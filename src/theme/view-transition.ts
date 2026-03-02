type StartViewTransition = Exclude<Document['startViewTransition'], undefined>;

/**
 * Narrow `Document` type to one exposing View Transitions API.
 *
 * @param doc - Document instance to test.
 * @returns Type guard for `startViewTransition` support.
 */
export function hasViewTransitionApi(
	doc: Document,
): doc is Document & { startViewTransition: StartViewTransition } {
	return typeof doc.startViewTransition === 'function';
}
