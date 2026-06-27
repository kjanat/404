/// <reference types="bun" />
import { type LocationSignals, type PageContext, resolvePageContext } from '#404/page-context';
import { describe, expect, test } from 'bun:test';

/** Build location signals with sensible blank defaults for the field(s) under test. */
function signals(overrides: Partial<LocationSignals> = {}): LocationSignals {
	return { hostname: '', pathname: '/', search: '', referrer: '', ...overrides };
}

function resolve(overrides: Partial<LocationSignals> = {}): PageContext {
	return resolvePageContext(signals(overrides));
}

describe('mode detection', () => {
	test('root path on an unknown host is domain mode', () => {
		expect(resolve({ hostname: 'example.com', pathname: '/' }).mode).toBe('domain');
	});

	test('bare index document is not a meaningful path', () => {
		expect(resolve({ hostname: 'example.com', pathname: '/index.html' }).mode).toBe('domain');
	});

	test('deep path with no corroborating signal stays domain mode', () => {
		// A parked domain still 404s deep URLs, so a path alone is too weak.
		expect(resolve({ hostname: 'example.com', pathname: '/blog/post' }).mode).toBe('domain');
	});

	test('same-host referrer flips a deep path to path mode', () => {
		const ctx = resolve({
			hostname: 'example.com',
			pathname: '/blog/post',
			referrer: 'https://example.com/index',
		});
		expect(ctx.mode).toBe('path');
	});

	test('cross-host referrer does not trigger path mode', () => {
		const ctx = resolve({
			hostname: 'example.com',
			pathname: '/blog/post',
			referrer: 'https://google.com/search',
		});
		expect(ctx.mode).toBe('domain');
	});

	test('GitHub Pages deep path is path mode without a referrer', () => {
		const ctx = resolve({ hostname: 'user.github.io', pathname: '/repo/docs/missing' });
		expect(ctx.mode).toBe('path');
	});

	test('GitHub Pages root is still domain mode', () => {
		expect(resolve({ hostname: 'user.github.io', pathname: '/' }).mode).toBe('domain');
	});
});

describe('overrides', () => {
	test('?mode=path forces path mode even on a root path', () => {
		expect(resolve({ hostname: 'example.com', pathname: '/', search: '?mode=path' }).mode).toBe('path');
	});

	test('?mode=domain forces domain mode despite a same-host referrer', () => {
		const ctx = resolve({
			hostname: 'example.com',
			pathname: '/blog/post',
			referrer: 'https://example.com/',
			search: '?mode=domain',
		});
		expect(ctx.mode).toBe('domain');
	});

	test('invalid ?mode= falls back to auto-detection', () => {
		expect(resolve({ hostname: 'example.com', pathname: '/', search: '?mode=banana' }).mode).toBe('domain');
	});

	test('?host= overrides the display host', () => {
		expect(resolve({ hostname: 'real.host', search: '?host=preview.example' }).host).toBe('preview.example');
	});

	test('?path= overrides the display path and drives detection', () => {
		const ctx = resolve({ hostname: 'example.com', pathname: '/', search: '?path=/docs/x&mode=path' });
		expect(ctx.path).toBe('/docs/x');
	});
});

describe('display values', () => {
	test('host falls back to the real hostname', () => {
		expect(resolve({ hostname: 'example.com' }).host).toBe('example.com');
	});

	test('path is empty when there is no meaningful path', () => {
		expect(resolve({ hostname: 'example.com', pathname: '/' }).path).toBe('');
	});

	test('path is normalized to a single leading slash', () => {
		const ctx = resolve({ hostname: 'example.com', search: '?path=docs//deep&mode=path' });
		expect(ctx.path).toBe('/docs/deep');
	});
});

describe('escape targets', () => {
	test('domain mode never offers escape targets', () => {
		expect(resolve({ hostname: 'example.com', pathname: '/blog/post' }).escapeTargets).toEqual([]);
	});

	test('a deep path offers parent then homepage', () => {
		const ctx = resolve({
			hostname: 'example.com',
			pathname: '/blog/2026/post',
			referrer: 'https://example.com/',
		});
		expect(ctx.escapeTargets.map((target) => target.href)).toEqual(['/blog/2026/', '/']);
	});

	test('GitHub Pages adds the project root and dedupes against the parent', () => {
		const ctx = resolve({ hostname: 'user.github.io', pathname: '/repo/missing' });
		// parent of /repo/missing is /repo/, same as the project root — kept once.
		expect(ctx.escapeTargets.map((target) => target.href)).toEqual(['/repo/', '/']);
		expect(ctx.escapeTargets[0]?.label).toBe('the repo project');
	});

	test('GitHub Pages keeps project root, parent, and homepage distinct when deep', () => {
		const ctx = resolve({ hostname: 'user.github.io', pathname: '/repo/a/b' });
		expect(ctx.escapeTargets.map((target) => target.href)).toEqual(['/repo/', '/repo/a/', '/']);
	});

	test('a single-segment path collapses to just the homepage', () => {
		const ctx = resolve({ hostname: 'example.com', search: '?path=/lonely&mode=path' });
		expect(ctx.escapeTargets.map((target) => target.href)).toEqual(['/']);
	});
});
