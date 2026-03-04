import { expect, type Page, test } from 'playwright/test';

async function gotoReady(page: Page, path = '/'): Promise<void> {
	await page.goto(path);
	await page.waitForFunction(() => document.body.classList.contains('page-ready'));
}

test.describe('Performance monitoring', () => {
	test('applies perf-reduced class when frames are artificially slowed', async ({ page }) => {
		await gotoReady(page);

		// Inject a script that artificially slows down rAF callbacks
		// to trigger the slow frame detection
		await page.evaluate(() => {
			const { SLOW_FRAME_TIME_MS, SLOW_FRAME_THRESHOLD } = {
				SLOW_FRAME_TIME_MS: 20,
				SLOW_FRAME_THRESHOLD: 20,
			};

			// Save original rAF
			const originalRAF = window.requestAnimationFrame;

			let rafCallCount = 0;
			const targetSlowFrames = SLOW_FRAME_THRESHOLD + 5;

			// Override rAF to add artificial delay
			window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
				return originalRAF((time: number) => {
					rafCallCount++;
					if (rafCallCount <= targetSlowFrames) {
						// Add artificial delay to trigger slow frame detection
						const start = performance.now();
						while (performance.now() - start < SLOW_FRAME_TIME_MS + 5) {
							// Busy wait to simulate slow frame
						}
					}
					callback(time);
				});
			};
		});

		// Wait for the slow frames to be detected and the class to be applied
		await expect(page.locator('html')).toHaveClass(/perf-reduced/, { timeout: 5000 });
	});

	test('strips flash-driven transitions from panel in perf-reduced mode', async ({ page }) => {
		await gotoReady(page);

		// Apply perf-reduced class manually for testing
		await page.evaluate(() => {
			document.documentElement.classList.add('perf-reduced');
		});

		// Check that .perf-reduced .panel has only transform transition
		const panelTransition = await page.evaluate(() => {
			const panel = document.querySelector('.panel') as HTMLElement;
			if (!panel) return null;
			return window.getComputedStyle(panel).transition;
		});

		expect(panelTransition).not.toBeNull();
		expect(panelTransition).toContain('transform');
		// Should not contain border-color, box-shadow, or background-color
		expect(panelTransition).not.toContain('border-color');
		expect(panelTransition).not.toContain('box-shadow');
		expect(panelTransition).not.toContain('background-color');
	});

	test('dev mode logging (manual verification)', async ({ page }) => {
		// This test documents that dev logging exists but doesn't assert on it
		// since console.info is only enabled in dev mode and we're testing the built version
		await gotoReady(page);

		// Note: In dev mode, console should show:
		// "[StormEngine] Performance reduced mode activated after N consecutive slow frames (>20ms)"
		// This can be manually verified by running the dev server and triggering slow frames
	});
});
