export interface Message {
    role: "user" | "assistant";
    content: string;
}

export interface Exchange {
    id: string;
    parentId: string | null;
    prompt: string;
    response: string;
    isAnchor?: boolean;
    childIds?: string[];
    promptTokens?: number;
    responseTokens?: number;
    model?: string;
}

export type ExchangeMap = Record<string, Exchange>;
export type ExchangesByParentId = Record<string, Exchange[]>;
export const ROOT_ANCHOR_ID = "__root_anchor__";

export type DeleteMode = "exchange" | "exchangeAndMainChat" | "exchangeAndSideChats";

export interface DeleteResult {
    exchanges: ExchangeMap;
    removedExchangeIds: string[];
}

export interface AddExchangeResult {
    id: string;
    exchanges: ExchangeMap;
}

export class ChatTreeOperationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ChatTreeOperationError";
    }
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new ChatTreeOperationError(message);
    }
}

function requireExchange(exchanges: ExchangeMap, exchangeId: string, message: string): Exchange {
    const exchange = exchanges[exchangeId];
    assert(exchange !== undefined, message);
    return exchange;
}

function finalizeChatTree(exchanges: ExchangeMap): ExchangeMap {
    return validateChatTree(exchanges);
}

function isSideExchange(
    exchanges: ExchangeMap,
    exchangeId: string,
    exchangesByParentId: ExchangesByParentId = buildExchangesByParentId(exchanges),
): boolean {
    let current = exchanges[exchangeId];

    while (current?.parentId) {
        const siblings = getChildExchanges(exchanges, current.parentId, exchangesByParentId);
        if (siblings[0]?.id !== current.id) {
            return true;
        }
        current = exchanges[current.parentId];
    }

    return false;
}

export function validateChatTree(exchanges: ExchangeMap): ExchangeMap {
    const rootExchanges = Object.values(exchanges).filter((exchange) => exchange.parentId === null);
    assert(rootExchanges.length === 1, `Tree must contain exactly one root, found ${rootExchanges.length}.`);

    const root = rootExchanges[0]!;
    assert(root.isAnchor === true, "Tree root must be the anchor exchange.");

    const exchangesByParentId = buildExchangesByParentId(exchanges);

    for (const exchange of Object.values(exchanges)) {
        if (exchange.id !== root.id) {
            assert(exchange.parentId !== null, `Exchange "${exchange.id}" must have a parent.`);
            assert(
                exchanges[exchange.parentId!] !== undefined,
                `Exchange "${exchange.id}" has missing parent "${exchange.parentId}".`,
            );
        }

        const childIds = exchange.childIds ?? [];
        assert(new Set(childIds).size === childIds.length, `Exchange "${exchange.id}" has duplicate child ids.`);
        for (const childId of childIds) {
            assert(exchanges[childId] !== undefined, `Exchange "${exchange.id}" references missing child "${childId}".`);
            assert(
                exchanges[childId]!.parentId === exchange.id,
                `Exchange "${exchange.id}" has invalid child reference "${childId}".`,
            );
        }

        if (exchange.isAnchor) {
            continue;
        }

        if (isSideExchange(exchanges, exchange.id, exchangesByParentId)) {
            const children = getChildExchanges(exchanges, exchange.id, exchangesByParentId);
            assert(children.length <= 1, `Side exchange "${exchange.id}" cannot have multiple children.`);
        }
    }

    const visited = new Set<string>();
    const queue = [root.id];
    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) {
            continue;
        }
        visited.add(currentId);
        getChildExchanges(exchanges, currentId, exchangesByParentId).forEach((child) => queue.push(child.id));
    }

    assert(visited.size === Object.keys(exchanges).length, "Tree contains unreachable or cyclic exchanges.");

    return exchanges;
}

export function addExchange(exchanges: ExchangeMap, parentId: string | null, prompt: string, response = "", model?: string): ExchangeMap {
    return addExchangeResult(exchanges, parentId, prompt, response, model).exchanges;
}

export function addExchangeResult(
    exchanges: ExchangeMap,
    parentId: string | null,
    prompt: string,
    response = "",
    model?: string,
): AddExchangeResult {
    assert(parentId !== null, "Cannot add an exchange without a parent.");
    requireExchange(exchanges, parentId, `Cannot add an exchange to missing parent "${parentId}".`);

    const id = crypto.randomUUID();
    const next: ExchangeMap = {
        ...exchanges,
        [id]: { id, parentId, prompt, response, model },
    };

    return {
        id,
        exchanges: finalizeChatTree(setChildOrder(next, parentId, [...getOrderedChildIds(exchanges, parentId), id])),
    };
}

export function removeExchange(exchanges: ExchangeMap, exchangeId: string): ExchangeMap {
    const removed = requireExchange(exchanges, exchangeId, `Cannot remove missing exchange "${exchangeId}".`);
    assert(!removed.isAnchor, "Cannot remove the root anchor exchange.");

    const exchangesByParentId = buildExchangesByParentId(exchanges);
    const removedChildIds = getChildExchanges(exchanges, exchangeId, exchangesByParentId).map((child) => child.id);
    let next = { ...exchanges };
    delete next[exchangeId];

    for (const childId of removedChildIds) {
        const child = next[childId];
        if (child) {
            next[childId] = { ...child, parentId: removed.parentId };
        }
    }

    if (removed.parentId && next[removed.parentId]) {
        const siblingIds = getChildExchanges(exchanges, removed.parentId, exchangesByParentId).map((child) => child.id);
        const removedIndex = siblingIds.indexOf(exchangeId);
        const reorderedSiblingIds = siblingIds.filter((id) => id !== exchangeId);

        reorderedSiblingIds.splice(
            removedIndex < 0 ? reorderedSiblingIds.length : removedIndex,
            0,
            ...removedChildIds,
        );
        next = setChildOrder(next, removed.parentId, reorderedSiblingIds);
    }

    return finalizeChatTree(next);
}

export function removeExchangeSubtree(exchanges: ExchangeMap, exchangeId: string): ExchangeMap {
    return removeExchangeSubtreeResult(exchanges, exchangeId).exchanges;
}

export function removeMainChatChild(exchanges: ExchangeMap, exchangeId: string): ExchangeMap {
    const exchangesByParentId = buildExchangesByParentId(exchanges);
    const mainChild = getChildExchanges(exchanges, exchangeId, exchangesByParentId)[0];
    assert(mainChild !== undefined, `Exchange "${exchangeId}" has no main chat child to remove.`);

    return removeExchangeSubtree(exchanges, mainChild.id);
}

export function removeSideChatChildren(exchanges: ExchangeMap, exchangeId: string): ExchangeMap {
    const exchangesByParentId = buildExchangesByParentId(exchanges);
    const sideChildren = getChildExchanges(exchanges, exchangeId, exchangesByParentId).slice(1);
    assert(sideChildren.length > 0, `Exchange "${exchangeId}" has no side chat children to remove.`);

    return sideChildren.reduce((currentExchanges, child) => removeExchangeSubtree(currentExchanges, child.id), exchanges);
}

export function deleteExchangeWithMode(exchanges: ExchangeMap, exchangeId: string, mode: DeleteMode): ExchangeMap {
    return deleteExchangeWithModeResult(exchanges, exchangeId, mode).exchanges;
}

export function deleteExchangeWithModeResult(
    exchanges: ExchangeMap,
    exchangeId: string,
    mode: DeleteMode,
): DeleteResult {
    requireExchange(exchanges, exchangeId, `Cannot delete missing exchange "${exchangeId}".`);

    switch (mode) {
        case "exchange":
            return {
                exchanges: removeExchange(exchanges, exchangeId),
                removedExchangeIds: [exchangeId],
            };
        case "exchangeAndMainChat":
            return deleteExchangeAndMainChat(exchanges, exchangeId);
        case "exchangeAndSideChats":
            return deleteExchangeAndSideChats(exchanges, exchangeId);
        default:
            throw new ChatTreeOperationError(`Unsupported delete mode "${mode satisfies never}".`);
    }
}

function removeExchangeSubtreeResult(exchanges: ExchangeMap, exchangeId: string): DeleteResult {
    const subtreeRoot = requireExchange(exchanges, exchangeId, `Cannot remove missing subtree "${exchangeId}".`);
    assert(!subtreeRoot.isAnchor, "Cannot remove the root anchor subtree.");

    const exchangesByParentId = buildExchangesByParentId(exchanges);
    const removedIds = new Set<string>();
    const queue = [exchangeId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (removedIds.has(currentId)) continue;
        removedIds.add(currentId);
        getChildExchanges(exchanges, currentId, exchangesByParentId).forEach((child) => queue.push(child.id));
    }

    let next = { ...exchanges };
    removedIds.forEach((id) => {
        delete next[id];
    });

    if (subtreeRoot.parentId && next[subtreeRoot.parentId]) {
        const siblingIds = getChildExchanges(exchanges, subtreeRoot.parentId, exchangesByParentId)
            .map((child) => child.id)
            .filter((id) => id !== exchangeId);
        next = setChildOrder(next, subtreeRoot.parentId, siblingIds);
    }

    return {
        exchanges: finalizeChatTree(next),
        removedExchangeIds: [...removedIds],
    };
}

function deleteExchangeAndMainChat(exchanges: ExchangeMap, exchangeId: string): DeleteResult {
    const exchangesByParentId = buildExchangesByParentId(exchanges);
    const mainChild = getChildExchanges(exchanges, exchangeId, exchangesByParentId)[0];
    const mainResult = mainChild
        ? removeExchangeSubtreeResult(exchanges, mainChild.id)
        : { exchanges, removedExchangeIds: [] };

    return {
        exchanges: removeExchange(mainResult.exchanges, exchangeId),
        removedExchangeIds: [exchangeId, ...mainResult.removedExchangeIds],
    };
}

function deleteExchangeAndSideChats(exchanges: ExchangeMap, exchangeId: string): DeleteResult {
    const exchangesByParentId = buildExchangesByParentId(exchanges);
    const sideChats = getChildExchanges(exchanges, exchangeId, exchangesByParentId).slice(1);

    const sideChatResult = sideChats.reduce<DeleteResult>(
        (result, child) => {
            const subtreeResult = removeExchangeSubtreeResult(result.exchanges, child.id);
            return {
                exchanges: subtreeResult.exchanges,
                removedExchangeIds: [...result.removedExchangeIds, ...subtreeResult.removedExchangeIds],
            };
        },
        { exchanges, removedExchangeIds: [] },
    );

    return {
        exchanges: removeExchange(sideChatResult.exchanges, exchangeId),
        removedExchangeIds: [exchangeId, ...sideChatResult.removedExchangeIds],
    };
}

export function getRootExchange(exchanges: ExchangeMap): Exchange | null {
    return Object.values(exchanges).find((exchange) => exchange.parentId === null) ?? null;
}

export function buildExchangesByParentId(exchanges: ExchangeMap): ExchangesByParentId {
    const unorderedExchangesByParentId: ExchangesByParentId = {};

    for (const exchange of Object.values(exchanges)) {
        if (exchange.parentId === null) continue;
        const children = unorderedExchangesByParentId[exchange.parentId] ?? [];
        children.push(exchange);
        unorderedExchangesByParentId[exchange.parentId] = children;
    }

    const exchangesByParentId: ExchangesByParentId = {};
    for (const [parentId, children] of Object.entries(unorderedExchangesByParentId)) {
        const orderedChildIds = getOrderedChildIds(exchanges, parentId);
        if (orderedChildIds.length === 0) {
            exchangesByParentId[parentId] = children;
            continue;
        }

        const childById = new Map(children.map((child) => [child.id, child]));
        const orderedChildren = orderedChildIds
            .map((childId) => childById.get(childId))
            .filter((child): child is Exchange => child !== undefined);
        const trailingChildren = children.filter((child) => !orderedChildIds.includes(child.id));
        exchangesByParentId[parentId] = [...orderedChildren, ...trailingChildren];
    }

    return exchangesByParentId;
}

export function getChildExchanges(
    exchanges: ExchangeMap,
    exchangeId: string,
    exchangesByParentId: ExchangesByParentId = buildExchangesByParentId(exchanges),
): Exchange[] {
    return exchangesByParentId[exchangeId] ?? [];
}

export function canCreateSideChats(
    exchanges: ExchangeMap,
    exchangeId: string,
    exchangesByParentId: ExchangesByParentId = buildExchangesByParentId(exchanges),
): boolean {
    let current = exchanges[exchangeId];

    while (current?.parentId) {
        const siblings = getChildExchanges(exchanges, current.parentId, exchangesByParentId);
        if (siblings[0]?.id !== current.id) {
            return false;
        }
        current = exchanges[current.parentId];
    }

    return current !== undefined;
}

export function canAcceptNewChat(
    exchanges: ExchangeMap,
    exchangeId: string,
    exchangesByParentId: ExchangesByParentId = buildExchangesByParentId(exchanges),
): boolean {
    if (canCreateSideChats(exchanges, exchangeId, exchangesByParentId)) {
        return true;
    }

    return getChildExchanges(exchanges, exchangeId, exchangesByParentId).length === 0;
}

export function getHistory(exchanges: ExchangeMap, exchangeId: string): Message[] {
    const path: Exchange[] = [];
    let current: Exchange | undefined = requireExchange(
        exchanges,
        exchangeId,
        `Cannot get history for missing exchange "${exchangeId}".`,
    );
    while (current) {
        path.unshift(current);
        current = current.parentId ? exchanges[current.parentId] : undefined;
    }
    return path.flatMap((exchange) => {
        if (exchange.isAnchor) return [];
        const messages: Message[] = [{ role: "user" as const, content: exchange.prompt }];
        if (exchange.response) messages.push({ role: "assistant" as const, content: exchange.response });
        return messages;
    });
}

export function getPathTokenTotal(exchanges: ExchangeMap, exchangeId: string): number {
    let current: Exchange | undefined = exchanges[exchangeId];
    let total = 0;
    while (current) {
        total += (current.promptTokens ?? 0) + (current.responseTokens ?? 0);
        current = current.parentId ? exchanges[current.parentId] : undefined;
    }
    return total;
}

export function updateExchangeTokens(
    exchanges: ExchangeMap,
    exchangeId: string,
    promptTokens: number,
    responseTokens: number,
): ExchangeMap {
    const exchange = requireExchange(exchanges, exchangeId, `Cannot update tokens for missing exchange "${exchangeId}".`);
    return { ...exchanges, [exchangeId]: { ...exchange, promptTokens, responseTokens } };
}

export function updateExchangeResponse(exchanges: ExchangeMap, exchangeId: string, response: string): ExchangeMap {
    const exchange = requireExchange(
        exchanges,
        exchangeId,
        `Cannot update response for missing exchange "${exchangeId}".`,
    );
    return { ...exchanges, [exchangeId]: { ...exchange, response } };
}

export function getMainChatTail(exchanges: ExchangeMap): string | null {
    const root = getRootExchange(exchanges);
    if (!root) return null;
    const exchangesByParentId = buildExchangesByParentId(exchanges);

    if (root.isAnchor) {
        const rootChildren = getChildExchanges(exchanges, root.id, exchangesByParentId);
        if (rootChildren.length === 0) return null;
        let current = rootChildren[0]!;
        while (true) {
            const children = getChildExchanges(exchanges, current.id, exchangesByParentId);
            if (children.length === 0) return current.id;
            current = children[0]!;
        }
    }

    let current = root;
    while (true) {
        const children = getChildExchanges(exchanges, current.id, exchangesByParentId);
        if (children.length === 0) return current.id;
        current = children[0]!;
    }
}

function hasBranchingExchangeDescendant(
    exchanges: ExchangeMap,
    exchangeId: string,
    exchangesByParentId: ExchangesByParentId = buildExchangesByParentId(exchanges),
): boolean {
    const queue = [exchangeId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = getChildExchanges(exchanges, currentId, exchangesByParentId);
        if (children.length > 1) {
            return true;
        }
        children.forEach((child) => queue.push(child.id));
    }

    return false;
}

export function canPromoteSideChatToMainChat(
    exchanges: ExchangeMap,
    exchangeId: string,
    exchangesByParentId: ExchangesByParentId = buildExchangesByParentId(exchanges),
): boolean {
    const exchange = exchanges[exchangeId];
    if (!exchange?.parentId) return false;

    const siblings = getChildExchanges(exchanges, exchange.parentId, exchangesByParentId);
    const siblingIds = siblings.map((child) => child.id);
    const index = siblingIds.indexOf(exchangeId);
    if (index <= 0) return false;

    const currentMainChild = siblings[0];
    if (!currentMainChild) return false;

    return !hasBranchingExchangeDescendant(exchanges, currentMainChild.id, exchangesByParentId);
}

export function promoteSideChatToMainChat(exchanges: ExchangeMap, exchangeId: string): ExchangeMap {
    const exchange = requireExchange(exchanges, exchangeId, `Cannot promote missing exchange "${exchangeId}".`);
    assert(exchange.parentId !== null, `Exchange "${exchangeId}" cannot be promoted because it has no parent.`);

    const siblingIds = getOrderedChildIds(exchanges, exchange.parentId);
    const index = siblingIds.indexOf(exchangeId);
    assert(index > 0, `Exchange "${exchangeId}" is not a side chat child of its parent.`);

    const reorderedSiblingIds = [...siblingIds];
    reorderedSiblingIds.splice(index, 1);
    reorderedSiblingIds.unshift(exchangeId);

    return finalizeChatTree(setChildOrder(exchanges, exchange.parentId, reorderedSiblingIds));
}

export function getDescendantExchanges(exchanges: ExchangeMap, exchangeId: string): string[] {
    requireExchange(exchanges, exchangeId, `Cannot get descendants for missing exchange "${exchangeId}".`);
    const exchangesByParentId = buildExchangesByParentId(exchanges);
    const result: string[] = [];
    const queue = getChildExchanges(exchanges, exchangeId, exchangesByParentId).map((exchange) => exchange.id);

    while (queue.length) {
        const id = queue.shift()!;
        result.push(id);
        getChildExchanges(exchanges, id, exchangesByParentId).forEach((exchange) => queue.push(exchange.id));
    }

    return result;
}

// Returns the id of the outermost ancestor exchange that has multiple children
// and whose side chat contains exchangeId. Since only one side chat parent
// can be expanded at a time, we expand the outermost one first so the exchange
// becomes reachable. Returns null if exchangeId is not inside any side chat.
export function findSideChatParent(exchanges: ExchangeMap, exchangeId: string): string | null {
    const exchangesByParentId = buildExchangesByParentId(exchanges);
    let current = exchanges[exchangeId];
    let outermostSideChatParent: string | null = null;

    while (current && current.parentId) {
        const parent = exchanges[current.parentId];
        if (!parent) break;
        const siblings = exchangesByParentId[parent.id] ?? [];
        if (siblings.length > 1 && siblings[0]?.id !== current.id) {
            outermostSideChatParent = parent.id;
        }
        current = parent;
    }

    return outermostSideChatParent;
}

export function withExplicitExchangeOrder(exchanges: ExchangeMap): ExchangeMap {
    let next = { ...exchanges };
    const unorderedChildIdsByParentId: Record<string, string[]> = {};

    for (const exchange of Object.values(exchanges)) {
        if (exchange.parentId === null) continue;
        const childIds = unorderedChildIdsByParentId[exchange.parentId] ?? [];
        childIds.push(exchange.id);
        unorderedChildIdsByParentId[exchange.parentId] = childIds;
    }

    for (const [parentId, childIds] of Object.entries(unorderedChildIdsByParentId)) {
        next = setChildOrder(next, parentId, childIds);
    }

    return finalizeChatTree(next);
}

function getOrderedChildIds(exchanges: ExchangeMap, parentId: string): string[] {
    return exchanges[parentId]?.childIds?.filter((childId) => exchanges[childId]?.parentId === parentId) ?? [];
}

function setChildOrder(exchanges: ExchangeMap, parentId: string, childIds: string[]): ExchangeMap {
    const parent = requireExchange(exchanges, parentId, `Cannot set child order for missing parent "${parentId}".`);

    const normalizedChildIds = childIds.filter(
        (childId, index) => childIds.indexOf(childId) === index && exchanges[childId]?.parentId === parentId,
    );

    return {
        ...exchanges,
        [parentId]: {
            ...parent,
            childIds: normalizedChildIds,
        },
    };
}
