import type { Plugin } from 'vite';

/** Inject `<meta name="version">` into the head with the package.json version. */
function versionMeta(version: string): Plugin {
	return {
		name: 'version-meta',
		transformIndexHtml() {
			return [
				{ tag: 'meta', attrs: { name: 'version', content: version }, injectTo: 'head-prepend' },
			];
		},
	};
}
export { versionMeta, versionMeta as default };
