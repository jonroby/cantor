import * as view from '@/view';
import viewContract from '@/tests/contracts/view.json';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type ViewMock = PublicApiMock<typeof view, typeof viewContract>;

export function createViewMock(overrides?: DeepPartial<ViewMock>): ViewMock {
	const base = {
		classic: {
			ChatMessage: view.classic.ChatMessage,
			ChatView: view.classic.ChatView,
			DocumentView: view.classic.DocumentView,
			FolderDocumentView: view.classic.FolderDocumentView
		},
		shared: {
			AppSidebar: view.shared.AppSidebar,
			Composer: view.shared.Composer,
			ComposerInput: view.shared.ComposerInput,
			SearchDialog: view.shared.SearchDialog
		}
	} satisfies ViewMock;

	return mergeMock<ViewMock>(base, overrides);
}
