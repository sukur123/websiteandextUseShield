/**
 * Prompt Engineering Module for Money Trap Analyzer
 * 
 * This module contains carefully crafted prompts to ensure consistent,
 * accurate analysis of Terms of Service and legal documents.
 */

import { Category, Severity } from './types.js';

/**
 * System prompt that establishes the AI's role and expertise
 */
const SYSTEM_PROMPT = `You are an expert consumer protection analyst and legal document reviewer with 15+ years of experience identifying predatory practices in Terms of Service, Privacy Policies, and similar legal documents.

Your expertise includes:
- Contract law and consumer rights
- Data privacy regulations (GDPR, CCPA, etc.)
- Subscription and billing practices
- Deceptive design patterns (dark patterns)
- Class action and arbitration clauses

Your analysis style:
- Thorough but concise
- Plain language that non-lawyers understand
- Action-oriented recommendations
- Risk-aware with severity ratings

You ALWAYS respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * Get the list of red flags to look for
 */
function getRedFlags() {
  return [
    // Critical - Immediate financial or legal risk
    { pattern: 'Forced arbitration clause', severity: 'critical', category: 'arbitration' },
    { pattern: 'Class action waiver', severity: 'critical', category: 'class_action_waiver' },
    { pattern: 'Selling personal data to third parties', severity: 'critical', category: 'data_selling' },
    { pattern: 'Hidden fees not disclosed upfront', severity: 'critical', category: 'fees' },
    { pattern: 'Auto-renewal without clear opt-out', severity: 'critical', category: 'auto_renewal' },
    { pattern: 'Trial converts to paid without notice', severity: 'critical', category: 'trial' },
    
    // High - Significant consumer concern
    { pattern: 'No refund policy', severity: 'high', category: 'refund' },
    { pattern: 'Prices can change without notice', severity: 'high', category: 'price_change' },
    { pattern: 'Difficult cancellation process', severity: 'high', category: 'cancellation' },
    { pattern: 'Broad data sharing with partners', severity: 'high', category: 'data_sharing' },
    { pattern: 'Account can be terminated without reason', severity: 'high', category: 'termination' },
    { pattern: 'Require 30+ day cancellation notice', severity: 'high', category: 'cancellation' },
    
    // Medium - Worth noting
    { pattern: 'Limited refund window (< 14 days)', severity: 'medium', category: 'refund' },
    { pattern: 'Auto-renewal with notice', severity: 'medium', category: 'auto_renewal' },
    { pattern: 'Usage data collection', severity: 'medium', category: 'data_sharing' },
    { pattern: 'Restocking fees', severity: 'medium', category: 'fees' },
    { pattern: 'Promotional pricing expires', severity: 'medium', category: 'price_change' },
    
    // Low - Standard but worth mentioning
    { pattern: 'Standard liability limitations', severity: 'low', category: 'liability' },
    { pattern: 'Reasonable data retention', severity: 'low', category: 'data_sharing' },
    { pattern: 'Service modifications reserved', severity: 'low', category: 'other' }
  ];
}

/**
 * Build the JSON schema for the expected response
 */
function getResponseSchema() {
  return {
    type: 'object',
    required: ['riskScore', 'riskLevel', 'summary', 'whatItMeans', 'whatToDo', 'findings', 'documentType', 'companyName'],
    properties: {
      riskScore: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Overall risk score from 0-100. 0-29=low, 30-59=medium, 60-79=high, 80-100=critical'
      },
      riskLevel: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Risk level based on score'
      },
      summary: {
        type: 'string',
        description: '2-3 sentence summary of the document fairness and main concerns'
      },
      whatItMeans: {
        type: 'string',
        description: 'Plain language explanation of what the findings mean for the average user (2-3 sentences)'
      },
      whatToDo: {
        type: 'string',
        description: 'Actionable advice on what the user should do (2-3 bullet points as text)'
      },
      documentType: {
        type: 'string',
        enum: ['terms_of_service', 'privacy_policy', 'refund_policy', 'billing_terms', 'user_agreement', 'cookie_policy', 'other'],
        description: 'Type of legal document detected'
      },
      companyName: {
        type: 'string',
        description: 'Name of the company/service if identifiable, or "Unknown"'
      },
      positives: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of 0-3 consumer-friendly aspects found (if any)'
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'category', 'severity', 'title', 'summary', 'quote', 'recommendation'],
          properties: {
            id: { type: 'string', description: 'Unique identifier like finding-1, finding-2' },
            category: { 
              type: 'string', 
              enum: Object.values(Category),
              description: 'Category of the issue'
            },
            severity: { 
              type: 'string', 
              enum: Object.values(Severity),
              description: 'Severity level'
            },
            title: { type: 'string', description: 'Short 5-10 word title' },
            summary: { type: 'string', description: 'Plain language explanation (1-2 sentences)' },
            quote: { type: 'string', description: 'Exact quote from document (max 200 chars, use ... for truncation)' },
            recommendation: { type: 'string', description: 'What user should do about this' },
            location: { type: 'string', description: 'Section name if identifiable, or null' },
            impactScore: { type: 'number', minimum: 1, maximum: 10, description: 'Impact on user 1-10' }
          }
        }
      }
    }
  };
}

/**
 * Build the main analysis prompt
 */
export function buildAnalysisPrompt({ url, title, text, pageType }) {
  const categories = Object.values(Category);
  const severities = Object.values(Severity);
  const redFlags = getRedFlags();
  const schema = getResponseSchema();

  const prompt = `${SYSTEM_PROMPT}

## YOUR TASK
Analyze the following legal document and identify ALL concerning clauses ("money traps") that could harm consumers.

## RISK SCORE CALCULATION
Calculate a risk score from 0-100 based on:
- Each CRITICAL finding adds 25-40 points
- Each HIGH finding adds 15-25 points  
- Each MEDIUM finding adds 5-15 points
- Each LOW finding adds 1-5 points
- Maximum score is 100

Risk Levels:
- 0-29: LOW (green) - Document is consumer-friendly
- 30-59: MEDIUM (yellow) - Some concerns, proceed with caution
- 60-79: HIGH (orange) - Significant concerns, reconsider
- 80-100: CRITICAL (red) - Major red flags, avoid if possible

## RED FLAGS TO LOOK FOR
${redFlags.map(f => `- ${f.pattern} (${f.severity}/${f.category})`).join('\n')}

## CATEGORIES
${categories.map(c => `- ${c}`).join('\n')}

## SEVERITY DEFINITIONS
- **critical**: Immediate financial/legal risk. Forced arbitration, class action waiver, data selling, hidden fees, auto-renewal traps, trial-to-paid without notice.
- **high**: Significant concern. No refunds, difficult cancellation, price changes without notice, broad data sharing, arbitrary termination.
- **medium**: Worth noting. Limited refund window, auto-renewal with notice, usage tracking, restocking fees.
- **low**: Standard practice. Liability limits, reasonable data retention, service modification rights.

## RESPONSE FORMAT
Respond with ONLY valid JSON matching this schema:
${JSON.stringify(schema, null, 2)}

## DOCUMENT TO ANALYZE
**URL**: ${url}
**Title**: ${title}
**Detected Page Type**: ${pageType || 'unknown'}

---BEGIN DOCUMENT---
${text}
---END DOCUMENT---

## IMPORTANT INSTRUCTIONS
1. Be thorough - identify ALL concerning clauses, not just obvious ones
2. Use plain language a teenager could understand
3. Include exact quotes (truncated with ... if over 200 chars)
4. Calculate risk score AFTER identifying all findings
5. If document is consumer-friendly, still note standard clauses as "low" severity
6. If you find fewer than 3 issues, double-check for subtle concerns
7. ALWAYS include whatItMeans and whatToDo with actionable advice
8. Identify any POSITIVE consumer protections (refund guarantees, easy cancellation, etc.)

OUTPUT ONLY THE JSON OBJECT. NO MARKDOWN. NO EXPLANATION.`;

  return prompt;
}

/**
 * Build a quick-check prompt for short documents
 */
export function buildQuickCheckPrompt({ url, title, text }) {
  return `${SYSTEM_PROMPT}

Quick analysis of this legal snippet. Respond with JSON only:
{
  "riskScore": 0-100,
  "riskLevel": "low|medium|high|critical", 
  "summary": "1 sentence summary",
  "topConcern": "Main issue or 'None' if clean",
  "recommendation": "1 sentence advice"
}

URL: ${url}
Title: ${title}
Text: ${text}

JSON only:`;
}

/**
 * Build a comparison prompt for two documents
 */
export function buildComparisonPrompt({ docA, docB }) {
  return `${SYSTEM_PROMPT}

Compare these two Terms of Service documents and determine which is more consumer-friendly.

## DOCUMENT A
URL: ${docA.url}
Title: ${docA.title}
Risk Score: ${docA.riskScore}
Key Issues: ${docA.findings?.map(f => f.title).join(', ') || 'None'}

## DOCUMENT B  
URL: ${docB.url}
Title: ${docB.title}
Risk Score: ${docB.riskScore}
Key Issues: ${docB.findings?.map(f => f.title).join(', ') || 'None'}

Respond with JSON only:
{
  "winner": "A" or "B",
  "winnerDomain": "domain of winner",
  "scoreDifference": number,
  "summary": "2-3 sentence comparison explaining why one is better",
  "keyDifferences": ["difference 1", "difference 2", "difference 3"],
  "recommendation": "Which service to choose and why"
}

JSON only:`;
}

/**
 * Build a change detection prompt
 */
export function buildChangeDetectionPrompt({ oldFindings, newText, url }) {
  return `${SYSTEM_PROMPT}

A Terms of Service document has been updated. Compare the previous analysis with the new document to identify what changed.

## PREVIOUS FINDINGS
${JSON.stringify(oldFindings, null, 2)}

## NEW DOCUMENT TEXT
${newText}

## URL
${url}

Respond with JSON only:
{
  "hasSignificantChanges": boolean,
  "changeType": "better" | "worse" | "neutral",
  "summary": "1-2 sentence summary of changes",
  "newIssues": [{ "title": "", "severity": "", "description": "" }],
  "resolvedIssues": [{ "title": "", "description": "" }],
  "recommendation": "What user should know about these changes"
}

JSON only:`;
}

/**
 * Validate and clean AI response
 */
export function validateAnalysisResponse(data) {
  // Ensure required fields exist
  const result = {
    riskScore: typeof data.riskScore === 'number' ? Math.min(100, Math.max(0, data.riskScore)) : 50,
    riskLevel: ['low', 'medium', 'high', 'critical'].includes(data.riskLevel) ? data.riskLevel : 'medium',
    summary: typeof data.summary === 'string' ? data.summary : 'Analysis completed.',
    whatItMeans: typeof data.whatItMeans === 'string' ? data.whatItMeans : '',
    whatToDo: typeof data.whatToDo === 'string' ? data.whatToDo : '',
    documentType: data.documentType || 'other',
    companyName: data.companyName || 'Unknown',
    positives: Array.isArray(data.positives) ? data.positives : [],
    findings: []
  };

  // Validate risk level matches score
  if (result.riskScore < 30) result.riskLevel = 'low';
  else if (result.riskScore < 60) result.riskLevel = 'medium';
  else if (result.riskScore < 80) result.riskLevel = 'high';
  else result.riskLevel = 'critical';

  // Validate findings
  if (Array.isArray(data.findings)) {
    const validCategories = new Set(Object.values(Category));
    const validSeverities = new Set(Object.values(Severity));

    result.findings = data.findings
      .filter(f => f && typeof f === 'object')
      .map((f, i) => ({
        id: f.id || `finding-${i + 1}`,
        category: validCategories.has(f.category) ? f.category : Category.OTHER,
        severity: validSeverities.has(f.severity) ? f.severity : Severity.MEDIUM,
        title: typeof f.title === 'string' ? f.title.slice(0, 100) : 'Unspecified Issue',
        summary: typeof f.summary === 'string' ? f.summary : '',
        quote: typeof f.quote === 'string' ? f.quote.slice(0, 250) : '',
        recommendation: typeof f.recommendation === 'string' ? f.recommendation : '',
        location: typeof f.location === 'string' ? f.location : null,
        impactScore: typeof f.impactScore === 'number' ? Math.min(10, Math.max(1, f.impactScore)) : 5
      }));
  }

  // Generate whatItMeans if empty
  if (!result.whatItMeans) {
    const criticalCount = result.findings.filter(f => f.severity === 'critical').length;
    const highCount = result.findings.filter(f => f.severity === 'high').length;
    
    if (criticalCount > 0) {
      result.whatItMeans = `This document contains ${criticalCount} critical issue(s) that could significantly impact your rights or finances. You may be waiving important legal rights or agreeing to terms that are difficult to reverse.`;
    } else if (highCount > 0) {
      result.whatItMeans = `This document has ${highCount} high-concern clause(s) worth careful consideration. These may affect your ability to get refunds, cancel services, or control your data.`;
    } else if (result.findings.length > 0) {
      result.whatItMeans = `This document contains some standard clauses that favor the company. While not unusual, you should be aware of the limitations and conditions.`;
    } else {
      result.whatItMeans = `This document appears relatively consumer-friendly with no major concerns identified.`;
    }
  }

  // Generate whatToDo if empty
  if (!result.whatToDo) {
    const actions = [];
    
    if (result.riskScore >= 80) {
      actions.push('Consider alternatives to this service');
      actions.push('Read the full terms before agreeing');
      actions.push('Document any promises made outside the ToS');
    } else if (result.riskScore >= 60) {
      actions.push('Review the highlighted concerns carefully');
      actions.push('Set calendar reminders for trial endings or renewals');
      actions.push('Save a copy of the current terms');
    } else if (result.riskScore >= 30) {
      actions.push('Note the refund and cancellation policies');
      actions.push('Be aware of auto-renewal dates');
    } else {
      actions.push('Terms appear fair - proceed normally');
      actions.push('Still review any payment commitments');
    }
    
    result.whatToDo = actions.join('. ') + '.';
  }

  return result;
}

export default {
  buildAnalysisPrompt,
  buildQuickCheckPrompt,
  buildComparisonPrompt,
  buildChangeDetectionPrompt,
  validateAnalysisResponse
};
