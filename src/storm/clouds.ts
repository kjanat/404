import { rand, randInt } from './rng.ts';

const CLOUD_MASS_MIN = 5;
const CLOUD_MASS_MAX = 8;
const PUFFS_PER_MASS_MIN = 3;
const PUFFS_PER_MASS_MAX = 6;

/**
 * Generate procedural cloud gradient stack for `--cloud-bg` CSS variable.
 *
 * @returns Comma-separated `radial-gradient(...)` background value.
 */
export function generateCloudBackground(): string {
	const massCount = randInt(CLOUD_MASS_MIN, CLOUD_MASS_MAX);
	const gradients: string[] = [];

	for (let m = 0; m < massCount; m++) {
		const cx = rand(8, 92);
		const cy = rand(8, 92);
		const puffCount = randInt(PUFFS_PER_MASS_MIN, PUFFS_PER_MASS_MAX);

		for (let p = 0; p < puffCount; p++) {
			const x = (cx + (Math.random() - 0.5) * 26).toFixed(0);
			const y = (cy + (Math.random() - 0.5) * 20).toFixed(0);
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
