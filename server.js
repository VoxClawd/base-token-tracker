const express = require('express');
const { WebSocketServer } = require('ws');
const puppeteer = require('puppeteer');
const cors = require('cors');
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
let browser = null;
let page = null;

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Scrape szn.zone
async function startScraping() {
  try {
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('🔗 Navigating to szn.zone/base...');
    await page.goto('https://szn.zone/base', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    console.log('👀 Monitoring for new tokens...');

    // Monitor DOM changes
    await page.exposeFunction('onTokenDetected', (tokenData) => {
      console.log('🎯 New token detected:', tokenData.name);
      tokens.unshift(tokenData); // Add to beginning
      if (tokens.length > 100) tokens.pop(); // Keep last 100
      
      broadcast({
        type: 'NEW_TOKEN',
        data: tokenData,
        timestamp: Date.now()
      });
    });

    // Inject observer script
    await page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // Extract token data from the added node
              // This will need to be adapted based on szn.zone's HTML structure
              const tokenCard = node.querySelector ? node.querySelector('[data-token]') : null;
              if (tokenCard || node.getAttribute?.('data-token')) {
                const element = tokenCard || node;
                try {
                  const tokenData = {
                    name: element.querySelector('.token-name')?.textContent || 'Unknown',
                    symbol: element.querySelector('.token-symbol')?.textContent || '',
                    contract: element.querySelector('.contract-address')?.textContent || '',
                    liquidity: element.querySelector('.liquidity')?.textContent || '0',
                    creator: element.querySelector('.creator')?.textContent || '',
                    timestamp: Date.now()
                  };
                  window.onTokenDetected(tokenData);
                } catch (e) {
                  console.error('Error parsing token:', e);
                }
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      console.log('Observer attached');
    });

    // Keep page alive and monitor
    setInterval(async () => {
      if (page && !page.isClosed()) {
        // Extract current tokens periodically as backup
        const currentTokens = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('[class*="token"]'));
          return cards.slice(0, 50).map((card) => ({
            name: card.querySelector('[class*="name"]')?.textContent || 'Token',
            symbol: card.querySelector('[class*="symbol"]')?.textContent || '',
            contract: 'extracting...',
            timestamp: Date.now()
          }));
        }).catch(() => []);

        if (currentTokens.length > 0) {
          console.log(`📊 Monitoring ${currentTokens.length} tokens`);
        }
      }
    }, 30000);

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    setTimeout(startScraping, 10000); // Retry after 10s
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

// Start scraping
startScraping();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});
