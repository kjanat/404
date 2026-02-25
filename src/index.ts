/** Checks if calm mode should be enabled based on URL params and user prefs. */
function checkCalmMode(): void {
	const calmValue: string | null = new URLSearchParams(window.location.search).get('calm');
	const explicitCalm: boolean = calmValue !== null && /^(1|true|yes|on)$/i.test(calmValue);
	const reduceMotionQuery: MediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
	const highContrastQuery: MediaQueryList = window.matchMedia('(prefers-contrast: more)');
	const forcedColorsQuery: MediaQueryList = window.matchMedia('(forced-colors: active)');
	const accessibilityCalm: boolean = reduceMotionQuery.matches || highContrastQuery.matches
		|| forcedColorsQuery.matches;

	if (explicitCalm || accessibilityCalm) {
		document.body.classList.add('calm-mode');
	}
}

/** Sets the page title and updates `[data-host]` elements with the current hostname. */
function initializePage(): void {
	const host: string = window.location.hostname;
	if (!host) return;

	for (const target of document.querySelectorAll('[data-host]')) {
		target.textContent = host;
	}
	document.title = `404 | ${host}`;
}

(function(): void {
	checkCalmMode();
	initializePage();
})();
