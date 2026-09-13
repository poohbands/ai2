import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  provider: 'redis' | 'memory'
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// ---------- In-memory fallback (single instance, dev / no Redis configured) ----------
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>()

  check(key: string, maxRequests: number, windowMs: number): RateLimitResult {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || entry.resetAt < now) {
      const resetAt = now + windowMs
      this.store.set(key, { count: 1, resetAt })
      // opportunistic cleanup
      if (this.store.size > 5000) {
        for (const [k, v] of this.store.entries()) {
          if (v.resetAt < now) this.store.delete(k)
        }
      }
      return { allowed: true, remaining: maxRequests - 1, resetAt, provider: 'memory' }
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt, provider: 'memory' }
    }

    entry.count++
    return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt, provider: 'memory' }
  }
}

const memoryLimiter = new InMemoryRateLimiter()

// ---------- Redis (Upstash) distributed limiter ----------
let redisClient: Redis | null = null
const redisLimiters = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  if (!redisClient) {
    redisClient = new Redis({ url, token })
  }
  return redisClient
}

function getRedisLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  const key = `${maxRequests}:${windowMs}`
  if (!redisLimiters.has(key)) {
    const windowStr =
      windowMs <= 60_000 ? `${Math.max(1, Math.round(windowMs / 1000))} s` : `${Math.max(1, Math.round(windowMs / 60000))} m`
    redisLimiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, windowStr as `${number} s`),
        analytics: true,
        prefix: 'family-ai-ratelimit',
      })
    )
  }
  return redisLimiters.get(key)!
}

export function getRateLimitProvider(): 'redis' | 'memory' {
  return getRedis() ? 'redis' : 'memory'
}

/**
 * Unified rate limit check.
 * Uses Upstash Redis (distributed, production-safe on Vercel) when
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set,
 * otherwise falls back to in-memory (single instance only).
 */
export async function rateLimit(
  userId: string,
  maxRequests = 20,
  windowMs = 60000,
  endpoint = 'chat'
): Promise<RateLimitResult> {
  const key = `${endpoint}:${userId}`
  const redisLimiter = getRedisLimiter(maxRequests, windowMs)

  if (redisLimiter) {
    try {
      const res = await redisLimiter.limit(key)
      return {
        allowed: res.success,
        remaining: res.remaining,
        resetAt: res.reset,
        provider: 'redis',
      }
    } catch (err) {
      console.warn('[rate-limit] Redis failed, falling back to memory:', err instanceof Error ? err.message : err)
    }
  }

  return memoryLimiter.check(key, maxRequests, windowMs)
}

// Presets per endpoint
export const RateLimitPresets = {
  chat: { max: 20, windowMs: 60_000 },
  upload: { max: 10, windowMs: 60_000 },
  search: { max: 30, windowMs: 60_000 },
  research: { max: 5, windowMs: 60_000 },
  image: { max: 10, windowMs: 60_000 },
  embeddings: { max: 60, windowMs: 60_000 },
} as const

export async function rateLimitEndpoint(
  userId: string,
  endpoint: keyof typeof RateLimitPresets
): Promise<RateLimitResult> {
  const p = RateLimitPresets[endpoint]
  return rateLimit(userId, p.max, p.windowMs, endpoint)
}

// Backwards compat
export function getRateLimiter(maxRequests = 20, windowMs = 60000) {
  return {
    check: (key: string) => memoryLimiter.check(key, maxRequests, windowMs),
  }
}
