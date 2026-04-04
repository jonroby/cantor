<script lang="ts">
	import * as app from '@/app';

	interface Props {
		open: boolean;
		onClose: () => void;
		enabledToolNames: string[] | null;
		onToggleTool: (name: string) => void;
		onToggleCapability: (id: string) => void;
		onToggleAll: () => void;
	}

	let { open, onClose, enabledToolNames, onToggleTool, onToggleCapability, onToggleAll }: Props =
		$props();

	const capabilities = app.agent.getCapabilities();
	const allToolNames = capabilities.flatMap((c) => c.tools.map((t) => t.name));

	function isToolEnabled(name: string): boolean {
		return enabledToolNames === null || enabledToolNames.includes(name);
	}

	function isCapabilityEnabled(id: string): boolean {
		const cap = capabilities.find((c) => c.id === id);
		if (!cap) return false;
		return cap.tools.every((t) => isToolEnabled(t.name));
	}

	function isCapabilityPartial(id: string): boolean {
		const cap = capabilities.find((c) => c.id === id);
		if (!cap) return false;
		const enabled = cap.tools.filter((t) => isToolEnabled(t.name));
		return enabled.length > 0 && enabled.length < cap.tools.length;
	}

	const allEnabled = $derived(
		enabledToolNames === null || enabledToolNames.length === allToolNames.length
	);
</script>

{#if open}
	<button class="modal-scrim" type="button" aria-label="Close agent palette" onclick={onClose}
	></button>
	<div class="modal-panel agent-palette-panel">
		<div class="agent-palette-header">
			<span class="agent-palette-title">Agent Tools</span>
			<label class="toggle-all-row">
				<input
					type="checkbox"
					class="capability-checkbox"
					checked={allEnabled}
					onchange={onToggleAll}
				/>
				<span class="toggle-all-label">{allEnabled ? 'Disable all' : 'Enable all'}</span>
			</label>
		</div>
		<div class="agent-palette-body">
			{#each capabilities as capability (capability.id)}
				<div class="capability-section">
					<label class="capability-header">
						<input
							type="checkbox"
							class="capability-checkbox"
							checked={isCapabilityEnabled(capability.id)}
							indeterminate={isCapabilityPartial(capability.id)}
							onchange={() => onToggleCapability(capability.id)}
						/>
						<div class="capability-info">
							<span class="capability-label">{capability.label}</span>
							<span class="capability-description">{capability.description}</span>
						</div>
					</label>
					<div class="tool-list">
						{#each capability.tools as tool (tool.name)}
							<label class="tool-row">
								<input
									type="checkbox"
									class="tool-checkbox"
									checked={isToolEnabled(tool.name)}
									onchange={() => onToggleTool(tool.name)}
								/>
								<div class="tool-info">
									<span class="tool-name">{tool.name}</span>
									<span class="tool-description">{tool.description}</span>
								</div>
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.agent-palette-panel {
		width: min(520px, calc(100vw - 2rem));
		max-height: 80vh;
		overflow-y: auto;
		padding: 0;
	}

	.agent-palette-header {
		position: sticky;
		top: 0;
		z-index: 1;
		background: hsl(var(--background));
		padding: 1rem 1.25rem 0.75rem;
		border-bottom: 1px solid hsl(var(--border));
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.agent-palette-title {
		font-size: var(--text-base);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: hsl(var(--muted-foreground));
	}

	.toggle-all-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.toggle-all-label {
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	.agent-palette-body {
		padding: 0.5rem 0;
	}

	.capability-section {
		border-bottom: 1px solid hsl(var(--border));
	}

	.capability-section:last-child {
		border-bottom: none;
	}

	.capability-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.875rem 1.25rem 0.625rem;
		cursor: pointer;
		transition: background-color var(--duration-normal);
	}

	.capability-header:hover {
		background: hsl(var(--muted) / 0.4);
	}

	.capability-checkbox {
		margin-top: 0.125rem;
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		accent-color: hsl(var(--primary));
	}

	.capability-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.capability-label {
		font-size: var(--text-sm);
		font-weight: 600;
		color: hsl(var(--foreground));
	}

	.capability-description {
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	.tool-list {
		padding: 0 0 0.5rem 2.75rem;
	}

	.tool-row {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.375rem 1.25rem 0.375rem 0;
		cursor: pointer;
		border-radius: 0.375rem;
		transition: background-color var(--duration-normal);
	}

	.tool-row:hover {
		background: hsl(var(--muted) / 0.4);
	}

	.tool-checkbox {
		margin-top: 0.125rem;
		flex-shrink: 0;
		width: 0.875rem;
		height: 0.875rem;
		cursor: pointer;
		accent-color: hsl(var(--primary));
	}

	.tool-info {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}

	.tool-name {
		font-size: var(--text-sm);
		font-weight: 500;
		color: hsl(var(--foreground));
		font-family: monospace;
	}

	.tool-description {
		font-size: var(--text-xs);
		color: hsl(var(--muted-foreground));
	}
</style>
