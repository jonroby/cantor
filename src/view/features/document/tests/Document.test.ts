// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Document from '../Document.svelte';

vi.mock('@/view/shared/ConfirmDeleteDialog.svelte', async () => ({
	default: (await import('../../../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/view/assets/provider-logos', () => ({
	PROVIDER_LOGOS: {}
}));

vi.mock('marked', () => ({
	Marked: class {
		parse(md: string) {
			return md;
		}
	}
}));

vi.mock('katex', () => ({
	default: { renderToString: (tex: string) => tex }
}));

vi.mock('dompurify', () => ({
	default: { sanitize: (html: string) => html }
}));

vi.mock('@/app', async () => {
	const { createAppMock } = await import('@/tests/mocks/app');
	return createAppMock({
		documents: {
			validateDocumentMarkdown: vi.fn(() => [])
		}
	});
});

describe('Document', () => {
	it('treats clearing the draft to empty as unsaved', async () => {
		const user = userEvent.setup();

		render(Document, {
			props: {
				title: 'Doc',
				content: 'hello',
				onClose: vi.fn()
			}
		});

		await user.click(screen.getByTitle('Edit'));
		const editor = screen.getByRole('textbox');
		await user.clear(editor);

		expect(screen.getByTitle('Unsaved changes')).toBeInTheDocument();
	});
});
