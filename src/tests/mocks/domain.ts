import * as domain from '@/domain';
import domainContract from '@/tests/contracts/domain.json';

import { mergeMock, mockFn, type DeepPartial, type PublicApiMock } from './helpers';

type DomainMock = PublicApiMock<typeof domain, typeof domainContract>;

export function createDomainMock(overrides?: DeepPartial<DomainMock>): DomainMock {
	const base = {
		constraints: {
			hasDuplicateNames: mockFn<typeof domain.constraints.hasDuplicateNames>(() => false),
			isUniqueName: mockFn<typeof domain.constraints.isUniqueName>(() => true)
		},
		documents: {
			findFile: mockFn<typeof domain.documents.findFile>(() => undefined),
			findFolder: mockFn<typeof domain.documents.findFolder>(() => undefined),
			findOpenDocumentIndex: mockFn<typeof domain.documents.findOpenDocumentIndex>(() => -1),
			resolveAsset: mockFn<typeof domain.documents.resolveAsset>(() => null)
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
		tree: {
			ChatTreeOperationError: domain.tree.ChatTreeOperationError,
			addExchange: mockFn<typeof domain.tree.addExchange>(),
			buildEmptyTree: mockFn<typeof domain.tree.buildEmptyTree>(() => ({
				rootId: null,
				exchanges: {}
			})),
			getChildren: mockFn<typeof domain.tree.getChildren>(() => []),
			getExchange: mockFn<typeof domain.tree.getExchange>(() => null),
			getMainChat: mockFn<typeof domain.tree.getMainChat>(() => []),
			getMainChatTail: mockFn<typeof domain.tree.getMainChatTail>(() => null),
			getPath: mockFn<typeof domain.tree.getPath>(() => []),
			promoteSideChatToMainChat: mockFn<typeof domain.tree.promoteSideChatToMainChat>(),
			removeExchange: mockFn<typeof domain.tree.removeExchange>(),
			removeExchangeSubtree: mockFn<typeof domain.tree.removeExchangeSubtree>(),
			updateExchangeResponse: mockFn<typeof domain.tree.updateExchangeResponse>(),
			updateExchangeTokens: mockFn<typeof domain.tree.updateExchangeTokens>(),
			validateChatTree: mockFn<typeof domain.tree.validateChatTree>(),
			constraints: {
				canAcceptNewChat: mockFn<typeof domain.tree.constraints.canAcceptNewChat>(() => false),
				canCreateSideChats: mockFn<typeof domain.tree.constraints.canCreateSideChats>(() => false),
				canPromoteSideChatToMainChat: mockFn<
					typeof domain.tree.constraints.canPromoteSideChatToMainChat
				>(() => false)
			}
		}
	} satisfies DomainMock;

	return mergeMock<DomainMock>(base, overrides);
}
