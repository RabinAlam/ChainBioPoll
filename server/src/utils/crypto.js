import crypto from 'node:crypto'
import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key'

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
 * Note: On the smart contract side the admin registers this hash via
 * `registerVoter(bytes32 _voterHash)`. The frontend converts this hex
 * string to bytes32 before calling the contract.
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
 * Encrypt a plaintext salt using AES symmetric encryption.
 * The encrypted value is stored in the DB — only the server can decrypt it.
 *
 * @param {string} plaintext — the raw salt
 * @returns {string} AES-encrypted ciphertext
 */
export function encryptSalt(plaintext) {
  return CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY).toString()
}

/**
 * Decrypt an AES-encrypted salt back to plaintext.
 *
 * @param {string} ciphertext — the encrypted salt from the DB
 * @returns {string} decrypted plaintext salt
 */
export function decryptSalt(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

/**
 * Generate a mock facial embedding vector.
 * Simulates a 128-dimensional face descriptor (like dlib/FaceNet would produce).
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
 * In production this would use a real ML model; here we just
 * check if the NID matches (and return a mock confidence score).
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
