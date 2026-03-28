import { describe, expect, it } from 'vitest';
import {
	createMainChatPanel,
	createSideChatPanel,
	createDocumentPanel,
	isSideChat,
	withContent
} from './panel';

describe('classic panel', () => {
	it('creates main-chat panels', () => {
		expect(createMainChatPanel().content).toEqual({ type: 'main-chat' });
	});

	it('creates side-chat panels', () => {
		expect(createSideChatPanel('ex-1', 2).content).toEqual({
			type: 'side-chat',
			parentExchangeId: 'ex-1',
			branchIndex: 2
		});
	});

	it('creates document panels', () => {
		expect(createDocumentPanel('folder-1', 'file-1').content).toEqual({
			type: 'document',
			folderId: 'folder-1',
			fileId: 'file-1'
		});
	});

	it('assigns unique ids', () => {
		const ids = [
			createMainChatPanel().id,
			createMainChatPanel().id,
			createSideChatPanel('ex-1', 0).id,
			createDocumentPanel('folder-1', 'file-1').id
		];
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('narrows side-chat panels', () => {
		expect(isSideChat(createSideChatPanel('ex-1', 0))).toBe(true);
		expect(isSideChat(createMainChatPanel())).toBe(false);
		expect(isSideChat(createDocumentPanel('folder-1', 'file-1'))).toBe(false);
	});

	it('preserves id when replacing content', () => {
		const original = createMainChatPanel();
		const updated = withContent(original, {
			type: 'document',
			folderId: 'folder-1',
			fileId: 'file-1'
		});

		expect(updated.id).toBe(original.id);
		expect(updated.content).toEqual({
			type: 'document',
			folderId: 'folder-1',
			fileId: 'file-1'
		});
		expect(original.content).toEqual({ type: 'main-chat' });
	});
});
