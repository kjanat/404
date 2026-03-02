/** Runtime phase for the lightning flash state machine. */
export enum FlashPhase {
	/** Idle period between CG flashes. */
	Quiet,
	/** Diffuse preflash glow before first return stroke. */
	PreFlash,
	/** Single-frame return stroke peak. */
	StrokePeak,
	/** Exponential decay after stroke peak. */
	StrokeDecay,
	/** Dark interval between consecutive strokes. */
	Interstroke,
	/** Slow tail current after final stroke. */
	ContinuingCurrent,
	/** Re-brightening pulse during continuing current. */
	MComponent,
	/** Background intra-cloud glow event. */
	ICGlow,
}

/** A single return stroke event descriptor. */
export interface StrokeEvent {
	/** Peak intensity in normalized `[0, 1]` range. */
	readonly peakIntensity: number;
	/** Exponential decay time constant in milliseconds. */
	readonly decayTau: number;
}

/** Fully generated CG flash sequence used by the runtime state machine. */
export interface FlashSequence {
	/** Ordered stroke list, first stroke typically brightest. */
	readonly strokes: readonly StrokeEvent[];
	/** Bolt element indexes activated for this flash. */
	readonly boltIndices: readonly number[];
	/** Preflash buildup duration in milliseconds. */
	readonly preflashDuration: number;
	/** Continuing-current tail duration in milliseconds. */
	readonly continuingCurrentDuration: number;
	/** Whether to include M-component pulse during tail. */
	readonly hasMComponent: boolean;
	/** Interstroke delays; length is `strokes.length - 1`. */
	readonly interstrokeIntervals: readonly number[];
}
