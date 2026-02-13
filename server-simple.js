const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: wss.clients.size });
});

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

// Store active tokens
let tokens = [];

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Function to fetch Base token data (placeholder - needs real API)
async function fetchBaseTokens() {
  // TODO: Replace with real data source
  // For now, generate demo data to show UI works
  return new Promise((resolve) => {
    const demoToken = {
      name: `Demo Token ${Math.floor(Math.random() * 1000)}`,
      symbol: `TKN${Math.floor(Math.random() * 999)}`,
      contract: `0x${Math.random().toString(16).substr(2, 40)}`,
      liquidity: `$${(Math.random() * 100).toFixed(2)}K`,
      creator: `0x${Math.random().toString(16).substr(2, 40)}`,
      timestamp: Date.now()
    };
    resolve(demoToken);
  });
}

// Simulate real-time token updates
async function startMonitoring() {
  console.log('👀 Monitoring for new tokens...');
  console.log('⚠️  Currently using DEMO data - needs real szn.zone integration');
  
  // Send new token every 30 seconds (demo)
  setInterval(async () => {
    const newToken = await fetchBaseTokens();
    tokens.unshift(newToken);
    if (tokens.length > 100) tokens.pop();
    
    console.log('🎯 New token:', newToken.name);
    broadcast({
      type: 'NEW_TOKEN',
      data: newToken,
      timestamp: Date.now()
    });
  }, 30000); // Every 30 seconds
  
  // Generate initial tokens
  for (let i = 0; i < 10; i++) {
    const token = await fetchBaseTokens();
    tokens.push(token);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
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
