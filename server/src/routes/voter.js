import { Router } from 'express'
import Voter from '../models/Voter.js'
import {
  generateSalt,
  createVoterHash,
  encryptSalt,
  decryptSalt,
  generateMockFaceEmbedding,
  computeSimilarity,
} from '../utils/crypto.js'

const router = Router()

// ──────────────────────────────────────────────────
//  POST /api/register
//  Register a new voter with NID, name, and mock biometric data.
//  Returns the pseudonymous voterHash for on-chain registration.
// ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { nid, name, biometricData } = req.body

    // ── Validate input ──
    if (!nid || !name) {
      return res.status(400).json({
        success: false,
        error: 'NID and Name are required.',
      })
    }

    // ── Check for duplicate NID ──
    const existing = await Voter.findOne({ nid: nid.trim() })
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A voter with this NID is already registered.',
        voterHash: existing.voterHash,
      })
    }

    // ── Generate cryptographic salt ──
    const salt = generateSalt()

    // ── Create pseudonymous voter hash (NID + salt → SHA-256) ──
    const voterHash = createVoterHash(nid.trim(), salt)

    // ── Encrypt the salt before storing (so raw salt is never in DB) ──
    const encryptedSalt = encryptSalt(salt)

    // ── Generate mock face embedding (simulating IoT biometric capture) ──
    // In production, this would come from the biometric device
    const faceEmbedding = biometricData?.faceEmbedding || generateMockFaceEmbedding()

    // ── Save voter to database ──
    const voter = new Voter({
      nid: nid.trim(),
      name: name.trim(),
      encryptedSalt,
      voterHash,
      faceEmbedding,
    })

    await voter.save()

    console.log(`✅ Voter registered: ${name.trim()} | Hash: ${voterHash.slice(0, 10)}…`)

    // ── Return the hash to the frontend ──
    // The admin will use this hash to call registerVoter(bytes32) on the smart contract
    return res.status(201).json({
      success: true,
      message: 'Voter registered successfully.',
      data: {
        voterHash,
        name: voter.name,
        nid: voter.nid,
        truncatedHash: voter.truncatedHash,
        registeredAt: voter.createdAt,
      },
    })
  } catch (err) {
    console.error('❌ Registration error:', err.message)

    // Handle Mongoose duplicate key error
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
//  Simulate biometric authentication.
//  Takes NID (and optional mock biometric input), verifies identity,
//  and returns the voter's on-chain hash for vote casting.
// ──────────────────────────────────────────────────
router.post('/authenticate', async (req, res) => {
  try {
    const { nid, biometricInput } = req.body

    // ── Validate input ──
    if (!nid) {
      return res.status(400).json({
        success: false,
        error: 'NID is required for authentication.',
      })
    }

    // ── Look up voter by NID ──
    const voter = await Voter.findOne({ nid: nid.trim() })
    if (!voter) {
      return res.status(404).json({
        success: false,
        error: 'No voter found with this NID. Please register first.',
      })
    }

    // ── Simulate biometric matching ──
    let biometricScore = 1.0 // default: perfect match (NID lookup is the primary check)
    let biometricMethod = 'nid-lookup'

    if (biometricInput?.faceEmbedding && voter.faceEmbedding.length > 0) {
      // If the frontend sends a face embedding, compute cosine similarity
      biometricScore = computeSimilarity(
        voter.faceEmbedding,
        biometricInput.faceEmbedding
      )
      biometricMethod = 'face-embedding'

      // Threshold check (in production, ~0.6 for face recognition)
      if (biometricScore < 0.3) {
        return res.status(401).json({
          success: false,
          error: 'Biometric verification failed. Face does not match.',
          biometricScore: parseFloat(biometricScore.toFixed(4)),
        })
      }
    }

    // ── Verify the stored hash is reproducible ──
    // Decrypt the salt and re-derive the hash to ensure data integrity
    const salt = decryptSalt(voter.encryptedSalt)
    const recomputedHash = createVoterHash(voter.nid, salt)

    if (recomputedHash !== voter.voterHash) {
      console.error(`⚠️ Hash integrity check failed for NID: ${voter.nid}`)
      return res.status(500).json({
        success: false,
        error: 'Data integrity check failed. Please contact the Election Commission.',
      })
    }

    console.log(`🔓 Voter authenticated: ${voter.name} | Method: ${biometricMethod}`)

    // ── Return the voter hash to the frontend ──
    // The frontend will use this hash to call castVote(candidateId, voterHash) on-chain
    return res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      data: {
        voterHash: voter.voterHash,
        name: voter.name,
        truncatedHash: voter.truncatedHash,
        biometricScore: parseFloat(biometricScore.toFixed(4)),
        biometricMethod,
      },
    })
  } catch (err) {
    console.error('❌ Authentication error:', err.message)
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication.',
    })
  }
})

// ──────────────────────────────────────────────────
//  GET /api/voters
//  List all registered voters (admin utility).
//  Excludes sensitive fields (encryptedSalt, faceEmbedding).
// ──────────────────────────────────────────────────
router.get('/voters', async (_req, res) => {
  try {
    const voters = await Voter.find({})
      .select('-encryptedSalt -faceEmbedding -__v')
      .sort({ createdAt: -1 })

    return res.status(200).json({
      success: true,
      count: voters.length,
      data: voters,
    })
  } catch (err) {
    console.error('❌ Fetch voters error:', err.message)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch voters.',
    })
  }
})

// ──────────────────────────────────────────────────
//  GET /api/voter/:nid
//  Look up a single voter by NID (admin utility).
// ──────────────────────────────────────────────────
router.get('/voter/:nid', async (req, res) => {
  try {
    const voter = await Voter.findOne({ nid: req.params.nid })
      .select('-encryptedSalt -faceEmbedding -__v')

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
    console.error('❌ Voter lookup error:', err.message)
    return res.status(500).json({
      success: false,
      error: 'Failed to look up voter.',
    })
  }
})

// ──────────────────────────────────────────────────
//  PATCH /api/voter/:nid/mark-registered
//  Mark a voter as registered on-chain (admin utility).
// ──────────────────────────────────────────────────
router.patch('/voter/:nid/mark-registered', async (req, res) => {
  try {
    const voter = await Voter.findOneAndUpdate(
      { nid: req.params.nid },
      { isRegistered: true },
      { new: true }
    ).select('-encryptedSalt -faceEmbedding -__v')

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
    console.error('❌ Mark registered error:', err.message)
    return res.status(500).json({
      success: false,
      error: 'Failed to update voter registration status.',
    })
  }
})

export default router
