import eslint from '@eslint/js';
import tailwind from 'eslint-plugin-tailwindcss';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import { resolve } from 'node:path';
import tseslint from 'typescript-eslint';

export default defineConfig(
	globalIgnores(['dist/**']),
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	tailwind.configs['flat/recommended'],
	{
		settings: {
			tailwindcss: {
				config: resolve(import.meta.dirname, 'src/styles.css'),
			},
		},
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['.github/actions/capture/*.mjs'],
				},
			},
		},
		rules: {
			'@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
		},
	},
	{
		files: ['.github/**/*.mjs'],
		languageOptions: { globals: globals.node },
	},
);
