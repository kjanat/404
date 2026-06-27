/**
 * Page-context resolution for the 404 screen.
 *
 * The page has to tell two very different stories apart:
 *
 * - **domain-dead** — nothing is configured for this host (parked domain,
 *   broken DNS, unconfigured Pages). "Nobody lives here" is the right voice.
 * - **path-dead** — the host serves a real, working site, but this one URL is
 *   missing (a GitHub Pages project, or a stale link clicked on a live domain).
 *   Here the domain is fine; only the path went away.
 *
 * Downstream copy and escape links switch on the resolved {@link PageMode}. All
 * detection lives in pure, DOM-free helpers so it can be unit-tested; only
 * {@link readPageContext} touches `window`/`document`.
 */

/** Query-string key forcing a specific {@link PageMode} (`domain` | `path`). */
const MODE_PARAM = 'mode';

/** Query-string key overriding the displayed host (preview/build use). */
const HOST_PARAM = 'host';

/** Query-string key overriding the displayed path (preview/build use). */
const PATH_PARAM = 'path';

/** Path basenames that count as "no meaningful path" when alone in the URL. */
const INDEX_BASENAMES = new Set(['index.html', 'index.htm']);

/** Whether the failed URL points at a dead domain or just a dead path. */
export type PageMode = 'domain' | 'path';

/** A reachable destination offered to a visitor stranded on a missing path. */
export interface EscapeTarget {
	/** Root-relative href, e.g. `/` or `/project/`. */
	readonly href: string;
	/** Human label shown as the link text. */
	readonly label: string;
}

/** Fully-resolved context driving headline, blurb, and escape-link rendering. */
export interface PageContext {
	/** Resolved scenario; selects the copy pool and gates escape links. */
	readonly mode: PageMode;
	/** Display host (may be empty; callers substitute a generic label). */
	readonly host: string;
	/** Display path, normalized to a single leading slash (empty when none). */
	readonly path: string;
	/** Climb-up destinations, nearest-first and deduped; empty in domain mode. */
	readonly escapeTargets: readonly EscapeTarget[];
}

/** Raw location signals the resolver reads; mirrors the relevant `window`/`document` fields. */
export interface LocationSignals {
	readonly hostname: string;
	readonly pathname: string;
	readonly search: string;
	readonly referrer: string;
}

/** Normalize a pathname to a single leading slash and no duplicate slashes. */
function normalizePath(pathname: string): string {
	if (pathname.length === 0) return '/';
	const withLead = pathname.startsWith('/') ? pathname : `/${pathname}`;
	return withLead.replace(/\/{2,}/g, '/');
}

/** Split a path into its non-empty segments. */
function pathSegments(pathname: string): string[] {
	return pathname.split('/').filter((segment) => segment.length > 0);
}

/**
 * Decide whether `pathname` names a specific resource rather than the site root.
 *
 * The root, the empty path, and a bare index document are not meaningful —
 * there is nothing path-specific to talk about, so the copy stays domain-level.
 */
function hasMeaningfulPath(pathname: string): boolean {
	const segments = pathSegments(pathname);
	const only = segments[0];
	if (only === undefined) return false;
	if (segments.length === 1 && INDEX_BASENAMES.has(only.toLowerCase())) return false;
	return true;
}

/** Extract the hostname of a referrer URL, or `null` when absent/unparseable. */
function referrerHostname(referrer: string): string | null {
	if (referrer.length === 0) return null;
	try {
		return new URL(referrer).hostname;
	} catch {
		return null;
	}
}

/**
 * True when the visitor arrived from a page on the same host.
 *
 * A same-host referrer is proof the domain is live — it just served them the
 * page they clicked from — so a 404 here is path-level, not domain-level.
 */
function cameFromSameHost(signals: LocationSignals): boolean {
	if (signals.hostname.length === 0) return false;
	return referrerHostname(signals.referrer) === signals.hostname;
}

/**
 * True for GitHub Pages hosts (`*.github.io`).
 *
 * On Pages the first path segment is the project root; a deeper miss means the
 * project exists even though the page does not.
 */
function isGithubPagesHost(hostname: string): boolean {
	return /\.github\.io$/i.test(hostname);
}

/** Read an explicit `?mode=` override, or `null` when unset/invalid. */
function readModeOverride(params: URLSearchParams): PageMode | null {
	const raw = params.get(MODE_PARAM)?.trim().toLowerCase();
	if (raw === 'domain' || raw === 'path') return raw;
	return null;
}

/**
 * Auto-detect the page mode from location signals.
 *
 * Path mode requires both a meaningful path *and* confidence the domain is
 * alive (a same-host referrer, or a GitHub Pages host). A meaningful path
 * alone is too weak — a parked domain still 404s deep URLs.
 */
function detectMode(signals: LocationSignals, displayPath: string): PageMode {
	if (!hasMeaningfulPath(displayPath)) return 'domain';
	if (cameFromSameHost(signals) || isGithubPagesHost(signals.hostname)) return 'path';
	return 'domain';
}

/**
 * Build climb-up destinations for a missing path, nearest-first and deduped.
 *
 * Always offers the site root; adds the immediate parent directory and, on
 * GitHub Pages, the owning project root (`/<repo>/`). The missing path itself
 * is never returned.
 */
function buildEscapeTargets(signals: LocationSignals, displayPath: string): EscapeTarget[] {
	const segments = pathSegments(displayPath);
	const firstSegment = segments[0];
	if (firstSegment === undefined) return [];

	const targets: EscapeTarget[] = [];
	const seen = new Set<string>();
	const currentHref = `/${segments.join('/')}`;

	const add = (href: string, label: string): void => {
		if (href === currentHref || seen.has(href)) return;
		seen.add(href);
		targets.push({ href, label });
	};

	// GitHub Pages project root: the project exists even if the page does not.
	if (isGithubPagesHost(signals.hostname) && segments.length >= 2) {
		add(`/${firstSegment}/`, `the ${firstSegment} project`);
	}

	// Immediate parent directory.
	const parentSegments = segments.slice(0, -1);
	if (parentSegments.length > 0) {
		add(`/${parentSegments.join('/')}/`, 'up one level');
	}

	// Site root.
	add('/', 'the homepage');

	return targets;
}

/**
 * Resolve the full {@link PageContext} from raw location signals.
 *
 * Pure and DOM-free: `?host=`/`?path=` override the display values for previews
 * and the build, and `?mode=` forces a scenario; otherwise the mode is detected
 * from the live signals. Use {@link readPageContext} to pull from the browser.
 */
export function resolvePageContext(signals: LocationSignals): PageContext {
	const params = new URLSearchParams(signals.search);

	const hostOverride = params.get(HOST_PARAM)?.trim() ?? '';
	const host = hostOverride.length > 0 ? hostOverride : signals.hostname;

	const pathOverride = params.get(PATH_PARAM)?.trim() ?? '';
	const displayPath = normalizePath(pathOverride.length > 0 ? pathOverride : signals.pathname);

	const mode = readModeOverride(params) ?? detectMode(signals, displayPath);

	const path = hasMeaningfulPath(displayPath) ? displayPath : '';
	const escapeTargets = mode === 'path' ? buildEscapeTargets(signals, displayPath) : [];

	return { mode, host, path, escapeTargets };
}

/** Read {@link PageContext} from the live `window`/`document`, with safe off-DOM defaults. */
export function readPageContext(): PageContext {
	if (typeof window === 'undefined') {
		return { mode: 'domain', host: '', path: '', escapeTargets: [] };
	}

	return resolvePageContext({
		hostname: window.location.hostname,
		pathname: window.location.pathname,
		search: window.location.search,
		referrer: typeof document === 'undefined' ? '' : document.referrer,
	});
}
