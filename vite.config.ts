import devtoolsJson from 'vite-plugin-devtools-json';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte(), devtoolsJson()],
	publicDir: 'static',
	build: {
		chunkSizeWarningLimit: 6500,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('plotly.js-dist-min')) return 'plotly';
					if (
						id.includes('@mlc-ai/web-llm') ||
						id.includes('/src/external/providers/webllm') ||
						id.includes('/src/external/providers/webllm-worker')
					) {
						return 'webllm';
					}
					if (
						id.includes('@xenova/transformers') ||
						id.includes('/src/external/providers/embedding')
					) {
						return 'embedding';
					}
					if (id.includes('/node_modules/katex/')) return 'katex';
					if (id.includes('/node_modules/bits-ui/')) return 'bits-ui';
					if (id.includes('/node_modules/lucide-svelte/')) return 'lucide';
					if (id.includes('/node_modules/marked/')) return 'marked';
					if (id.includes('/node_modules/dompurify/')) return 'dompurify';
					if (id.includes('/node_modules/jszip/')) return 'jszip';
					if (id.includes('/node_modules/xstate/')) return 'xstate';
				}
			}
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			'@tests': path.resolve(__dirname, 'tests')
		},
		conditions: process.env.VITEST ? ['browser'] : undefined
	},
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		setupFiles: ['tests/setup/view.ts']
	}
});
