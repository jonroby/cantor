// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ChatMessage from '../ChatMessage.svelte';
import type { ChatCardData } from '@/view/components/chat-card';

vi.mock('@/view/lib/katex', () => ({
	renderRichText: (text: string) => text,
	renderMarkdownKatexBlocks: vi.fn((text: string) =>
		text
			? text.split('\n\n').map((block) => ({
					source: block,
					html: `<p>${block}</p>`
				}))
			: []
	)
}));

vi.mock('dompurify', () => ({
	default: { sanitize: (html: string) => html }
}));

vi.mock('@/view/assets/provider-logos', () => ({
	PROVIDER_LOGOS: {}
}));

function makeNodeData(overrides: Partial<ChatCardData> = {}): ChatCardData {
	return {
		prompt: 'Hello world',
		response: 'Hi there',
		model: 'claude-sonnet-4-5',
		provider: 'claude',
		isActive: false,
		isStreaming: false,
		hasSideChildren: false,
		sideChildrenCount: 0,
		isSideRoot: false,
		canCreateSideChat: false,
		canPromote: false,
		canQuickAsk: true,
		canQuickAdd: false,
		onCopy: vi.fn(),
		onToggleSideChildren: vi.fn(),
		onPromote: vi.fn(),
		onDelete: vi.fn(),
		onQuickAsk: vi.fn(),
		onQuickAdd: vi.fn(),
		...overrides
	};
}

describe('ChatMessage', () => {
	it('displays prompt and response text', () => {
		render(ChatMessage, { props: { data: makeNodeData() } });
		expect(screen.getByText('Hello world')).toBeInTheDocument();
		expect(screen.getByText('Hi there')).toBeInTheDocument();
	});

	it('shows "Waiting for response…" during streaming with no response', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ isStreaming: true, response: '' }) }
		});
		expect(screen.getByText('Waiting for response…')).toBeInTheDocument();
	});

	it('shows "Cancelled" when no response and not streaming', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ isStreaming: false, response: '' }) }
		});
		expect(screen.getByText('Cancelled')).toBeInTheDocument();
	});

	it('shows model name', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ model: 'gpt-4o' }) }
		});
		expect(screen.getByText('gpt-4o')).toBeInTheDocument();
	});

	it('copy button fires onCopy', async () => {
		const data = makeNodeData();
		render(ChatMessage, { props: { data } });
		await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
		expect(data.onCopy).toHaveBeenCalledOnce();
	});

	it('delete button fires onDelete', async () => {
		const data = makeNodeData();
		render(ChatMessage, { props: { data } });
		await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(data.onDelete).toHaveBeenCalledOnce();
	});

	it('side chat button visible for non-side-root exchanges', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ isSideRoot: false }) }
		});
		expect(screen.getByRole('button', { name: 'Side chat' })).toBeInTheDocument();
	});

	it('side chat button disabled when canCreateSideChat is false', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ canCreateSideChat: false }) }
		});
		expect(screen.getByRole('button', { name: 'Side chat' })).toBeDisabled();
	});

	it('side chat button enabled when canCreateSideChat is true', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ canCreateSideChat: true }) }
		});
		expect(screen.getByRole('button', { name: 'Side chat' })).toBeEnabled();
	});

	it('side chat button fires onToggleSideChildren', async () => {
		const data = makeNodeData({ canCreateSideChat: true, hasSideChildren: false });
		render(ChatMessage, { props: { data } });
		await userEvent.click(screen.getByRole('button', { name: 'Side chat' }));
		expect(data.onToggleSideChildren).toHaveBeenCalledOnce();
	});

	it('promote button visible only for side roots', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ isSideRoot: true }) }
		});
		expect(screen.getByRole('button', { name: 'Promote' })).toBeInTheDocument();
	});

	it('promote button not visible for non-side-root', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ isSideRoot: false }) }
		});
		expect(screen.queryByRole('button', { name: 'Promote' })).not.toBeInTheDocument();
	});

	it('promote button disabled when canPromote is false', () => {
		render(ChatMessage, {
			props: { data: makeNodeData({ isSideRoot: true, canPromote: false }) }
		});
		expect(screen.getByRole('button', { name: 'Promote' })).toBeDisabled();
	});

	it('side chat badge shows side children count', () => {
		render(ChatMessage, {
			props: {
				data: makeNodeData({ canCreateSideChat: true, hasSideChildren: true, sideChildrenCount: 3 })
			}
		});
		expect(screen.getByText('3')).toBeInTheDocument();
	});

	it('side chat badge fires onToggleSideChildren', async () => {
		const data = makeNodeData({
			canCreateSideChat: true,
			hasSideChildren: true,
			sideChildrenCount: 2
		});
		render(ChatMessage, { props: { data } });
		await userEvent.click(screen.getByText('2'));
		expect(data.onToggleSideChildren).toHaveBeenCalledOnce();
	});

	it('quick ask can target a single response block', async () => {
		const data = makeNodeData({
			response: 'First block\n\nSecond block\n\nThird block'
		});
		render(ChatMessage, { props: { data } });

		const secondBlock = screen.getByText('Second block');
		await fireEvent.contextMenu(secondBlock);
		await userEvent.click(screen.getByRole('button', { name: /quick ask/i }));

		expect(data.onQuickAsk).toHaveBeenCalledOnce();
		expect(data.onQuickAsk).toHaveBeenCalledWith('Second block');
	});

	it('quick ask can include a contiguous block range in document order', async () => {
		const data = makeNodeData({
			response: 'First block\n\nSecond block\n\nThird block'
		});
		render(ChatMessage, { props: { data } });

		const firstBlock = screen.getByText('First block');
		const thirdBlock = screen.getByText('Third block');

		await fireEvent.mouseDown(firstBlock, { button: 0 });
		await fireEvent.mouseDown(thirdBlock, { button: 0, shiftKey: true });
		await fireEvent.contextMenu(thirdBlock);
		await userEvent.click(screen.getByRole('button', { name: /quick ask/i }));

		expect(data.onQuickAsk).toHaveBeenCalledOnce();
		expect(data.onQuickAsk).toHaveBeenCalledWith('First block\n\nSecond block\n\nThird block');
	});

	it('quick ask preserves document order when the selection is made backwards', async () => {
		const data = makeNodeData({
			response: 'First block\n\nSecond block\n\nThird block'
		});
		render(ChatMessage, { props: { data } });

		const firstBlock = screen.getByText('First block');
		const thirdBlock = screen.getByText('Third block');

		await fireEvent.mouseDown(thirdBlock, { button: 0 });
		await fireEvent.mouseDown(firstBlock, { button: 0, shiftKey: true });
		await fireEvent.contextMenu(firstBlock);
		await userEvent.click(screen.getByRole('button', { name: /quick ask/i }));

		expect(data.onQuickAsk).toHaveBeenCalledOnce();
		expect(data.onQuickAsk).toHaveBeenCalledWith('First block\n\nSecond block\n\nThird block');
	});

	it('does not expose quick ask when the exchange cannot accept it', async () => {
		const data = makeNodeData({
			canQuickAsk: false,
			response: 'First block\n\nSecond block'
		});
		render(ChatMessage, { props: { data } });

		await fireEvent.contextMenu(screen.getByText('First block'));

		expect(screen.queryByRole('button', { name: /quick ask/i })).not.toBeInTheDocument();
		expect(data.onQuickAsk).not.toHaveBeenCalled();
	});
});
