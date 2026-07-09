const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const htmlPath = path.resolve('spec-document.html');
  const out = process.argv[2] || 'Interactive-Mesozoic-Dinosaur-Atlas-Specification.pdf';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
  await page.goto('file://' + htmlPath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__done === true', { timeout: 90000 });
  const err = await page.evaluate('window.__err || ""');
  if (err) console.log('MERMAID ERROR:', err);
  // give layout/fonts a beat
  await page.waitForTimeout(600);
  const footer = `<div style="font-family:'IBM Plex Mono',monospace;font-size:7px;color:#7c8b98;width:100%;
    padding:0 15mm;display:flex;justify-content:space-between;">
    <span>Interactive Mesozoic Dinosaur Atlas — Functional Specification V2</span>
    <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  await page.pdf({
    path: out, format: 'A4', printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer,
    margin: { top: '15mm', bottom: '16mm', left: '14mm', right: '14mm' }
  });
  await browser.close();
  console.log('wrote', out);
})().catch(e => { console.error(e); process.exit(1); });
