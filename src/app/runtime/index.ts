import * as state from '@/state';
import * as external from '@/external';

export const chatState = state.chatState;
export const docState = state.docState;
export const providerState = state.providerState;
export const getActiveChat = state.getActiveChat;
export const getActiveExchanges = state.getActiveExchanges;
export const getActiveExchangeId = state.getActiveExchangeId;
export const newChat = state.newChat;
export const selectChat = state.selectChat;
export const deleteChat = state.deleteChat;
export const renameChat = state.renameChat;
export const setActiveExchangeId = state.setActiveExchangeId;
export const newFolder = state.newFolder;
export const deleteFolder = state.deleteFolder;
export const renameFolder = state.renameFolder;
export const deleteDocFromFolder = state.deleteDocFromFolder;
export const renameDocInFolder = state.renameDocInFolder;
export const moveDocToFolder = state.moveDocToFolder;
export const updateDocContent = state.updateDocContent;
export const selectModel = state.selectModel;
export const updateContextLength = state.updateContextLength;

export const loadFromStorage = external.persistence.loadFromStorage;
export const saveToStorage = external.persistence.saveToStorage;
export const cancelStreamsForChat = external.streams.cancelStreamsForChat;
export const cancelStream = external.streams.cancelStream;
export const isStreaming = external.streams.isStreaming;
export const getProviderStream = external.providers.getProviderStream;

export type ChatFolder = state.ChatFolder;
export type DocFile = state.DocFile;
export type ActiveModel = state.ActiveModel;
export type OllamaStatus = state.OllamaStatus;
export type WebLLMStatus = state.WebLLMStatus;
export type WebLLMModelEntry = state.WebLLMModelEntry;
export type WebLLMContextSize = state.WebLLMContextSize;
