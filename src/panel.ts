import { initializePanelDragReload } from '#404/panel/drag-reload';
import { PanelLightRenderer } from '#404/panel/renderer';

/**
 * Time window for counting rapid panel presses before locking (ms).
 *
 * Use when filtering recent press samples in {@link initializePanelInteractivity}.
 */
const PANEL_PRESS_SPAM_WINDOW_MS = 1300;

/**
 * Number of presses in the spam window that trigger a temporary lock.
 *
 * Use when checking spam threshold in {@link initializePanelInteractivity}.
 */
const PANEL_PRESS_SPAM_LIMIT = 4;

/**
 * Duration of temporary lock after spam-threshold press burst (ms).
 *
 * Use when setting unlock timeout in {@link initializePanelInteractivity}.
 */
const PANEL_PRESS_COOLDOWN_MS = 2400;

/**
 * CSS class marking panel press interactions as temporarily locked.
 *
 * Use when toggling lock state in {@link initializePanelInteractivity}.
 */
const PANEL_PRESS_LOCK_CLASS = 'panel-press-locked';
const PANEL_LIGHT_ACTIVE_CLASS = 'panel-light-active';

/**
 * Hold duration that triggers the long-press transmission gesture (ms).
 *
 * Use when arming the long-press timer in {@link initializePanelInteractivity}.
 */
const PANEL_LONG_PRESS_MS = 1300;

/**
 * Pointer travel that cancels an in-progress long press (px).
 *
 * Keeps a deliberate hold distinct from a drag or tilt sweep.
 */
const PANEL_LONG_PRESS_MOVE_TOLERANCE_PX = 12;

/**
 * Media query representing user reduced-motion preference.
 *
 * Use when gating motion-heavy interactions in {@link initializePanelInteractivity}.
 */
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Initialize pointer-driven panel tilt, shader glint, and press feedback.
 *
 * Includes spam-press cooldown guard and automatic reset for reduced-motion.
 *
 * @param onLongPress - Invoked once when the panel is held still past
 * {@link PANEL_LONG_PRESS_MS}; omit to disable the long-press gesture.
 */
export function initializePanelInteractivity(onLongPress?: () => void): void {
	const panel = document.querySelector<HTMLElement>('.panel');
	if (!panel) return;
	initializePanelDragReload(panel);
	const panelLight = PanelLightRenderer.create(panel);
	let pressLockUntilMs = 0;
	let pressSamples: number[] = [];
	let pressLockTimerId: number | null = null;

	const clearPressLockTimer = (): void => {
		if (pressLockTimerId === null) return;
		window.clearTimeout(pressLockTimerId);
		pressLockTimerId = null;
	};

	const unlockPanelPress = (): void => {
		pressLockUntilMs = 0;
		panel.classList.remove(PANEL_PRESS_LOCK_CLASS);
		clearPressLockTimer();
	};

	const lockPanelPress = (nowMs: number): void => {
		pressLockUntilMs = nowMs + PANEL_PRESS_COOLDOWN_MS;
		panel.classList.add(PANEL_PRESS_LOCK_CLASS);
		clearPressLockTimer();
		pressLockTimerId = window.setTimeout(() => {
			unlockPanelPress();
		}, PANEL_PRESS_COOLDOWN_MS);
	};

	const clearPressDepth = (): void => {
		panel.style.setProperty('--panel-press-depth', '0');
	};

	const registerPanelPress = (nowMs: number): void => {
		pressSamples = pressSamples.filter((sample) => nowMs - sample <= PANEL_PRESS_SPAM_WINDOW_MS);
		pressSamples.push(nowMs);

		if (pressSamples.length >= PANEL_PRESS_SPAM_LIMIT) {
			pressSamples = [];
			clearPressDepth();
			lockPanelPress(nowMs);
		}
	};

	const resetPanelStyle = (): void => {
		panel.style.setProperty('--panel-tilt-x', '0');
		panel.style.setProperty('--panel-tilt-y', '0');
		panel.classList.remove(PANEL_LIGHT_ACTIVE_CLASS);
		clearPressDepth();
	};

	resetPanelStyle();

	panel.addEventListener('pointermove', (event) => {
		if (reduceMotionQuery.matches) return;

		const rect = panel.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;

		const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

		const tiltX = (x - 0.5) * 4.8;
		const tiltY = (0.5 - y) * 4.2;

		panel.style.setProperty('--panel-tilt-x', tiltX.toFixed(2));
		panel.style.setProperty('--panel-tilt-y', tiltY.toFixed(2));
		panel.classList.add(PANEL_LIGHT_ACTIVE_CLASS);
		panelLight?.setGlint(x, y);
	});

	panel.addEventListener('pointerleave', resetPanelStyle);

	panel.addEventListener('pointerdown', () => {
		if (reduceMotionQuery.matches) return;

		const nowMs = window.performance.now();
		if (pressLockUntilMs > 0 && nowMs >= pressLockUntilMs) {
			unlockPanelPress();
		}

		if (nowMs < pressLockUntilMs) {
			clearPressDepth();
			return;
		}

		registerPanelPress(nowMs);
		if (nowMs < pressLockUntilMs) return;

		panel.style.setProperty('--panel-press-depth', '1');
	});

	panel.addEventListener('pointerup', clearPressDepth);
	panel.addEventListener('pointercancel', clearPressDepth);

	// Long-press transmission gesture: a still hold past the threshold keys the
	// hidden morse sequence. Movement, release, or a spam lock cancels it.
	let longPressTimerId: number | null = null;
	let longPressPointerId: number | null = null;
	let longPressStartX = 0;
	let longPressStartY = 0;

	const cancelLongPress = (): void => {
		if (longPressTimerId !== null) {
			window.clearTimeout(longPressTimerId);
			longPressTimerId = null;
		}
		longPressPointerId = null;
	};

	if (onLongPress) {
		panel.addEventListener('pointerdown', (event) => {
			if (reduceMotionQuery.matches) return;
			cancelLongPress();
			if (window.performance.now() < pressLockUntilMs) return;

			longPressPointerId = event.pointerId;
			longPressStartX = event.clientX;
			longPressStartY = event.clientY;
			longPressTimerId = window.setTimeout(() => {
				longPressTimerId = null;
				longPressPointerId = null;
				onLongPress();
			}, PANEL_LONG_PRESS_MS);
		});

		panel.addEventListener('pointermove', (event) => {
			if (longPressPointerId === null || event.pointerId !== longPressPointerId) return;
			const dx = event.clientX - longPressStartX;
			const dy = event.clientY - longPressStartY;
			if (dx * dx + dy * dy > PANEL_LONG_PRESS_MOVE_TOLERANCE_PX ** 2) cancelLongPress();
		});

		panel.addEventListener('pointerup', cancelLongPress);
		panel.addEventListener('pointercancel', cancelLongPress);
		panel.addEventListener('pointerleave', cancelLongPress);
	}

	if (typeof reduceMotionQuery.addEventListener === 'function') {
		reduceMotionQuery.addEventListener('change', () => {
			if (reduceMotionQuery.matches) {
				unlockPanelPress();
				cancelLongPress();
				pressSamples = [];
				resetPanelStyle();
			}
		});
	}
}
