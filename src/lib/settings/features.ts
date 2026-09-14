import { createServiceClient } from '@/lib/supabase/service'
import { MenuFeatures, DEFAULT_MENU_FEATURES } from '@/types'

let cachedFeatures: MenuFeatures = { ...DEFAULT_MENU_FEATURES }
let cacheTime = 0
const CACHE_TTL = 10000 // 10 seconds

export async function getMenuFeatures(): Promise<MenuFeatures> {
  const now = Date.now()
  if (now - cacheTime < CACHE_TTL) {
    return cachedFeatures
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'menu_features')
      .maybeSingle()

    if (!error && data?.value && typeof data.value === 'object') {
      cachedFeatures = { ...DEFAULT_MENU_FEATURES, ...(data.value as Partial<MenuFeatures>) }
      cacheTime = now
      return cachedFeatures
    }
  } catch (e) {
    console.warn('[features] failed to read from app_settings, using fallback:', e)
  }

  return cachedFeatures
}

export async function updateMenuFeatures(updates: Partial<MenuFeatures>): Promise<MenuFeatures> {
  const current = await getMenuFeatures()
  const next: MenuFeatures = {
    web: updates.web !== undefined ? Boolean(updates.web) : current.web,
    research: updates.research !== undefined ? Boolean(updates.research) : current.research,
    kb: updates.kb !== undefined ? Boolean(updates.kb) : current.kb,
    compare: updates.compare !== undefined ? Boolean(updates.compare) : current.compare,
    image: updates.image !== undefined ? Boolean(updates.image) : current.image,
    prompts: updates.prompts !== undefined ? Boolean(updates.prompts) : current.prompts,
  }

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('app_settings').upsert({
      key: 'menu_features',
      value: next,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn('[features] upsert error in app_settings, fallback to in-memory:', error.message)
    }
  } catch (e) {
    console.warn('[features] failed to persist to app_settings, fallback to in-memory:', e)
  }

  cachedFeatures = next
  cacheTime = Date.now()
  return next
}
