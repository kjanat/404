import { applyCalmMode } from './calm/apply.ts';
import { subscribeCalmSignals } from './calm/detect.ts';
import { initializePage } from './page-content.ts';
import { initializePanelInteractivity } from './panel.ts';
import { generateCloudBackground } from './storm/clouds.ts';
import { StormEngine } from './storm/engine.ts';
import { initializeThemeControls } from './theme/controls.ts';

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
