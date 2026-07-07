import mongoose from 'mongoose'
import { encryptNID, decryptNID } from '../utils/crypto.js'

/**
 * Voter Schema
 *
 * Stores voter identity data for off-chain biometric verification.
 * NID is encrypted at rest using AES-256-GCM.
 */
const voterSchema = new mongoose.Schema(
  {
    encryptedNID: {
      type: String,
      required: [true, 'National ID is required'],
      unique: true,
      index: true,
    },
    nidHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    encryptedSalt: {
      type: String,
      required: true,
    },
    voterHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    faceEmbedding: {
      type: [Number],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v),
        message: 'faceEmbedding must be an array of numbers',
      },
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

// Virtual: truncated hash for display
voterSchema.virtual('truncatedHash').get(function () {
  return this.voterHash
    ? `${this.voterHash.slice(0, 10)}...${this.voterHash.slice(-6)}`
    : ''
})

// Virtual: decrypt NID for internal use only
voterSchema.virtual('nid').get(function () {
  try {
    return decryptNID(this.encryptedNID)
  } catch {
    return null
  }
})

// Ensure virtuals are included in JSON output
voterSchema.set('toJSON', { virtuals: true })
voterSchema.set('toObject', { virtuals: true })

const Voter = mongoose.model('Voter', voterSchema)

export default Voter
