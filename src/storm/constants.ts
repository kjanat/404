/** Minimum inter-flash delay (ms). */
export const INTER_FLASH_MIN = 2800;

/** Maximum inter-flash delay (ms). */
export const INTER_FLASH_MAX = 8500;

/** Minimum IC glow interval while quiet (ms). */
export const IC_GLOW_MIN = 1200;

/** Maximum IC glow interval while quiet (ms). */
export const IC_GLOW_MAX = 4000;

/** Minimum return strokes per flash. */
export const STROKES_MIN = 3;

/** Maximum return strokes per flash. */
export const STROKES_MAX = 6;

/** Geometric center of interstroke interval (ms). */
export const INTERSTROKE_CENTER = 52;

/** Spread factor for interstroke log-normal sampling. */
export const INTERSTROKE_SPREAD = 0.45;

/** Minimum preflash buildup duration (ms). */
export const PREFLASH_DURATION_MIN = 40;

/** Maximum preflash buildup duration (ms). */
export const PREFLASH_DURATION_MAX = 90;

/** Base exponential decay tau for return strokes (ms). */
export const STROKE_DECAY_TAU = 28;

/** Minimum relative intensity for subsequent strokes. */
export const SUBSEQUENT_INTENSITY_MIN = 0.35;

/** Maximum relative intensity for subsequent strokes. */
export const SUBSEQUENT_INTENSITY_MAX = 0.65;

/** Minimum continuing-current tail duration (ms). */
export const CONTINUING_CURRENT_MIN = 120;

/** Maximum continuing-current tail duration (ms). */
export const CONTINUING_CURRENT_MAX = 350;

/** Probability that a flash includes an M-component pulse. */
export const M_COMPONENT_CHANCE = 0.4;

/** Peak additive intensity of M-component pulse. */
export const M_COMPONENT_INTENSITY = 0.12;

/** Nominal duration of M-component pulse envelope (ms). */
export const M_COMPONENT_DURATION = 35;

/** Minimum IC glow peak intensity. */
export const IC_GLOW_INTENSITY_MIN = 0.04;

/** Maximum IC glow peak intensity. */
export const IC_GLOW_INTENSITY_MAX = 0.12;

/** Minimum IC glow event duration (ms). */
export const IC_GLOW_DURATION_MIN = 80;

/** Maximum IC glow event duration (ms). */
export const IC_GLOW_DURATION_MAX = 250;

/** Baseline darkness value used when no active flash is present. */
export const REGION_DIM_BASELINE = 0.42;

/** Default number of generated bolt elements. */
export const DEFAULT_BOLT_COUNT = 6;
