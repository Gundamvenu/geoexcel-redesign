import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright';
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
const r = await lighthouse(process.argv[2], { port: chrome.port, output: 'json', logLevel: 'error', formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, onlyCategories: ['accessibility', 'performance'] });
for (const a of Object.values(r.lhr.audits)) if (a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary') console.log(a.id, '|', a.title, '|', (a.details?.items || []).slice(0, 3).map((i) => i.node?.snippet || i.node?.selector || '').join(' ; ').slice(0, 300));
console.log('LCP element:', r.lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 160));
await chrome.kill();
