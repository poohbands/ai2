import { createClient } from '@/lib/supabase/server'
import { Model } from '@/types'

const modelCostCache = new Map<string, { input: number; output: number }>()

export async function getModelCosts(modelId: string): Promise<{ input: number; output: number }> {
  if (modelCostCache.has(modelId)) {
    return modelCostCache.get(modelId)!
  }

  const supabase = await createClient()
  const { data: model } = await supabase
    .from('models')
    .select('estimated_input_cost, estimated_output_cost')
    .eq('id', modelId)
    .single()

  if (!model) {
    return { input: 0.000001, output: 0.000002 }
  }

  const costs = {
    input: Number(model.estimated_input_cost),
    output: Number(model.estimated_output_cost),
  }
  modelCostCache.set(modelId, costs)
  return costs
}

export function calculateCost(inputTokens: number, outputTokens: number, costs: { input: number; output: number }): number {
  const inputCost = inputTokens * costs.input
  const outputCost = outputTokens * costs.output
  return inputCost + outputCost
}

export async function calculateEstimatedCost(modelId: string, inputTokens: number, outputTokens: number): Promise<number> {
  const costs = await getModelCosts(modelId)
  return calculateCost(inputTokens, outputTokens, costs)
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(6)}`
  if (cost < 1) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}