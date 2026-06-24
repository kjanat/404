import type { TransmissionStep } from '#404/storm/types';

/**
 * International Morse code lookup table.
 *
 * Maps an uppercase character to its dot/dash pattern. Word spaces map to a
 * `/` token so {@link textToMorse} renders human-readable output; the timeline
 * builder splits on whitespace directly and never reads the space entry.
 */
export const MORSE_MAP: Readonly<Record<string, string>> = {
	A: '.-',
	B: '-...',
	C: '-.-.',
	D: '-..',
	E: '.',
	F: '..-.',
	G: '--.',
	H: '....',
	I: '..',
	J: '.---',
	K: '-.-',
	L: '.-..',
	M: '--',
	N: '-.',
	O: '---',
	P: '.--.',
	Q: '--.-',
	R: '.-.',
	S: '...',
	T: '-',
	U: '..-',
	V: '...-',
	W: '.--',
	X: '-..-',
	Y: '-.--',
	Z: '--..',
	'0': '-----',
	'1': '.----',
	'2': '..---',
	'3': '...--',
	'4': '....-',
	'5': '.....',
	'6': '-....',
	'7': '--...',
	'8': '---..',
	'9': '----.',
	' ': '/',
	'.': '.-.-.-',
	',': '--..--',
	'?': '..--..',
	'!': '-.-.--',
	"'": '.----.',
	'"': '.-..-.',
	':': '---...',
	';': '-.-.-.',
	'=': '-...-',
	'+': '.-.-.',
	'-': '-....-',
	'/': '-..-.',
	'(': '-.--.',
	')': '-.--.-',
	'@': '.--.-.',
};

/**
 * The secret message keyed out by the lightning during a transmission.
 *
 * Single line change to retune the easter egg. Kept short-ish so the keyed
 * sequence stays under ~20s at {@link MORSE_UNIT_MS}.
 */
export const TRANSMISSION_MESSAGE = 'EDGING INTENSIFIES';

/**
 * Duration of one morse time unit, equal to a single dot (ms).
 *
 * All other element and gap durations are integer multiples of this unit per
 * standard morse timing.
 */
export const MORSE_UNIT_MS = 105;

/** Dash length in morse units. */
const DASH_UNITS = 3;

/** Gap between elements within one letter, in morse units. */
const ELEMENT_GAP_UNITS = 1;

/** Gap between letters within one word, in morse units. */
const LETTER_GAP_UNITS = 3;

/** Gap between words, in morse units. */
const WORD_GAP_UNITS = 7;

/**
 * Convert text to a space-separated international morse string.
 *
 * Unknown characters are dropped. Letters are separated by single spaces and
 * words by a `/` token, matching the conventional written form.
 *
 * @param text - Source text in any case.
 */
export function textToMorse(text: string): string {
	return text
		.toUpperCase()
		.split('')
		.map((char) => MORSE_MAP[char] ?? '')
		.filter(Boolean)
		.join(' ');
}

function keyed(kind: 'dot' | 'dash', units: number, unitMs: number): TransmissionStep {
	return { on: true, kind, durationMs: units * unitMs };
}

function gap(units: number, unitMs: number): TransmissionStep {
	return { on: false, kind: null, durationMs: units * unitMs };
}

/**
 * Expand text into an ordered, fully-timed morse transmission timeline.
 *
 * Each keyed element (dot/dash) and each silent gap (intra-letter, inter-letter,
 * inter-word) becomes one {@link TransmissionStep}. The storm engine walks this
 * timeline by elapsed time to drive the keyed lightning.
 *
 * @param text - Message to encode; case-insensitive, unknown chars dropped.
 * @param unitMs - Duration of a single dot/time unit (ms).
 */
export function buildTransmissionTimeline(
	text: string,
	unitMs: number = MORSE_UNIT_MS,
): TransmissionStep[] {
	const steps: TransmissionStep[] = [];
	// Encode and drop empty words up front so a word made only of unsupported
	// characters (e.g. the `©` in `A © B`) never injects a spurious word gap.
	const encodedWords = text
		.toUpperCase()
		.trim()
		.split(/\s+/)
		.map((word) =>
			Array.from(word)
				.map((char) => MORSE_MAP[char])
				.filter((pattern): pattern is string => pattern !== undefined && pattern !== '/')
		)
		.filter((patterns) => patterns.length > 0);

	encodedWords.forEach((patterns, wordIndex) => {
		if (wordIndex > 0) steps.push(gap(WORD_GAP_UNITS, unitMs));

		patterns.forEach((pattern, letterIndex) => {
			if (letterIndex > 0) steps.push(gap(LETTER_GAP_UNITS, unitMs));

			Array.from(pattern).forEach((symbol, symbolIndex) => {
				if (symbolIndex > 0) steps.push(gap(ELEMENT_GAP_UNITS, unitMs));
				steps.push(symbol === '-' ? keyed('dash', DASH_UNITS, unitMs) : keyed('dot', 1, unitMs));
			});
		});
	});

	return steps;
}

/**
 * Total wall-clock duration of a transmission timeline (ms).
 *
 * @param steps - Timeline produced by {@link buildTransmissionTimeline}.
 */
export function transmissionDuration(steps: readonly TransmissionStep[]): number {
	return steps.reduce((total, step) => total + step.durationMs, 0);
}
