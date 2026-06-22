/**
 * Downward travel (px) the panel must reach before a release reloads the page.
 *
 * Use when deciding whether a pull gesture is committed in
 * {@link initializePanelDragReload}.
 */
const DRAG_RELOAD_THRESHOLD_PX = 120;

/**
 * Resistance factor so the panel trails the finger with a rubber-band feel.
 *
 * Use when mapping raw pointer travel to panel offset in
 * {@link initializePanelDragReload}.
 */
const DRAG_RESISTANCE = 0.6;

/**
 * Maximum distance (px) the panel can be dragged downward.
 *
 * Use when clamping panel offset in {@link initializePanelDragReload}.
 */
const DRAG_MAX_TRAVEL_PX = 220;

/**
 * Vertical travel (px) before an ambiguous touch is locked in as a pull.
 *
 * Use when distinguishing a downward pull from a tap/horizontal swipe in
 * {@link initializePanelDragReload}.
 */
const DRAG_DIRECTION_SLOP_PX = 10;

/**
 * CSS custom property carrying the live downward drag offset.
 *
 * Use when feeding the panel transform in {@link initializePanelDragReload}.
 */
const DRAG_OFFSET_VAR = '--panel-drag-y';

/**
 * Class disabling the panel transition while it tracks the finger.
 *
 * Use when toggling immediate-follow state in {@link initializePanelDragReload}.
 */
const DRAG_ACTIVE_CLASS = 'panel-dragging';

/**
 * Class marking the pull as past the reload threshold (armed).
 *
 * Use when reflecting commit-ready state in {@link initializePanelDragReload}.
 */
const DRAG_ARMED_CLASS = 'panel-drag-armed';

/**
 * Wire a mobile-only "pull the panel down to reload" gesture.
 *
 * Only touch pointers drive the gesture; mouse/pen input is ignored so the
 * existing tilt and press interactions are untouched on desktop. A downward
 * drag past {@link DRAG_RELOAD_THRESHOLD_PX} reloads the page on release;
 * shorter pulls settle the panel back to rest.
 */
export function initializePanelDragReload(panel: HTMLElement): void {
	let activePointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let dragging = false;

	const setOffset = (px: number): void => {
		panel.style.setProperty(DRAG_OFFSET_VAR, `${px}px`);
	};

	const settle = (): void => {
		activePointerId = null;
		dragging = false;
		panel.classList.remove(DRAG_ACTIVE_CLASS, DRAG_ARMED_CLASS);
		setOffset(0);
	};

	panel.addEventListener('pointerdown', (event) => {
		if (event.pointerType !== 'touch') return;
		activePointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		dragging = false;
	});

	panel.addEventListener('pointermove', (event) => {
		if (event.pointerId !== activePointerId) return;

		const dx = event.clientX - startX;
		const dy = event.clientY - startY;

		if (!dragging) {
			// Ignore upward motion and abandon the gesture if it reads as a
			// horizontal swipe rather than a deliberate downward pull.
			if (dy < DRAG_DIRECTION_SLOP_PX) {
				if (dy < 0 || Math.abs(dx) > Math.abs(dy)) activePointerId = null;
				return;
			}
			if (Math.abs(dx) > dy) {
				activePointerId = null;
				return;
			}
			dragging = true;
			panel.classList.add(DRAG_ACTIVE_CLASS);
			panel.setPointerCapture(event.pointerId);
		}

		event.preventDefault();
		setOffset(Math.min(dy * DRAG_RESISTANCE, DRAG_MAX_TRAVEL_PX));
		panel.classList.toggle(DRAG_ARMED_CLASS, dy >= DRAG_RELOAD_THRESHOLD_PX);
	});

	const finish = (event: PointerEvent): void => {
		if (event.pointerId !== activePointerId) return;
		const committed = dragging && event.clientY - startY >= DRAG_RELOAD_THRESHOLD_PX;
		settle();
		if (committed) window.location.reload();
	};

	panel.addEventListener('pointerup', finish);
	panel.addEventListener('pointercancel', settle);
}
