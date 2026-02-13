const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth middleware for scraper
const SCRAPER_TOKEN = process.env.SCRAPER_TOKEN || 'local-scraper-secret';

function authScraper(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth === `Bearer ${SCRAPER_TOKEN}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: wss.clients.size, tokens: tokens.length });
});

// API endpoint to receive tokens from scraper
app.post('/api/token', authScraper, (req, res) => {
  const tokenData = req.body;
  
  if (!tokenData || !tokenData.contract) {
    return res.status(400).json({ error: 'Invalid token data' });
  }
  
  // Add to tokens array
  tokens.unshift(tokenData);
  if (tokens.length > 100) tokens.pop();
  
  console.log('📥 Received token:', tokenData.name || tokenData.contract.slice(0, 10));
  
  // Broadcast to all WebSocket clients
  broadcast({
    type: 'NEW_TOKEN',
    data: tokenData,
    timestamp: Date.now()
  });
  
  res.json({ success: true });
});

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

// Store active tokens
let tokens = [];

// Clean old tokens every 30 seconds
setInterval(() => {
  const now = Date.now();
  const fourMinutes = 4 * 60 * 1000; // 4 minutes in milliseconds
  const oldCount = tokens.length;
  
  tokens = tokens.filter(token => {
    const age = now - token.timestamp;
    return age < fourMinutes;
  });
  
  const removed = oldCount - tokens.length;
  if (removed > 0) {
    console.log(`🗑️  Cleaned ${removed} old tokens (older than 4 minutes)`);
  }
}, 30000); // Check every 30 seconds

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// No auto-generation - tokens come from external scraper
async function startMonitoring() {
  console.log('👀 Waiting for tokens from scraper...');
  console.log('💡 Make sure the local scraper is running and sending data');
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('✅ Client connected');
  
  // Send existing tokens
  ws.send(JSON.stringify({
    type: 'INITIAL_TOKENS',
    data: tokens,
    timestamp: Date.now()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📥 Received:', data);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    console.log('❌ Client disconnected');
  });
});

// Start monitoring
startMonitoring();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  process.exit(0);
});
