-- ============================================
-- ADDITIONAL SCHEMA FOR API KEY MANAGEMENT
-- Add this to your existing SUPABASE-SCHEMA.sql
-- ============================================

-- Create private schema first (if it doesn't exist)
CREATE SCHEMA IF NOT EXISTS private;

-- Grant access to service role
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON SCHEMA private TO service_role;

-- Table to store OpenAI API keys (server-side only, not accessible from client)
CREATE TABLE IF NOT EXISTS private.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service TEXT NOT NULL, -- 'openai', 'anthropic', etc.
  key_name TEXT NOT NULL, -- 'default', 'backup', etc.
  api_key TEXT NOT NULL, -- Encrypted API key
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_service_key UNIQUE(service, key_name)
);

-- This table is in the private schema, not accessible via REST API
-- Only Edge Functions can access it

-- Grant access only to service role (backend only)
GRANT ALL ON private.api_keys TO service_role;

-- Insert your OpenAI API key (replace with your actual key)
-- Run this ONLY in SQL Editor, never expose this key to client
INSERT INTO private.api_keys (service, key_name, api_key)
VALUES ('openai', 'default', 'your-openai-api-key-here')
ON CONFLICT (service, key_name) 
DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = NOW();

-- Function to get active API key (only callable by Edge Functions)
CREATE OR REPLACE FUNCTION private.get_api_key(p_service TEXT)
RETURNS TEXT AS $$
DECLARE
  v_api_key TEXT;
BEGIN
  SELECT api_key INTO v_api_key
  FROM private.api_keys
  WHERE service = p_service
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to service role only
GRANT EXECUTE ON FUNCTION private.get_api_key TO service_role;
