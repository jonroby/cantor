import { vi } from 'vitest';

import type * as domain from '@/domain';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type DomainMock = PublicApiMock<typeof domain>;

export function createDomainMock(overrides?: DeepPartial<DomainMock>): DomainMock {
	const base = {
		models: {
			LOCAL_PROVIDERS: ['ollama', 'webllm'] as const,
			KEY_BASED_PROVIDERS: [
				'claude',
				'openai',
				'gemini',
				'moonshot',
				'qwen',
				'deepseek',
				'mistral',
				'groq'
			] as const,
			PROVIDERS: [
				'ollama',
				'webllm',
				'claude',
				'openai',
				'gemini',
				'moonshot',
				'qwen',
				'deepseek',
				'mistral',
				'groq'
			] as const,
			isKeyBasedProvider: vi.fn((provider: string) =>
				['claude', 'openai', 'gemini', 'moonshot', 'qwen', 'deepseek', 'mistral', 'groq'].includes(
					provider
				)
			)
		},
		search: {
			getDefaultItems: vi.fn(() => []),
			groupResults: vi.fn(() => []),
			searchChats: vi.fn(() => [])
		},
		tree: {
			ChatTreeOperationError:
				class ChatTreeOperationError extends Error {} as unknown as DomainMock['tree']['ChatTreeOperationError'],
			addDocumentExchangeResult: vi.fn(),
			addExchange: vi.fn(),
			addExchangeResult: vi.fn(),
			buildEmptyTree: vi.fn(() => ({ rootId: null, exchanges: {} })),
			canAcceptNewChat: vi.fn(() => false),
			canCreateSideChats: vi.fn(() => false),
			canPromoteSideChatToMainChat: vi.fn(() => false),
			copyPath: vi.fn(),
			deleteExchangeWithMode: vi.fn(),
			deleteExchangeWithModeResult: vi.fn(),
			findRootId: vi.fn(),
			findSideChatParent: vi.fn(),
			getChildExchanges: vi.fn(() => []),
			getDescendantExchanges: vi.fn(() => []),
			getHistory: vi.fn(() => []),
			getMainChatHistory: vi.fn(() => []),
			getMainChatTail: vi.fn(() => null),
			getPathTokenTotal: vi.fn(() => 0),
			getRootExchange: vi.fn(),
			promoteSideChatToMainChat: vi.fn(),
			removeExchange: vi.fn(),
			removeExchangeSubtree: vi.fn(),
			removeMainChatChild: vi.fn(),
			removeSideChatChildren: vi.fn(),
			updateExchangeResponse: vi.fn(),
			updateExchangeTokens: vi.fn(),
			validateChatTree: vi.fn()
		}
	} satisfies DomainMock;

	return mergeMock(
		base as unknown as Record<string, unknown>,
		overrides as DeepPartial<Record<string, unknown>>
	) as unknown as DomainMock;
}
