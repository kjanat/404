import type { Range } from './types.ts';

function resolveRange(minOrRange: number | Range, maybeMax: number | undefined): Range {
	if (typeof minOrRange === 'number') {
		if (typeof maybeMax !== 'number') {
			throw new TypeError('max is required when calling rand/randInt with min number');
		}

		return {
			min: minOrRange,
			max: maybeMax,
		};
	}

	return minOrRange;
}

/**
 * Uniform random float in `[min, max)`.
 *
 * Accepts either explicit bounds or a range object.
 *
 * @param min - Inclusive lower bound.
 * @param max - Exclusive upper bound.
 */
export function rand(min: number, max: number): number;
export function rand(range: Range): number;
export function rand(minOrRange: number | Range, maybeMax?: number): number {
	const range = resolveRange(minOrRange, maybeMax);
	return range.min + Math.random() * (range.max - range.min);
}

/**
 * Random integer in `[min, max]`.
 *
 * Accepts either explicit bounds or a range object.
 *
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound.
 */
export function randInt(min: number, max: number): number;
export function randInt(range: Range): number;
export function randInt(minOrRange: number | Range, maybeMax?: number): number {
	const range = resolveRange(minOrRange, maybeMax);
	return Math.floor(rand(range.min, range.max + 1));
}

/**
 * Sample log-normal distributed value centered near `center`.
 *
 * @param center - Geometric mean target.
 * @param spread - Sigma of underlying normal distribution.
 */
export function randLogNormal(center: number, spread: number): number {
	const u1 = Math.random();
	const u2 = Math.random();
	const normal = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
	return center * Math.exp(spread * normal);
}
