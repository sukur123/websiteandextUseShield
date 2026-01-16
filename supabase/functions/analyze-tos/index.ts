/**
 * Supabase Edge Function: analyze-tos
 * 
 * This function securely calls OpenAI API from the server side.
 * The API key is never exposed to the client.
 * 
 * Deploy this to: supabase/functions/analyze-tos/index.ts
 * 
 * How to deploy:
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Login: supabase login
 * 3. Link project: supabase link --project-ref fmptjjpwndojeywyacum
 * 4. Deploy: supabase functions deploy analyze-tos
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role (has access to private schema)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check subscription and usage limits
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError || !subscription) {
      throw new Error('No active subscription found')
    }

    // Check if user has scans remaining
    if (subscription.scans_used >= subscription.scans_limit) {
      return new Response(
        JSON.stringify({
          error: 'Usage limit reached',
          message: `You've used ${subscription.scans_used} of ${subscription.scans_limit} scans. Upgrade your plan for more.`
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { url, text, title, maxChars = 20000, analysisMode = 'standard', customPrompt = '' } = await req.json()

    console.log('[Edge Function] Request params:', {
      url,
      textLength: text?.length || 0,
      maxChars,
      analysisMode,
      hasCustomPrompt: !!customPrompt
    })

    if (!text) {
      throw new Error('Missing text to analyze')
    }

    // Validate analysis mode against subscription tier
    const tierLevelMap = { free: 0, starter: 1, pro: 2, pro_plus: 3, agency: 4 }
    // Allow Standard analysis for free users (uses gpt-4o-mini anyway, just restricted by scan limits)
    const modeTierMap = { flash: 0, standard: 0, deepdive: 3, neural: 4 }
    const userTierLevel = tierLevelMap[subscription.tier] || 0
    const requiredTierLevel = modeTierMap[analysisMode] || 1

    console.log('[Edge Function] Tier validation:', {
      subscriptionTier: subscription.tier,
      userTierLevel,
      analysisMode,
      requiredTierLevel,
      hasAccess: userTierLevel >= requiredTierLevel
    })

    if (userTierLevel < requiredTierLevel) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient tier',
          message: `${analysisMode} analysis requires ${Object.keys(tierLevelMap).find(k => tierLevelMap[k] === requiredTierLevel)} tier or higher`,
          currentTier: subscription.tier,
          requiredTier: Object.keys(tierLevelMap).find(k => tierLevelMap[k] === requiredTierLevel)
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Configure analysis based on mode
    const analysisConfig = {
      flash: { maxChars: 10000, model: 'gpt-4o-mini', temp: 0.3, detail: 'quick' },
      standard: { maxChars: 20000, model: 'gpt-4o-mini', temp: 0.3, detail: 'balanced' },
      deepdive: { maxChars: 50000, model: 'gpt-4o', temp: 0.2, detail: 'comprehensive' },
      neural: { maxChars: 100000, model: 'gpt-4o', temp: 0.1, detail: 'advanced' }
    }

    const config = analysisConfig[analysisMode] || analysisConfig.standard
    const effectiveMaxChars = Math.min(maxChars, config.maxChars)

    // Truncate text if needed
    const truncatedText = text.slice(0, effectiveMaxChars)

    // Get OpenAI API key from private schema
    const { data: apiKeyData, error: keyError } = await supabaseAdmin.rpc(
      'get_api_key',
      { p_service: 'openai' }
    )

    if (keyError || !apiKeyData) {
      throw new Error('Failed to retrieve API key')
    }

    // Build system prompt based on analysis mode
    const systemPrompts = {
      flash: `You are a legal analyst doing a QUICK SCAN. Focus ONLY on critical red flags and major issues. Return 3-7 findings maximum.

JSON structure:
{
  "findings": [{ "category": "CANCELLATION|REFUND|DATA_PRIVACY|LIABILITY|AUTO_RENEWAL|BINDING_ARBITRATION|CLASS_ACTION_WAIVER|JURISDICTION|PRICE_CHANGE|ACCOUNT_TERMINATION|CONTENT_RIGHTS|WARRANTY|INDEMNITY|SURVIVAL", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "clause": "exact quote", "explanation": "why concerning", "location": "section ref" }],
  "riskScore": 0-100,
  "whatItMeans": "brief summary",
  "whatToDo": "quick advice",
  "redFlags": ["warnings"],
  "positives": ["good aspects"]
}`,
      standard: `You are an expert legal analyst. Provide BALANCED analysis covering key issues across all categories. Return 5-12 findings.

JSON structure:
{
  "findings": [{ "category": "CANCELLATION|REFUND|DATA_PRIVACY|LIABILITY|AUTO_RENEWAL|BINDING_ARBITRATION|CLASS_ACTION_WAIVER|JURISDICTION|PRICE_CHANGE|ACCOUNT_TERMINATION|CONTENT_RIGHTS|WARRANTY|INDEMNITY|SURVIVAL", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "clause": "exact quote", "explanation": "detailed reasoning", "location": "section ref" }],
  "riskScore": 0-100,
  "whatItMeans": "comprehensive summary",
  "whatToDo": "actionable steps",
  "redFlags": ["key warnings"],
  "positives": ["consumer protections"]
}`,
      deepdive: `You are a senior legal analyst with expertise in consumer protection law. Conduct COMPREHENSIVE analysis with legal context, precedents, and industry comparisons. Return 10-25 findings with detailed explanations.

JSON structure:
{
  "findings": [{ "category": "CANCELLATION|REFUND|DATA_PRIVACY|LIABILITY|AUTO_RENEWAL|BINDING_ARBITRATION|CLASS_ACTION_WAIVER|JURISDICTION|PRICE_CHANGE|ACCOUNT_TERMINATION|CONTENT_RIGHTS|WARRANTY|INDEMNITY|SURVIVAL", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "clause": "exact quote with context", "explanation": "legal analysis with precedents", "location": "precise section" }],
  "riskScore": 0-100,
  "whatItMeans": "detailed legal implications",
  "whatToDo": "strategic recommendations",
  "redFlags": ["critical legal risks"],
  "positives": ["protective clauses"]
}`,
      neural: `You are an elite legal AI with advanced reasoning capabilities. Perform NEURAL SYNTHESIS: deep pattern recognition, cross-reference case law, identify subtle manipulation tactics, predict enforcement scenarios, and provide strategic legal insights. This is the most thorough analysis possible. Return 15-30 findings with extensive legal reasoning.

JSON structure:
{
  "findings": [{ "category": "CANCELLATION|REFUND|DATA_PRIVACY|LIABILITY|AUTO_RENEWAL|BINDING_ARBITRATION|CLASS_ACTION_WAIVER|JURISDICTION|PRICE_CHANGE|ACCOUNT_TERMINATION|CONTENT_RIGHTS|WARRANTY|INDEMNITY|SURVIVAL", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "clause": "full context quote", "explanation": "multi-layered legal analysis with case citations, enforcement history, and strategic implications", "location": "exact section with surrounding context" }],
  "riskScore": 0-100,
  "whatItMeans": "comprehensive legal risk assessment with industry context",
  "whatToDo": "detailed strategic action plan with alternatives",
  "redFlags": ["all legal vulnerabilities with severity justification"],
  "positives": ["all consumer protections with legal strength assessment"]
}`
    }

    const systemPrompt = systemPrompts[analysisMode] || systemPrompts.standard

    // Allow Pro Plus and Agency users to override with custom prompt
    const finalSystemPrompt = (customPrompt && userTierLevel >= 3)
      ? customPrompt
      : systemPrompt

    if (customPrompt && userTierLevel < 3) {
      console.log('[Edge Function] Custom prompt ignored - tier too low:', subscription.tier)
    }

    console.log('[Edge Function] Using system prompt:', {
      isCustom: !!(customPrompt && userTierLevel >= 3),
      promptLength: finalSystemPrompt.length
    })

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyData}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: finalSystemPrompt
          },
          {
            role: 'user',
            content: `Analyze this Terms of Service document and identify concerning clauses:\n\nTitle: ${title || 'Terms of Service'}\nURL: ${url || 'Unknown'}\n\n${truncatedText}`
          }
        ],
        temperature: config.temp,
        response_format: { type: 'json_object' }
      })
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      throw new Error(`OpenAI API error: ${errorText}`)
    }

    const openaiData = await openaiResponse.json()
    const analysisText = openaiData.choices[0]?.message?.content

    if (!analysisText) {
      throw new Error('No response from OpenAI')
    }

    // Parse and validate the response
    let analysis
    try {
      analysis = JSON.parse(analysisText)
    } catch (e) {
      throw new Error('Invalid JSON response from OpenAI')
    }

    // Increment usage counter
    const { error: usageError } = await supabaseAdmin.rpc('increment_scan_usage', {
      p_user_id: user.id,
      p_url: url || 'unknown',
      p_risk_score: analysis.riskScore || 0
    })

    if (usageError) {
      console.error('Failed to increment usage:', usageError)
      // Don't fail the request, just log the error
    }

    // Return the analysis
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...analysis,
          analyzed_at: new Date().toISOString(),
          scans_used: subscription.scans_used + 1,
          scans_limit: subscription.scans_limit
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
