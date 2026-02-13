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
          console.log('✅ Sent:', tokenData.name);
          resolve(response);
        } else {
          reject(new Error(`Backend returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function extractTokenData() {
  return await page.evaluate(() => {
    const tokens = [];
    
    // Find all potential token containers
    const containers = document.querySelectorAll('div, article, section');
    
    for (const el of containers) {
      const html = el.innerHTML || '';
      const text = el.textContent || '';
      
      // Must have a contract address
      const contractMatch = text.match(/0x[a-fA-F0-9]{40}/);
      if (!contractMatch) continue;
      
      const contract = contractMatch[0];
      
      // Extract name (usually before the contract or symbol)
      let name = 'Unknown Token';
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      for (const line of lines) {
        if (line.length > 3 && line.length < 50 && !line.includes('0x') && !line.includes('@')) {
          name = line;
          break;
        }
      }
      
      // Extract symbol (usually $SYMBOL format)
      const symbolMatch = text.match(/\$([A-Z0-9]+)/);
      const symbol = symbolMatch ? '$' + symbolMatch[1] : '';
      
      // Extract tweet URL or embedded tweet
      let tweetUrl = '';
      const tweetLinkMatch = html.match(/https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
      if (tweetLinkMatch) {
        tweetUrl = tweetLinkMatch[0];
      }
      
      // Check if this container has an embedded tweet iframe
      const hasTweet = html.includes('twitter.com/embed') || html.includes('Tweet') || tweetUrl;
      
      const tokenData = {
        contract: contract,
        name: name,
        symbol: symbol,
        tweetUrl: tweetUrl,
        hasTweet: hasTweet,
        timestamp: Date.now()
      };
      
      tokens.push(tokenData);
    }
    
    // Deduplicate by contract
    const seen = new Set();
    return tokens.filter(t => {
      if (seen.has(t.contract)) return false;
      seen.add(t.contract);
      return true;
    });
  });
}

async function startScraping() {
  try {
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();
    
    console.log(`🔗 Navigating to ${SCRAPE_URL}...`);
    await page.goto(SCRAPE_URL, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });

    console.log('⏳ Waiting for content...');
    await new Promise(r => setTimeout(r, 8000));

    console.log('👀 Starting extraction...');
    
    setInterval(async () => {
      try {
        const tokens = await extractTokenData();
        
        for (const token of tokens) {
          const key = token.contract;
          if (!seenTokens.has(key)) {
            seenTokens.add(key);
            console.log('🎯 Token:', token.name, token.symbol);
            await sendTokenToBackend(token).catch(e => 
              console.error('❌ Send failed:', e.message)
            );
          }
        }
        
        if (tokens.length > 0) {
          console.log(`📊 Found ${tokens.length} tokens`);
        }
      } catch (e) {
        console.error('❌ Error:', e.message);
      }
    }, 10000);

    console.log('✅ Scraper running!');
    
  } catch (error) {
    console.error('❌ Fatal:', error.message);
    setTimeout(startScraping, 10000);
  }
}

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

console.log('🚀 Simple Scraper (Name + Symbol + Tweet)');
console.log(`📡 Backend: ${BACKEND_URL}`);
startScraping();
