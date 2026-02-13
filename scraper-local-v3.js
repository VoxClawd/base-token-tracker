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
    
    // Find all token cards/containers
    const elements = document.querySelectorAll('div[class*="card"], div[class*="token"], article, section');
    
    for (const el of elements) {
      const text = el.textContent || '';
      const html = el.innerHTML || '';
      
      // Must have a contract address to be a token
      const contractMatch = text.match(/0x[a-fA-F0-9]{40}/);
      if (!contractMatch) continue;
      
      const contract = contractMatch[0];
      
      // Extract all data
      const nameMatch = text.match(/([A-Za-z0-9\s]+)(?=\s+0x|$)/);
      const symbolMatch = text.match(/\$([A-Z0-9]+)/);
      const taxMatch = text.match(/Tax[:\s]*(\d+\.?\d*)%/i) || text.match(/(\d+\.?\d*)%/);
      const creatorMatch = text.match(/@(\w+)/);
      const followersMatch = text.match(/Followers?[:\s]*([\d,\.]+)/i);
      const tokensCreatedMatch = text.match(/Tokens created[:\s]*(\d+)/i);
      const liquidityMatch = text.match(/\$[\d,\.]+[KMB]?/);
      
      // Extract tags
      const tags = [];
      if (text.includes('GMGN')) tags.push('GMGN');
      if (text.includes('Ban deployer')) tags.push('Ban deployer');
      if (text.match(/AAA\d/)) tags.push(text.match(/AAA\d/)[0]);
      if (text.includes('OP Followers')) tags.push('OP Followers');
      
      // Check for embedded tweets
      const hasTweet = html.includes('twitter.com') || html.includes('Tweet');
      
      const tokenData = {
        contract: contract,
        name: nameMatch ? nameMatch[1].trim() : 'Unknown Token',
        symbol: symbolMatch ? symbolMatch[1] : '',
        tax: taxMatch ? taxMatch[1] + '%' : '',
        creator: creatorMatch ? '@' + creatorMatch[1] : '',
        followers: followersMatch ? followersMatch[1] : '',
        tokensCreated: tokensCreatedMatch ? tokensCreatedMatch[1] : '',
        liquidity: liquidityMatch ? liquidityMatch[0] : '',
        tags: tags.join(', '),
        hasTweet: hasTweet,
        timestamp: Date.now(),
        rawText: text.slice(0, 300)
      };
      
      // Only add if we have meaningful data
      if (tokenData.name !== 'Unknown Token' || tokenData.symbol) {
        tokens.push(tokenData);
      }
    }
    
    return tokens;
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

    console.log('👀 Starting extraction loop...');
    
    // Poll every 10 seconds
    setInterval(async () => {
      try {
        const tokens = await extractTokenData();
        
        for (const token of tokens) {
          const key = token.contract + token.name;
          if (!seenTokens.has(key)) {
            seenTokens.add(key);
            console.log('🎯 New token:', token.name, token.symbol);
            await sendTokenToBackend(token).catch(e => 
              console.error('❌ Send failed:', e.message)
            );
          }
        }
        
        if (tokens.length > 0) {
          console.log(`📊 Total tokens on page: ${tokens.length}`);
        }
      } catch (e) {
        console.error('❌ Extraction error:', e.message);
      }
    }, 10000);

    console.log('✅ Scraper v3 running!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    setTimeout(startScraping, 10000);
  }
}

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

console.log('🚀 Base Token Scraper v3 (Full Data) starting...');
console.log(`📡 Backend: ${BACKEND_URL}`);
startScraping();
