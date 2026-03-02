/**
 * URL query parameter controlling explicit calm mode override.
 *
 * Use when parsing query overrides in {@link ./detect.ts#getCalmOverride}.
 */
export const CALM_PARAM = 'calm';

/**
 * CSS class toggled when calm mode is active.
 *
 * Use when applying calm styling in {@link ./apply.ts#applyCalmMode}.
 */
export const CALM_CLASS = 'calm-mode';

/**
 * Truthy override values for `?calm=`.
 *
 * Use when resolving explicit override in {@link ./detect.ts#getCalmOverride}.
 */
export const CALM_ON_RE = /^(1|true|yes|on)$/i;

/**
 * Falsy override values for `?calm=`.
 *
 * Use when resolving explicit override in {@link ./detect.ts#getCalmOverride}.
 */
export const CALM_OFF_RE = /^(0|false|no|off)$/i;

/**
 * Accessibility media queries that imply calm mode when matched.
 *
 * Use when resolving and subscribing calm signals in {@link ./detect.ts#getAccessibilityCalm}
 * and {@link ./detect.ts#subscribeCalmSignals}.
 */
export const mediaQueryDefs = {
	reduceMotion: '(prefers-reduced-motion: reduce)',
	moreContrast: '(prefers-contrast: more)',
	forcedColors: '(forced-colors: active)',
} as const;

/**
 * Discriminant key for calm-related media query signals.
 *
 * Use when typing media query records built from {@link mediaQueryDefs}.
 */
export type CalmSignal = keyof typeof mediaQueryDefs;
