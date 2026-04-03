<script lang="ts">
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

<div
	class="min-w-full overflow-hidden rounded-[0.7rem] border border-border bg-card text-card-foreground shadow-[0_2px_6px_hsl(var(--foreground)/0.06)]"
	bind:this={cardElement}
>
	<div
		class="flex items-center justify-between border-b border-border bg-muted/65 px-[0.85rem] py-[0.6rem]"
	>
		<div
			class="flex items-center gap-[0.4rem] text-[0.78rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
		>
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
			<span
				class="ml-1 rounded-full bg-muted px-[0.45rem] py-[0.1rem] text-xs font-normal tracking-normal normal-case"
				>JavaScript</span
			>
		</div>
		<div class="flex items-center gap-[0.4rem]">
			<button
				class="code-editor-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-[0.4rem] border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted"
				onclick={clearOutput}
				title="Clear output"
			>
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
				class="flex cursor-pointer items-center gap-[0.35rem] rounded-lg border border-border bg-primary px-[0.7rem] py-[0.3rem] text-sm font-semibold text-primary-foreground transition-opacity hover:not-disabled:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
				onclick={runCode}
				disabled={isRunning}
				title="Run (Cmd+Enter)"
			>
				{#if isRunning}
					<div class="code-run-spinner"></div>
				{:else}
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<path d="M4 2.5v11l9-5.5z" />
					</svg>
				{/if}
				<span>Run</span>
			</button>
		</div>
	</div>
	<div class="relative">
		<textarea
			class="code-editor-textarea box-border block max-h-[500px] min-h-[240px] w-full resize-y border-none bg-card px-[0.85rem] py-3 font-mono text-[0.85rem] leading-[1.6] text-card-foreground outline-none [tab-size:2]"
			bind:value={code}
			onkeydown={handleKeyDown}
			spellcheck={false}
			autocomplete="off"
		></textarea>
	</div>
	{#if output}
		<div class="border-t border-border" class:code-editor-output-error={hasError}>
			<div
				class="output-header bg-muted/35 px-[0.85rem] py-[0.4rem] text-[0.7rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
			>
				<span>Output</span>
			</div>
			<pre
				class="output-text m-0 max-h-[200px] overflow-y-auto px-[0.85rem] py-[0.65rem] font-mono text-[0.8rem] leading-[1.55] break-words whitespace-pre-wrap text-foreground">{output}</pre>
		</div>
	{/if}
</div>

<style>
	.code-editor-textarea::placeholder {
		color: hsl(var(--muted-foreground) / 0.5);
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

	.code-editor-output-error .output-header {
		color: hsl(var(--destructive));
	}

	.code-editor-output-error .output-text {
		color: hsl(var(--destructive));
	}
</style>
