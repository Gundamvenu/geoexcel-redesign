import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright';
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
for (let i = 0; i < 3; i++) {
  const r = await lighthouse(process.argv[2], { port: chrome.port, output: 'json', logLevel: 'error', formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, onlyCategories: ['performance'] });
  const a = r.lhr.audits;
  console.log('run', i, 'score', Math.round(r.lhr.categories.performance.score * 100), ...['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'speed-index'].map((k) => k.slice(0, 5) + '=' + a[k].displayValue));
  const el = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet; if (i === 0) console.log('LCP el:', el);
}
await chrome.kill();
