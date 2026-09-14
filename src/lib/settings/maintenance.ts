import { createServiceClient } from '@/lib/supabase/service'
import { MaintenanceSettings, DEFAULT_MAINTENANCE_SETTINGS } from '@/types'

let cachedMaintenance: MaintenanceSettings = { ...DEFAULT_MAINTENANCE_SETTINGS }
let cacheTime = 0
const CACHE_TTL = 5000 // 5 seconds

export async function getMaintenanceSettings(): Promise<MaintenanceSettings> {
  const now = Date.now()
  if (now - cacheTime < CACHE_TTL) {
    return cachedMaintenance
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'service_maintenance')
      .maybeSingle()

    if (!error && data?.value && typeof data.value === 'object') {
      cachedMaintenance = {
        ...DEFAULT_MAINTENANCE_SETTINGS,
        ...(data.value as Partial<MaintenanceSettings>),
      }
      cacheTime = now
      return cachedMaintenance
    }
  } catch (e) {
    console.warn('[maintenance] failed to read from app_settings, using fallback:', e)
  }

  return cachedMaintenance
}

export async function updateMaintenanceSettings(
  updates: Partial<MaintenanceSettings>,
  updatedBy?: string
): Promise<MaintenanceSettings> {
  const current = await getMaintenanceSettings()
  const next: MaintenanceSettings = {
    enabled: updates.enabled !== undefined ? Boolean(updates.enabled) : current.enabled,
    mode: updates.mode === 'full' ? 'full' : updates.mode === 'notice' ? 'notice' : current.mode,
    title: typeof updates.title === 'string' ? updates.title.trim() : current.title,
    message: typeof updates.message === 'string' ? updates.message.trim() : current.message,
    estimated_end_time:
      updates.estimated_end_time !== undefined
        ? String(updates.estimated_end_time).trim()
        : current.estimated_end_time,
    allow_admins:
      updates.allow_admins !== undefined ? Boolean(updates.allow_admins) : current.allow_admins,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || current.updated_by,
  }

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('app_settings').upsert({
      key: 'service_maintenance',
      value: next,
      updated_at: next.updated_at,
    })
    if (error) {
      console.warn('[maintenance] upsert error in app_settings, fallback to in-memory:', error.message)
    }
  } catch (e) {
    console.warn('[maintenance] failed to persist to app_settings, fallback to in-memory:', e)
  }

  cachedMaintenance = next
  cacheTime = Date.now()
  return next
}
