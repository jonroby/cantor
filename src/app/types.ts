import type { Provider } from '@/domain/models';

export interface ExchangeNodeData {
	prompt: string;
	response: string;
	model?: string;
	provider?: Provider | null;
	isActive: boolean;
	isStreaming: boolean;
	hasSideChildren: boolean;
	sideChildrenCount: number;
	isSideRoot: boolean;
	canCreateSideChat: boolean;
	canPromote: boolean;
	canQuickAsk: boolean;
	onMeasure: (height: number) => void;
	onSelect: () => void;
	onCopy: () => void;
	onToggleSideChildren: () => void;
	onPromote: () => void;
	onDelete: () => void;
	onQuickAsk: (sourceText: string) => void;
}
