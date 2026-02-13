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
          console.log('✅ Token sent to backend:', tokenData.name || tokenData.contract?.slice(0, 10));
          resolve(response);
        } else {
          console.error('❌ Backend error:', res.statusCode, response);
          reject(new Error(`Backend returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Failed to send token:', error.message);
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
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log(`🔗 Navigating to ${SCRAPE_URL}...`);
    await page.goto(SCRAPE_URL, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    console.log('👀 Monitoring for new tokens...');

    // Expose function to send tokens from browser context
    await page.exposeFunction('onTokenDetected', async (tokenData) => {
      const tokenId = tokenData.contract || tokenData.name || Math.random().toString();
      
      if (!seenTokens.has(tokenId)) {
        seenTokens.add(tokenId);
        console.log('🎯 New token detected:', tokenData.name || tokenId);
        
        try {
          await sendTokenToBackend(tokenData);
        } catch (error) {
          console.error('Failed to forward token:', error.message);
        }
      }
    });

    // Inject monitoring script into the page
    await page.evaluate(() => {
      console.log('Injecting token observer...');
      
      // Observer for DOM changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              try {
                // Try to extract token data from various possible structures
                let tokenData = null;
                
                // Check if this is a token container
                const possibleSelectors = [
                  '[data-token]',
                  '[class*="token"]',
                  '[class*="Token"]',
                  '[class*="card"]',
                  '[class*="Card"]'
                ];
                
                let element = null;
                for (const selector of possibleSelectors) {
                  element = node.matches?.(selector) ? node : node.querySelector?.(selector);
                  if (element) break;
                }
                
                if (element) {
                  // Extract text content from element
                  const text = element.textContent || '';
                  
                  // Try to find contract address (0x followed by 40 hex chars)
                  const contractMatch = text.match(/0x[a-fA-F0-9]{40}/);
                  
                  if (contractMatch) {
                    tokenData = {
                      contract: contractMatch[0],
                      name: element.querySelector('[class*="name"]')?.textContent || 'Unknown',
                      symbol: element.querySelector('[class*="symbol"]')?.textContent || '',
                      liquidity: element.querySelector('[class*="liquidity"]')?.textContent || 
                                element.querySelector('[class*="liq"]')?.textContent || '0',
                      creator: text.match(/0x[a-fA-F0-9]{40}/g)?.[1] || '',
                      timestamp: Date.now(),
                      rawText: text.slice(0, 200) // Keep some raw text for debugging
                    };
                    
                    window.onTokenDetected(tokenData);
                  }
                }
              } catch (e) {
                console.error('Error parsing token:', e);
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      console.log('✅ Observer attached to page');
    });

    // Keep the page alive
    console.log('✅ Scraper running. Waiting for tokens...');
    
  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    setTimeout(startScraping, 10000); // Retry after 10s
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down scraper...');
  if (browser) await browser.close();
  process.exit(0);
});

// Start scraping
console.log('🚀 Base Token Scraper starting...');
console.log(`📡 Backend: ${BACKEND_URL}`);
startScraping();
