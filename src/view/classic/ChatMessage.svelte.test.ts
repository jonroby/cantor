// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ChatMessage from './ChatMessage.svelte';
import type { ExchangeNodeData } from '@/app/types';

vi.mock('@/view/shared/katex', () => ({
	renderRichText: (text: string) => text
}));

vi.mock('@/domain/document-map/index', () => ({
	mapDocument: (text: string) => (text ? [{ source: text, html: text }] : []),
	marked: { lexer: () => [], parser: () => '', parse: (t: string) => t }
}));

vi.mock('dompurify', () => ({
	default: { sanitize: (html: string) => html }
}));

vi.mock('@/domain/models/logos', () => ({
	PROVIDER_LOGOS: {}
}));

function makeNodeData(overrides: Partial<ExchangeNodeData> = {}): ExchangeNodeData {
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
		onMeasure: vi.fn(),
		onSelect: vi.fn(),
		onCopy: vi.fn(),
		onToggleSideChildren: vi.fn(),
		onPromote: vi.fn(),
		onDelete: vi.fn(),
		onQuickAsk: vi.fn(),
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

	it('branch badge shows side children count', () => {
		render(ChatMessage, {
			props: {
				data: makeNodeData({ canCreateSideChat: true, hasSideChildren: true, sideChildrenCount: 3 })
			}
		});
		expect(screen.getByText('3')).toBeInTheDocument();
	});

	it('branch badge fires onToggleSideChildren', async () => {
		const data = makeNodeData({
			canCreateSideChat: true,
			hasSideChildren: true,
			sideChildrenCount: 2
		});
		render(ChatMessage, { props: { data } });
		await userEvent.click(screen.getByText('2'));
		expect(data.onToggleSideChildren).toHaveBeenCalledOnce();
	});
});
