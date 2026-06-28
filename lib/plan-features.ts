import { query } from '@/lib/db'

export const FEATURES = ['json_export', 'advanced_filters', 'rating_web_filter', 'bulk_actions', 'keyword_history', 'api_keys'] as const
export type Feature = typeof FEATURES[number]

// Default feature access per plan (matches pricing page)
export const FEATURE_DEFAULTS: Record<string, Record<Feature, boolean>> = {
  free:     { json_export: false, advanced_filters: false, rating_web_filter: false, bulk_actions: false, keyword_history: false, api_keys: false },
  starter:  { json_export: true,  advanced_filters: true,  rating_web_filter: true,  bulk_actions: false, keyword_history: false, api_keys: false },
  pro:      { json_export: true,  advanced_filters: true,  rating_web_filter: true,  bulk_actions: true,  keyword_history: true,  api_keys: false },
  business: { json_export: true,  advanced_filters: true,  rating_web_filter: true,  bulk_actions: true,  keyword_history: true,  api_keys: true  },
  admin:    { json_export: true,  advanced_filters: true,  rating_web_filter: true,  bulk_actions: true,  keyword_history: true,  api_keys: true  },
}

export async function ensureFeaturesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS plan_features (
      feature VARCHAR(50) NOT NULL,
      plan    VARCHAR(20) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (feature, plan)
    )
  `)
}

export async function getPlanFeatures(plan: string): Promise<Record<Feature, boolean>> {
  const defaults = FEATURE_DEFAULTS[plan] || FEATURE_DEFAULTS.free
  try {
    await ensureFeaturesTable()
    const rows = await query<{ feature: string; enabled: number }[]>(
      'SELECT feature, enabled FROM plan_features WHERE plan = ?', [plan]
    )
    if (rows.length === 0) return { ...defaults }
    const merged = { ...defaults }
    for (const row of rows) {
      if (FEATURES.includes(row.feature as Feature)) {
        merged[row.feature as Feature] = row.enabled === 1
      }
    }
    return merged
  } catch {
    return { ...defaults }
  }
}

// Returns all features for all plans (for admin UI)
export async function getAllPlanFeatures(): Promise<Record<string, Record<Feature, boolean>>> {
  const plans = ['free', 'starter', 'pro', 'business']
  const result: Record<string, Record<Feature, boolean>> = {}
  try {
    await ensureFeaturesTable()
    const rows = await query<{ feature: string; plan: string; enabled: number }[]>(
      'SELECT feature, plan, enabled FROM plan_features'
    )
    const dbMap: Record<string, Record<string, boolean>> = {}
    for (const row of rows) {
      if (!dbMap[row.plan]) dbMap[row.plan] = {}
      dbMap[row.plan][row.feature] = row.enabled === 1
    }
    for (const plan of plans) {
      const defaults = FEATURE_DEFAULTS[plan]
      result[plan] = { ...defaults }
      if (dbMap[plan]) {
        for (const feat of FEATURES) {
          if (dbMap[plan][feat] !== undefined) result[plan][feat] = dbMap[plan][feat]
        }
      }
    }
  } catch {
    for (const plan of plans) result[plan] = { ...FEATURE_DEFAULTS[plan] }
  }
  return result
}
