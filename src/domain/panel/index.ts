// ── Content types ───────────────────────────────────────────────────────────

export interface MainChatContent {
	readonly type: 'main-chat';
}

export interface SideChatContent {
	readonly type: 'side-chat';
	readonly parentExchangeId: string;
	readonly branchIndex: number;
}

export interface DocumentContent {
	readonly type: 'document';
	readonly folderId: string;
	readonly fileId: string;
}

export type PanelContentType = MainChatContent | SideChatContent | DocumentContent;

// ── Panel ───────────────────────────────────────────────────────────────────

export interface Panel {
	readonly id: string;
	readonly content: PanelContentType;
}

// ── Factories ───────────────────────────────────────────────────────────────

export function createMainChatPanel(): Panel {
	return { id: crypto.randomUUID(), content: { type: 'main-chat' } };
}

export function createSideChatPanel(parentExchangeId: string, branchIndex: number): Panel {
	return { id: crypto.randomUUID(), content: { type: 'side-chat', parentExchangeId, branchIndex } };
}

export function createDocumentPanel(folderId: string, fileId: string): Panel {
	return { id: crypto.randomUUID(), content: { type: 'document', folderId, fileId } };
}

// ── Type guards ─────────────────────────────────────────────────────────────

export function isMainChat(panel: Panel): panel is Panel & { content: MainChatContent } {
	return panel.content.type === 'main-chat';
}

export function isSideChat(panel: Panel): panel is Panel & { content: SideChatContent } {
	return panel.content.type === 'side-chat';
}

export function isDocument(panel: Panel): panel is Panel & { content: DocumentContent } {
	return panel.content.type === 'document';
}

// ── Transforms ──────────────────────────────────────────────────────────────

export function withContent(panel: Panel, content: PanelContentType): Panel {
	return { id: panel.id, content };
}
