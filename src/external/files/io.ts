import * as domain from '@/domain';
import type * as state from '@/state';

export function deduplicateName(name: string, existingNames: string[]): string {
	if (!existingNames.includes(name)) return name;
	const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
	const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
	let i = 1;
	while (existingNames.includes(`${base} (${i})${ext}`)) i++;
	return `${base} (${i})${ext}`;
}

function deriveRootId(exchanges: domain.tree.ExchangeMap): string | null {
	for (const exchange of Object.values(exchanges)) {
		if (exchange.parentId === null) return exchange.id;
	}
	return null;
}

export function validateChatUpload(data: unknown): state.chats.ChatRecord {
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
	} else if (Array.isArray(obj.roots) && obj.roots.length > 0) {
		const rootIndex = typeof obj.activeRootIndex === 'number' ? obj.activeRootIndex : 0;
		exchanges = obj.roots[rootIndex] as domain.tree.ExchangeMap;
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
		rootId,
		exchanges,
		activeExchangeId:
			typeof obj.activeExchangeId === 'string'
				? obj.activeExchangeId
				: domain.tree.getMainChatTail(tree)
	};
}
