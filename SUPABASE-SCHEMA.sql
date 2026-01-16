-- ============================================
-- SUPABASE DATABASE SCHEMA
-- Money Trap Analyzer Extension
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUBSCRIPTIONS TABLE
-- Stores user subscription data and usage limits
-- ============================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Subscription details
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'pro_plus', 'agency')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'trialing')),
  
  -- Usage tracking
  scans_used INTEGER NOT NULL DEFAULT 0,
  scans_limit INTEGER NOT NULL DEFAULT 3,
  
  -- Payment info (supports both legacy license keys and PayPal)
  license_key TEXT UNIQUE,
  payment_id TEXT,
  paypal_subscription_id TEXT UNIQUE,
  paypal_payer_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_subscription UNIQUE(user_id)
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_license_key ON public.subscriptions(license_key);

-- ============================================
-- USAGE TRACKING TABLE
-- Detailed log of each analysis performed
-- ============================================

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Analysis details
  url TEXT NOT NULL,
  risk_score INTEGER,
  
  -- Timestamps
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  ip_address INET,
  user_agent TEXT
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON public.usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_date ON public.usage_tracking(analysis_date DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensure users can only access their own data
-- ============================================

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usage tracking policies
CREATE POLICY "Users can view own usage"
  ON public.usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage"
  ON public.usage_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- DATABASE FUNCTIONS
-- Business logic for subscription management
-- ============================================

-- Function: Create free subscription for new users
CREATE OR REPLACE FUNCTION public.create_free_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, scans_limit)
  VALUES (NEW.id, 'free', 3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create free subscription on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_free_subscription();

-- Function: Increment scan usage
CREATE OR REPLACE FUNCTION public.increment_scan_usage(
  p_user_id UUID,
  p_url TEXT,
  p_risk_score INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Get current subscription
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for user';
  END IF;

  -- Check if limit reached
  IF v_subscription.scans_used >= v_subscription.scans_limit THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usage limit reached',
      'scans_used', v_subscription.scans_used,
      'scans_limit', v_subscription.scans_limit
    );
  END IF;

  -- Increment usage
  UPDATE public.subscriptions
  SET scans_used = scans_used + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log usage
  INSERT INTO public.usage_tracking (user_id, url, risk_score)
  VALUES (p_user_id, p_url, p_risk_score);

  -- Return success
  RETURN json_build_object(
    'success', true,
    'scans_used', v_subscription.scans_used + 1,
    'scans_limit', v_subscription.scans_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reset weekly usage (for free tier)
CREATE OR REPLACE FUNCTION public.reset_weekly_usage()
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET scans_used = 0,
      last_reset_at = NOW(),
      updated_at = NOW()
  WHERE tier = 'free'
    AND last_reset_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reset monthly usage (for paid tiers)
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET scans_used = 0,
      last_reset_at = NOW(),
      updated_at = NOW()
  WHERE tier IN ('starter', 'pro', 'pro_plus', 'agency')
    AND last_reset_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Upgrade subscription
CREATE OR REPLACE FUNCTION public.upgrade_subscription(
  p_user_id UUID,
  p_tier TEXT,
  p_license_key TEXT DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_scans_limit INTEGER;
BEGIN
  -- Set scans limit based on tier
  v_scans_limit := CASE p_tier
    WHEN 'free' THEN 3
    WHEN 'starter' THEN 15
    WHEN 'pro' THEN 80
    WHEN 'pro_plus' THEN 200
    WHEN 'agency' THEN 300
    ELSE 3
  END;

  -- Update subscription
  UPDATE public.subscriptions
  SET tier = p_tier,
      scans_limit = v_scans_limit,
      scans_used = 0,
      license_key = COALESCE(p_license_key, license_key),
      payment_id = COALESCE(p_payment_id, payment_id),
      status = 'active',
      expires_at = CASE 
        WHEN p_tier = 'free' THEN NULL
        ELSE NOW() + INTERVAL '30 days'
      END,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'tier', p_tier,
    'scans_limit', v_scans_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- EDGE FUNCTIONS (Optional - for webhooks)
-- ============================================

-- This would be deployed as a Supabase Edge Function
-- For handling payment webhooks from Stripe/Paddle/etc.

/*
// File: supabase/functions/payment-webhook/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const payload = await req.json()
  
  // Verify webhook signature (Stripe/Paddle specific)
  
  // Handle different event types
  if (payload.event_type === 'subscription_created') {
    await supabase.rpc('upgrade_subscription', {
      p_user_id: payload.user_id,
      p_tier: payload.tier,
      p_license_key: payload.license_key,
      p_payment_id: payload.payment_id
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
*/

-- ============================================
-- SCHEDULED JOBS (Using pg_cron extension)
-- ============================================

-- Note: pg_cron is available on Supabase Pro plan
-- Alternatively, use Supabase Edge Functions with cron triggers

-- Reset free tier weekly
-- SELECT cron.schedule('reset-weekly-usage', '0 0 * * 1', 'SELECT public.reset_weekly_usage()');

-- Reset paid tier monthly
-- SELECT cron.schedule('reset-monthly-usage', '0 0 1 * *', 'SELECT public.reset_monthly_usage()');

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Example: Create test subscription
-- INSERT INTO public.subscriptions (user_id, tier, scans_limit)
-- VALUES ('your-test-user-uuid', 'pro', 100);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant authenticated users access to tables
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT ON public.usage_tracking TO authenticated;

-- Grant service role full access (for edge functions)
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.usage_tracking TO service_role;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.subscriptions IS 'User subscription plans and usage limits';
COMMENT ON TABLE public.usage_tracking IS 'Detailed log of all analyses performed by users';
COMMENT ON FUNCTION public.increment_scan_usage IS 'Atomically increment scan counter and log usage';
COMMENT ON FUNCTION public.upgrade_subscription IS 'Upgrade user to a paid tier';
COMMENT ON FUNCTION public.reset_weekly_usage IS 'Reset free tier usage counters weekly';
COMMENT ON FUNCTION public.reset_monthly_usage IS 'Reset paid tier usage counters monthly';
