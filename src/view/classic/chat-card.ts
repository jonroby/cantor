import type * as app from '@/app';

export interface ChatCardData {
	prompt: string;
	response: string;
	model?: string;
	provider?: app.providers.Provider | null;
	label?: string;
	isActive: boolean;
	isStreaming: boolean;
	hasSideChildren: boolean;
	sideChildrenCount: number;
	isSideRoot: boolean;
	canCreateSideChat: boolean;
	canPromote: boolean;
	canQuickAsk: boolean;
	canQuickAdd: boolean;
	onCopy: () => void;
	onToggleSideChildren: () => void;
	onPromote: () => void;
	onDelete: () => void;
	onQuickAsk: (sourceText: string) => void;
	onQuickAdd: (sourceText: string) => void;
}
