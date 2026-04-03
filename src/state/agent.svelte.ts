export type ThinkingEventType =
	| 'status'
	| 'note'
	| 'tool_call'
	| 'tool_result'
	| 'verification';

export interface ThinkingEvent {
	id: string;
	exchangeId: string;
	type: ThinkingEventType;
	text: string;
	createdAt: number;
}

export interface AgentState {
	streamingExchangeIds: string[];
	pendingContent: string | null;
	lastResponse: string | null;
	liveStatusByExchangeId: Record<string, string>;
	thinkingByExchangeId: Record<string, ThinkingEvent[]>;
	expandedByExchangeId: Record<string, boolean>;
}

export const agentState: AgentState = $state({
	streamingExchangeIds: [],
	pendingContent: null,
	lastResponse: null,
	liveStatusByExchangeId: {},
	thinkingByExchangeId: {},
	expandedByExchangeId: {}
});

export function isStreaming(exchangeId: string): boolean {
	return agentState.streamingExchangeIds.includes(exchangeId);
}

export function startStreaming(exchangeId: string) {
	if (isStreaming(exchangeId)) return;
	agentState.streamingExchangeIds = [...agentState.streamingExchangeIds, exchangeId];
}

export function stopStreaming(exchangeId: string) {
	agentState.streamingExchangeIds = agentState.streamingExchangeIds.filter((id) => id !== exchangeId);
	delete agentState.liveStatusByExchangeId[exchangeId];
}

export function setPendingContent(content: string | null) {
	agentState.pendingContent = content;
}

export function setLastResponse(response: string | null) {
	agentState.lastResponse = response;
}

export function setLiveStatus(exchangeId: string, status: string) {
	agentState.liveStatusByExchangeId[exchangeId] = status;
}

export function clearLiveStatus(exchangeId: string) {
	delete agentState.liveStatusByExchangeId[exchangeId];
}

export function clearThinking(exchangeId: string) {
	delete agentState.thinkingByExchangeId[exchangeId];
	delete agentState.liveStatusByExchangeId[exchangeId];
}

export function appendThinkingEvent(
	exchangeId: string,
	type: ThinkingEventType,
	text: string
): ThinkingEvent {
	const event: ThinkingEvent = {
		id: crypto.randomUUID(),
		exchangeId,
		type,
		text,
		createdAt: Date.now()
	};
	agentState.thinkingByExchangeId[exchangeId] = [
		...(agentState.thinkingByExchangeId[exchangeId] ?? []),
		event
	];
	return event;
}

export function setExpanded(exchangeId: string, expanded: boolean) {
	agentState.expandedByExchangeId[exchangeId] = expanded;
}

export function reset() {
	agentState.streamingExchangeIds = [];
	agentState.pendingContent = null;
	agentState.lastResponse = null;
	agentState.liveStatusByExchangeId = {};
	agentState.thinkingByExchangeId = {};
	agentState.expandedByExchangeId = {};
}
