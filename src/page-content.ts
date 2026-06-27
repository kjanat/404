import { type EscapeTarget, readPageContext } from '#404/page-context';

const HEADLINES: readonly [string, ...string[]] = [
	'404 \u2014 Huh?',
	'404 \u2014 Who are you?',
	'404 \u2014 What are you doing here?',
	'404 \u2014 Do I know you?',
	'404 \u2014 Wait, what?',
	'404 \u2014 Come again?',
	'404 \u2014 Sorry, who?',
	'404 \u2014 Nope.',
	'404 \u2014 Go home.',
	'404 \u2014 No.',
	'404 \u2014 Absolutely not.',
	'404 \u2014 Not today.',
	'404 \u2014 Try again. Or don\u2019t.',
	'404 \u2014 Nothing to see here.',
	'404 \u2014 Nice try though.',
	'404 \u2014 Not even close.',
	'404 \u2014 You sure about that URL?',
	'404 \u2014 Cute URL. Doesn\u2019t exist.',
	'404 \u2014 Bold of you to assume.',
	'404 \u2014 Bless your heart.',
	'404 \u2014 This is awkward.',
	'404 \u2014 Well, this is embarrassing.',
	'404 \u2014 You seem lost.',
	'404 \u2014 Wrong turn, buddy.',
	'404 \u2014 Somebody lied to you.',
	'404 \u2014 This host is not configured.',
	'404 \u2014 There\u2019s nothing here.',
	'404 \u2014 Nobody lives here.',
	'404 \u2014 Plot twist: there is no website.',
	'404 \u2014 The void says hi.',
];

const BLURBS: readonly [string, ...string[]] = [
	'{host} gazed into the void, and the void gazed back. There\u2019s nothing here \u2014 no site, no config, not even a humble \u2018Hello World.\u2019 If you expected something, someone owes you an apology.',
	'Legend has it that {host} once hosted a website. That legend is wrong. There\u2019s nothing here. There never was.',
	'{host} is the digital equivalent of showing up to a party at the wrong address. Awkward silence. Empty rooms. Check the address.',
	'If {host} were a book, every page would be blank. Avant-garde? Maybe. Useful? Absolutely not.',
	'Somewhere in a parallel universe, {host} is a thriving website. This is not that universe.',
	'{host} is serving absolutely nothing. Whoever pointed you here probably fat-fingered a DNS record. We\u2019re not pointing fingers, but someone should double-check their work.',
	'You\u2019ve reached {host}. Nobody\u2019s home. We checked. Twice. If you expected a website, the DNS might be lying to you.',
	'{host} has the same energy as a \u2018Coming Soon\u2019 sign that\u2019s been up since 2019. Nothing\u2019s coming. Nothing was ever coming.',
	'The server responded. {host} did not. One of them is doing their job.',
	'Fun fact: {host} has been visited more times than it\u2019s been configured. You\u2019re part of the statistic now. Congratulations.',
	'We asked {host} what it wanted to be when it grew up. It hasn\u2019t decided yet. Check back later, or check the address \u2014 one of you is lost.',
	'{host} was supposed to be here, but it ghosted us. Left us on read. Not cool, {host}. Not cool.',
	'{host} called in sick today. No substitute was provided. Please try again when it feels better, or check if you have the right address.',
	'{host} is giving main character energy with zero plot development. Completely empty arc.',
	'Dear {host}, we\u2019ve been trying to reach you about your extended website warranty. Please exist at your earliest convenience.',
	'{host} is a pristine, untouched plot of internet. No tenants, no content, just digital tumbleweeds. If you expected a website here, the address might be wrong \u2014 or the landlord forgot to build.',
	'Welcome to {host}, a beautiful vacant lot on the information superhighway. Zoning permits pending. Utilities not connected. Content: none.',
	'{host}: zero bedrooms, zero bathrooms, zero content. Great bones though. Someone should really develop this property.',
	'Roses are red, violets are blue, {host} has no website, and now you\u2019re sad too.',
	'Knock knock. Who\u2019s there? Not {host}, that\u2019s for sure. This domain is emptier than a promises.txt from your last standup.',
	'404: the number of seconds you\u2019ll spend wondering why {host} has nothing on it. Spoiler: nobody configured it.',
	'{host} exists the way your weekend plans do \u2014 technically real, but with absolutely nothing behind it. Check the address, maybe.',
	'Turns out {host} is a domain, not a website. Common misconception. Like thinking the cloud is actually a cloud.',
	'{host}\u2019s deployment pipeline is flawless: nothing goes in, nothing comes out. Zero bugs. Technically perfect.',
	'`SELECT * FROM {host} WHERE content IS NOT NULL`\nreturned zero rows. The database is not the problem. There is no database.',
	'{host} runs on 100% renewable energy because it does absolutely nothing. Carbon-neutral by default.',
	'git log for {host} is empty. No commits, no history, no regrets. A clean slate in every sense.',
	'This page is the only proof that {host} exists. Think of it as a birth certificate for an empty domain. Frame it if you want.',
	'A wise person once said, \u2018If you visit {host} and nothing loads, does the website even exist?\u2019 The answer is no. It does not.',
	'{host} has all the charisma of a 404 page. Oh wait \u2014 that\u2019s exactly what this is.',
];

/**
 * Headlines for the path-dead scenario: the site works, this one URL does not.
 *
 * Use when the resolved page mode is `path` (see {@link initializePage}).
 */
const PATH_HEADLINES: readonly [string, ...string[]] = [
	'404 \u2014 Wrong turn.',
	'404 \u2014 Dead link, live site.',
	'404 \u2014 This page wandered off.',
	'404 \u2014 Close, but no page.',
	'404 \u2014 That link lied to you.',
	'404 \u2014 The site\u2019s fine. This page isn\u2019t.',
	'404 \u2014 You took a wrong turn.',
	'404 \u2014 Lost the thread.',
	'404 \u2014 Almost. Not quite.',
	'404 \u2014 This page packed up and left.',
	'404 \u2014 Nope, not this one.',
	'404 \u2014 The page, not the place.',
];

/**
 * Blurbs for the path-dead scenario; reference both the living `{host}` and the
 * missing `{path}` so it reads as "wrong turn," not "dead domain."
 *
 * Use when the resolved page mode is `path` (see {@link initializePage}).
 */
const PATH_BLURBS: readonly [string, ...string[]] = [
	'Good news: {host} is alive and well. Less good: there\u2019s nothing at {path}. You\u2019re one wrong link away from where you meant to be.',
	'{host} works fine \u2014 it just doesn\u2019t have a {path}. Wrong turn, not a dead end. Try one of the doors below.',
	'The site loaded. {path} did not. Somebody\u2019s link needs a typo-ectomy, but the rest of {host} is open for business.',
	'Nothing lives at {path}, yet the rest of {host} is perfectly fine. You took a wrong turn somewhere \u2014 here\u2019s the way back.',
	'Plot twist: {host} exists, this page doesn\u2019t. {path} is a dead link on a very-much-alive site. Climb back up and try again.',
	'You found {host}. You did not find {path}. The good part of the site is just a click away.',
	'Whoever sent you to {path} owes you an apology \u2014 it isn\u2019t a real page. The working part of {host} is one click away.',
	'{path} is missing in action, but {host} itself is up and running. Don\u2019t leave; just back up a level.',
	'This isn\u2019t the whole domain throwing in the towel \u2014 only {path} is gone. {host} is still very much open. Pick a door below.',
	'404 means \u201cnot found,\u201d not \u201cnever existed.\u201d {host} is fine; {path} just isn\u2019t a thing. Let\u2019s get you back on track.',
	'The map says {path}. The territory disagrees. {host} is still here, though \u2014 follow one of these links home.',
	'{path} took the day off. {host} did not. Try the homepage, or step back up the path.',
];

/** Pick a random item from a non-empty readonly tuple. */
function pickRandom<T>(arr: readonly [T, ...T[]]): T {
	const value = arr[Math.floor(Math.random() * arr.length)];
	if (value === undefined) {
		throw new Error('pickRandom selected out-of-range index');
	}
	return value;
}

/* Blurb template parsing */

/** Substitutable placeholder names recognized inside blurb templates. */
type PlaceholderName = 'host' | 'path';

interface TextPart {
	readonly kind: 'text';
	readonly value: string;
}

interface PlaceholderPart {
	readonly kind: 'placeholder';
	readonly name: PlaceholderName;
}

type InlinePart = TextPart | PlaceholderPart;

interface CodePart {
	readonly kind: 'code';
	readonly inner: readonly InlinePart[];
}

type TemplatePart = InlinePart | CodePart;

/** Matches `{host}` / `{path}` placeholders; capture group 1 is the name. */
const PLACEHOLDER_RE = /\{(host|path)\}/g;

/** Split a raw string on `{host}` / `{path}` into typed inline parts. */
function parseInline(text: string): readonly InlinePart[] {
	const result: InlinePart[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(PLACEHOLDER_RE)) {
		const name = match[1];
		if (name !== 'host' && name !== 'path') continue;
		const index = match.index;
		if (index > lastIndex) result.push({ kind: 'text', value: text.slice(lastIndex, index) });
		result.push({ kind: 'placeholder', name });
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) result.push({ kind: 'text', value: text.slice(lastIndex) });
	return result;
}

/**
 * Parse a blurb template string into typed segments.
 *
 * Backtick-delimited spans become `CodePart`; everything else is split on
 * `{host}` into `TextPart` / `HostPart` inline nodes.
 */
function parseTemplate(template: string): readonly TemplatePart[] {
	const result: TemplatePart[] = [];
	const segments = template.split('`');
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i] ?? '';
		const inner = parseInline(seg);
		if (i % 2 === 1) {
			result.push({ kind: 'code', inner });
		} else {
			result.push(...inner);
		}
	}
	return result;
}

/** Append `text` to `parent`, inserting `<br>` elements at each `\n`. */
function appendTextWithBreaks(parent: HTMLElement, text: string): void {
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		if (i > 0) parent.appendChild(document.createElement('br'));
		const line = lines[i];
		if (line) parent.appendChild(document.createTextNode(line));
	}
}

/**
 * Render a parsed blurb into the DOM.
 *
 * Substitutes a clone of the matching `placeholders` span for every `{host}` /
 * `{path}` placeholder and wraps backtick spans in `<code>` elements. Newlines
 * outside code spans become `<br>` elements.
 */
function renderBlurb(
	target: HTMLElement,
	parts: readonly TemplatePart[],
	placeholders: Readonly<Record<PlaceholderName, HTMLSpanElement>>,
): void {
	target.textContent = '';
	for (const part of parts) {
		if (part.kind === 'text') {
			appendTextWithBreaks(target, part.value);
		} else if (part.kind === 'placeholder') {
			target.appendChild(placeholders[part.name].cloneNode(true));
		} else {
			const code = document.createElement('code');
			for (const inner of part.inner) {
				if (inner.kind === 'text') {
					code.appendChild(document.createTextNode(inner.value));
				} else {
					code.appendChild(placeholders[inner.name].cloneNode(true));
				}
			}
			target.appendChild(code);
		}
	}
}

/**
 * Populate the escape-link row with climb-up destinations, or keep it hidden.
 *
 * Only the path-dead scenario yields targets; an empty list leaves the row
 * hidden so the domain-dead page never offers links into a dead domain.
 */
function renderEscapeTargets(targets: readonly EscapeTarget[]): void {
	const container = document.querySelector<HTMLElement>('[data-escape-hatches]');
	if (!container) return;

	const list = container.querySelector<HTMLElement>('[data-escape-links]');
	if (!list) return;

	list.textContent = '';
	if (targets.length === 0) {
		container.hidden = true;
		return;
	}

	for (const target of targets) {
		const link = document.createElement('a');
		link.className = 'escape-hatch';
		link.href = target.href;
		link.title = target.href;
		link.textContent = target.label;
		list.appendChild(link);
	}
	container.hidden = false;
}

/** Build an accent-coloured inline span carrying substituted copy. */
function makeAccentSpan(className: string, text: string): HTMLSpanElement {
	const span = document.createElement('span');
	span.className = className;
	span.textContent = text;
	return span;
}

/**
 * Populate host/path-dependent copy, escape links, and title for the 404 page.
 *
 * The scenario (dead domain vs dead path) is resolved by {@link readPageContext}
 * — it honours `?host=`/`?path=`/`?mode=` overrides and otherwise detects from
 * the live location. Path mode swaps in the "wrong turn" copy pool and reveals
 * climb-up links; domain mode keeps the original "nobody home" voice.
 */
export function initializePage(): void {
	const context = readPageContext();
	const isPathMode = context.mode === 'path';
	const copyHost = context.host.length > 0 ? context.host : 'this host';
	const copyPath = context.path.length > 0 ? context.path : 'this page';

	const headlineTarget = document.querySelector<HTMLElement>('[data-headline]');
	if (headlineTarget) {
		headlineTarget.textContent = pickRandom(isPathMode ? PATH_HEADLINES : HEADLINES);
	}

	const blurbTarget = document.querySelector<HTMLElement>('[data-blurb]');
	if (blurbTarget) {
		const placeholders = {
			host: makeAccentSpan('font-bold text-accent-2', copyHost),
			path: makeAccentSpan('font-bold text-accent', copyPath),
		} as const;
		renderBlurb(blurbTarget, parseTemplate(pickRandom(isPathMode ? PATH_BLURBS : BLURBS)), placeholders);
	}

	for (const target of document.querySelectorAll<HTMLElement>('[data-host]')) {
		target.textContent = copyHost;
	}

	renderEscapeTargets(context.escapeTargets);

	if (context.host.length > 0) {
		document.title = `404 | ${context.host}`;
	}
}
