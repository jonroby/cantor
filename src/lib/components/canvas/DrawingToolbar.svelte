<script lang="ts">
	import type { DrawingTool } from '$lib/drawing/types';

	interface Props {
		activeTool: DrawingTool;
		onSelectTool: (tool: DrawingTool) => void;
		onClose: () => void;
	}

	let { activeTool, onSelectTool, onClose }: Props = $props();

	const tools: { id: DrawingTool; label: string; icon: string }[] = [
		{ id: 'select', label: 'Select', icon: '↖' },
		{ id: 'rectangle', label: 'Rectangle', icon: '▭' },
		{ id: 'circle', label: 'Circle', icon: '◯' },
		{ id: 'line', label: 'Line', icon: '╱' },
		{ id: 'arrow', label: 'Arrow', icon: '→' },
		{ id: 'pen', label: 'Pen', icon: '✎' }
	];
</script>

<div class="drawing-toolbar">
	{#each tools as tool}
		<button
			class="tool-btn"
			class:active={activeTool === tool.id}
			onclick={() => onSelectTool(tool.id)}
			title={tool.label}
		>
			{tool.icon}
		</button>
	{/each}
	<div class="toolbar-divider"></div>
	<button class="tool-btn close-btn" onclick={onClose} title="Exit drawing">✕</button>
</div>

<style>
	.drawing-toolbar {
		position: fixed;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 2px;
		background: hsl(var(--card, 0 0% 100%));
		border: 1px solid hsl(var(--border, 0 0% 85%));
		border-radius: 10px;
		padding: 4px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		z-index: 100;
	}

	.tool-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		border-radius: 7px;
		cursor: pointer;
		font-size: 16px;
		color: hsl(var(--foreground, 0 0% 10%));
		transition: background 0.15s;
	}

	.tool-btn:hover {
		background: hsl(var(--muted, 0 0% 95%));
	}

	.tool-btn.active {
		background: hsl(var(--primary, 220 90% 56%));
		color: hsl(var(--primary-foreground, 0 0% 100%));
	}

	.toolbar-divider {
		width: 1px;
		height: 24px;
		background: hsl(var(--border, 0 0% 85%));
		margin: 0 4px;
	}

	.close-btn {
		font-size: 14px;
	}
</style>
