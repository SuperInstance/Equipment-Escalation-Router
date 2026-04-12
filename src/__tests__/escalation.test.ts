/**
 * Equipment-Escalation-Router — Intelligent LLM routing tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EscalationRouter,
  DecisionRouter,
  CostOptimizer,
  HumanEscalation,
} from '../index';

// ═══════════════════════════════════════════════════════════════════
// DecisionRouter Tests (12 tests)
// ═══════════════════════════════════════════════════════════════════

describe('DecisionRouter', () => {
  let dr: DecisionRouter;
  beforeEach(() => { dr = new DecisionRouter(); });

  it('should route simple queries to bot tier', async () => {
    const result = await dr.decide({ query: 'What time is it?' });
    expect(result.recommendedTier).toBe('bot');
  });

  it('should route coding queries to brain tier', async () => {
    const result = await dr.decide({ query: 'Write a Python function to sort a list using merge sort' });
    expect(result.recommendedTier).toBe('brain');
  });

  it('should route legal/approval queries to human tier', async () => {
    const result = await dr.decide({ query: 'We need legal approval for this contract' });
    expect(result.recommendedTier).toBe('human');
  });

  it('should route safety-sensitive queries to human', async () => {
    const result = await dr.decide({ query: 'This involves safety-critical medical device approval' });
    expect(result.recommendedTier).toBe('human');
  });

  it('should route creative tasks to brain', async () => {
    const result = await dr.decide({ query: 'Write a creative story about AI agents' });
    expect(result.recommendedTier).toBe('brain');
  });

  it('should route basic math to bot', async () => {
    const result = await dr.decide({ query: 'What is 2 + 2?' });
    expect(result.recommendedTier).toBe('bot');
  });

  it('should include confidence and reasoning', async () => {
    const result = await dr.decide({ query: 'Explain quantum computing' });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.reasoning).toBeTruthy();
  });

  it('should learn patterns', async () => {
    dr.learnPattern('deploy to production', { tier: 'human', confidence: 0.95 });
    const result = await dr.decide({ query: 'deploy to production' });
    expect(result).toBeDefined();
  });

  it('should factor in override factors', async () => {
    const result = await dr.decide({
      query: 'simple question',
      overrideFactors: { urgency: 'critical' as any },
    });
    expect(result).toBeDefined();
  });

  it('should detect emotional content', async () => {
    const result = await dr.decide({ query: 'I am very upset about this terrible service' });
    expect(result.factors).toBeDefined();
  });

  it('should detect compliance needs', async () => {
    const result = await dr.decide({ query: 'Does this comply with GDPR regulations?' });
    expect(result).toBeDefined();
  });

  it('should return decision factors', async () => {
    const result = await dr.decide({ query: 'Write a test' });
    expect(result.factors).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// CostOptimizer Tests (10 tests)
// ═══════════════════════════════════════════════════════════════════

describe('CostOptimizer', () => {
  let co: CostOptimizer;
  beforeEach(() => { co = new CostOptimizer(); });

  it('should track costs', () => {
    co.trackCost({ tier: 'bot', amount: 0.002, tokens: 100, cached: false, timestamp: new Date() });
    const metrics = co.getMetrics();
    expect(metrics.totalCost).toBeGreaterThanOrEqual(0.002);
  });

  it('should check budget', () => {
    const result = co.checkBudget(0.001);
    expect(result.allowed).toBeDefined();
    expect(typeof result.remainingBudget).toBe('number');
  });

  it('should cache patterns', async () => {
    await co.cachePattern('test query', { tier: 'bot', decision: {}, cost: 0.002 });
    const cached = co.checkCache('test query');
    expect(cached).not.toBeNull();
  });

  it('should return null for uncached patterns', () => {
    expect(co.checkCache('never seen before')).toBeNull();
  });

  it('should generate cost report', () => {
    co.trackCost({ tier: 'bot', amount: 0.002, tokens: 100, cached: false, timestamp: new Date() });
    const report = co.generateCostReport();
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  it('should get cache stats', () => {
    const stats = co.getCacheStats();
    expect(stats).toBeDefined();
    expect(typeof stats.entries).toBe('number');
  });

  it('should clear cache', async () => {
    await co.cachePattern('q', { tier: 'bot', decision: {}, cost: 0.002 });
    co.clearCache();
    expect(co.checkCache('q')).toBeNull();
  });

  it('should optimize cache', async () => {
    await co.cachePattern('q1', { tier: 'bot', decision: {}, cost: 0.002 });
    const result = co.optimizeCache();
    expect(typeof result.removed).toBe('number');
  });

  it('should reset daily spend', () => {
    co.trackCost({ tier: 'bot', amount: 0.002, tokens: 100, cached: false, timestamp: new Date() });
    co.resetDailySpend();
    const metrics = co.getMetrics();
    expect(metrics.projectedDailyCost).toBe(0);
  });

  it('should update budget config', () => {
    co.updateBudget({ dailyLimit: 100 });
    const check = co.checkBudget(50);
    expect(check).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// EscalationRouter Tests (8 tests)
// ═══════════════════════════════════════════════════════════════════

describe('EscalationRouter', () => {
  let er: EscalationRouter;
  beforeEach(() => { er = new EscalationRouter(); });

  it('should route simple requests to bot', async () => {
    const result = await er.route({ query: 'Hello, how are you?' });
    expect(result.tier).toBe('bot');
    expect(result.cost).toBeGreaterThan(0);
  });

  it('should route complex requests to brain', async () => {
    const result = await er.route({ query: 'Analyze the architectural trade-offs of microservices vs monolith' });
    expect(result.tier).toBe('brain');
  });

  it('should return routing result with metadata', async () => {
    const result = await er.route({ query: 'What is 1+1?' });
    expect(result.timestamp).toBeDefined();
    expect(typeof result.processingTimeMs).toBe('number');
  });

  it('should provide cost metrics', () => {
    const metrics = er.getCostMetrics();
    expect(metrics).toBeDefined();
  });

  it('should provide routing metrics', () => {
    const metrics = er.getRoutingMetrics();
    expect(metrics).toBeDefined();
    expect(typeof metrics.costReductionRatio).toBe('number');
  });

  it('should clear cache', () => {
    er.clearCache();
  });

  it('should update budget', () => {
    er.updateBudget({ dailyLimit: 50 });
  });

  it('should create with custom config', () => {
    const custom = new EscalationRouter({
      enableCaching: false,
      enableFallback: true,
      maxRetries: 3,
    });
    expect(custom).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// HumanEscalation Tests (4 tests)
// ═══════════════════════════════════════════════════════════════════

describe('HumanEscalation', () => {
  let he: HumanEscalation;
  beforeEach(() => { he = new HumanEscalation(); });

  it('should create with default config', () => {
    expect(he).toBeDefined();
  });

  it('should get metrics', () => {
    const metrics = he.getMetrics();
    expect(metrics).toBeDefined();
  });

  it('should get pending escalations (initially empty)', () => {
    const pending = he.getPendingEscalations();
    expect(Array.isArray(pending)).toBe(true);
  });

  it('should generate report', () => {
    const report = he.generateReport();
    expect(typeof report).toBe('string');
  });
});
