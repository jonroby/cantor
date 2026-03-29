import * as domain from '@/domain';

export * from './commands';
export * from './queries';
export * from './types';
export {
	copyChat as performCopy,
	addDocToChat as performAddDocToChat,
	deleteExchange as performDelete,
	promoteExchange as performPromote,
	quickAsk as performQuickAsk,
	submitPrompt as performSubmitPrompt
} from './commands';

export const getChildExchanges = domain.tree.getChildExchanges;
export const getRootExchange = domain.tree.getRootExchange;
export const canAcceptNewChat = domain.tree.canAcceptNewChat;
export const getMainChatHistory = domain.tree.getMainChatHistory;
export const getPathTokenTotal = domain.tree.getPathTokenTotal;

export type Chat = domain.tree.Chat;
export type Exchange = domain.tree.Exchange;
export type DeleteMode = domain.tree.DeleteMode;
export type Message = domain.tree.Message;
