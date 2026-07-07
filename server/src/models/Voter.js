import mongoose from 'mongoose'

/**
 * Voter Schema
 *
 * Stores voter identity data for off-chain biometric verification.
 *
 * Fields:
 *  - nid:             National ID (unique identifier — stored for lookup during authentication)
 *  - name:            Voter's full name
 *  - encryptedSalt:   AES-encrypted random salt (used to derive voterHash)
 *  - voterHash:       keccak256(nid + salt) — this is the pseudonymous hash registered on-chain
 *  - faceEmbedding:   Mock biometric data (array of numbers simulating a facial embedding vector)
 *  - isRegistered:    Whether this voter's hash has been registered on the smart contract
 *  - registeredAt:    Timestamp of registration
 */
const voterSchema = new mongoose.Schema(
  {
    nid: {
      type: String,
      required: [true, 'National ID is required'],
      unique: true,
      trim: true,
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
    ? `${this.voterHash.slice(0, 10)}…${this.voterHash.slice(-6)}`
    : ''
})

// Ensure virtuals are included in JSON output
voterSchema.set('toJSON', { virtuals: true })
voterSchema.set('toObject', { virtuals: true })

const Voter = mongoose.model('Voter', voterSchema)

export default Voter
