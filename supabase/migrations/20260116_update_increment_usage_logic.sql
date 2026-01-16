-- Function: Increment scan usage with auto-reset logic
-- Drop existing first to avoid conflicts
DROP FUNCTION IF EXISTS public.increment_scan_usage;

CREATE OR REPLACE FUNCTION public.increment_scan_usage(
  p_user_id UUID,
  p_url TEXT,
  p_risk_score INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_subscription RECORD;
  v_reset_interval INTERVAL;
  v_should_reset BOOLEAN;
BEGIN
  -- Get current subscription
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  -- Create subscription if not exists (default to free)
  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (user_id, tier, scans_limit, scans_used)
    VALUES (p_user_id, 'free', 3, 0)
    RETURNING * INTO v_subscription;
  END IF;

  -- Determine reset interval based on tier
  v_reset_interval := CASE 
    WHEN v_subscription.tier = 'free' THEN INTERVAL '7 days'
    ELSE INTERVAL '30 days'
  END;

  -- Check if we need to reset usage
  v_should_reset := v_subscription.last_reset_at < (NOW() - v_reset_interval);

  IF v_should_reset THEN
    -- Reset usage
    UPDATE public.subscriptions
    SET scans_used = 0,
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Update local variable to reflect reset
    v_subscription.scans_used := 0;
  END IF;

  -- Check limit
  IF v_subscription.scans_used >= v_subscription.scans_limit THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usage limit reached',
      'scans_used', v_subscription.scans_used,
      'scans_limit', v_subscription.scans_limit,
      'period', CASE WHEN v_subscription.tier = 'free' THEN 'week' ELSE 'month' END
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
