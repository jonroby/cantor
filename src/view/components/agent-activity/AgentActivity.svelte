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
	<div
		class="agent-activity mx-4 mt-4 overflow-hidden rounded-[14px] border border-border"
		class:agent-activity-compact={compact}
	>
		<button
			class="flex w-full cursor-pointer items-start justify-between gap-4 border-0 bg-transparent px-4 py-[14px] text-left text-inherit max-[820px]:flex-col max-[820px]:items-stretch"
			onclick={toggle}
			type="button"
		>
			<div class="flex min-w-0 items-center gap-2">
				<div class="text-sm font-bold tracking-[0.06em] text-muted-foreground uppercase">
					Agent activity
				</div>
				{#if liveStatus}
					<div class="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-foreground">
						Running
					</div>
				{/if}
			</div>
			<div
				class="flex max-w-[min(60%,420px)] flex-col items-end gap-1 max-[820px]:max-w-none max-[820px]:items-start"
			>
				<span
					class="w-full overflow-hidden text-right text-base leading-[1.4] text-ellipsis whitespace-nowrap text-foreground max-[820px]:text-left"
					>{lastEvent}</span
				>
				<span class="text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase"
					>{stepCount} step{stepCount === 1 ? '' : 's'}</span
				>
			</div>
		</button>
		{#if expanded}
			<div class="flex flex-col gap-2.5 px-4 pb-4">
				{#each groupedEvents as group (group.id)}
					{#if group.kind === 'tool'}
						<div
							class="agent-activity-step flex flex-col gap-2 rounded-[--radius-lg] border border-border/70 bg-muted/[0.22] px-2.5 py-2.5 pb-3"
						>
							<div class="flex items-center justify-between gap-2 px-0.5">
								<div class="text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
									Tool step
								</div>
								<div class="text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
									{formatTimestamp(group.call.createdAt)}
								</div>
							</div>
							<div
								class="agent-activity-event agent-activity-event-call rounded-[--radius-lg] border border-border/82 bg-background/92 px-[13px] py-3"
							>
								<div class="mb-1.5 flex items-center justify-between gap-2">
									<div class="text-xs font-bold tracking-[0.05em] text-muted-foreground uppercase">
										{getEventLabel(group.call.type)}
									</div>
								</div>
								<div
									class="text-base leading-[1.5] break-words whitespace-pre-wrap text-foreground"
								>
									{group.call.text}
								</div>
							</div>
							{#each group.followups as event (event.id)}
								<div
									class="agent-activity-event agent-activity-event-{getEventTone(
										event.type
									)} rounded-[--radius-lg] border border-border/82 bg-background/92 px-[13px] py-3"
								>
									<div class="mb-1.5 flex items-center justify-between gap-2">
										<div
											class="text-xs font-bold tracking-[0.05em] text-muted-foreground uppercase"
										>
											{getEventLabel(event.type)}
										</div>
										<div
											class="text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase"
										>
											{formatTimestamp(event.createdAt)}
										</div>
									</div>
									<div
										class="text-base leading-[1.5] break-words whitespace-pre-wrap text-foreground"
									>
										{event.text}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div
							class="agent-activity-event agent-activity-event-{getEventTone(
								group.event.type
							)} rounded-[--radius-lg] border border-border/82 bg-background/92 px-[13px] py-3"
						>
							<div class="mb-1.5 flex items-center justify-between gap-2">
								<div class="text-xs font-bold tracking-[0.05em] text-muted-foreground uppercase">
									{getEventLabel(group.event.type)}
								</div>
								<div class="text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
									{formatTimestamp(group.event.createdAt)}
								</div>
							</div>
							<div class="text-base leading-[1.5] break-words whitespace-pre-wrap text-foreground">
								{group.event.text}
							</div>
						</div>
					{/if}
				{/each}
				{#if liveStatus}
					<div
						class="agent-activity-event agent-activity-event-live rounded-[--radius-lg] border border-border/82 bg-background/92 px-[13px] py-3"
					>
						<div class="mb-1.5 flex items-center justify-between gap-2">
							<div class="text-xs font-bold tracking-[0.05em] text-muted-foreground uppercase">
								In progress
							</div>
							<div class="text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
								live
							</div>
						</div>
						<div class="text-base leading-[1.5] break-words whitespace-pre-wrap text-foreground">
							{liveStatus}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.agent-activity {
		background: linear-gradient(180deg, hsl(var(--muted) / 0.4), hsl(var(--background) / 0.92));
	}

	.agent-activity-compact {
		margin: 12px 12px 0;
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
</style>
