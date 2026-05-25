package main

// Claude 3.5 Sonnet Pricing rates per token (USD)
const (
	CostPerInputToken      = 0.000003   // $3.00 / 1M tokens
	CostPerOutputToken     = 0.000015   // $15.00 / 1M tokens
	CostPerCacheWriteToken = 0.00000375 // $3.75 / 1M tokens
	CostPerCacheReadToken  = 0.0000003  // $0.30 / 1M tokens
)

// CalculateCost computes the exact cost of a task execution based on its token usage profile.
// It applies the standard Anthropic prompt caching pricing ratios.
func CalculateCost(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens int) float64 {
	cost := float64(inputTokens)*CostPerInputToken +
		float64(outputTokens)*CostPerOutputToken +
		float64(cacheReadTokens)*CostPerCacheReadToken +
		float64(cacheWriteTokens)*CostPerCacheWriteToken

	return cost
}
