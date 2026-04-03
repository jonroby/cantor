import * as domain from '@/domain';

export interface ValidatedChatUpload {
	id: string;
	name: string;
	tree: domain.tree.ChatTree;
	activeExchangeId: string | null;
}

export function pickFile(accept: string): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.click();
	});
}

export function pickDirectory(): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.webkitdirectory = true;
		input.onchange = () => resolve(input.files ? Array.from(input.files) : []);
		input.click();
	});
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 100);
}

function deriveRootId(exchanges: domain.tree.ExchangeMap): string | null {
	for (const exchange of Object.values(exchanges)) {
		if (exchange.parentId === null) return exchange.id;
	}
	return null;
}

export function validateChatUpload(data: unknown): ValidatedChatUpload {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		throw new Error('Upload must be a JSON object.');
	}

	const obj = data as Record<string, unknown>;

	if (typeof obj.id !== 'string' || !obj.id) {
		throw new Error('Chat is missing a valid "id".');
	}
	if (typeof obj.name !== 'string' || !obj.name) {
		throw new Error('Chat is missing a valid "name".');
	}

	let exchanges: domain.tree.ExchangeMap;
	if (obj.exchanges && typeof obj.exchanges === 'object' && !Array.isArray(obj.exchanges)) {
		exchanges = obj.exchanges as domain.tree.ExchangeMap;
	} else {
		throw new Error('Chat must have an "exchanges" map.');
	}

	if (Object.keys(exchanges).length === 0) {
		throw new Error('Exchanges map is empty.');
	}
	for (const [id, exchange] of Object.entries(exchanges)) {
		if (typeof exchange !== 'object' || exchange === null) {
			throw new Error(`Exchange "${id}" is not a valid object.`);
		}
		if (typeof exchange.id !== 'string') {
			throw new Error(`Exchange is missing an "id".`);
		}
		if (
			exchange.prompt === null ||
			(typeof exchange.prompt !== 'object' && typeof exchange.prompt !== 'string')
		) {
			throw new Error(`Exchange "${id}" is missing a "prompt".`);
		}
	}

	const rootId = deriveRootId(exchanges);
	const tree = { rootId, exchanges };
	try {
		domain.tree.validateChatTree(tree);
	} catch (e) {
		throw new Error(e instanceof Error ? e.message : String(e));
	}

	return {
		id: obj.id as string,
		name: obj.name as string,
		tree,
		activeExchangeId:
			typeof obj.activeExchangeId === 'string'
				? obj.activeExchangeId
				: domain.tree.getMainChatTail(tree)
	};
}
