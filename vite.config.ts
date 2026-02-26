import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import svgToIco from 'vite-svg-to-ico';

export default defineConfig({
	plugins: [
		tailwindcss(),
		svgToIco({
			input: 'src/icon.svg',
			emit: { source: { name: 'favicon.svg' } },
		}),
	],
	dev: { sourcemap: true },
	build: { sourcemap: true },
	server: {
		open: true,
		host: true,
		allowedHosts: true,
		strictPort: true,
	},
});
