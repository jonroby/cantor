import type * as view from '@/view';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type ViewMock = PublicApiMock<typeof view>;

export function createViewMock(overrides?: DeepPartial<ViewMock>): ViewMock {
	const base = {
		classic: {
			ChatMessage: {} as ViewMock['classic']['ChatMessage'],
			ChatView: {} as ViewMock['classic']['ChatView']
		},
		shared: {
			AppSidebar: {} as ViewMock['shared']['AppSidebar'],
			ChatInput: {} as ViewMock['shared']['ChatInput'],
			Composer: {} as ViewMock['shared']['Composer'],
			SearchDialog: {} as ViewMock['shared']['SearchDialog']
		}
	} satisfies ViewMock;

	return mergeMock(
		base as unknown as Record<string, unknown>,
		overrides as DeepPartial<Record<string, unknown>>
	) as unknown as ViewMock;
}
