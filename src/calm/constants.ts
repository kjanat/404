/** URL query parameter controlling explicit calm mode override. */
export const CALM_PARAM = 'calm';

/** CSS class toggled when calm mode is active. */
export const CALM_CLASS = 'calm-mode';

/** Truthy override values for `?calm=`. */
export const CALM_ON_RE = /^(1|true|yes|on)$/i;

/** Falsy override values for `?calm=`. */
export const CALM_OFF_RE = /^(0|false|no|off)$/i;

/** Accessibility media queries that imply calm mode when matched. */
export const mediaQueryDefs = {
	reduceMotion: '(prefers-reduced-motion: reduce)',
	moreContrast: '(prefers-contrast: more)',
	forcedColors: '(forced-colors: active)',
} as const;

/** Discriminant key for calm-related media query signals. */
export type CalmSignal = keyof typeof mediaQueryDefs;
