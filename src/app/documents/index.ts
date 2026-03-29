import * as state from '@/state';

export * from './commands';
export * from './queries';
export const getFolders = () => state.documents.docState.folders;
export const getOpenDocs = () => state.documents.docState.openDocs;
export const newFolder = state.documents.newFolder;
export const deleteFolder = state.documents.deleteFolder;
export const renameFolder = state.documents.renameFolder;
export const deleteDocFromFolder = state.documents.deleteDocFromFolder;
export const renameDocInFolder = state.documents.renameDocInFolder;
export const moveDocToFolder = state.documents.moveDocToFolder;
export const updateDocContent = state.documents.updateDocContent;

export type ChatFolder = state.documents.ChatFolder;
export type DocFile = state.documents.DocFile;
export type OpenDoc = state.documents.OpenDoc;
