import { expect, type Page, test } from 'playwright/test';

async function gotoReady(page: Page, path = '/'): Promise<void> {
	await page.goto(path);
	await page.waitForFunction(() => document.body.classList.contains('page-ready'));
}

async function canvasHasVisibleStormFrame(page: Page): Promise<boolean> {
	return await page.evaluate(() => {
		const canvas = document.querySelector<HTMLCanvasElement>('.storm-canvas');
		if (canvas === null || canvas.width <= 0 || canvas.height <= 0) return false;

		const gl = canvas.getContext('webgl2');
		if (gl === null) return false;

		const pixel = new Uint8Array(4);
		let minLuma = Number.POSITIVE_INFINITY;
		let maxLuma = Number.NEGATIVE_INFINITY;
		let opaqueSamples = 0;

		for (let y = 1; y <= 4; y++) {
			for (let x = 1; x <= 4; x++) {
				const px = Math.floor((canvas.width * x) / 5);
				const py = Math.floor((canvas.height * y) / 5);
				gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

				const red = pixel[0] ?? 0;
				const green = pixel[1] ?? 0;
				const blue = pixel[2] ?? 0;
				const alpha = pixel[3] ?? 0;
				const luma = red + green + blue;
				minLuma = Math.min(minLuma, luma);
				maxLuma = Math.max(maxLuma, luma);
				if (alpha > 0) opaqueSamples++;
			}
		}

		return opaqueSamples >= 12 && maxLuma - minLuma > 10;
	});
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1
		? (sorted[mid] ?? 0)
		: ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Measure single-frame on-screen cloud anisotropy: the ratio of horizontal to
 * vertical luma-gradient energy in the cloud band.
 *
 * Samples an equal-pixel-step grid (identical step in x and y) so the ratio
 * reflects true on-screen feature shape. With correct aspect handling this is
 * a near viewport-independent constant; the unfixed shader makes it scale with
 * the viewport aspect (tall sausages on portrait).
 *
 * A single frame can be contaminated by a lightning bolt — a spatially coherent
 * vertical structure that crosses many grid columns and spikes the horizontal
 * gradient — so callers should median across frames (see sampleAnisotropy), not
 * trust one reading.
 */
async function cloudAnisotropy(page: Page): Promise<number> {
	return await page.evaluate(() => {
		const canvas = document.querySelector<HTMLCanvasElement>('.storm-canvas');
		if (canvas === null || canvas.width <= 0 || canvas.height <= 0) return Number.NaN;

		const gl = canvas.getContext('webgl2');
		if (gl === null) return Number.NaN;

		const width = canvas.width;
		const height = canvas.height;
		// Equal pixel step on both axes keeps the H/V comparison fair.
		const step = Math.max(8, Math.floor(Math.min(width, height) * 0.05));
		const x0 = Math.floor(width * 0.15);
		const y0 = Math.floor(height * 0.15);
		const cols = Math.floor((width * 0.7) / step);
		const rows = Math.floor((height * 0.7) / step);
		if (cols < 3 || rows < 3) return Number.NaN;

		const pixel = new Uint8Array(4);
		const luma: number[][] = [];
		for (let row = 0; row < rows; row++) {
			const line: number[] = [];
			for (let col = 0; col < cols; col++) {
				gl.readPixels(x0 + col * step, y0 + row * step, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
				line.push((pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0));
			}
			luma.push(line);
		}

		const median = (values: number[]): number => {
			const sorted = [...values].sort((a, b) => a - b);
			const mid = Math.floor(sorted.length / 2);
			return sorted.length % 2 === 1
				? (sorted[mid] ?? 0)
				: ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
		};

		const horizontalDiffs: number[] = [];
		const verticalDiffs: number[] = [];
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols - 1; col++) {
				horizontalDiffs.push(Math.abs((luma[row]?.[col + 1] ?? 0) - (luma[row]?.[col] ?? 0)));
			}
		}
		for (let row = 0; row < rows - 1; row++) {
			for (let col = 0; col < cols; col++) {
				verticalDiffs.push(Math.abs((luma[row + 1]?.[col] ?? 0) - (luma[row]?.[col] ?? 0)));
			}
		}

		return median(horizontalDiffs) / Math.max(median(verticalDiffs), 1e-6);
	});
}

/**
 * Median single-frame anisotropy over several spaced frames.
 *
 * Lightning bolts contaminate ~20% of frames but are temporally sparse, so the
 * median over many frames rejects them. Frames are spaced beyond a single bolt
 * flash so consecutive samples decorrelate.
 */
async function sampleAnisotropy(page: Page, frames: number): Promise<number> {
	const values: number[] = [];
	for (let i = 0; i < frames; i++) {
		const value = await cloudAnisotropy(page);
		if (Number.isFinite(value)) values.push(value);
		await page.waitForTimeout(80);
	}
	return values.length > 0 ? median(values) : Number.NaN;
}

test('cloud composition is aspect-corrected across portrait and landscape', async ({ page }) => {
	await page.setViewportSize({ width: 900, height: 500 });
	await gotoReady(page, '/?calm=off&theme=dark&storm-test=1');

	const canvas = page.locator('.storm-canvas');
	await expect(canvas).toHaveAttribute('data-storm-active', 'true');

	// Wait for a stable landscape frame, then median over frames.
	await expect
		.poll(async () => await canvasHasVisibleStormFrame(page))
		.toBe(true);
	const landscape = await sampleAnisotropy(page, 9);

	// Flip to portrait; the renderer resizes from clientWidth/Height each frame.
	await page.setViewportSize({ width: 500, height: 900 });
	await page.waitForFunction(() => {
		const c = document.querySelector<HTMLCanvasElement>('.storm-canvas');
		return c !== null && c.height > c.width;
	});
	await expect
		.poll(async () => await canvasHasVisibleStormFrame(page))
		.toBe(true);
	const portrait = await sampleAnisotropy(page, 9);

	expect(Number.isFinite(landscape)).toBe(true);
	expect(Number.isFinite(portrait)).toBe(true);

	// Aspect-corrected clouds keep a near viewport-independent feature shape, so
	// flipping orientation barely moves the anisotropy. The unfixed shader lets
	// it scale with the viewport aspect, swinging the ratio much higher.
	//
	// Measured on chromium with 9-frame-median sampling (which removes the
	// single-frame lightning outliers): fixed ratio 1.44-1.60, unfixed ratio
	// 2.07-2.41 across 10 repeats each. 1.85 is the midpoint of that gap, leaving
	// ~0.24 margin on both sides.
	const orientationRatio = portrait / Math.max(landscape, 1e-6);
	expect(orientationRatio).toBeGreaterThan(0.5);
	expect(orientationRatio).toBeLessThan(1.85);
});

test('WebGL storm canvas initializes and draws a nonblank frame', async ({ page }) => {
	await gotoReady(page, '/?calm=off&theme=dark&storm-test=1');

	const canvas = page.locator('.storm-canvas');
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-storm-renderer', 'webgl2');
	await expect(canvas).toHaveAttribute('data-storm-active', 'true');

	await expect.poll(async () => await canvasHasVisibleStormFrame(page)).toBe(true);
});

test('calm mode stops and hides the storm canvas', async ({ page }) => {
	await gotoReady(page, '/?calm=on&theme=dark');

	const canvas = page.locator('.storm-canvas');
	await expect(canvas).toHaveAttribute('data-storm-active', 'false');

	const canvasState = await canvas.evaluate((element) => {
		const styles = getComputedStyle(element);
		return {
			opacity: Number.parseFloat(styles.opacity),
			visibility: styles.visibility,
		};
	});

	expect(canvasState).toEqual({ opacity: 0, visibility: 'hidden' });
});

test('theme changes update the storm renderer theme', async ({ page }) => {
	await gotoReady(page, '/?calm=off');

	const canvas = page.locator('.storm-canvas');
	await expect(canvas).toHaveAttribute('data-storm-renderer', 'webgl2');

	await page.keyboard.press('t');
	await page.locator('[data-theme-option="light"]').click();

	await expect(canvas).toHaveAttribute('data-storm-theme', 'light');
});
