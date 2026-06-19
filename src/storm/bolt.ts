import { rand, randInt } from '#404/storm/rng';
import type { BoltSegment, Range } from '#404/storm/types';

/**
 * Main spine segment count range used per generated bolt.
 *
 * Use when sampling jagged lightning paths for WebGL rendering.
 */
const BOLT_SEGMENTS: Range = {
	min: 8,
	max: 12,
};

/**
 * Branch count range generated from each main bolt.
 *
 * Use when adding secondary forks to the primary return-stroke channel.
 */
const BOLT_BRANCHES: Range = {
	min: 1,
	max: 3,
};

interface BoltPoint {
	readonly x: number;
	readonly y: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function createSegment(from: BoltPoint, to: BoltPoint, width: number, strength: number): BoltSegment {
	return {
		ax: from.x,
		ay: from.y,
		bx: to.x,
		by: to.y,
		width,
		strength,
	};
}

function generateMainBolt(): BoltPoint[] {
	const segments = randInt(BOLT_SEGMENTS);
	const startX = rand(0.12, 0.88);
	const startY = rand(-0.14, -0.03);
	const endY = rand(0.82, 1.14);
	const stepY = (endY + rand(0.04, 0.12)) / segments;
	const points: BoltPoint[] = [{ x: startX, y: startY }];
	let x = startX;

	for (let i = 1; i <= segments; i++) {
		const progress = i / segments;
		const taper = 1 - progress * 0.5;
		x = clamp(x + rand(-0.09, 0.09) * taper, -0.08, 1.08);
		points.push({
			x,
			y: startY + stepY * i,
		});
	}

	return points;
}

function appendBranch(
	segments: BoltSegment[],
	spine: readonly BoltPoint[],
	baseWidth: number,
	baseStrength: number,
): void {
	const startIndex = randInt(2, Math.max(2, spine.length - 3));
	const origin = spine[startIndex];
	if (origin === undefined) return;

	const branchSegments = randInt(2, 4);
	const direction = Math.random() < 0.5 ? -1 : 1;
	const points: BoltPoint[] = [origin];
	let x = origin.x;
	let y = origin.y;

	for (let i = 0; i < branchSegments; i++) {
		x = clamp(x + direction * rand(0.035, 0.1) + rand(-0.025, 0.025), -0.12, 1.12);
		y += rand(0.04, 0.1);
		points.push({ x, y });
	}

	for (let i = 0; i < points.length - 1; i++) {
		const from = points[i];
		const to = points[i + 1];
		if (from === undefined || to === undefined) continue;
		const fade = 1 - i / points.length;
		segments.push(createSegment(from, to, baseWidth * 0.58, baseStrength * 0.48 * fade));
	}
}

/**
 * Generate normalized lightning line segments for WebGL shader uniforms.
 *
 * Coordinates are in a top-left normalized viewport space. Width is expressed
 * in CSS pixels so the renderer can keep bolt thickness stable across DPR.
 *
 * @param boltCount - Number of independent return-stroke channels to generate.
 */
export function generateBoltSegments(boltCount: number): BoltSegment[] {
	const segments: BoltSegment[] = [];

	for (let bolt = 0; bolt < boltCount; bolt++) {
		const spine = generateMainBolt();
		const baseWidth = rand(1.35, 2.3);
		const baseStrength = rand(0.78, 1);

		for (let i = 0; i < spine.length - 1; i++) {
			const from = spine[i];
			const to = spine[i + 1];
			if (from === undefined || to === undefined) continue;
			const taper = 1 - i / spine.length;
			segments.push(createSegment(from, to, baseWidth * (0.74 + taper * 0.36), baseStrength));
		}

		const branches = randInt(BOLT_BRANCHES);
		for (let i = 0; i < branches; i++) {
			appendBranch(segments, spine, baseWidth, baseStrength);
		}
	}

	return segments;
}
