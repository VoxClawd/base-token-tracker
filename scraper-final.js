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
          console.log('✅', tokenData.name, tokenData.symbol);
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

async function extractTokens() {
  return await page.evaluate(() => {
    const tokens = [];
    const bodyText = document.body.textContent;
    
    // Find all contract addresses
    const contracts = bodyText.match(/0x[a-fA-F0-9]{40}/g) || [];
    const uniqueContracts = [...new Set(contracts)];
    
    for (const contract of uniqueContracts) {
      // Find this contract in the page
      const allElements = Array.from(document.querySelectorAll('*'));
      const containerEl = allElements.find(el => {
        const text = el.textContent || '';
        return text.includes(contract) && el.children.length > 0 && el.children.length < 20;
      });
      
      if (!containerEl) continue;
      
      const text = containerEl.textContent;
      const html = containerEl.innerHTML;
      
      // Extract name - look for text before GMGN/Tax/@/0x
      const beforeContract = text.split(contract)[0];
      const lines = beforeContract.split('\n').map(l => l.trim()).filter(l => l);
      
      let name = '';
      // Name is usually a clean word/phrase before symbols/addresses
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.includes('GM') && !line.includes('@') && !line.includes('Tax') && 
            !line.includes('Filter') && !line.includes('Token') && 
            line.length > 2 && line.length < 40 &&
            !/^\d+/.test(line)) {
          name = line;
          break;
        }
      }
      
      // Extract symbol - look for $SYMBOL
      const symbolMatch = text.match(/\$([A-Z0-9]{1,10})/);
      const symbol = symbolMatch ? '$' + symbolMatch[1] : '';
      
      // Extract tweet URL
      const tweetMatch = html.match(/https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
      const tweetUrl = tweetMatch ? tweetMatch[0] : '';
      
      if (name || symbol) {
        tokens.push({
          contract: contract,
          name: name || 'Token',
          symbol: symbol,
          tweetUrl: tweetUrl,
          timestamp: Date.now()
        });
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

    console.log('⏳ Waiting...');
    await new Promise(r => setTimeout(r, 10000));

    console.log('👀 Extracting tokens...');
    
    setInterval(async () => {
      try {
        const tokens = await extractTokens();
        
        for (const token of tokens) {
          if (!seenTokens.has(token.contract)) {
            seenTokens.add(token.contract);
            await sendTokenToBackend(token).catch(e => 
              console.error('❌', e.message)
            );
          }
        }
        
        if (tokens.length > 0) {
          console.log(`📊 ${tokens.length} tokens`);
        }
      } catch (e) {
        console.error('❌', e.message);
      }
    }, 10000);

    console.log('✅ Running!');
    
  } catch (error) {
    console.error('❌', error.message);
    setTimeout(startScraping, 10000);
  }
}

process.on('SIGINT', async () => {
  console.log('🛑 Bye');
  if (browser) await browser.close();
  process.exit(0);
});

console.log('🚀 Scraper Final (szn.zone → Dashboard)');
startScraping();
