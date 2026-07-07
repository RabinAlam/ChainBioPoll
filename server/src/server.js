import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import voterRoutes from './routes/voter.js'

// ──────────────────────────────────────────────────
//  Config
// ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chainbiopoll'

// ──────────────────────────────────────────────────
//  Express App
// ──────────────────────────────────────────────────
const app = express()

// ── Middleware ──
app.use(cors({
  origin: [
    'http://localhost:5173',   // Vite dev server
    'http://localhost:3000',   // Alternate dev port
    'http://127.0.0.1:5173',
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Request logging ──
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.path}`)
  next()
})

// ──────────────────────────────────────────────────
//  Routes
// ──────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ChainBioPoll Backend',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })
})

// Voter routes
app.use('/api', voterRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found.',
  })
})

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('💥 Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error.',
  })
})

// ──────────────────────────────────────────────────
//  MongoDB Connection + Server Start
// ──────────────────────────────────────────────────
async function start() {
  try {
    console.log('🔌 Connecting to MongoDB…')
    await mongoose.connect(MONGODB_URI)
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`)

    app.listen(PORT, () => {
      console.log('')
      console.log('╔══════════════════════════════════════════════╗')
      console.log('║   ChainBioPoll Backend                       ║')
      console.log(`║   http://localhost:${PORT}                       ║`)
      console.log('╚══════════════════════════════════════════════╝')
      console.log('')
      console.log('Endpoints:')
      console.log(`  POST   http://localhost:${PORT}/api/register`)
      console.log(`  POST   http://localhost:${PORT}/api/authenticate`)
      console.log(`  GET    http://localhost:${PORT}/api/voters`)
      console.log(`  GET    http://localhost:${PORT}/api/voter/:nid`)
      console.log(`  PATCH  http://localhost:${PORT}/api/voter/:nid/mark-registered`)
      console.log(`  GET    http://localhost:${PORT}/api/health`)
      console.log('')
    })
  } catch (err) {
    console.error('❌ Failed to start server:', err.message)
    process.exit(1)
  }
}

start()
