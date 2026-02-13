const puppeteer = require('puppeteer');
const https = require('https');

const BACKEND_URL = process.env.BACKEND_URL || 'https://base-token-tracker.onrender.com';
const SCRAPE_URL = 'https://szn.zone/base';

let browser = null;
let page = null;

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
        'Authorization': 'Bearer local-scraper-secret'
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) resolve();
      else reject(new Error(`Backend ${res.statusCode}`));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function startScraping() {
  try {
    console.log('🚀 Scraper v3...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();
    
    await page.exposeFunction('sendToken', async (tokenData) => {
      try {
        await sendTokenToBackend(tokenData);
        console.log('✅', tokenData.name, tokenData.symbol || '(no symbol)');
      } catch (e) {
        console.error('❌ Failed');
      }
    });
    
    console.log('🔗 Loading...');
    await page.goto(SCRAPE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(r => setTimeout(r, 10000));

    await page.evaluate(() => {
      const processed = new Set();
      
      function extractToken(element) {
        const text = element.textContent || '';
        const html = element.innerHTML || '';
        
        const contractMatch = text.match(/0x[a-fA-F0-9]{40}/);
        if (!contractMatch) return null;
        
        const contract = contractMatch[0];
        if (processed.has(contract)) return null;
        processed.add(contract);
        
        const beforeContract = text.split(contract)[0];
        
        // Extract symbol first
        const symbolMatch = beforeContract.match(/\$([A-Z0-9]+)/);
        const symbolText = symbolMatch ? symbolMatch[1] : '';
        const symbol = symbolText ? '$' + symbolText : '';
        
        // Extract name - find text before GMGN/Tax/@ markers
        let rawName = '';
        const gmgnMatch = beforeContract.match(/([^\n]{2,80})GMGN/);
        const taxMatch = beforeContract.match(/([^\n]{2,80})Tax:/);
        const atMatch = beforeContract.match(/([^\n]{2,80})@/);
        
        if (gmgnMatch) rawName = gmgnMatch[1];
        else if (taxMatch) rawName = taxMatch[1];
        else if (atMatch) rawName = atMatch[1];
        
        // Clean the name
        let name = rawName
          .replace(/Filters?/gi, '')
          .replace(/Token feed/gi, '')
          .replace(/Connected/gi, '')
          .replace(/Add\?/gi, '')
          .trim();
        
        // If we have a symbol, remove it from name
        if (symbolText) {
          // Remove $SYMBOL pattern
          name = name.replace(new RegExp('\\$' + symbolText + '\\s*', 'gi'), '');
          // Remove just SYMBOL pattern (all caps version at end)
          name = name.replace(new RegExp(symbolText + '\\s*$', 'i'), '');
        }
        
        // Take the last meaningful word
        const words = name.split(/\s+/).filter(w => w && w.length > 1);
        if (words.length > 0) {
          name = words[words.length - 1];
        }
        
        // Final cleanup - remove any remaining uppercase duplicates
        if (name && symbolText) {
          if (name.toLowerCase() === symbolText.toLowerCase()) {
            // Name and symbol are the same, just use one
            name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
          }
        }
        
        // Tweet URL
        const tweetMatch = html.match(/https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
        const tweetUrl = tweetMatch ? tweetMatch[0] : '';
        
        if (name && name.length >= 2) {
          return { contract, name, symbol, tweetUrl, timestamp: Date.now() };
        }
        
        return null;
      }
      
      console.log('Processing...');
      document.querySelectorAll('*').forEach(el => {
        const token = extractToken(el);
        if (token) window.sendToken(token);
      });
      
      console.log('Watching...');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              const token = extractToken(node);
              if (token) window.sendToken(token);
              
              const children = node.querySelectorAll ? node.querySelectorAll('*') : [];
              children.forEach(child => {
                const t = extractToken(child);
                if (t) window.sendToken(t);
              });
            }
          });
        });
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      console.log('✅ Active!');
    });

    console.log('✅ Running!');
    
  } catch (error) {
    console.error('❌', error.message);
    setTimeout(startScraping, 15000);
  }
}

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

startScraping();
