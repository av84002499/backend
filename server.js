// server.js — Render.com deployment (API only)
// Frontend is on Vercel. This server handles ONLY /api/* and /uploads/*
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = parseInt(process.env.PORT) || 5000;
const HOST = '0.0.0.0';

let dbStatus = 'connecting';

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Uploads ───────────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    db:     dbStatus,
    time:   new Date().toISOString(),
    env:    process.env.NODE_ENV || 'production',
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',            require('./routes/authRoutes'));
app.use('/api/organizations',   require('./routes/orgRoutes'));
app.use('/api/reports',         require('./routes/reportRoutes'));
app.use('/api/vulnerabilities', require('./routes/vulnerabilityRoutes'));

// ── Root route ────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'VAPT Report Tool API is running',
    db:      dbStatus,
    health:  '/api/health',
  });
});

// ── 404 for anything else ─────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀  API running on ${HOST}:${PORT}`);
  console.log(`    MONGODB_URI : ${process.env.MONGODB_URI ? '✅ set' : '❌ NOT SET'}`);
  console.log(`    FRONTEND_URL: ${process.env.FRONTEND_URL || '(any)'}`);

  require('./config/db')()
    .then(() => { dbStatus = 'connected'; console.log('✅  MongoDB connected'); })
    .catch(err => { dbStatus = 'error'; console.error('❌  MongoDB:', err.message); });
});

process.on('unhandledRejection', r => console.error('UnhandledRejection:', r));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
