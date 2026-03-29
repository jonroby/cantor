import * as domain from '@/domain';
import domainContract from '@/tests/contracts/domain.json';

import { mergeMock, mockFn, type DeepPartial, type PublicApiMock } from './helpers';

type DomainMock = PublicApiMock<typeof domain, typeof domainContract>;

export function createDomainMock(overrides?: DeepPartial<DomainMock>): DomainMock {
	const base = {
		constraints: {
			enforceUniqueName: mockFn<typeof domain.constraints.enforceUniqueName>((name) => name),
			enforceUniqueNames: mockFn<typeof domain.constraints.enforceUniqueNames>(() => false)
		},
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
			isKeyBasedProvider: mockFn<typeof domain.models.isKeyBasedProvider>((provider) =>
				['claude', 'openai', 'gemini', 'moonshot', 'qwen', 'deepseek', 'mistral', 'groq'].includes(
					provider
				)
			)
		},
		search: {
			getDefaultItems: mockFn<typeof domain.search.getDefaultItems>(() => []),
			groupResults: mockFn<typeof domain.search.groupResults>(() => []),
			searchChats: mockFn<typeof domain.search.searchChats>(() => [])
		},
		tree: {
			ChatTreeOperationError: domain.tree.ChatTreeOperationError,
			addDocumentExchangeResult: mockFn<typeof domain.tree.addDocumentExchangeResult>(),
			addExchange: mockFn<typeof domain.tree.addExchange>(),
			addExchangeResult: mockFn<typeof domain.tree.addExchangeResult>(),
			buildEmptyTree: mockFn<typeof domain.tree.buildEmptyTree>(() => ({
				rootId: null,
				exchanges: {}
			})),
			canAcceptNewChat: mockFn<typeof domain.tree.canAcceptNewChat>(() => false),
			canCreateSideChats: mockFn<typeof domain.tree.canCreateSideChats>(() => false),
			canPromoteSideChatToMainChat: mockFn<typeof domain.tree.canPromoteSideChatToMainChat>(
				() => false
			),
			copyPath: mockFn<typeof domain.tree.copyPath>(),
			deleteExchangeWithMode: mockFn<typeof domain.tree.deleteExchangeWithMode>(),
			deleteExchangeWithModeResult: mockFn<typeof domain.tree.deleteExchangeWithModeResult>(),
			findRootId: mockFn<typeof domain.tree.findRootId>(),
			findSideChatParent: mockFn<typeof domain.tree.findSideChatParent>(),
			getChildExchanges: mockFn<typeof domain.tree.getChildExchanges>(() => []),
			getDescendantExchanges: mockFn<typeof domain.tree.getDescendantExchanges>(() => []),
			getHistory: mockFn<typeof domain.tree.getHistory>(() => []),
			getMainChatHistory: mockFn<typeof domain.tree.getMainChatHistory>(() => []),
			getMainChatTail: mockFn<typeof domain.tree.getMainChatTail>(() => null),
			getPathTokenTotal: mockFn<typeof domain.tree.getPathTokenTotal>(() => 0),
			getRootExchange: mockFn<typeof domain.tree.getRootExchange>(),
			promoteSideChatToMainChat: mockFn<typeof domain.tree.promoteSideChatToMainChat>(),
			removeExchange: mockFn<typeof domain.tree.removeExchange>(),
			removeExchangeSubtree: mockFn<typeof domain.tree.removeExchangeSubtree>(),
			removeMainChatChild: mockFn<typeof domain.tree.removeMainChatChild>(),
			removeSideChatChildren: mockFn<typeof domain.tree.removeSideChatChildren>(),
			updateExchangeResponse: mockFn<typeof domain.tree.updateExchangeResponse>(),
			updateExchangeTokens: mockFn<typeof domain.tree.updateExchangeTokens>(),
			validateChatTree: mockFn<typeof domain.tree.validateChatTree>()
		}
	} satisfies DomainMock;

	return mergeMock<DomainMock>(base, overrides);
}
