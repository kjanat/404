import { rand, randInt } from './rng.ts';

/**
 * Minimum number of spine segments used per generated bolt.
 *
 * Use when sampling `segments` in {@link generateBoltPath}.
 */
const BOLT_SEGMENTS_MIN = 8;

/**
 * Maximum number of spine segments used per generated bolt.
 *
 * Use when sampling `segments` in {@link generateBoltPath}.
 */
const BOLT_SEGMENTS_MAX = 12;

/**
 * Half-width offset (percentage points) for mirrored bolt polygon edges.
 *
 * Use when mirroring spine points into left/right polygon edges in {@link generateBoltPath}.
 */
const BOLT_HALF_WIDTH = 1.5;

/**
 * Generate procedural lightning bolt polygon for CSS clip-path.
 *
 * Uses a downward random walk spine then mirrors it with width offset.
 *
 * @returns CSS `polygon(...)` value.
 */
export function generateBoltPath(): string {
	const segments = randInt(BOLT_SEGMENTS_MIN, BOLT_SEGMENTS_MAX);
	const stepY = 100 / segments;

	const spine: { x: number; y: number }[] = [{ x: 50, y: 0 }];
	let x = 50;

	for (let i = 1; i <= segments; i++) {
		const jitter = rand(-20, 20);
		x = Math.max(10, Math.min(90, x + jitter));
		spine.push({ x, y: i * stepY });
	}

	const left: string[] = [];
	const right: string[] = [];

	for (const pt of spine) {
		left.push(`${(pt.x - BOLT_HALF_WIDTH).toFixed(1)}% ${pt.y.toFixed(1)}%`);
	}
	for (let i = spine.length - 1; i >= 0; i--) {
		const pt = spine[i];
		if (!pt) continue;
		right.push(`${(pt.x + BOLT_HALF_WIDTH).toFixed(1)}% ${pt.y.toFixed(1)}%`);
	}

	return `polygon(${[...left, ...right].join(',')})`;
}
