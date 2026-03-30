import * as view from '@/view';
import viewContract from '@/tests/contracts/view.json';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type ViewMock = PublicApiMock<typeof view, typeof viewContract>;

export function createViewMock(overrides?: DeepPartial<ViewMock>): ViewMock {
	const base = {
		classic: {
			ChatMessage: view.classic.ChatMessage,
			ChatView: view.classic.ChatView
		},
		shared: {
			AppSidebar: view.shared.AppSidebar,
			ChatInput: view.shared.ChatInput,
			Composer: view.shared.Composer,
			SearchDialog: view.shared.SearchDialog
		}
	} satisfies ViewMock;

	return mergeMock<ViewMock>(base, overrides);
}
