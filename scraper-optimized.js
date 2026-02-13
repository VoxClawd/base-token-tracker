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
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Backend error ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function startScraping() {
  try {
    console.log('🚀 Starting optimized scraper...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();
    
    // Expose function to send tokens from browser
    await page.exposeFunction('sendToken', async (tokenData) => {
      try {
        await sendTokenToBackend(tokenData);
        console.log('✅', tokenData.name, tokenData.symbol || '');
      } catch (e) {
        console.error('❌ Send failed:', e.message);
      }
    });
    
    console.log('🔗 Loading szn.zone/base...');
    await page.goto(SCRAPE_URL, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });

    console.log('⏳ Waiting for tokens to load...');
    await new Promise(r => setTimeout(r, 10000));

    // Inject real-time observer
    await page.evaluate(() => {
      const processed = new Set();
      
      function extractTokenFromElement(element) {
        const text = element.textContent || '';
        const html = element.innerHTML || '';
        
        // Must have a contract
        const contractMatch = text.match(/0x[a-fA-F0-9]{40}/);
        if (!contractMatch) return null;
        
        const contract = contractMatch[0];
        if (processed.has(contract)) return null;
        processed.add(contract);
        
        // Extract name - text before GMGN or Tax or @
        let name = '';
        const beforeContract = text.split(contract)[0];
        
        // Look for pattern: [WORDS]GMGN or [WORDS]Tax: or [WORDS]@
        const gmgnMatch = beforeContract.match(/([A-Za-z0-9\s]{2,50})GMGN/);
        const taxMatch = beforeContract.match(/([A-Za-z0-9\s]{2,50})Tax:/);
        const atMatch = beforeContract.match(/([A-Za-z0-9\s]{2,50})@/);
        
        if (gmgnMatch) {
          name = gmgnMatch[1];
        } else if (taxMatch) {
          name = taxMatch[1];
        } else if (atMatch) {
          name = atMatch[1];
        }
        
        // Clean name
        name = name
          .replace(/Filters?/gi, '')
          .replace(/Token feed/gi, '')
          .replace(/Connected/gi, '')
          .replace(/Add\?/gi, '')
          .trim();
        
        // Take last word/phrase if multiple
        const words = name.split(/\s+/).filter(w => w.length > 1);
        if (words.length > 0) {
          name = words[words.length - 1];
        }
        
        // Symbol
        const symbolMatch = text.match(/\$([A-Z0-9]+)/);
        const symbol = symbolMatch ? '$' + symbolMatch[1] : '';
        
        // Tweet URL
        const tweetMatch = html.match(/https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
        const tweetUrl = tweetMatch ? tweetMatch[0] : '';
        
        if (name && name.length >= 2) {
          return {
            contract,
            name,
            symbol,
            tweetUrl,
            timestamp: Date.now()
          };
        }
        
        return null;
      }
      
      // Process existing tokens first
      console.log('Processing existing tokens...');
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const token = extractTokenFromElement(el);
        if (token) {
          window.sendToken(token);
        }
      });
      
      // Watch for new tokens
      console.log('Watching for new tokens...');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              const token = extractTokenFromElement(node);
              if (token) {
                console.log('🎯 New token detected:', token.name);
                window.sendToken(token);
              }
              
              // Also check children
              const children = node.querySelectorAll ? node.querySelectorAll('*') : [];
              children.forEach(child => {
                const childToken = extractTokenFromElement(child);
                if (childToken) {
                  console.log('🎯 New token (child):', childToken.name);
                  window.sendToken(childToken);
                }
              });
            }
          });
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      console.log('✅ Observer active!');
    });

    console.log('✅ Scraper running - watching for new tokens!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    setTimeout(startScraping, 15000);
  }
}

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

startScraping();
