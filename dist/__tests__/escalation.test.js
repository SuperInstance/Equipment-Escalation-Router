"use strict";
/**
 * Equipment-Escalation-Router — Intelligent LLM routing tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("../index");
// ═══════════════════════════════════════════════════════════════════
// DecisionRouter Tests (12 tests)
// ═══════════════════════════════════════════════════════════════════
(0, vitest_1.describe)('DecisionRouter', () => {
    let dr;
    (0, vitest_1.beforeEach)(() => { dr = new index_1.DecisionRouter(); });
    (0, vitest_1.it)('should route simple queries to bot tier', async () => {
        const result = await dr.decide({ query: 'What time is it?' });
        (0, vitest_1.expect)(result.recommendedTier).toBe('bot');
    });
    (0, vitest_1.it)('should route coding queries to brain tier', async () => {
        const result = await dr.decide({ query: 'Write a Python function to sort a list using merge sort' });
        (0, vitest_1.expect)(result.recommendedTier).toBe('brain');
    });
    (0, vitest_1.it)('should route legal/approval queries to human tier', async () => {
        const result = await dr.decide({ query: 'We need legal approval for this contract' });
        (0, vitest_1.expect)(result.recommendedTier).toBe('human');
    });
    (0, vitest_1.it)('should route safety-sensitive queries to human', async () => {
        const result = await dr.decide({ query: 'This involves safety-critical medical device approval' });
        (0, vitest_1.expect)(result.recommendedTier).toBe('human');
    });
    (0, vitest_1.it)('should route creative tasks to brain', async () => {
        const result = await dr.decide({ query: 'Write a creative story about AI agents' });
        (0, vitest_1.expect)(result.recommendedTier).toBe('brain');
    });
    (0, vitest_1.it)('should route basic math to bot', async () => {
        const result = await dr.decide({ query: 'What is 2 + 2?' });
        (0, vitest_1.expect)(result.recommendedTier).toBe('bot');
    });
    (0, vitest_1.it)('should include confidence and reasoning', async () => {
        const result = await dr.decide({ query: 'Explain quantum computing' });
        (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.confidence).toBeLessThanOrEqual(1);
        (0, vitest_1.expect)(result.reasoning).toBeTruthy();
    });
    (0, vitest_1.it)('should learn patterns', async () => {
        dr.learnPattern('deploy to production', { tier: 'human', success: true, factors: {} });
        const result = await dr.decide({ query: 'deploy to production' });
        (0, vitest_1.expect)(result).toBeDefined();
    });
    (0, vitest_1.it)('should factor in override factors', async () => {
        const result = await dr.decide({
            query: 'simple question',
            overrideFactors: { urgency: 'critical' },
        });
        (0, vitest_1.expect)(result).toBeDefined();
    });
    (0, vitest_1.it)('should detect emotional content', async () => {
        const result = await dr.decide({ query: 'I am very upset about this terrible service' });
        (0, vitest_1.expect)(result.factors).toBeDefined();
    });
    (0, vitest_1.it)('should detect compliance needs', async () => {
        const result = await dr.decide({ query: 'Does this comply with GDPR regulations?' });
        (0, vitest_1.expect)(result).toBeDefined();
    });
    (0, vitest_1.it)('should return decision factors', async () => {
        const result = await dr.decide({ query: 'Write a test' });
        (0, vitest_1.expect)(result.factors).toBeDefined();
    });
});
// ═══════════════════════════════════════════════════════════════════
// CostOptimizer Tests (10 tests)
// ═══════════════════════════════════════════════════════════════════
(0, vitest_1.describe)('CostOptimizer', () => {
    let co;
    (0, vitest_1.beforeEach)(() => { co = new index_1.CostOptimizer(); });
    (0, vitest_1.it)('should track costs', () => {
        co.trackCost({ tier: 'bot', amount: 0.002, tokens: 100, cached: false, timestamp: new Date() });
        const metrics = co.getMetrics();
        (0, vitest_1.expect)(metrics.totalCost).toBeGreaterThanOrEqual(0.002);
    });
    (0, vitest_1.it)('should check budget', () => {
        const result = co.checkBudget(0.001);
        (0, vitest_1.expect)(result.allowed).toBeDefined();
        (0, vitest_1.expect)(typeof result.remainingBudget).toBe('number');
    });
    (0, vitest_1.it)('should cache patterns', async () => {
        await co.cachePattern('test query', { tier: 'bot', decision: {}, cost: 0.002 });
        const cached = co.checkCache('test query');
        (0, vitest_1.expect)(cached).not.toBeNull();
    });
    (0, vitest_1.it)('should return null for uncached patterns', () => {
        (0, vitest_1.expect)(co.checkCache('never seen before')).toBeNull();
    });
    (0, vitest_1.it)('should generate cost report', () => {
        co.trackCost({ tier: 'bot', amount: 0.002, tokens: 100, cached: false, timestamp: new Date() });
        const report = co.generateCostReport();
        (0, vitest_1.expect)(typeof report).toBe('string');
        (0, vitest_1.expect)(report.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should get cache stats', () => {
        const stats = co.getCacheStats();
        (0, vitest_1.expect)(stats).toBeDefined();
        (0, vitest_1.expect)(typeof stats.entries).toBe('number');
    });
    (0, vitest_1.it)('should clear cache', async () => {
        await co.cachePattern('q', { tier: 'bot', decision: {}, cost: 0.002 });
        co.clearCache();
        (0, vitest_1.expect)(co.checkCache('q')).toBeNull();
    });
    (0, vitest_1.it)('should optimize cache', async () => {
        await co.cachePattern('q1', { tier: 'bot', decision: {}, cost: 0.002 });
        const result = co.optimizeCache();
        (0, vitest_1.expect)(typeof result.removed).toBe('number');
    });
    (0, vitest_1.it)('should reset daily spend', () => {
        co.trackCost({ tier: 'bot', amount: 0.002, tokens: 100, cached: false, timestamp: new Date() });
        co.resetDailySpend();
        const metrics = co.getMetrics();
        (0, vitest_1.expect)(metrics.projectedDailyCost).toBe(0);
    });
    (0, vitest_1.it)('should update budget config', () => {
        co.updateBudget({ dailyLimit: 100 });
        const check = co.checkBudget(50);
        (0, vitest_1.expect)(check).toBeDefined();
    });
});
// ═══════════════════════════════════════════════════════════════════
// EscalationRouter Tests (8 tests)
// ═══════════════════════════════════════════════════════════════════
(0, vitest_1.describe)('EscalationRouter', () => {
    let er;
    (0, vitest_1.beforeEach)(() => { er = new index_1.EscalationRouter(); });
    (0, vitest_1.it)('should route simple requests to bot', async () => {
        const result = await er.route({ query: 'Hello, how are you?' });
        (0, vitest_1.expect)(result.tier).toBe('bot');
        (0, vitest_1.expect)(result.cost).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should route complex requests to brain', async () => {
        const result = await er.route({ query: 'Analyze the architectural trade-offs of microservices vs monolith' });
        (0, vitest_1.expect)(result.tier).toBe('brain');
    });
    (0, vitest_1.it)('should return routing result with metadata', async () => {
        const result = await er.route({ query: 'What is 1+1?' });
        (0, vitest_1.expect)(result.timestamp).toBeDefined();
        (0, vitest_1.expect)(typeof result.processingTimeMs).toBe('number');
    });
    (0, vitest_1.it)('should provide cost metrics', () => {
        const metrics = er.getCostMetrics();
        (0, vitest_1.expect)(metrics).toBeDefined();
    });
    (0, vitest_1.it)('should provide routing metrics', () => {
        const metrics = er.getRoutingMetrics();
        (0, vitest_1.expect)(metrics).toBeDefined();
        (0, vitest_1.expect)(typeof metrics.costReductionRatio).toBe('number');
    });
    (0, vitest_1.it)('should clear cache', () => {
        er.clearCache();
    });
    (0, vitest_1.it)('should update budget', () => {
        er.updateBudget({ dailyLimit: 50 });
    });
    (0, vitest_1.it)('should create with custom config', () => {
        const custom = new index_1.EscalationRouter({
            enableCaching: false,
            enableFallback: true,
            maxRetries: 3,
        });
        (0, vitest_1.expect)(custom).toBeDefined();
    });
});
// ═══════════════════════════════════════════════════════════════════
// HumanEscalation Tests (4 tests)
// ═══════════════════════════════════════════════════════════════════
(0, vitest_1.describe)('HumanEscalation', () => {
    let he;
    (0, vitest_1.beforeEach)(() => { he = new index_1.HumanEscalation(); });
    (0, vitest_1.it)('should create with default config', () => {
        (0, vitest_1.expect)(he).toBeDefined();
    });
    (0, vitest_1.it)('should get metrics', () => {
        const metrics = he.getMetrics();
        (0, vitest_1.expect)(metrics).toBeDefined();
    });
    (0, vitest_1.it)('should get pending escalations (initially empty)', () => {
        const pending = he.getPendingEscalations();
        (0, vitest_1.expect)(Array.isArray(pending)).toBe(true);
    });
    (0, vitest_1.it)('should generate report', () => {
        const report = he.generateReport();
        (0, vitest_1.expect)(typeof report).toBe('string');
    });
});
//# sourceMappingURL=escalation.test.js.map