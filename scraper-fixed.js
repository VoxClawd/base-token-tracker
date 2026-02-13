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
          console.log('✅', tokenData.name, tokenData.symbol || '');
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
    const bodyHTML = document.body.innerHTML;
    
    // Find all contracts
    const contracts = bodyText.match(/0x[a-fA-F0-9]{40}/g) || [];
    const uniqueContracts = [...new Set(contracts)];
    
    for (const contract of uniqueContracts) {
      // Find text around this contract
      const contractIndex = bodyText.indexOf(contract);
      if (contractIndex === -1) continue;
      
      // Get 400 chars before contract
      const before = bodyText.slice(Math.max(0, contractIndex - 400), contractIndex);
      
      // Name is usually the last words before "GMGN" or "Tax:" or "@"
      let name = '';
      
      // Try to find pattern: [NAME]GMGN
      const gmgnMatch = before.match(/([A-Za-z0-9\s]{2,40})GMGN/);
      if (gmgnMatch) {
        name = gmgnMatch[1].trim();
      } else {
        // Try pattern: [NAME]Tax:
        const taxMatch = before.match(/([A-Za-z0-9\s]{2,40})Tax:/);
        if (taxMatch) {
          name = taxMatch[1].trim();
        } else {
          // Try pattern: [NAME]@
          const atMatch = before.match(/([A-Za-z0-9\s]{2,40})@/);
          if (atMatch) {
            name = atMatch[1].trim();
          }
        }
      }
      
      // Clean up name - remove common noise words
      name = name.replace(/Filters?/g, '').replace(/Token feed/g, '').replace(/Connected/g, '').trim();
      
      // Extract symbol if present ($SYMBOL)
      const symbolMatch = before.match(/\$([A-Z0-9]+)/);
      const symbol = symbolMatch ? '$' + symbolMatch[1] : '';
      
      // Extract tweet URL from HTML near this contract
      const htmlIndex = bodyHTML.indexOf(contract);
      const htmlAround = bodyHTML.slice(Math.max(0, htmlIndex - 2000), htmlIndex + 500);
      const tweetMatch = htmlAround.match(/https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
      const tweetUrl = tweetMatch ? tweetMatch[0] : '';
      
      if (name && name.length > 1) {
        tokens.push({
          contract: contract,
          name: name,
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

    console.log('👀 Extracting...');
    
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

console.log('🚀 Scraper FIXED (Name + Symbol + Tweet)');
startScraping();
