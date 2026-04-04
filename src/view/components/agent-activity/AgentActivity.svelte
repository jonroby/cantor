<script lang="ts">
	import * as app from '@/app';

	interface Props {
		exchangeId: string | null;
		compact?: boolean;
	}

	let { exchangeId, compact = false }: Props = $props();

	let agentState = $derived(app.agent.getState());
	let thinkingEvents = $derived(
		exchangeId ? (agentState.thinkingByExchangeId[exchangeId] ?? []) : []
	);
	let liveStatus = $derived(
		exchangeId ? (agentState.liveStatusByExchangeId[exchangeId] ?? '') : ''
	);
	let expanded = $derived(
		exchangeId ? agentState.expandedByExchangeId[exchangeId] !== false : false
	);
	let hasActivity = $derived(!!liveStatus || thinkingEvents.length > 0);
	let groupedEvents = $derived(buildGroups(thinkingEvents));
	let stepCount = $derived(groupedEvents.length + (liveStatus ? 1 : 0));
	let lastEvent = $derived.by(() => {
		if (liveStatus) return liveStatus;
		const latestGroup = groupedEvents[groupedEvents.length - 1];
		return latestGroup ? summarizeGroup(latestGroup) : '';
	});

	function summarizeEvent(type: string, text: string) {
		if (type === 'tool_call') return text;
		if (type === 'tool_result') return text.split('\n')[0] ?? text;
		return text;
	}

	type EventGroup =
		| {
				kind: 'tool';
				id: string;
				call: (typeof thinkingEvents)[number];
				followups: typeof thinkingEvents;
		  }
		| {
				kind: 'single';
				id: string;
				event: (typeof thinkingEvents)[number];
		  };

	function buildGroups(events: typeof thinkingEvents): EventGroup[] {
		const groups: EventGroup[] = [];
		let currentToolGroup: Extract<EventGroup, { kind: 'tool' }> | null = null;

		for (const event of events) {
			if (event.type === 'tool_call') {
				currentToolGroup = {
					kind: 'tool',
					id: event.id,
					call: event,
					followups: []
				};
				groups.push(currentToolGroup);
				continue;
			}

			if (currentToolGroup && (event.type === 'tool_result' || event.type === 'verification')) {
				currentToolGroup.followups = [...currentToolGroup.followups, event];
				continue;
			}

			currentToolGroup = null;
			groups.push({
				kind: 'single',
				id: event.id,
				event
			});
		}

		return groups;
	}

	function summarizeGroup(group: EventGroup) {
		if (group.kind === 'tool') {
			const latestFollowup = group.followups[group.followups.length - 1];
			return latestFollowup
				? summarizeEvent(latestFollowup.type, latestFollowup.text)
				: summarizeEvent(group.call.type, group.call.text);
		}
		return summarizeEvent(group.event.type, group.event.text);
	}

	function getEventLabel(type: string) {
		switch (type) {
			case 'tool_call':
				return 'Tool call';
			case 'tool_result':
				return 'Tool result';
			case 'verification':
				return 'Verification';
			case 'status':
				return 'Status';
			case 'note':
				return 'Note';
			default:
				return type.replace('_', ' ');
		}
	}

	function getEventTone(type: string) {
		switch (type) {
			case 'tool_call':
				return 'call';
			case 'tool_result':
				return 'result';
			case 'verification':
				return 'verification';
			case 'status':
				return 'status';
			default:
				return 'note';
		}
	}

	function formatTimestamp(createdAt: number) {
		const deltaSeconds = Math.max(0, Math.round((Date.now() - createdAt) / 1000));
		if (deltaSeconds < 5) return 'now';
		if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
		const deltaMinutes = Math.round(deltaSeconds / 60);
		if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
		const deltaHours = Math.round(deltaMinutes / 60);
		return `${deltaHours}h ago`;
	}

	function toggle() {
		if (!exchangeId) return;
		app.agent.setThinkingExpanded(exchangeId, !expanded);
	}
</script>

{#if hasActivity}
	<div class="agent-activity" class:agent-activity-compact={compact}>
		<button class="agent-activity-header" onclick={toggle} type="button">
			<div class="agent-activity-heading">
				<div class="agent-activity-title">Agent activity</div>
				{#if liveStatus}
					<div class="agent-activity-badge">Running</div>
				{/if}
			</div>
			<div class="agent-activity-summary">
				<span class="agent-activity-last">{lastEvent}</span>
				<span class="agent-activity-count">{stepCount} step{stepCount === 1 ? '' : 's'}</span>
			</div>
		</button>
		{#if expanded}
			<div class="agent-activity-body">
				{#each groupedEvents as group (group.id)}
					{#if group.kind === 'tool'}
						<div class="agent-activity-step agent-activity-step-tool">
							<div class="agent-activity-step-header">
								<div class="agent-activity-step-title">Tool step</div>
								<div class="agent-activity-step-time">
									{formatTimestamp(group.call.createdAt)}
								</div>
							</div>
							<div class="agent-activity-event agent-activity-event-call">
								<div class="agent-activity-event-header">
									<div class="agent-activity-event-type">{getEventLabel(group.call.type)}</div>
								</div>
								<div class="agent-activity-event-text">{group.call.text}</div>
							</div>
							{#each group.followups as event (event.id)}
								<div
									class={`agent-activity-event agent-activity-event-${getEventTone(event.type)}`}
								>
									<div class="agent-activity-event-header">
										<div class="agent-activity-event-type">{getEventLabel(event.type)}</div>
										<div class="agent-activity-event-time">
											{formatTimestamp(event.createdAt)}
										</div>
									</div>
									<div class="agent-activity-event-text">{event.text}</div>
								</div>
							{/each}
						</div>
					{:else}
						<div
							class={`agent-activity-event agent-activity-event-${getEventTone(group.event.type)}`}
						>
							<div class="agent-activity-event-header">
								<div class="agent-activity-event-type">{getEventLabel(group.event.type)}</div>
								<div class="agent-activity-event-time">
									{formatTimestamp(group.event.createdAt)}
								</div>
							</div>
							<div class="agent-activity-event-text">{group.event.text}</div>
						</div>
					{/if}
				{/each}
				{#if liveStatus}
					<div class="agent-activity-event agent-activity-event-live">
						<div class="agent-activity-event-header">
							<div class="agent-activity-event-type">In progress</div>
							<div class="agent-activity-event-time">live</div>
						</div>
						<div class="agent-activity-event-text">{liveStatus}</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.agent-activity {
		margin: 16px 16px 0;
		border: 1px solid var(--border-color);
		border-radius: 14px;
		background: linear-gradient(180deg, hsl(var(--muted) / 0.4), hsl(var(--background) / 0.92));
		overflow: hidden;
	}

	.agent-activity-compact {
		margin: 12px 12px 0;
	}

	.agent-activity-header {
		width: 100%;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 16px;
		background: transparent;
		border: 0;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.agent-activity-heading {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.agent-activity-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: hsl(var(--muted-foreground));
	}

	.agent-activity-badge {
		padding: 2px 8px;
		border-radius: 999px;
		background: hsl(var(--accent) / 0.15);
		color: hsl(var(--foreground));
		font-size: var(--text-xs);
		font-weight: var(--font-weight-bold);
	}

	.agent-activity-summary {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		max-width: min(60%, 420px);
	}

	.agent-activity-last {
		font-size: var(--text-sm);
		line-height: 1.4;
		color: hsl(var(--foreground));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
		text-align: right;
	}

	.agent-activity-count {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}

	.agent-activity-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 0 16px 16px;
	}

	.agent-activity-step {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 10px 12px;
		border-radius: 12px;
		background: hsl(var(--muted) / 0.22);
		border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
	}

	.agent-activity-step-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 0 2px;
	}

	.agent-activity-step-title,
	.agent-activity-event-time,
	.agent-activity-step-time {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}

	.agent-activity-event {
		padding: 12px 13px;
		border-radius: 12px;
		background: hsl(var(--background) / 0.92);
		border: 1px solid color-mix(in srgb, var(--border-color) 82%, transparent);
	}

	.agent-activity-event-call {
		border-left: 3px solid hsl(var(--foreground) / 0.55);
	}

	.agent-activity-event-result {
		border-left: 3px solid hsl(var(--primary) / 0.55);
	}

	.agent-activity-event-verification {
		border-left: 3px solid hsl(var(--chart-2, 142 72% 29%) / 0.7);
	}

	.agent-activity-event-status,
	.agent-activity-event-live {
		border-style: dashed;
	}

	.agent-activity-event-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 6px;
	}

	.agent-activity-event-type {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: hsl(var(--muted-foreground));
	}

	.agent-activity-event-text {
		white-space: pre-wrap;
		word-break: break-word;
		font-size: var(--text-sm);
		line-height: 1.5;
		color: hsl(var(--foreground));
	}

	@media (max-width: 820px) {
		.agent-activity-header {
			flex-direction: column;
			align-items: stretch;
		}

		.agent-activity-summary {
			max-width: none;
			align-items: flex-start;
		}

		.agent-activity-last {
			text-align: left;
		}
	}
</style>
