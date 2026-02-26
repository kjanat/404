/**
 * Validate that the Edge tooltip is not clipped by the panel container.
 * Always rebuilds the project to ensure fresh output.
 * Run: bun scripts/validate-tooltip.ts
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const distHtml = resolve('dist/index.html');

console.log('Building project...');
execSync('bun run build', { stdio: 'inherit' });

if (!existsSync(distHtml)) {
	console.error('Build failed: dist/index.html not found');
	process.exit(1);
}

const browser = await chromium.launch({
	args: ['--no-sandbox', '--disable-gpu'],
});

try {
	const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
	await page.goto(`file://${distHtml}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(500);

	// Hover over the "Edge" word to trigger the tooltip
	const edgeWord = page.locator('.edge-word');
	await edgeWord.hover();
	await page.waitForTimeout(400); // Wait for opacity transition (180ms + margin)

	// Check tooltip visibility via computed style of ::after pseudo-element
	const tooltipInfo = await page.evaluate(() => {
		const el = document.querySelector('.edge-word');
		if (!el) return { error: 'element not found' };

		const afterStyle = window.getComputedStyle(el, '::after');
		const opacity = afterStyle.opacity;
		const visibility = afterStyle.visibility;
		const content = afterStyle.content;

		// Get bounding rects
		const elRect = el.getBoundingClientRect();
		const panelEl = el.closest('.panel');
		const panelRect = panelEl?.getBoundingClientRect();

		return {
			opacity,
			visibility,
			content,
			elementTop: elRect.top,
			panelTop: panelRect?.top ?? null,
			panelOverflow: panelEl ? window.getComputedStyle(panelEl).overflow : null,
		};
	});

	console.log('\n=== Tooltip Validation Results ===');
	console.log(JSON.stringify(tooltipInfo, null, 2));

	// Take a screenshot for visual confirmation
	await page.screenshot({ path: 'tooltip-validation.png' });
	console.log('\nScreenshot saved to tooltip-validation.png');

	// Assertions
	let passed = true;

	if (tooltipInfo.opacity === '1') {
		console.log('\n✓ PASS: Tooltip opacity is 1 (visible)');
	} else {
		console.log(`\n✗ FAIL: Tooltip opacity is ${tooltipInfo.opacity ?? 'unknown'} (expected 1)`);
		passed = false;
	}

	if (tooltipInfo.panelOverflow === 'visible') {
		console.log('✓ PASS: Panel overflow is "visible" (not clipping)');
	} else {
		console.log(`✗ FAIL: Panel overflow is "${tooltipInfo.panelOverflow ?? 'null'}" (expected "visible")`);
		passed = false;
	}

	if (tooltipInfo.content && tooltipInfo.content !== 'none' && tooltipInfo.content !== '""') {
		console.log(`✓ PASS: Tooltip has content: ${tooltipInfo.content}`);
	} else {
		console.log(`✗ FAIL: Tooltip content is empty or "none"`);
		passed = false;
	}

	if (!passed) {
		console.log('\n=== Some checks FAILED ===\n');
		process.exit(1);
	}

	console.log('\n=== All checks passed! Tooltip is visible and not clipped. ===\n');
} finally {
	await browser.close();
}
