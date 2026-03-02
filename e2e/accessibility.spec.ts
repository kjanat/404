import AxeBuilder from '@axe-core/playwright';
import { expect, test } from 'playwright/test';

test('page has no auto-detectable WCAG A/AA violations', async ({ page }, testInfo) => {
	await page.goto('/?theme=dark&calm=off');
	await page.waitForFunction(() => document.body.classList.contains('page-ready'));

	const accessibilityScanResults = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();

	await testInfo.attach('accessibility-scan-results', {
		body: JSON.stringify(accessibilityScanResults, null, 2),
		contentType: 'application/json',
	});

	expect(accessibilityScanResults.violations).toEqual([]);
});
