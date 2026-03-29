import { describe, expect, it } from 'vitest';
import { buildInitialExchanges } from './initial-exchanges';
import * as domain from '@/domain';

describe('buildInitialExchanges', () => {
	it('returns a valid ChatTree', () => {
		const tree = buildInitialExchanges();
		expect(tree.rootId).toBe('1');
		expect(Object.keys(tree.exchanges).length).toBeGreaterThan(0);
		expect(() => domain.tree.validateChatTree(tree)).not.toThrow();
	});

	it('root exchange has no parent', () => {
		const tree = buildInitialExchanges();
		const root = domain.tree.getRootExchange(tree);
		expect(root).not.toBeNull();
		expect(root!.parentId).toBeNull();
	});

	it('has a main chat path with depth > 1', () => {
		const tree = buildInitialExchanges();
		const tail = domain.tree.getMainChatTail(tree);
		expect(tail).not.toBeNull();
		expect(tail).not.toBe(tree.rootId);
	});

	it('root has side chats (multiple children)', () => {
		const tree = buildInitialExchanges();
		const children = domain.tree.getChildExchanges(tree.exchanges, tree.rootId!);
		expect(children.length).toBeGreaterThan(1);
	});

	it('all exchanges have prompt and response', () => {
		const tree = buildInitialExchanges();
		for (const exchange of Object.values(tree.exchanges)) {
			expect(exchange.prompt).toBeDefined();
			expect(exchange.prompt.text.length).toBeGreaterThan(0);
			expect(exchange.response).not.toBeNull();
			expect(exchange.response!.text.length).toBeGreaterThan(0);
		}
	});
});
