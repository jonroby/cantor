import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [tailwindcss(), svelte(), devtoolsJson()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src')
		},
		conditions: process.env.VITEST ? ['browser'] : undefined
	},
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		setupFiles: ['src/view/vitest-setup-view.ts']
	}
});
