/** Checks if calm mode should be enabled based on URL params and user prefs. */
function checkCalmMode(): void {
	const calmValue = new URLSearchParams(window.location.search).get('calm');
	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const highContrastQuery = window.matchMedia('(prefers-contrast: more)');
	const forcedColorsQuery = window.matchMedia('(forced-colors: active)');
	const explicitCalm = calmValue !== null && /^(1|true|yes|on)$/i.test(calmValue);
	const accessibilityCalm = reduceMotionQuery.matches || highContrastQuery.matches || forcedColorsQuery.matches;

	if (explicitCalm || accessibilityCalm) {
		document.body.classList.add('calm-mode');
	}
}

/** Sets the page title and updates [data-host] elements with the current hostname. */
function initializePage(): void {
	const host = window.location.hostname;
	if (!host) return;

	for (const target of document.querySelectorAll('[data-host]')) {
		target.textContent = host;
	}
	document.title = '404 | ' + host;
}

(function(): void {
	checkCalmMode();
	initializePage();
})();
