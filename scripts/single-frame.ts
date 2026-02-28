import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
chromium.use(StealthPlugin());
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
	const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
	await page.goto('http://localhost:5173?host=unavailable.kajkowalski.nl', { waitUntil: 'domcontentloaded' });
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.waitForTimeout(3000);
	await page.screenshot({ path: 'screenshot.png' });
} finally {
	await browser.close();
}
console.log('done');
