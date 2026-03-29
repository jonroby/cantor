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

export const getChildExchanges = domain.getChildExchanges;
export const getRootExchange = domain.getRootExchange;
export const canAcceptNewChat = domain.canAcceptNewChat;
export const getMainChatHistory = domain.getMainChatHistory;
export const getPathTokenTotal = domain.getPathTokenTotal;

export type Chat = domain.Chat;
export type Exchange = domain.Exchange;
export type DeleteMode = domain.DeleteMode;
export type Message = domain.Message;
