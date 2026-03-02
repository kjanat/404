import AxeBuilder from '@axe-core/playwright';
import { expect, test } from 'playwright/test';

interface AccessibilityVariant {
	readonly id: string;
	readonly path: string;
}

const accessibilityVariants: readonly AccessibilityVariant[] = [
	{
		id: 'default',
		path: '/',
	},
	{
		id: 'light-calm-off',
		path: '/?theme=light&calm=off',
	},
	{
		id: 'dark-calm-on',
		path: '/?theme=dark&calm=on',
	},
	{
		id: 'light-calm-on',
		path: '/?theme=light&calm=on',
	},
];

for (const variant of accessibilityVariants) {
	test(`page has no auto-detectable WCAG A/AA violations (${variant.id})`, async ({ page }, testInfo) => {
		await page.goto(variant.path);
		await page.waitForFunction(() => document.body.classList.contains('page-ready'));

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();

		await testInfo.attach(`accessibility-scan-results-${variant.id}`, {
			body: JSON.stringify(accessibilityScanResults, null, 2),
			contentType: 'application/json',
		});

		expect(accessibilityScanResults.violations).toEqual([]);
	});
}
