export { createAppMock } from './app';
export {
	mockAppChatModule,
	mockAppDocumentsModule,
	mockAppProvidersModule,
	mockAppWorkspaceModule
} from './app';
export { createDomainMock } from './domain';
export { createExternalMock } from './external';
export { mockExternalModule } from './external';
export { createLibMock } from './lib';
export { mockLibModule } from './lib';
export { createStateMock } from './state';
export { mockStateModule } from './state';
export { createViewMock } from './view';
export { createJSZipMock, mockJSZipModule } from './jszip';
export type { DeepPartial, PublicApiMock } from './helpers';
import { vi } from 'vitest';

export async function mockProvidersInitializeModule() {
	return {
		initialize: vi.fn()
	};
}
