const puppeteer = require('puppeteer');
const https = require('https');

const BACKEND_URL = process.env.BACKEND_URL || 'https://base-token-tracker.onrender.com';
const SCRAPE_URL = 'https://szn.zone/base';

let browser = null;
let page = null;
let seenTokens = new Set();

async function sendTokenToBackend(tokenData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(tokenData);
    const url = new URL('/api/token', BACKEND_URL);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${process.env.SCRAPER_TOKEN || 'local-scraper-secret'}`
      }
    };

    const req = https.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Token sent:', tokenData.name || tokenData.contract?.slice(0, 10));
          resolve(response);
        } else {
          console.error('❌ Backend error:', res.statusCode);
          reject(new Error(`Backend returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Network error:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function startScraping() {
  try {
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    page = await browser.newPage();
    
    // Intercept network requests to catch API/WebSocket data
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      console.log('📡 Request:', url.slice(0, 80));
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('token')) {
        try {
          const text = await response.text();
          console.log('📥 API Response from:', url.slice(0, 60));
          console.log('   Data sample:', text.slice(0, 200));
        } catch (e) {
          // Ignore
        }
      }
    });

    console.log(`🔗 Navigating to ${SCRAPE_URL}...`);
    await page.goto(SCRAPE_URL, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });

    console.log('⏳ Waiting for content to load...');
    await new Promise(r => setTimeout(r, 5000));

    // Check what's on the page
    const pageInfo = await page.evaluate(() => {
      return {
        html: document.body.innerHTML.slice(0, 1000),
        hasAddresses: document.body.innerHTML.includes('0x'),
        divCount: document.querySelectorAll('div').length
      };
    });
    
    console.log('📄 Page info:', pageInfo);

    // Set up continuous monitoring
    console.log('👀 Setting up monitors...');
    
    // Method 1: Poll the page every 10 seconds
    setInterval(async () => {
      try {
        const tokens = await page.evaluate(() => {
          const addresses = document.body.innerHTML.match(/0x[a-fA-F0-9]{40}/g) || [];
          const uniqueAddresses = [...new Set(addresses)];
          
          return uniqueAddresses.slice(0, 5).map(addr => ({
            contract: addr,
            name: `Token ${addr.slice(0, 6)}`,
            timestamp: Date.now()
          }));
        });
        
        for (const token of tokens) {
          if (!seenTokens.has(token.contract)) {
            seenTokens.add(token.contract);
            console.log('🎯 New token found:', token.contract);
            await sendTokenToBackend(token);
          }
        }
      } catch (e) {
        console.error('Error polling page:', e.message);
      }
    }, 10000);

    console.log('✅ Scraper running!');
    
  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    setTimeout(startScraping, 10000);
  }
}

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

console.log('🚀 Base Token Scraper v2 starting...');
console.log(`📡 Backend: ${BACKEND_URL}`);
startScraping();
