import * as view from '@/view';
import viewContract from '@/tests/contracts/view.json';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type ViewMock = PublicApiMock<typeof view, typeof viewContract>;

export function createViewMock(overrides?: DeepPartial<ViewMock>): ViewMock {
	const base = {
		AgentActivity: view.AgentActivity,
		ChatMessage: view.ChatMessage,
		ChatView: view.ChatView,
		DocumentView: view.DocumentView,
		FolderDocumentView: view.FolderDocumentView,
		shared: {
			AppSidebar: view.shared.AppSidebar,
			Composer: view.shared.Composer,
			ComposerInput: view.shared.ComposerInput,
			SearchDialog: view.shared.SearchDialog
		}
	} satisfies ViewMock;

	return mergeMock<ViewMock>(base, overrides);
}
