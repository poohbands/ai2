import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { UsageLog, Profile } from '@/types'

export async function recordUsage(log: Omit<UsageLog, 'id' | 'created_at'>) {
  const supabase = createServiceClient()

  const { error } = await supabase.from('usage_logs').insert({
    user_id: log.user_id,
    conversation_id: log.conversation_id,
    model: log.model,
    request_type: log.request_type,
    input_tokens: log.input_tokens,
    output_tokens: log.output_tokens,
    estimated_cost: log.estimated_cost,
    provider_request_id: log.provider_request_id,
    is_estimate: log.is_estimate,
  })

  if (error) {
    console.error('Failed to record usage:', error)
  }
}

export async function getCurrentMonthUsage(userId: string): Promise<number> {
  const supabase = createServiceClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('usage_logs')
    .select('estimated_cost')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    console.error('Failed to get usage:', error)
    return 0
  }

  return data.reduce((sum, log) => sum + Number(log.estimated_cost), 0)
}

export async function checkBudget(userId: string, monthlyBudget: number): Promise<{
  allowed: boolean
  usage: number
  budget: number
  percentage: number
  warning: boolean
}> {
  const usage = await getCurrentMonthUsage(userId)
  const percentage = monthlyBudget > 0 ? (usage / monthlyBudget) * 100 : 0

  return {
    allowed: usage < monthlyBudget,
    usage,
    budget: monthlyBudget,
    percentage,
    warning: percentage >= 80,
  }
}

export async function updateProfileUsageCache(userId: string) {
  const usage = await getCurrentMonthUsage(userId)
  const supabase = createServiceClient()

  await supabase
    .from('profiles')
    .update({ usage_current_month: usage })
    .eq('id', userId)
}