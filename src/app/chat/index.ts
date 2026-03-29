import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';

export * from './commands';
export * from './queries';
export * from './types';

export const getChildExchanges = domain.tree.getChildExchanges;
export const getRootExchange = domain.tree.getRootExchange;
export const canAcceptNewChat = domain.tree.canAcceptNewChat;
export const getMainChatHistory = domain.tree.getMainChatHistory;
export const getPathTokenTotal = domain.tree.getPathTokenTotal;
export const getState = () => ({
	chats: state.chats.chatState.chats,
	activeChatIndex: state.chats.chatState.activeChatIndex,
	activeChat: state.chats.getActiveChat(),
	activeExchanges: state.chats.getActiveExchanges(),
	activeExchangeId: state.chats.getActiveExchangeId()
});
export const createChat = state.chats.newChat;
export const selectChat = state.chats.selectChat;
export const removeChat = state.chats.deleteChat;
export function renameChat(index: number, name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return null;

	let candidate = trimmed;
	let i = 1;
	while (!state.chats.renameChat(index, candidate)) {
		candidate = `${trimmed} (${i})`;
		i++;
	}
	return candidate;
}
export const selectExchange = state.chats.setActiveExchangeId;
export const isStreaming = external.streams.isStreaming;
export const stopStream = external.streams.cancelStream;
export const stopChatStreams = external.streams.cancelStreamsForChat;

export type Chat = domain.tree.Chat;
export type Exchange = domain.tree.Exchange;
export type DeleteMode = domain.tree.DeleteMode;
export type Message = domain.tree.Message;
