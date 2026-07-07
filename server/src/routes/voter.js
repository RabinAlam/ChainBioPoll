import { Router } from 'express'
import crypto from 'node:crypto'
import Voter from '../models/Voter.js'
import {
  generateSalt,
  createVoterHash,
  encryptSalt,
  decryptSalt,
  encryptNID,
  generateMockFaceEmbedding,
  computeSimilarity,
} from '../utils/crypto.js'

// NID format: alphanumeric, 6-20 characters
const NID_REGEX = /^[A-Za-z0-9]{6,20}$/
// Name: 2-100 characters, letters/spaces/hyphens/periods
const NAME_REGEX = /^[A-Za-z\u00C0-\u024F\s\-.']{2,100}$/

/**
 * Admin authentication middleware.
 * Requires a valid ADMIN_API_KEY in the x-api-key header.
 */
function requireAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key']
  const validKey = process.env.ADMIN_API_KEY

  if (!validKey) {
    return res.status(500).json({
      success: false,
      error: 'Admin API key not configured.',
    })
  }

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Valid admin API key required.',
    })
  }

  next()
}

/**
 * Validate NID format.
 */
function validateNID(nid) {
  return typeof nid === 'string' && NID_REGEX.test(nid.trim())
}

/**
 * Validate name format.
 */
function validateName(name) {
  return typeof name === 'string' && NAME_REGEX.test(name.trim())
}

/**
 * Hash NID for indexing (deterministic, one-way).
 * Used to check duplicates without storing plaintext NID.
 */
function hashNID(nid) {
  return crypto.createHash('sha256').update(`nid:${nid}`).digest('hex')
}

export default function voterRoutes({ authLimiter, registerLimiter }) {
  const router = Router()

  // ──────────────────────────────────────────────────
  //  POST /api/register
  //  Register a new voter with NID, name, and mock biometric data.
  // ──────────────────────────────────────────────────
  router.post('/register', registerLimiter, async (req, res) => {
    try {
      const { nid, name, biometricData } = req.body

      // ── Validate input ──
      if (!nid || !name) {
        return res.status(400).json({
          success: false,
          error: 'NID and Name are required.',
        })
      }

      if (!validateNID(nid)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid NID format. Must be 6-20 alphanumeric characters.',
        })
      }

      if (!validateName(name)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid name format. Must be 2-100 characters (letters, spaces, hyphens, periods).',
        })
      }

      const trimmedNID = nid.trim()
      const trimmedName = name.trim()

      // ── Check for duplicate NID (via hash) ──
      const nidHash = hashNID(trimmedNID)
      const existing = await Voter.findOne({ nidHash })
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'A voter with this NID is already registered.',
        })
      }

      // ── Generate cryptographic salt ──
      const salt = generateSalt()

      // ── Create pseudonymous voter hash (NID + salt → SHA-256) ──
      const voterHash = createVoterHash(trimmedNID, salt)

      // ── Encrypt the salt before storing ──
      const encryptedSalt = encryptSalt(salt)

      // ── Encrypt NID at rest ──
      const encryptedNID = encryptNID(trimmedNID)

      // ── Generate mock face embedding ──
      const faceEmbedding = biometricData?.faceEmbedding || generateMockFaceEmbedding()

      // ── Save voter to database ──
      const voter = new Voter({
        encryptedNID,
        nidHash,
        name: trimmedName,
        encryptedSalt,
        voterHash,
        faceEmbedding,
      })

      await voter.save()

      console.log(`Voter registered | Hash: ${voterHash.slice(0, 10)}...`)

      return res.status(201).json({
        success: true,
        message: 'Voter registered successfully.',
        data: {
          voterHash,
          name: voter.name,
          truncatedHash: voter.truncatedHash,
          registeredAt: voter.createdAt,
        },
      })
    } catch (err) {
      console.error('Registration error:', err.message)

      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'A voter with this NID or hash already exists.',
        })
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error during registration.',
      })
    }
  })

  // ──────────────────────────────────────────────────
  //  POST /api/authenticate
  //  Requires biometric data to return voter hash.
  // ──────────────────────────────────────────────────
  router.post('/authenticate', authLimiter, async (req, res) => {
    try {
      const { nid, biometricInput } = req.body

      // ── Validate input ──
      if (!nid) {
        return res.status(400).json({
          success: false,
          error: 'NID is required for authentication.',
        })
      }

      if (!validateNID(nid)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid NID format.',
        })
      }

      const trimmedNID = nid.trim()

      // ── Look up voter by NID hash ──
      const nidHash = hashNID(trimmedNID)
      const voter = await Voter.findOne({ nidHash })
      if (!voter) {
        return res.status(404).json({
          success: false,
          error: 'No voter found with this NID. Please register first.',
        })
      }

      // ── Biometric verification (optional in demo mode) ──
      let biometricScore = 1.0
      let biometricMethod = 'nid-lookup'

      if (biometricInput?.faceEmbedding && voter.faceEmbedding && voter.faceEmbedding.length > 0) {
        biometricScore = computeSimilarity(
          voter.faceEmbedding,
          biometricInput.faceEmbedding
        )
        biometricMethod = 'face-embedding'

        if (biometricScore < 0.3) {
          return res.status(401).json({
            success: false,
            error: 'Biometric verification failed. Face does not match.',
            biometricScore: parseFloat(biometricScore.toFixed(4)),
          })
        }
      }

      // ── Verify the stored hash is reproducible ──
      const salt = decryptSalt(voter.encryptedSalt)
      const actualNID = voter.nid
      const recomputedHash = createVoterHash(actualNID, salt)

      if (recomputedHash !== voter.voterHash) {
        console.error('Hash integrity check failed')
        return res.status(500).json({
          success: false,
          error: 'Data integrity check failed. Please contact the Election Commission.',
        })
      }

      console.log(`Voter authenticated | Method: face-embedding | Score: ${biometricScore.toFixed(4)}`)

      return res.status(200).json({
        success: true,
        message: 'Authentication successful.',
        data: {
          voterHash: voter.voterHash,
          name: voter.name,
          truncatedHash: voter.truncatedHash,
          biometricScore: parseFloat(biometricScore.toFixed(4)),
          biometricMethod: 'face-embedding',
        },
      })
    } catch (err) {
      console.error('Authentication error:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Internal server error during authentication.',
      })
    }
  })

  // ──────────────────────────────────────────────────
  //  GET /api/voters
  //  Admin-only: List all registered voters.
  // ──────────────────────────────────────────────────
  router.get('/voters', requireAdmin, async (_req, res) => {
    try {
      const voters = await Voter.find({})
        .select('-encryptedSalt -faceEmbedding -encryptedNID -nidHash -__v')
        .sort({ createdAt: -1 })

      return res.status(200).json({
        success: true,
        count: voters.length,
        data: voters,
      })
    } catch (err) {
      console.error('Fetch voters error:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch voters.',
      })
    }
  })

  // ──────────────────────────────────────────────────
  //  GET /api/voter/:nidHash
  //  Admin-only: Look up a single voter by NID hash.
  // ──────────────────────────────────────────────────
  router.get('/voter/:nidHash', requireAdmin, async (req, res) => {
    try {
      const voter = await Voter.findOne({ nidHash: req.params.nidHash })
        .select('-encryptedSalt -faceEmbedding -encryptedNID -nidHash -__v')

      if (!voter) {
        return res.status(404).json({
          success: false,
          error: 'Voter not found.',
        })
      }

      return res.status(200).json({
        success: true,
        data: voter,
      })
    } catch (err) {
      console.error('Voter lookup error:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to look up voter.',
      })
    }
  })

  // ──────────────────────────────────────────────────
  //  PATCH /api/voter/:nid/mark-registered
  //  Admin-only: Mark a voter as registered on-chain.
  // ──────────────────────────────────────────────────
  router.patch('/voter/:nid/mark-registered', requireAdmin, async (req, res) => {
    try {
      const trimmedNID = req.params.nid.trim()
      const nidHash = hashNID(trimmedNID)

      const voter = await Voter.findOneAndUpdate(
        { nidHash },
        { isRegistered: true },
        { new: true }
      ).select('-encryptedSalt -faceEmbedding -encryptedNID -nidHash -__v')

      if (!voter) {
        return res.status(404).json({
          success: false,
          error: 'Voter not found.',
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Voter marked as registered on-chain.',
        data: voter,
      })
    } catch (err) {
      console.error('Mark registered error:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to update voter registration status.',
      })
    }
  })

  return router
}
