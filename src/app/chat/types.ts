import type * as domain from '@/domain';

export interface ExchangeNodeData {
	prompt: string;
	response: string;
	model?: string;
	provider?: domain.models.Provider | null;
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
	onMeasure: (height: number) => void;
	onSelect: () => void;
	onCopy: () => void;
	onToggleSideChildren: () => void;
	onPromote: () => void;
	onDelete: () => void;
	onQuickAsk: (sourceText: string) => void;
	onQuickAdd: (sourceText: string) => void;
}
