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
    console.log('🚀 Scraper v2 - Improved parsing...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();
    
    await page.exposeFunction('sendToken', async (tokenData) => {
      try {
        await sendTokenToBackend(tokenData);
        console.log('✅', tokenData.name, tokenData.symbol || '');
      } catch (e) {
        console.error('❌ Send failed');
      }
    });
    
    console.log('🔗 Loading page...');
    await page.goto(SCRAPE_URL, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });

    console.log('⏳ Waiting...');
    await new Promise(r => setTimeout(r, 10000));

    await page.evaluate(() => {
      const processed = new Set();
      
      function extractToken(element) {
        const text = element.textContent || '';
        const html = element.innerHTML || '';
        
        // Must have contract
        const contractMatch = text.match(/0x[a-fA-F0-9]{40}/);
        if (!contractMatch) return null;
        
        const contract = contractMatch[0];
        if (processed.has(contract)) return null;
        processed.add(contract);
        
        const beforeContract = text.split(contract)[0];
        
        // Extract symbol FIRST ($SYMBOL)
        const symbolMatch = beforeContract.match(/\$([A-Z0-9]+)/);
        const symbol = symbolMatch ? '$' + symbolMatch[1] : '';
        
        // Extract name - text before GMGN/Tax/@, but REMOVE symbol from it
        let name = '';
        
        // Get text before markers
        const gmgnMatch = beforeContract.match(/([A-Za-z0-9\s]{2,60})GMGN/);
        const taxMatch = beforeContract.match(/([A-Za-z0-9\s]{2,60})Tax:/);
        const atMatch = beforeContract.match(/([A-Za-z0-9\s]{2,60})@/);
        
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
        
        // IMPORTANT: Remove the symbol from the name if it appears
        if (symbol) {
          const symbolText = symbol.replace('$', ''); // Remove $
          // Remove symbol text from name (case insensitive)
          name = name.replace(new RegExp(symbolText + '\\s*$', 'i'), '').trim();
          name = name.replace(new RegExp('^\\s*' + symbolText, 'i'), '').trim();
        }
        
        // Take last word if multiple remain
        const words = name.split(/\s+/).filter(w => w.length > 1);
        if (words.length > 0) {
          name = words[words.length - 1];
        }
        
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
      
      console.log('Processing tokens...');
      document.querySelectorAll('*').forEach(el => {
        const token = extractToken(el);
        if (token) window.sendToken(token);
      });
      
      console.log('Watching for new...');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              const token = extractToken(node);
              if (token) {
                console.log('🎯 New:', token.name, token.symbol);
                window.sendToken(token);
              }
              
              const children = node.querySelectorAll ? node.querySelectorAll('*') : [];
              children.forEach(child => {
                const t = extractToken(child);
                if (t) {
                  console.log('🎯 New (child):', t.name, t.symbol);
                  window.sendToken(t);
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
      
      console.log('✅ Active!');
    });

    console.log('✅ Running!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    setTimeout(startScraping, 15000);
  }
}

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

startScraping();
