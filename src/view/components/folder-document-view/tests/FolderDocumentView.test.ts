// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FolderDocumentView from '../FolderDocumentView.svelte';

vi.mock('@/view/components/document', async () => ({
	Document: (await import('../../../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

describe('FolderDocumentView', () => {
	const files = [
		{ id: 'file-1', name: 'Self Attention.md', content: '# Self Attention' },
		{ id: 'file-2', name: 'Linear Transformation.md', content: '# Linear Transformation' }
	];

	it('renders a close button and calls onClose', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(FolderDocumentView, {
			props: {
				folderId: 'folder-1',
				folderName: 'Transformers',
				files,
				activeFileId: 'file-1',
				onClose
			}
		});

		await user.click(screen.getByRole('button', { name: 'Close' }));

		expect(onClose).toHaveBeenCalledOnce();
	});

	it('opens the file picker and selects a file through the click-away scrim path', async () => {
		const user = userEvent.setup();
		const onSelectFile = vi.fn();

		render(FolderDocumentView, {
			props: {
				folderId: 'folder-1',
				folderName: 'Transformers',
				files,
				activeFileId: 'file-1',
				onClose: vi.fn(),
				onSelectFile
			}
		});

		await user.click(screen.getByRole('button', { name: /Self Attention\.md/i }));

		const scrim = screen.getByRole('button', { name: 'Close dropdown' });
		expect(scrim.className).toContain('folderview-dropdown-scrim');

		await user.click(screen.getByRole('button', { name: /Linear Transformation\.md/i }));

		expect(onSelectFile).toHaveBeenCalledWith('file-2');
	});
});
