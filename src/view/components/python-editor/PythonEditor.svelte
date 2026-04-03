<script lang="ts">
	import { tick } from 'svelte';

	let code = $state(
		`# Write your Python here\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("World"))`
	);
	let output = $state('');
	let isRunning = $state(false);
	let isLoading = $state(false);
	let hasError = $state(false);
	let cardElement: HTMLDivElement | null = $state(null);

	interface Props {
		onMeasure?: (height: number) => void;
	}

	let { onMeasure }: Props = $props();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let pyodide: any = null;

	$effect(() => {
		if (!cardElement || typeof ResizeObserver === 'undefined' || !onMeasure) return;

		const reportHeight = () => {
			const nextHeight = Math.ceil(cardElement?.offsetHeight ?? 0);
			if (nextHeight > 0) {
				onMeasure(nextHeight);
			}
		};

		reportHeight();
		const observer = new ResizeObserver(() => reportHeight());
		observer.observe(cardElement);

		return () => {
			observer.disconnect();
		};
	});

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const target = e.target as HTMLTextAreaElement;
			const start = target.selectionStart;
			const end = target.selectionEnd;
			code = code.substring(0, start) + '    ' + code.substring(end);
			tick().then(() => {
				target.selectionStart = target.selectionEnd = start + 4;
			});
		}

		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			runCode();
		}
	}

	async function loadPyodide() {
		if (pyodide) return pyodide;
		isLoading = true;

		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js';

		await new Promise<void>((resolve, reject) => {
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Failed to load Pyodide'));
			document.head.appendChild(script);
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		pyodide = await (window as any).loadPyodide();
		isLoading = false;
		return pyodide;
	}

	async function runCode() {
		if (isRunning) return;
		isRunning = true;
		hasError = false;
		output = '';

		try {
			const py = await loadPyodide();

			py.setStdout({ batched: (text: string) => (output += text + '\n') });
			py.setStderr({ batched: (text: string) => (output += '[stderr] ' + text + '\n') });

			const result = await py.runPythonAsync(code);
			if (result !== undefined && result !== null) {
				output += '=> ' + String(result);
			}
		} catch (err: unknown) {
			hasError = true;
			if (err instanceof Error) {
				output = err.message;
			} else {
				output = String(err);
			}
		} finally {
			isRunning = false;
			output = output.trimEnd();
		}
	}

	function clearOutput() {
		output = '';
		hasError = false;
	}
</script>

<div class="code-editor-card" bind:this={cardElement}>
	<div class="code-editor-header">
		<div class="code-editor-title">
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-3.5 4"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<span>Code</span>
			<span class="code-editor-lang">Python</span>
		</div>
		<div class="code-editor-actions">
			<button class="code-editor-btn" onclick={clearOutput} title="Clear output">
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
				</svg>
			</button>
			<button
				class="code-editor-run-btn"
				onclick={runCode}
				disabled={isRunning || isLoading}
				title="Run (Cmd+Enter)"
			>
				{#if isRunning || isLoading}
					<div class="code-run-spinner"></div>
				{:else}
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<path d="M4 2.5v11l9-5.5z" />
					</svg>
				{/if}
				<span>{isLoading ? 'Loading…' : 'Run'}</span>
			</button>
		</div>
	</div>
	<div class="code-editor-body">
		<textarea
			class="code-editor-textarea"
			bind:value={code}
			onkeydown={handleKeyDown}
			spellcheck={false}
			autocomplete="off"
		></textarea>
	</div>
	{#if output}
		<div class="code-editor-output" class:code-editor-output-error={hasError}>
			<div class="code-editor-output-header">
				<span>Output</span>
			</div>
			<pre class="code-editor-output-text">{output}</pre>
		</div>
	{/if}
</div>

<style>
	.code-editor-card {
		border: 1px solid hsl(var(--border));
		border-radius: 0.7rem;
		background: hsl(var(--card));
		color: hsl(var(--card-foreground));
		box-shadow: 0 2px 6px hsl(var(--foreground) / 0.06);
		overflow: hidden;
		min-width: 100%;
	}

	.code-editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.85rem;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.65);
	}

	.code-editor-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: hsl(var(--muted-foreground));
	}

	.code-editor-lang {
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		margin-left: 0.25rem;
		padding: 0.1rem 0.45rem;
		border-radius: var(--radius-full);
		background: hsl(var(--muted));
		font-size: var(--text-xs);
	}

	.code-editor-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.code-editor-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border: none;
		border-radius: 0.4rem;
		background: transparent;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition: background var(--duration-fast) ease;
	}

	.code-editor-btn:hover {
		background: hsl(var(--muted));
	}

	.code-editor-run-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--duration-fast) ease;
	}

	.code-editor-run-btn:hover:not(:disabled) {
		opacity: 0.85;
	}

	.code-editor-run-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.code-run-spinner {
		width: 12px;
		height: 12px;
		border: 2px solid hsl(var(--primary-foreground) / 0.3);
		border-top-color: hsl(var(--primary-foreground));
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.code-editor-body {
		position: relative;
	}

	.code-editor-textarea {
		display: block;
		width: 100%;
		min-height: 240px;
		max-height: 500px;
		padding: 0.75rem 0.85rem;
		border: none;
		background: hsl(var(--card));
		color: hsl(var(--card-foreground));
		font-family:
			'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, Consolas, monospace;
		font-size: 0.85rem;
		line-height: 1.6;
		tab-size: 4;
		resize: vertical;
		outline: none;
		box-sizing: border-box;
	}

	.code-editor-textarea::placeholder {
		color: hsl(var(--muted-foreground) / 0.5);
	}

	.code-editor-output {
		border-top: 1px solid hsl(var(--border));
	}

	.code-editor-output-header {
		padding: 0.4rem 0.85rem;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: hsl(var(--muted-foreground));
		background: hsl(var(--muted) / 0.35);
	}

	.code-editor-output-text {
		margin: 0;
		padding: 0.65rem 0.85rem;
		font-family:
			'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, Consolas, monospace;
		font-size: 0.8rem;
		line-height: 1.55;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 200px;
		overflow-y: auto;
		color: hsl(var(--foreground));
	}

	.code-editor-output-error .code-editor-output-text {
		color: hsl(var(--destructive));
	}

	.code-editor-output-error .code-editor-output-header {
		color: hsl(var(--destructive));
	}
</style>
