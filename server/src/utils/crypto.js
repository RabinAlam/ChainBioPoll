import crypto from 'node:crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 64) {
  throw new Error('ENCRYPTION_KEY must be set to a 256-bit (64 hex char) random value')
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Generate a cryptographically random salt (hex string).
 * @param {number} bytes — number of random bytes (default 32)
 * @returns {string} hex-encoded salt
 */
export function generateSalt(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Create a pseudonymous voter hash from NID + salt.
 * Uses SHA-256 to produce a 0x-prefixed bytes32-compatible hex string.
 *
 * @param {string} nid — national ID
 * @param {string} salt — random salt
 * @returns {string} 0x-prefixed SHA-256 hash (66 chars)
 */
export function createVoterHash(nid, salt) {
  const combined = `${nid}:${salt}`
  const hash = crypto.createHash('sha256').update(combined).digest('hex')
  return `0x${hash}`
}

/**
 * Encrypt a plaintext salt using AES-256-GCM symmetric encryption.
 * The encrypted value is stored in the DB — only the server can decrypt it.
 *
 * @param {string} plaintext — the raw salt
 * @returns {string} IV:authTag:ciphertext (all hex-encoded)
 */
export function encryptSalt(plaintext) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an AES-256-GCM encrypted salt back to plaintext.
 *
 * @param {string} ciphertext — IV:authTag:ciphertext
 * @returns {string} decrypted plaintext salt
 */
export function decryptSalt(ciphertext) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Encrypt NID at rest using AES-256-GCM.
 *
 * @param {string} plaintext — the raw NID
 * @returns {string} IV:authTag:ciphertext
 */
export function encryptNID(plaintext) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an encrypted NID back to plaintext.
 *
 * @param {string} ciphertext — IV:authTag:ciphertext
 * @returns {string} decrypted plaintext NID
 */
export function decryptNID(ciphertext) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Generate a mock facial embedding vector.
 * Simulates a 128-dimensional face descriptor.
 *
 * @returns {number[]} array of 128 floats between -1 and 1
 */
export function generateMockFaceEmbedding() {
  return Array.from({ length: 128 }, () =>
    parseFloat((Math.random() * 2 - 1).toFixed(6))
  )
}

/**
 * Simulate biometric matching by computing cosine similarity
 * between two embedding vectors.
 *
 * @param {number[]} embeddingA
 * @param {number[]} embeddingB
 * @returns {number} similarity score between 0 and 1
 */
export function computeSimilarity(embeddingA, embeddingB) {
  if (embeddingA.length !== embeddingB.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < embeddingA.length; i++) {
    dotProduct += embeddingA[i] * embeddingB[i]
    normA += embeddingA[i] ** 2
    normB += embeddingB[i] ** 2
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dotProduct / denom
}
