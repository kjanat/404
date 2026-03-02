/**
 * Minimum inter-flash delay (ms).
 *
 * Use when sampling delay before scheduling the next flash.
 */
export const INTER_FLASH_MIN = 2800;

/**
 * Maximum inter-flash delay (ms).
 *
 * Use when sampling delay before scheduling the next flash.
 */
export const INTER_FLASH_MAX = 8500;

/**
 * Minimum IC glow interval while quiet (ms).
 *
 * Use when sampling idle intra-cloud glow interval.
 */
export const IC_GLOW_MIN = 1200;

/**
 * Maximum IC glow interval while quiet (ms).
 *
 * Use when sampling idle intra-cloud glow interval.
 */
export const IC_GLOW_MAX = 4000;

/**
 * Minimum return strokes per flash.
 *
 * Use when sampling stroke count for a single flash.
 */
export const STROKES_MIN = 3;

/**
 * Maximum return strokes per flash.
 *
 * Use when sampling stroke count for a single flash.
 */
export const STROKES_MAX = 6;

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
 * Minimum preflash buildup duration (ms).
 *
 * Use when sampling preflash buildup time before first stroke.
 */
export const PREFLASH_DURATION_MIN = 40;

/**
 * Maximum preflash buildup duration (ms).
 *
 * Use when sampling preflash buildup time before first stroke.
 */
export const PREFLASH_DURATION_MAX = 90;

/**
 * Base exponential decay tau for return strokes (ms).
 *
 * Use when computing exponential brightness falloff per stroke.
 */
export const STROKE_DECAY_TAU = 28;

/**
 * Minimum relative intensity for subsequent strokes.
 *
 * Use when scaling intensity for strokes after the first one.
 */
export const SUBSEQUENT_INTENSITY_MIN = 0.35;

/**
 * Maximum relative intensity for subsequent strokes.
 *
 * Use when scaling intensity for strokes after the first one.
 */
export const SUBSEQUENT_INTENSITY_MAX = 0.65;

/**
 * Minimum continuing-current tail duration (ms).
 *
 * Use when sampling lingering tail duration after return strokes.
 */
export const CONTINUING_CURRENT_MIN = 120;

/**
 * Maximum continuing-current tail duration (ms).
 *
 * Use when sampling lingering tail duration after return strokes.
 */
export const CONTINUING_CURRENT_MAX = 350;

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
 * Minimum IC glow peak intensity.
 *
 * Use when sampling peak intensity for idle glow events.
 */
export const IC_GLOW_INTENSITY_MIN = 0.04;

/**
 * Maximum IC glow peak intensity.
 *
 * Use when sampling peak intensity for idle glow events.
 */
export const IC_GLOW_INTENSITY_MAX = 0.12;

/**
 * Minimum IC glow event duration (ms).
 *
 * Use when sampling duration for idle glow events.
 */
export const IC_GLOW_DURATION_MIN = 80;

/**
 * Maximum IC glow event duration (ms).
 *
 * Use when sampling duration for idle glow events.
 */
export const IC_GLOW_DURATION_MAX = 250;

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
