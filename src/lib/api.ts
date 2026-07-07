/**
 * ChainBioPoll — Backend API Client
 *
 * All calls to the Express backend (/api/*) go through this module.
 * The base URL is configurable via VITE_API_URL env var.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || ''

// ──────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────

export interface RegisterRequest {
  nid: string
  name: string
  biometricData?: {
    faceEmbedding?: number[]
  }
}

export interface RegisterResponse {
  success: boolean
  message: string
  error?: string
  data?: {
    voterHash: string
    name: string
    truncatedHash: string
    registeredAt: string
  }
}

export interface AuthenticateRequest {
  nid: string
  biometricInput?: {
    faceEmbedding?: number[]
  }
}

export interface AuthenticateResponse {
  success: boolean
  message: string
  error?: string
  data?: {
    voterHash: string
    name: string
    truncatedHash: string
    biometricScore: number
    biometricMethod: string
  }
}

export interface VoterRecord {
  _id: string
  name: string
  voterHash: string
  truncatedHash: string
  isRegistered: boolean
  createdAt: string
}

export interface VotersListResponse {
  success: boolean
  count: number
  data: VoterRecord[]
}

// ──────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────

function adminHeaders(): Record<string, string> {
  return ADMIN_API_KEY ? { 'x-api-key': ADMIN_API_KEY } : {}
}

/**
 * Generate a mock 128-dimensional face embedding vector.
 * Used for demo/testing when real biometric data is unavailable.
 */
function generateMockFaceEmbedding(): number[] {
  return Array.from({ length: 128 }, () =>
    parseFloat((Math.random() * 2 - 1).toFixed(6))
  )
}

// ──────────────────────────────────────────────────
//  API Functions
// ──────────────────────────────────────────────────

/**
 * Register a voter off-chain (backend generates salt + voterHash).
 */
export async function apiRegisterVoter(payload: RegisterRequest): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

/**
 * Authenticate a voter via biometric verification.
 * Sends NID + mock face embedding for demo mode.
 */
export async function apiAuthenticateVoter(payload: AuthenticateRequest): Promise<AuthenticateResponse> {
  const body: AuthenticateRequest = {
    nid: payload.nid,
    biometricInput: payload.biometricInput || {
      faceEmbedding: generateMockFaceEmbedding(),
    },
  }

  const res = await fetch(`${API_BASE}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

/**
 * Fetch the list of all registered voters (admin utility).
 * Requires x-api-key header.
 */
export async function apiGetVoters(): Promise<VotersListResponse> {
  const res = await fetch(`${API_BASE}/voters`, {
    headers: adminHeaders(),
  })
  return res.json()
}

/**
 * Mark a voter as registered on-chain in the backend DB.
 * Requires x-api-key header.
 */
export async function apiMarkVoterRegistered(nid: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/voter/${encodeURIComponent(nid)}/mark-registered`, {
    method: 'PATCH',
    headers: adminHeaders(),
  })
  return res.json()
}

/**
 * Health check — ping the backend.
 */
export async function apiHealthCheck(): Promise<{ status: string; mongodb: string }> {
  const res = await fetch(`${API_BASE}/health`)
  return res.json()
}
