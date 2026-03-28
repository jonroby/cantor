import { describe, expect, it } from 'vitest';
import {
	createMainChatPanel,
	createSideChatPanel,
	createDocumentPanel,
	isMainChat,
	isSideChat,
	isDocument,
	withContent
} from './index';

describe('panel', () => {
	describe('factories', () => {
		it('createMainChatPanel produces main-chat content', () => {
			const panel = createMainChatPanel();
			expect(panel.content).toEqual({ type: 'main-chat' });
		});

		it('createSideChatPanel captures parentExchangeId and branchIndex', () => {
			const panel = createSideChatPanel('ex-1', 2);
			expect(panel.content).toEqual({
				type: 'side-chat',
				parentExchangeId: 'ex-1',
				branchIndex: 2
			});
		});

		it('createDocumentPanel captures folderId and fileId', () => {
			const panel = createDocumentPanel('folder-1', 'file-1');
			expect(panel.content).toEqual({ type: 'document', folderId: 'folder-1', fileId: 'file-1' });
		});

		it('each panel gets a unique id', () => {
			const ids = [
				createMainChatPanel().id,
				createMainChatPanel().id,
				createSideChatPanel('ex-1', 0).id,
				createDocumentPanel('folder-1', 'file-1').id
			];
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	describe('type guards', () => {
		it('isMainChat narrows correctly', () => {
			expect(isMainChat(createMainChatPanel())).toBe(true);
			expect(isMainChat(createSideChatPanel('ex-1', 0))).toBe(false);
			expect(isMainChat(createDocumentPanel('folder-1', 'file-1'))).toBe(false);
		});

		it('isSideChat narrows correctly', () => {
			expect(isSideChat(createSideChatPanel('ex-1', 0))).toBe(true);
			expect(isSideChat(createMainChatPanel())).toBe(false);
			expect(isSideChat(createDocumentPanel('folder-1', 'file-1'))).toBe(false);
		});

		it('isDocument narrows correctly', () => {
			expect(isDocument(createDocumentPanel('folder-1', 'file-1'))).toBe(true);
			expect(isDocument(createMainChatPanel())).toBe(false);
			expect(isDocument(createSideChatPanel('ex-1', 0))).toBe(false);
		});
	});

	describe('withContent', () => {
		it('returns a new panel with updated content and same id', () => {
			const original = createMainChatPanel();
			const updated = withContent(original, { type: 'document', folderId: 'f1', fileId: 'd1' });
			expect(updated.id).toBe(original.id);
			expect(updated.content).toEqual({ type: 'document', folderId: 'f1', fileId: 'd1' });
		});

		it('does not mutate the original panel', () => {
			const original = createMainChatPanel();
			withContent(original, { type: 'side-chat', parentExchangeId: 'ex-1', branchIndex: 0 });
			expect(original.content).toEqual({ type: 'main-chat' });
		});
	});
});
