/**
 * Uniform random float in `[min, max)`.
 *
 * @param min - Inclusive lower bound.
 * @param max - Exclusive upper bound.
 */
export function rand(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

/**
 * Random integer in `[min, max]`.
 *
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound.
 */
export function randInt(min: number, max: number): number {
	return Math.floor(rand(min, max + 1));
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
