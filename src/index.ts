import { applyCalmMode } from '#404/calm/apply';
import { subscribeCalmSignals } from '#404/calm/detect';
import { initializePage } from '#404/page-content';
import { initializePanelInteractivity } from '#404/panel';
import { StormEngine } from '#404/storm/engine';
import { initializeThemeControls } from '#404/theme/controls';

/**
 * Body class toggled once initial layout and controls are wired.
 *
 * Use when marking ready state in {@link markPageReady}.
 */
const PAGE_READY_CLASS = 'page-ready';

function markPageReady(): void {
	requestAnimationFrame(() => {
		document.body.classList.add(PAGE_READY_CLASS);
	});
}

((): void => {
	initializeThemeControls();
	initializePanelInteractivity();
	markPageReady();

	const storm = new StormEngine();
	applyCalmMode(storm);
	subscribeCalmSignals(() => {
		applyCalmMode(storm);
	});

	initializePage();
})();
