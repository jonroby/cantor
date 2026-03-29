import * as state from '@/state';
import * as external from '@/external';

export const chatState = state.chats.chatState;
export const docState = state.documents.docState;
export const providerState = state.providers.providerState;
export const getActiveChat = state.chats.getActiveChat;
export const getActiveExchanges = state.chats.getActiveExchanges;
export const getActiveExchangeId = state.chats.getActiveExchangeId;
export const newChat = state.chats.newChat;
export const selectChat = state.chats.selectChat;
export const deleteChat = state.chats.deleteChat;
export const renameChat = state.chats.renameChat;
export const setActiveExchangeId = state.chats.setActiveExchangeId;
export const newFolder = state.documents.newFolder;
export const deleteFolder = state.documents.deleteFolder;
export const renameFolder = state.documents.renameFolder;
export const deleteDocFromFolder = state.documents.deleteDocFromFolder;
export const renameDocInFolder = state.documents.renameDocInFolder;
export const moveDocToFolder = state.documents.moveDocToFolder;
export const updateDocContent = state.documents.updateDocContent;
export const selectModel = state.providers.selectModel;
export const updateContextLength = state.providers.updateContextLength;

export const loadFromStorage = external.persistence.loadFromStorage;
export const saveToStorage = external.persistence.saveToStorage;
export const cancelStreamsForChat = external.streams.cancelStreamsForChat;
export const cancelStream = external.streams.cancelStream;
export const isStreaming = external.streams.isStreaming;
export const getProviderStream = external.providers.stream.getProviderStream;

export type ChatFolder = state.documents.ChatFolder;
export type DocFile = state.documents.DocFile;
export type ActiveModel = state.providers.ActiveModel;
export type OllamaStatus = state.providers.OllamaStatus;
export type WebLLMStatus = state.providers.WebLLMStatus;
export type WebLLMModelEntry = state.providers.WebLLMModelEntry;
export type WebLLMContextSize = state.providers.WebLLMContextSize;
