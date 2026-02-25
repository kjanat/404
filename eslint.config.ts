import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
	globalIgnores(['dist/**']),
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
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
