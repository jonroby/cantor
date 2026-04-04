<script lang="ts">
	import { Code2, X, Play } from 'lucide-svelte';

	let code = $state(
		`// Write your JavaScript here\nfunction greet(name) {\n  return "Hello, " + name + "!";\n}\n\nconsole.log(greet("World"));`
	);
	let output = $state('');
	let isRunning = $state(false);
	let hasError = $state(false);
	let cardElement: HTMLDivElement | null = $state(null);

	interface Props {
		onMeasure?: (height: number) => void;
	}

	let { onMeasure }: Props = $props();

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
		// Tab inserts a tab character instead of moving focus
		if (e.key === 'Tab') {
			e.preventDefault();
			const target = e.target as HTMLTextAreaElement;
			const start = target.selectionStart;
			const end = target.selectionEnd;
			code = code.substring(0, start) + '  ' + code.substring(end);
			tick().then(() => {
				target.selectionStart = target.selectionEnd = start + 2;
			});
		}

		// Cmd/Ctrl+Enter runs the code
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			runCode();
		}
	}

	async function runCode() {
		if (isRunning) return;
		isRunning = true;
		hasError = false;
		output = '';

		const logs: string[] = [];
		const originalConsole = {
			log: console.log,
			warn: console.warn,
			error: console.error,
			info: console.info
		};

		// Intercept console methods
		console.log = (...args) => logs.push(args.map(formatArg).join(' '));
		console.warn = (...args) => logs.push('[warn] ' + args.map(formatArg).join(' '));
		console.error = (...args) => logs.push('[error] ' + args.map(formatArg).join(' '));
		console.info = (...args) => logs.push('[info] ' + args.map(formatArg).join(' '));

		try {
			const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
			const fn = new AsyncFunction(code);
			const result = await fn();
			if (result !== undefined) {
				logs.push('=> ' + formatArg(result));
			}
		} catch (err: unknown) {
			hasError = true;
			if (err instanceof Error) {
				logs.push(err.name + ': ' + err.message);
			} else {
				logs.push(String(err));
			}
		} finally {
			console.log = originalConsole.log;
			console.warn = originalConsole.warn;
			console.error = originalConsole.error;
			console.info = originalConsole.info;
			output = logs.join('\n');
			isRunning = false;
		}
	}

	function formatArg(arg: unknown): string {
		if (arg === null) return 'null';
		if (arg === undefined) return 'undefined';
		if (typeof arg === 'string') return arg;
		if (typeof arg === 'object') {
			try {
				return JSON.stringify(arg, null, 2);
			} catch {
				return String(arg);
			}
		}
		return String(arg);
	}

	function clearOutput() {
		output = '';
		hasError = false;
	}

	import { tick } from 'svelte';
</script>

<div class="code-editor-card" bind:this={cardElement}>
	<div class="code-editor-header">
		<div class="code-editor-title">
			<Code2 size={16} />
			<span>Code</span>
			<span class="code-editor-lang">JavaScript</span>
		</div>
		<div class="code-editor-actions">
			<button class="code-editor-btn" onclick={clearOutput} title="Clear output">
				<X size={14} />
			</button>
			<button
				class="code-editor-run-btn"
				onclick={runCode}
				disabled={isRunning}
				title="Run (Cmd+Enter)"
			>
				{#if isRunning}
					<div class="code-run-spinner"></div>
				{:else}
					<Play size={14} />
				{/if}
				<span>Run</span>
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
		border: 1px solid var(--border-color);
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
		border-bottom: 1px solid var(--border-color);
		background: hsl(var(--muted) / 0.65);
	}

	.code-editor-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: hsl(var(--muted-foreground));
	}

	.code-editor-lang {
		font-weight: var(--font-weight-normal);
		letter-spacing: 0;
		text-transform: none;
		margin-left: 0.25rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: hsl(var(--muted));
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
		transition: background 120ms ease;
	}

	.code-editor-btn:hover {
		background: hsl(var(--muted));
	}

	.code-editor-run-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		transition: opacity 120ms ease;
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
		line-height: 1.6;
		tab-size: 2;
		resize: vertical;
		outline: none;
		box-sizing: border-box;
	}

	.code-editor-textarea::placeholder {
		color: hsl(var(--muted-foreground) / 0.5);
	}

	.code-editor-output {
		border-top: 1px solid var(--border-color);
	}

	.code-editor-output-header {
		padding: 0.4rem 0.85rem;
		font-weight: var(--font-weight-semibold);
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
