import type { StormEngine } from '../storm/engine.ts';
import { CALM_CLASS } from './constants.ts';
import { shouldCalm } from './detect.ts';

/**
 * Apply calm mode class toggles and start/stop the storm engine.
 *
 * @param storm - Storm engine instance controlled by calm-mode state.
 */
export function applyCalmMode(storm: StormEngine): void {
	const calm = shouldCalm();
	document.documentElement.classList.toggle(CALM_CLASS, calm);
	document.body.classList.toggle(CALM_CLASS, calm);

	if (calm) {
		storm.stop();
	} else {
		storm.start();
	}
}
