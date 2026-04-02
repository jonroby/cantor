import type * as domain from '@/domain';

type Message = domain.tree.Message;

export interface AgentState {
	history: Message[];
	streaming: boolean;
	pendingContent: string | null;
}

export const agentState: AgentState = $state({
	history: [],
	streaming: false,
	pendingContent: null
});

export function pushMessage(message: Message) {
	agentState.history = [...agentState.history, message];
}

export function setStreaming(streaming: boolean) {
	agentState.streaming = streaming;
}

export function setPendingContent(content: string | null) {
	agentState.pendingContent = content;
}

export function reset() {
	agentState.history = [];
	agentState.streaming = false;
	agentState.pendingContent = null;
}
