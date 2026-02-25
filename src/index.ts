/**
 * Checks if calmmode should be enabled based on URL parameters and user preferences, and updates the page accordingly.
 */
async function checkCalmMode(): Promise<void> {
	const calmValue: string | null = new URLSearchParams(window.location.search).get('calm');
	const reduceMotionQuery: MediaQueryList = window.matchMedia(
		'(prefers-reduced-motion: reduce)',
	);
	const highContrastQuery: MediaQueryList = window.matchMedia('(prefers-contrast: more)');
	const forcedColorsQuery: MediaQueryList = window.matchMedia('(forced-colors: active)');
	const explicitCalm: boolean | '' | null = calmValue && /^(1|true|yes|on)$/i.test(calmValue);
	const accessibilityCalm: boolean = reduceMotionQuery.matches
		|| highContrastQuery.matches
		|| forcedColorsQuery.matches;

	if (explicitCalm || accessibilityCalm) {
		document.body.classList.add('calm-mode');
	}
}

/** Sets the page title and updates any elements with the data-host attribute to display the current hostname. */
async function initializePage(): Promise<void> {
	const host: string = window.location.hostname;
	if (!host) return;

	const targets: NodeListOf<Element> = document.querySelectorAll('[data-host]');
	for (const target of targets) {
		target.textContent = host;
	}
	document.title = '404 | ' + host;
}

(function(): void {
	checkCalmMode();
	initializePage();
})();
