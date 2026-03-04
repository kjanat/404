import type { Range } from './types.ts';

function createRange(min: number, max: number): Range {
	return Object.freeze({ min, max });
}

/**
 * Inter-flash delay range (ms).
 *
 * Use when sampling delay before scheduling the next flash.
 */
export const INTER_FLASH = createRange(2800, 8500);

/**
 * IC glow interval range while quiet (ms).
 *
 * Use when sampling idle intra-cloud glow interval.
 */
export const IC_GLOW = createRange(1200, 4000);

/**
 * Return-stroke count range per flash.
 *
 * Use when sampling stroke count for a single flash.
 */
export const STROKES = createRange(3, 6);

/**
 * Geometric center of interstroke interval (ms).
 *
 * Use when parameterizing log-normal interstroke delay sampling.
 */
export const INTERSTROKE_CENTER = 52;

/**
 * Spread factor for interstroke log-normal sampling.
 *
 * Use when parameterizing log-normal interstroke delay sampling.
 */
export const INTERSTROKE_SPREAD = 0.45;

/**
 * Preflash buildup duration range (ms).
 *
 * Use when sampling preflash buildup time before first stroke.
 */
export const PREFLASH_DURATION = createRange(40, 90);

/**
 * Base exponential decay tau for return strokes (ms).
 *
 * Use when computing exponential brightness falloff per stroke.
 */
export const STROKE_DECAY_TAU = 28;

/**
 * Relative intensity range for subsequent strokes.
 *
 * Use when scaling intensity for strokes after the first one.
 */
export const SUBSEQUENT_INTENSITY = createRange(0.35, 0.65);

/**
 * Continuing-current tail duration range (ms).
 *
 * Use when sampling lingering tail duration after return strokes.
 */
export const CONTINUING_CURRENT = createRange(120, 350);

/**
 * Probability that a flash includes an M-component pulse.
 *
 * Use when deciding whether to append an M-component event.
 */
export const M_COMPONENT_CHANCE = 0.4;

/**
 * Peak additive intensity of M-component pulse.
 *
 * Use when applying additive brightness for an M-component event.
 */
export const M_COMPONENT_INTENSITY = 0.12;

/**
 * Nominal duration of M-component pulse envelope (ms).
 *
 * Use when shaping the M-component pulse envelope in time.
 */
export const M_COMPONENT_DURATION = 35;

/**
 * IC glow peak intensity range.
 *
 * Use when sampling peak intensity for idle glow events.
 */
export const IC_GLOW_INTENSITY = createRange(0.04, 0.12);

/**
 * IC glow event duration range (ms).
 *
 * Use when sampling duration for idle glow events.
 */
export const IC_GLOW_DURATION = createRange(80, 250);

/**
 * Baseline darkness value used when no active flash is present.
 *
 * Use when rendering ambient dim level outside active flash events.
 */
export const REGION_DIM_BASELINE = 0.42;

/**
 * Default number of generated bolt elements.
 *
 * Use when no explicit bolt count override is provided.
 */
export const DEFAULT_BOLT_COUNT = 6;

/**
 * Hard upper bound for generated bolt elements.
 *
 * Use to guard against excessive DOM allocations from invalid overrides.
 */
export const MAX_BOLT_COUNT = 24;

/**
 * Frame time threshold in ms for slow-frame detection (~50fps).
 *
 * Use when classifying individual frames as slow during performance monitoring.
 */
export const SLOW_FRAME_TIME_MS = 20;

/**
 * Number of consecutive slow frames required to trigger reduced-performance mode.
 *
 * Use when determining whether to apply perf-reduced class to root element.
 */
export const SLOW_FRAME_THRESHOLD = 20;

/**
 * Frame time threshold in ms for ignoring backgrounded tab gaps.
 *
 * Use to filter out rAF callbacks delayed by tab backgrounding or main-thread pauses.
 */
export const BACKGROUND_TAB_GAP_MS = 200;
