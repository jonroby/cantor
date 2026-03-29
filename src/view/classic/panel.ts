export interface MainChatContent {
	readonly type: 'main-chat';
}

export interface SideChatContent {
	readonly type: 'side-chat';
	readonly parentExchangeId: string;
	readonly sideChatIndex: number;
}

export interface DocumentContent {
	readonly type: 'document';
	readonly folderId: string;
	readonly fileId: string;
}

export type PanelContent = MainChatContent | SideChatContent | DocumentContent;

export interface Panel {
	readonly id: string;
	readonly content: PanelContent;
}

export function createMainChatPanel(): Panel {
	return { id: crypto.randomUUID(), content: { type: 'main-chat' } };
}

export function createSideChatPanel(parentExchangeId: string, sideChatIndex: number): Panel {
	return {
		id: crypto.randomUUID(),
		content: { type: 'side-chat', parentExchangeId, sideChatIndex }
	};
}

export function createDocumentPanel(folderId: string, fileId: string): Panel {
	return { id: crypto.randomUUID(), content: { type: 'document', folderId, fileId } };
}

export function isSideChat(panel: Panel): panel is Panel & { content: SideChatContent } {
	return panel.content.type === 'side-chat';
}

export function withContent(panel: Panel, content: PanelContent): Panel {
	return { id: panel.id, content };
}
