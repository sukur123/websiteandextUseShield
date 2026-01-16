// Supabase Edge Function: PayPal Webhook Handler
// Deploy to: supabase functions deploy paypal-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// PayPal API endpoints
const PAYPAL_API = {
    sandbox: 'https://api-m.sandbox.paypal.com',
    production: 'https://api-m.paypal.com'
}

// Get environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')!
const PAYPAL_MODE = Deno.env.get('PAYPAL_MODE') || 'sandbox'

// Tier configuration
const TIER_CONFIG: Record<string, { scansLimit: number }> = {
    free: { scansLimit: 3 },
    starter: { scansLimit: 15 },
    pro: { scansLimit: 80 },
    pro_plus: { scansLimit: 200 },
    agency: { scansLimit: 300 }
}

/**
 * Get PayPal access token
 */
async function getPayPalAccessToken(): Promise<string> {
    const baseUrl = PAYPAL_API[PAYPAL_MODE as keyof typeof PAYPAL_API]
    const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
        throw new Error('Failed to get PayPal access token')
    }

    const data = await response.json()
    return data.access_token
}

/**
 * Verify PayPal webhook signature
 * https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 */
async function verifyWebhookSignature(
    webhookId: string,
    headers: Headers,
    body: string
): Promise<boolean> {
    try {
        const accessToken = await getPayPalAccessToken()
        const baseUrl = PAYPAL_API[PAYPAL_MODE as keyof typeof PAYPAL_API]

        const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth_algo: headers.get('paypal-auth-algo'),
                cert_url: headers.get('paypal-cert-url'),
                transmission_id: headers.get('paypal-transmission-id'),
                transmission_sig: headers.get('paypal-transmission-sig'),
                transmission_time: headers.get('paypal-transmission-time'),
                webhook_id: webhookId,
                webhook_event: JSON.parse(body)
            })
        })

        if (!response.ok) {
            console.error('Webhook verification failed:', await response.text())
            return false
        }

        const result = await response.json()
        return result.verification_status === 'SUCCESS'
    } catch (error) {
        console.error('Error verifying webhook:', error)
        return false
    }
}

/**
 * Get subscription details from PayPal
 */
async function getSubscriptionDetails(subscriptionId: string): Promise<any> {
    const accessToken = await getPayPalAccessToken()
    const baseUrl = PAYPAL_API[PAYPAL_MODE as keyof typeof PAYPAL_API]

    const response = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    })

    if (!response.ok) {
        throw new Error('Failed to get subscription details')
    }

    return response.json()
}

/**
 * Determine tier from plan ID
 * This maps PayPal plan IDs to our tier names
 */
function getTierFromPlanId(planId: string): string {
    // These should match the plan IDs in your PayPal dashboard
    const planToTier: Record<string, string> = {
        // Add your actual plan IDs here
        'P-STARTER-SANDBOX-PLAN-ID': 'starter',
        'P-PRO-SANDBOX-PLAN-ID': 'pro',
        'P-PROPLUS-SANDBOX-PLAN-ID': 'pro_plus',
        'P-AGENCY-SANDBOX-PLAN-ID': 'agency',
        // Production plan IDs
        'P-STARTER-PRODUCTION-PLAN-ID': 'starter',
        'P-PRO-PRODUCTION-PLAN-ID': 'pro',
        'P-PROPLUS-PRODUCTION-PLAN-ID': 'pro_plus',
        'P-AGENCY-PRODUCTION-PLAN-ID': 'agency'
    }

    return planToTier[planId] || 'starter' // Default to starter if unknown
}

serve(async (req) => {
    // CORS headers
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        })
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    try {
        const body = await req.text()
        const event = JSON.parse(body)
        const eventType = event.event_type

        console.log('Received PayPal webhook:', eventType)

        // Initialize Supabase client with service role key
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        // Handle different event types
        switch (eventType) {
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
            case 'BILLING.SUBSCRIPTION.CREATED': {
                // New subscription created and activated
                const subscriptionId = event.resource.id
                const payerId = event.resource.subscriber?.payer_id
                const email = event.resource.subscriber?.email_address
                const planId = event.resource.plan_id
                const tier = getTierFromPlanId(planId)
                const tierConfig = TIER_CONFIG[tier]

                console.log(`Activating subscription: ${subscriptionId} for tier: ${tier}`)

                // Find user by email
                const { data: users, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', email)
                    .single()

                if (userError || !users) {
                    console.error('User not found for email:', email)
                    // Still return 200 to acknowledge webhook
                    break
                }

                // Update subscription
                const { error: updateError } = await supabase
                    .from('subscriptions')
                    .update({
                        tier: tier,
                        status: 'active',
                        paypal_subscription_id: subscriptionId,
                        paypal_payer_id: payerId,
                        scans_limit: tierConfig.scansLimit,
                        scans_used: 0,
                        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', users.id)

                if (updateError) {
                    console.error('Error updating subscription:', updateError)
                } else {
                    console.log('Subscription activated successfully')
                }
                break
            }

            case 'BILLING.SUBSCRIPTION.CANCELLED': {
                // User cancelled subscription
                const subscriptionId = event.resource.id

                console.log(`Cancelling subscription: ${subscriptionId}`)

                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        status: 'canceled',
                        auto_renew: false,
                        updated_at: new Date().toISOString()
                    })
                    .eq('paypal_subscription_id', subscriptionId)

                if (error) {
                    console.error('Error cancelling subscription:', error)
                }
                break
            }

            case 'BILLING.SUBSCRIPTION.EXPIRED': {
                // Subscription expired
                const subscriptionId = event.resource.id

                console.log(`Expiring subscription: ${subscriptionId}`)

                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        tier: 'free',
                        status: 'expired',
                        scans_limit: 3,
                        paypal_subscription_id: null,
                        paypal_payer_id: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('paypal_subscription_id', subscriptionId)

                if (error) {
                    console.error('Error expiring subscription:', error)
                }
                break
            }

            case 'BILLING.SUBSCRIPTION.SUSPENDED': {
                // Payment failed, subscription suspended
                const subscriptionId = event.resource.id

                console.log(`Suspending subscription: ${subscriptionId}`)

                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        status: 'suspended',
                        updated_at: new Date().toISOString()
                    })
                    .eq('paypal_subscription_id', subscriptionId)

                if (error) {
                    console.error('Error suspending subscription:', error)
                }
                break
            }

            case 'PAYMENT.SALE.COMPLETED': {
                // Recurring payment successful
                const parentPayment = event.resource.billing_agreement_id

                console.log(`Payment completed for subscription: ${parentPayment}`)

                // Reset monthly scan counter and extend expiry
                if (parentPayment) {
                    const { data: sub } = await supabase
                        .from('subscriptions')
                        .select('tier')
                        .eq('paypal_subscription_id', parentPayment)
                        .single()

                    if (sub) {
                        const { error } = await supabase
                            .from('subscriptions')
                            .update({
                                scans_used: 0,
                                status: 'active',
                                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                                last_reset_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            })
                            .eq('paypal_subscription_id', parentPayment)

                        if (error) {
                            console.error('Error resetting scan counter:', error)
                        } else {
                            console.log('Scan counter reset for renewal')
                        }
                    }
                }
                break
            }

            default:
                console.log('Unhandled event type:', eventType)
        }

        // Always return 200 to acknowledge receipt
        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        })

    } catch (error) {
        console.error('Webhook error:', error)

        // Still return 200 to prevent PayPal from retrying
        return new Response(JSON.stringify({ error: 'Internal error' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
