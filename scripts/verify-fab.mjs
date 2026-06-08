import { chromium, devices } from 'playwright';

const iPhone = devices['iPhone 12'];
const SITE = 'https://infinityegstore.com';

const browser = await chromium.launch();
const context = await browser.newContext({ ...iPhone });
const page = await context.newPage();

const fail = (msg) => { console.error('FAIL:', msg); };

// 1) Find a book page URL from the catalogue.
await page.goto(`${SITE}/books`, { waitUntil: 'networkidle' });
const bookHref = await page.evaluate(() => {
  const a = document.querySelector('a[href*="/books/"]');
  return a ? a.getAttribute('href') : null;
});
if (!bookHref) { fail('no book link found on /books'); await browser.close(); process.exit(1); }
const bookUrl = bookHref.startsWith('http') ? bookHref : SITE + bookHref;
console.log('book page:', bookUrl);

await page.goto(bookUrl, { waitUntil: 'networkidle' });

// Selectors: the sticky bar is the fixed bottom-0 z-30 div; the FAB has .whatsapp-fab
const barSel = 'div.fixed.bottom-0.z-30';
const fabSel = '.whatsapp-fab';

const hasFab = await page.locator(fabSel).count();
const hasBar = await page.locator(barSel).count();
console.log('FAB present:', hasFab, '| sticky bar present:', hasBar);
if (!hasFab) fail('WhatsApp FAB (.whatsapp-fab) not on page');
if (!hasBar) fail('sticky ATC bar not on page (book may be out of stock)');

// State BEFORE scroll: bar should be hidden (translate-y-full), body has no atc-bar-up
const before = await page.evaluate((s) => ({
  bodyClass: document.body.classList.contains('atc-bar-up'),
}), {});
await page.screenshot({ path: 'scripts/_fab-before.png' });
console.log('before scroll — body.atc-bar-up:', before.bodyClass);

// Scroll to the bottom so the in-flow ATC leaves the viewport and the bar slides up.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(600); // allow IntersectionObserver + slide transition

const result = await page.evaluate(({ barSel, fabSel }) => {
  const bar = document.querySelector(barSel);
  const fab = document.querySelector(fabSel);
  const b = bar?.getBoundingClientRect();
  const f = fab?.getBoundingClientRect();
  const cs = fab ? getComputedStyle(fab) : null;
  return {
    bodyClass: document.body.classList.contains('atc-bar-up'),
    barRect: b && { top: b.top, bottom: b.bottom, height: b.height },
    fabRect: f && { top: f.top, bottom: f.bottom, height: f.height },
    fabBottomCss: cs?.bottom,
    atcBarHeightVar: getComputedStyle(document.body).getPropertyValue('--atc-bar-height'),
    viewportH: window.innerHeight,
  };
}, { barSel, fabSel });

await page.screenshot({ path: 'scripts/_fab-after.png' });

console.log('\n--- after scroll ---');
console.log(JSON.stringify(result, null, 2));

// Assertions
let ok = true;
if (!result.bodyClass) { ok = false; fail('body.atc-bar-up not set after scroll (bar not detected as visible)'); }
if (result.barRect && result.fabRect) {
  // bar must actually be on-screen (top within viewport)
  const barOnScreen = result.barRect.top < result.viewportH - 5;
  if (!barOnScreen) { ok = false; fail('sticky bar did not slide into view'); }
  // No vertical overlap: FAB's bottom edge must be at/above the bar's top edge.
  const gap = result.barRect.top - result.fabRect.bottom;
  console.log(`\nvertical gap between FAB bottom and bar top: ${gap.toFixed(1)}px`);
  if (gap < 0) { ok = false; fail(`FAB overlaps the bar by ${(-gap).toFixed(1)}px`); }
  else console.log('OK: FAB sits fully above the bar (no overlap).');
} else {
  ok = false; fail('could not measure bar/FAB rects after scroll');
}

console.log('\n==== ' + (ok ? 'PASS' : 'FAIL') + ' ====');
await browser.close();
process.exit(ok ? 0 : 1);
