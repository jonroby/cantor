import type { Provider } from '@/lib/models';

export interface ExchangeNodeData {
	prompt: string;
	response: string;
	model?: string;
	provider?: Provider | null;
	isActive: boolean;
	isStreaming: boolean;
	canFork: boolean;
	hasSideChildren: boolean;
	sideChildrenCount: number;
	isSideRoot: boolean;
	canPromote: boolean;
	onMeasure: (height: number) => void;
	onSelect: () => void;
	onFork: () => void;
	onToggleSideChildren: () => void;
	onPromote: () => void;
	onDelete: () => void;
}
