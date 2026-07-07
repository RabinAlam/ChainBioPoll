/**
 * ChainBioPoll — Backend API Client
 *
 * All calls to the Express backend (/api/*) go through this module.
 * The base URL is configurable via VITE_API_URL env var.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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
    nid: string
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
  nid: string
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
 * Authenticate a voter via mock biometric (NID lookup).
 * Returns the voter's on-chain hash if successful.
 */
export async function apiAuthenticateVoter(payload: AuthenticateRequest): Promise<AuthenticateResponse> {
  const res = await fetch(`${API_BASE}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

/**
 * Fetch the list of all registered voters (admin utility).
 */
export async function apiGetVoters(): Promise<VotersListResponse> {
  const res = await fetch(`${API_BASE}/voters`)
  return res.json()
}

/**
 * Mark a voter as registered on-chain in the backend DB.
 */
export async function apiMarkVoterRegistered(nid: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/voter/${encodeURIComponent(nid)}/mark-registered`, {
    method: 'PATCH',
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
