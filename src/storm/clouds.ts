import { rand, randInt } from './rng.ts';
import type { Range } from './types.ts';

/**
 * Cloud mass count range layered into the generated background.
 *
 * Use when sampling `massCount` in {@link generateCloudBackground}.
 */
const CLOUD_MASS: Range = {
	min: 5,
	max: 8,
};

/**
 * Radial puff count range generated inside one cloud mass.
 *
 * Use when sampling `puffCount` in {@link generateCloudBackground}.
 */
const PUFFS_PER_MASS: Range = {
	min: 3,
	max: 6,
};

/**
 * Generate procedural cloud gradient stack for `--cloud-bg` CSS variable.
 *
 * @returns Comma-separated `radial-gradient(...)` background value.
 */
export function generateCloudBackground(): string {
	const massCount = randInt(CLOUD_MASS);
	const gradients: string[] = [];

	for (let m = 0; m < massCount; m++) {
		const cx = rand(8, 92);
		const cy = rand(8, 92);
		const puffCount = randInt(PUFFS_PER_MASS);

		for (let p = 0; p < puffCount; p++) {
			const x = (cx + rand(-13, 13)).toFixed(0);
			const y = (cy + rand(-10, 10)).toFixed(0);
			const rx = rand(14, 38).toFixed(0);
			const ry = rand(10, 28).toFixed(0);
			const a = rand(0.35, 0.8).toFixed(2);
			const fade = rand(48, 64).toFixed(0);
			gradients.push(
				`radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%,rgb(0 0 0/${a}),transparent ${fade}%)`,
			);
		}
	}

	return gradients.join(',');
}
