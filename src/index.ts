import { applyCalmMode } from './calm/apply.ts';
import { subscribeCalmSignals } from './calm/detect.ts';
import { initializePage } from './page-content.ts';
import { initializePanelInteractivity } from './panel.ts';
import { generateCloudBackground } from './storm/clouds.ts';
import { StormEngine } from './storm/engine.ts';
import { initializeThemeControls } from './theme/controls.ts';

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
	document.documentElement.style.setProperty('--cloud-bg', generateCloudBackground());
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
