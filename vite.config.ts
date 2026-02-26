import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import svgToIco from 'vite-svg-to-ico';

export default defineConfig({
	base: '/',
	plugins: [
		tailwindcss(),
		svgToIco({
			input: 'src/icon.svg',
			emit: { source: { name: 'favicon.svg' } },
		}),
		{
			name: 'cf-async-disable',
			transformIndexHtml(html) {
				return html.replace(/<script type="module"/g, '<script data-cfasync="false" type="module"');
			},
		},
	],
	build: { sourcemap: true },
	server: {
		open: true,
		host: true,
		allowedHosts: true,
		strictPort: true,
	},
});
