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

/** Pick a random item from a non-empty readonly tuple. */
function pickRandom<T>(arr: readonly [T, ...T[]]): T {
	const value = arr[Math.floor(Math.random() * arr.length)];
	if (value === undefined) {
		throw new Error('pickRandom selected out-of-range index');
	}
	return value;
}

/* Blurb template parsing */

interface TextPart {
	readonly kind: 'text';
	readonly value: string;
}

interface HostPart {
	readonly kind: 'host';
}

type InlinePart = TextPart | HostPart;

interface CodePart {
	readonly kind: 'code';
	readonly inner: readonly InlinePart[];
}

type TemplatePart = InlinePart | CodePart;

/** Split a raw string on `{host}` into typed inline parts. */
function parseInline(text: string): readonly InlinePart[] {
	const result: InlinePart[] = [];
	const segments = text.split('{host}');
	for (let i = 0; i < segments.length; i++) {
		if (i > 0) result.push({ kind: 'host' });
		const seg = segments[i];
		if (seg) result.push({ kind: 'text', value: seg });
	}
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
 * Substitutes `hostSpan` clones for every `{host}` placeholder and wraps
 * backtick spans in `<code>` elements. Newlines outside code spans become
 * `<br>` elements.
 */
function renderBlurb(
	target: HTMLElement,
	parts: readonly TemplatePart[],
	hostSpan: HTMLSpanElement,
): void {
	target.textContent = '';
	for (const part of parts) {
		if (part.kind === 'text') {
			appendTextWithBreaks(target, part.value);
		} else if (part.kind === 'host') {
			target.appendChild(hostSpan.cloneNode(true));
		} else {
			const code = document.createElement('code');
			for (const inner of part.inner) {
				if (inner.kind === 'text') {
					code.appendChild(document.createTextNode(inner.value));
				} else {
					code.appendChild(hostSpan.cloneNode(true));
				}
			}
			target.appendChild(code);
		}
	}
}

/**
 * Populate host-dependent copy and title for the 404 page.
 *
 * Uses `?host=` override when present, else falls back to `window.location.hostname`.
 */
export function initializePage(): void {
	const rawHostParam = new URLSearchParams(window.location.search).get('host');
	const host = rawHostParam && rawHostParam.trim().length > 0
		? rawHostParam.trim()
		: window.location.hostname;
	if (!host) return;

	const headlineTarget = document.querySelector<HTMLElement>('[data-headline]');
	if (headlineTarget) {
		headlineTarget.textContent = pickRandom(HEADLINES);
	}

	const blurbTarget = document.querySelector<HTMLElement>('[data-blurb]');
	if (blurbTarget) {
		const hostSpan = document.createElement('span');
		hostSpan.className = 'font-bold break-all text-accent-2';
		hostSpan.textContent = host;
		renderBlurb(blurbTarget, parseTemplate(pickRandom(BLURBS)), hostSpan);
	}

	for (const target of document.querySelectorAll<HTMLElement>('[data-host]')) {
		target.textContent = host;
	}

	document.title = `404 | ${host}`;
}
