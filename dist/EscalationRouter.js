"use strict";
/**
 * EscalationRouter - Main equipment class for intelligent LLM routing
 *
 * Implements three-tier routing: Bot→Brain→Human with 40x cost reduction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationRouter = void 0;
const DecisionRouter_1 = require("./DecisionRouter");
const CostOptimizer_1 = require("./CostOptimizer");
const HumanEscalation_1 = require("./HumanEscalation");
/**
 * Default tier configurations
 */
const DEFAULT_TIERS = {
    bot: {
        name: 'bot',
        costPerRequest: 0.002,
        description: 'Fast, cheap responses for simple queries',
        capabilities: ['simple-qa', 'formatting', 'basic-calculation', 'lookup'],
        maxTokens: 1000,
        avgLatencyMs: 100
    },
    brain: {
        name: 'brain',
        costPerRequest: 0.03,
        description: 'Complex reasoning and analysis',
        capabilities: ['reasoning', 'analysis', 'coding', 'creative', 'planning'],
        maxTokens: 4000,
        avgLatencyMs: 2000
    },
    human: {
        name: 'human',
        costPerRequest: 30,
        description: 'Human expert for high-stakes decisions',
        capabilities: ['judgment', 'approval', 'creative-direction', 'legal', 'ethical'],
        maxTokens: 0, // No token limit for humans
        avgLatencyMs: 300000 // 5 minutes average
    }
};
/**
 * Main EscalationRouter class
 * Routes requests to appropriate tiers based on complexity, stakes, urgency, and novelty
 */
class EscalationRouter {
    decisionRouter;
    costOptimizer;
    humanEscalation = null;
    config;
    tiers;
    metrics;
    constructor(config = {}) {
        this.config = {
            enableCaching: true,
            maxCacheSize: 100 * 1024 * 1024, // 100MB
            enablePatternLearning: true,
            budget: {
                dailyLimit: 100,
                alertThreshold: 0.8,
                hardStop: false
            },
            enableFallback: true,
            maxRetries: 2,
            ...config
        };
        this.tiers = { ...DEFAULT_TIERS };
        // Apply custom tier configurations
        if (this.config.tiers) {
            for (const [tier, customConfig] of Object.entries(this.config.tiers)) {
                if (customConfig) {
                    this.tiers[tier] = {
                        ...this.tiers[tier],
                        ...customConfig
                    };
                }
            }
        }
        this.decisionRouter = new DecisionRouter_1.DecisionRouter({
            enablePatternLearning: this.config.enablePatternLearning
        });
        this.costOptimizer = new CostOptimizer_1.CostOptimizer({
            enableCaching: this.config.enableCaching,
            maxCacheSize: this.config.maxCacheSize,
            budget: this.config.budget
        });
        // Initialize human escalation if enabled
        if (this.config.humanEscalation?.enabled) {
            this.humanEscalation = new HumanEscalation_1.HumanEscalation({
                approvalTimeoutMs: this.config.humanEscalation.approvalTimeoutMs,
                maxPendingRequests: this.config.humanEscalation.maxPendingRequests
            });
        }
        this.metrics = {
            totalRequests: 0,
            tierUsage: { bot: 0, brain: 0, human: 0 },
            cacheHits: 0,
            fallbackActivations: 0,
            totalCost: 0
        };
    }
    /**
     * Route a request to the appropriate tier
     */
    async route(request) {
        const startTime = Date.now();
        this.metrics.totalRequests++;
        // Check for cached response
        const cachedResult = await this.costOptimizer.checkCache(request.query);
        if (cachedResult) {
            this.metrics.cacheHits++;
            this.costOptimizer.trackCost({
                tier: cachedResult.tier,
                amount: 0, // No cost for cached responses
                tokens: 0,
                cached: true,
                timestamp: new Date()
            });
            const result = {
                ...cachedResult,
                cached: true,
                processingTimeMs: Date.now() - startTime,
                fallbackChain: cachedResult.fallbackChain || [],
                timestamp: cachedResult.timestamp || new Date()
            };
            return result;
        }
        // Make routing decision
        const decision = await this.decisionRouter.decide({
            query: request.query,
            context: request.context,
            overrideFactors: request.decisionFactors
        });
        let tier = request.preferredTier || decision.recommendedTier;
        let fallbackChain = this.buildFallbackChain(tier);
        // Check budget constraints
        const tierCost = this.tiers[tier].costPerRequest;
        const budgetCheck = this.costOptimizer.checkBudget(tierCost, request.budgetOverride);
        if (!budgetCheck.allowed) {
            // Downgrade to cheaper tier
            tier = this.findCheapestAvailableTier(budgetCheck.remainingBudget);
            fallbackChain = this.buildFallbackChain(tier);
        }
        // Track metrics
        this.metrics.tierUsage[tier]++;
        this.metrics.totalCost += this.tiers[tier].costPerRequest;
        // Track cost
        this.costOptimizer.trackCost({
            tier,
            amount: this.tiers[tier].costPerRequest,
            tokens: this.tiers[tier].maxTokens,
            cached: false,
            timestamp: new Date(),
            query: request.query
        });
        // Cache the result pattern
        if (this.config.enableCaching) {
            await this.costOptimizer.cachePattern(request.query, {
                tier,
                decision,
                cost: this.tiers[tier].costPerRequest
            });
        }
        // Update pattern learning
        if (this.config.enablePatternLearning) {
            this.decisionRouter.learnPattern(request.query, {
                tier,
                success: true,
                factors: decision.factors
            });
        }
        return {
            tier,
            decision,
            cost: this.tiers[tier].costPerRequest,
            cached: false,
            fallbackChain,
            timestamp: new Date(),
            processingTimeMs: Date.now() - startTime,
            metadata: {
                budgetRemaining: budgetCheck.remainingBudget,
                alternativeTier: decision.recommendedTier !== tier ? decision.recommendedTier : undefined
            }
        };
    }
    /**
     * Route with automatic escalation when primary tier fails
     */
    async routeWithEscalation(request) {
        const initialResult = await this.route(request);
        const escalationHistory = [];
        if (!this.config.enableFallback) {
            return { ...initialResult, escalated: false, escalationHistory };
        }
        let currentTier = initialResult.tier;
        let result = initialResult;
        let escalated = false;
        // Check if primary tier succeeded
        if (request.onTierResult) {
            const success = await request.onTierResult(currentTier, result);
            escalationHistory.push({ tier: currentTier, success });
            if (!success) {
                // Try fallback chain
                for (const fallbackTier of initialResult.fallbackChain) {
                    if (fallbackTier === currentTier)
                        continue;
                    this.metrics.fallbackActivations++;
                    escalated = true;
                    const fallbackResult = await this.route({
                        ...request,
                        preferredTier: fallbackTier
                    });
                    const fallbackSuccess = await request.onTierResult(fallbackTier, fallbackResult);
                    escalationHistory.push({ tier: fallbackTier, success: fallbackSuccess });
                    if (fallbackSuccess) {
                        result = fallbackResult;
                        break;
                    }
                }
            }
        }
        return { ...result, escalated, escalationHistory };
    }
    /**
     * Request human escalation for a high-stakes decision
     */
    async escalateToHuman(request) {
        if (!this.humanEscalation) {
            throw new Error('Human escalation is not enabled. Set humanEscalation.enabled to true in config.');
        }
        const escalationRequest = {
            id: this.generateRequestId(),
            query: request.query,
            context: request.context,
            reason: request.reason,
            priority: request.priority || 'medium',
            createdAt: new Date(),
            metadata: request.metadata,
            estimatedCost: this.tiers.human.costPerRequest
        };
        return this.humanEscalation.request(escalationRequest);
    }
    /**
     * Get current cost metrics
     */
    getCostMetrics() {
        return this.costOptimizer.getMetrics();
    }
    /**
     * Get routing metrics
     */
    getRoutingMetrics() {
        const avgCostWithoutRouting = this.tiers.brain.costPerRequest; // Assuming brain would be default
        const actualAvgCost = this.metrics.totalRequests > 0
            ? this.metrics.totalCost / this.metrics.totalRequests
            : 0;
        const costReductionRatio = actualAvgCost > 0
            ? avgCostWithoutRouting / actualAvgCost
            : 1;
        return {
            ...this.metrics,
            costReductionRatio
        };
    }
    /**
     * Clear the pattern cache
     */
    clearCache() {
        this.costOptimizer.clearCache();
    }
    /**
     * Update budget configuration
     */
    updateBudget(config) {
        this.costOptimizer.updateBudget(config);
    }
    /**
     * Build fallback chain for a tier
     */
    buildFallbackChain(tier) {
        const chains = {
            bot: ['bot', 'brain', 'human'],
            brain: ['brain', 'human', 'bot'], // bot as last resort for simple responses
            human: ['human'] // Human is the final authority
        };
        return chains[tier];
    }
    /**
     * Find the cheapest tier within budget
     */
    findCheapestAvailableTier(remainingBudget) {
        const tiers = ['bot', 'brain', 'human'];
        for (const tier of tiers) {
            if (this.tiers[tier].costPerRequest <= remainingBudget) {
                return tier;
            }
        }
        return 'bot'; // Default to cheapest
    }
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `esc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.EscalationRouter = EscalationRouter;
exports.default = EscalationRouter;
//# sourceMappingURL=EscalationRouter.js.map