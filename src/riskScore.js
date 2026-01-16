import { Category, Severity, SeverityWeight, getRiskLevel, RiskThresholds } from './types.js';

/**
 * Calculate risk score from findings array
 * @param {Array} findings - Array of Clause objects
 * @returns {number} 0-100 risk score
 */
export function calculateRiskScore(findings) {
  if (!findings || findings.length === 0) return 0;

  let totalWeight = 0;
  const categoryPenalties = {};

  for (const finding of findings) {
    const weight = SeverityWeight[finding.severity] || SeverityWeight[Severity.LOW];
    totalWeight += weight;

    // Additional penalty for multiple issues in same critical category
    const cat = finding.category;
    if ([Category.AUTO_RENEWAL, Category.ARBITRATION, Category.DATA_SELLING, Category.FEES].includes(cat)) {
      categoryPenalties[cat] = (categoryPenalties[cat] || 0) + 5;
    }
  }

  // Add category penalties (capped)
  const extraPenalty = Math.min(Object.values(categoryPenalties).reduce((a, b) => a + b, 0), 20);
  totalWeight += extraPenalty;

  // Normalize to 0-100, cap at 100
  const score = Math.min(Math.round(totalWeight), 100);
  return score;
}

/**
 * Get stats breakdown by category and severity
 * @param {Array} findings
 * @returns {Object} stats object
 */
export function getStats(findings) {
  const byCategory = {};
  const bySeverity = {
    [Severity.LOW]: 0,
    [Severity.MEDIUM]: 0,
    [Severity.HIGH]: 0,
    [Severity.CRITICAL]: 0
  };

  for (const finding of findings) {
    byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
  }

  return { byCategory, bySeverity, total: findings.length };
}

/**
 * Generate plain-language summary from findings
 * @param {number} riskScore
 * @param {Array} findings
 * @returns {{ whatItMeans: string, whatToDo: string }}
 */
export function generatePlainLanguageSummary(riskScore, findings) {
  const level = getRiskLevel(riskScore);
  const stats = getStats(findings);

  let whatItMeans = '';
  let whatToDo = '';

  // Risk level intro
  if (level === 'low') {
    whatItMeans = 'This document appears relatively consumer-friendly with few concerning clauses. ';
    whatToDo = 'While this looks reasonable, still read key sections before agreeing. ';
  } else if (level === 'medium') {
    whatItMeans = 'This document has some clauses that could affect you financially or limit your rights. ';
    whatToDo = 'Pay attention to the highlighted issues before signing up. Consider alternatives if the terms don\'t work for you. ';
  } else if (level === 'high') {
    whatItMeans = 'This document contains several concerning clauses that could cost you money or significantly limit your rights. ';
    whatToDo = 'Proceed with caution. Make sure you understand the cancellation and refund policies. Set calendar reminders for any trial periods. ';
  } else {
    whatItMeans = 'This document has multiple red flags that strongly favor the company over consumers. ';
    whatToDo = 'We recommend carefully reconsidering this service. If you proceed, document everything, use virtual payment methods, and set reminders for all deadlines. ';
  }

  // Add specific warnings based on categories found
  const criticalCategories = [];
  if (stats.byCategory[Category.AUTO_RENEWAL]) criticalCategories.push('auto-renewal');
  if (stats.byCategory[Category.ARBITRATION]) criticalCategories.push('forced arbitration');
  if (stats.byCategory[Category.DATA_SELLING]) criticalCategories.push('data selling');
  if (stats.byCategory[Category.FEES]) criticalCategories.push('hidden fees');
  if (stats.byCategory[Category.REFUND]) criticalCategories.push('refund restrictions');

  if (criticalCategories.length > 0) {
    whatItMeans += `Key concerns include: ${criticalCategories.join(', ')}.`;
  }

  if (stats.byCategory[Category.TRIAL]) {
    whatToDo += 'Set a reminder before any trial period ends. ';
  }
  if (stats.byCategory[Category.CANCELLATION]) {
    whatToDo += 'Note exactly how and when you can cancel. ';
  }

  return { whatItMeans: whatItMeans.trim(), whatToDo: whatToDo.trim() };
}

/**
 * Sort findings by severity (critical first)
 * @param {Array} findings
 * @returns {Array} sorted findings
 */
export function sortFindingsBySeverity(findings) {
  const order = { [Severity.CRITICAL]: 0, [Severity.HIGH]: 1, [Severity.MEDIUM]: 2, [Severity.LOW]: 3 };
  return [...findings].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
}
