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

/** One normalized lightning segment uploaded to the WebGL renderer. */
export interface BoltSegment {
	/** Segment start x in normalized top-left viewport space. */
	readonly ax: number;
	/** Segment start y in normalized top-left viewport space. */
	readonly ay: number;
	/** Segment end x in normalized top-left viewport space. */
	readonly bx: number;
	/** Segment end y in normalized top-left viewport space. */
	readonly by: number;
	/** Segment core width in CSS pixels. */
	readonly width: number;
	/** Segment relative brightness multiplier. */
	readonly strength: number;
}

/** Numeric range used for bounded random sampling. */
export interface Range {
	/** Inclusive lower bound. */
	readonly min: number;
	/** Upper bound (exclusive for `rand`, inclusive for `randInt`). */
	readonly max: number;
}

/** Fully generated CG flash sequence used by the runtime state machine. */
export interface FlashSequence {
	/** Ordered stroke list, first stroke typically brightest. */
	readonly strokes: readonly StrokeEvent[];
	/** Generated WebGL line segments activated by this flash. */
	readonly boltSegments: readonly BoltSegment[];
	/** Preflash buildup duration in milliseconds. */
	readonly preflashDuration: number;
	/** Continuing-current tail duration in milliseconds. */
	readonly continuingCurrentDuration: number;
	/** Whether to include M-component pulse during tail. */
	readonly hasMComponent: boolean;
	/** Interstroke delays; length is `strokes.length - 1`. */
	readonly interstrokeIntervals: readonly number[];
}
