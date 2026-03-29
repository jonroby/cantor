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
export const getChats = () => state.chats.chatState.chats;
export const getActiveChatIndex = () => state.chats.chatState.activeChatIndex;
export const getActiveChat = state.chats.getActiveChat;
export const getActiveExchanges = state.chats.getActiveExchanges;
export const getActiveExchangeId = state.chats.getActiveExchangeId;
export const newChat = state.chats.newChat;
export const selectChat = state.chats.selectChat;
export const deleteChat = state.chats.deleteChat;
export const renameChat = state.chats.renameChat;
export const setActiveExchangeId = state.chats.setActiveExchangeId;
export const isStreaming = external.streams.isStreaming;
export const cancelStream = external.streams.cancelStream;
export const cancelStreamsForChat = external.streams.cancelStreamsForChat;

export type Chat = domain.tree.Chat;
export type Exchange = domain.tree.Exchange;
export type DeleteMode = domain.tree.DeleteMode;
export type Message = domain.tree.Message;
