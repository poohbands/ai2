import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'APP_ENCRYPTION_KEY missing or invalid (need 64 hex chars from `openssl rand -hex 32`)'
    )
  }
  return Buffer.from(hex, 'hex')
}

/** Encrypt plaintext API key for DB storage. Returns iv:tag:cipher (hex). */
export function encryptApiKey(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

/** Decrypt value produced by encryptApiKey. */
export function decryptApiKey(payload: string): string {
  const key = getKey()
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted payload')
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
}

/** Non-reversible hint for UI display, e.g. "sk-...a1b2". */
export function keyHint(key: string): string {
  const t = key.trim()
  if (t.length <= 8) return '****'
  return `${t.slice(0, 3)}...${t.slice(-4)}`
}
