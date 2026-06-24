/// <reference types="bun" />
import {
	buildTransmissionTimeline,
	MORSE_UNIT_MS,
	textToMorse,
	TRANSMISSION_MESSAGE,
	transmissionDuration,
} from '#404/storm/morse';
import { describe, expect, test } from 'bun:test';

describe('textToMorse', () => {
	test('encodes letters with single-space separation', () => {
		expect(textToMorse('SOS')).toBe('... --- ...');
	});

	test('is case-insensitive', () => {
		expect(textToMorse('sos')).toBe(textToMorse('SOS'));
	});

	test('renders word breaks as a slash token', () => {
		expect(textToMorse('A B')).toBe('.- / -...');
	});

	test('drops characters outside the table', () => {
		expect(textToMorse('A©B')).toBe('.- -...');
	});
});

describe('buildTransmissionTimeline', () => {
	test('keys E as a single dot with no surrounding gaps', () => {
		const steps = buildTransmissionTimeline('E', 100);
		expect(steps).toEqual([{ on: true, kind: 'dot', durationMs: 100 }]);
	});

	test('keys T as a single dash of three units', () => {
		const steps = buildTransmissionTimeline('T', 100);
		expect(steps).toEqual([{ on: true, kind: 'dash', durationMs: 300 }]);
	});

	test('separates elements within a letter by one unit', () => {
		// A => .- : dot, element-gap, dash
		expect(buildTransmissionTimeline('A', 100)).toEqual([
			{ on: true, kind: 'dot', durationMs: 100 },
			{ on: false, kind: null, durationMs: 100 },
			{ on: true, kind: 'dash', durationMs: 300 },
		]);
	});

	test('separates letters by three units', () => {
		// EE => dot, letter-gap (3u), dot
		expect(buildTransmissionTimeline('EE', 100)).toEqual([
			{ on: true, kind: 'dot', durationMs: 100 },
			{ on: false, kind: null, durationMs: 300 },
			{ on: true, kind: 'dot', durationMs: 100 },
		]);
	});

	test('separates words by seven units', () => {
		// "E E" => dot, word-gap (7u), dot
		expect(buildTransmissionTimeline('E E', 100)).toEqual([
			{ on: true, kind: 'dot', durationMs: 100 },
			{ on: false, kind: null, durationMs: 700 },
			{ on: true, kind: 'dot', durationMs: 100 },
		]);
	});

	test('never emits a keyed step for a word break', () => {
		const steps = buildTransmissionTimeline('A B');
		expect(steps.every((step) => step.kind !== null || !step.on)).toBe(true);
	});

	test('produces an empty timeline for blank input', () => {
		expect(buildTransmissionTimeline('   ')).toEqual([]);
	});

	test('drops an unsupported-only word without injecting an extra word gap', () => {
		// `©` encodes to nothing, so `A © B` must time-out identically to `A B`
		// (a single inter-word gap), not a doubled or leading gap.
		expect(buildTransmissionTimeline('A © B', 100)).toEqual(buildTransmissionTimeline('A B', 100));
		const wordGaps = buildTransmissionTimeline('A © B', 100).filter(
			(step) => !step.on && step.durationMs === 700,
		);
		expect(wordGaps).toHaveLength(1);
	});
});

describe('transmissionDuration', () => {
	test('sums every step duration', () => {
		const steps = buildTransmissionTimeline('SOS', 100);
		const expected = steps.reduce((total, step) => total + step.durationMs, 0);
		expect(transmissionDuration(steps)).toBe(expected);
	});

	test('keeps the default message under 22 seconds', () => {
		const steps = buildTransmissionTimeline(TRANSMISSION_MESSAGE, MORSE_UNIT_MS);
		expect(transmissionDuration(steps)).toBeLessThan(22_000);
		expect(transmissionDuration(steps)).toBeGreaterThan(0);
	});
});
