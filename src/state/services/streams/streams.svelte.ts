import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { ActiveModel } from '@/domain/models';
import type { ChatTree } from '@/domain/tree';
import { getTreeByChatId, replaceTreeByChatId } from '@/state/chats.svelte';
import { getProviderStream } from '@/app/providers';
import {
	isStreaming as _isStreaming,
	isAnyStreaming as _isAnyStreaming,
	startStream as _startStream,
	cancelStream as _cancelStream,
	cancelAllStreams as _cancelAllStreams,
	cancelStreamsForExchanges as _cancelStreamsForExchanges,
	cancelStreamsForChat as _cancelStreamsForChat,
	type StreamStore,
	type StreamDeps
} from './streams';

const store: StreamStore = {
	streamingIds: new SvelteSet<string>(),
	actors: new SvelteMap(),
	actorChatIds: new SvelteMap()
};

const deps: StreamDeps = {
	getTreeByChatId,
	replaceTreeByChatId,
	getProviderStream
};

export function isStreaming(exchangeId: string): boolean {
	return _isStreaming(store, exchangeId);
}

export function isAnyStreaming(): boolean {
	return _isAnyStreaming(store);
}

export function startStream(params: {
	exchangeId: string;
	chatId: string;
	model: ActiveModel;
	tree: ChatTree;
}): void {
	_startStream(store, deps, params);
}

export function cancelStream(exchangeId: string): void {
	_cancelStream(store, exchangeId);
}

export function cancelAllStreams(): void {
	_cancelAllStreams(store);
}

export function cancelStreamsForExchanges(exchangeIds: string[]): void {
	_cancelStreamsForExchanges(store, exchangeIds);
}

export function cancelStreamsForChat(chatId: string): void {
	_cancelStreamsForChat(store, chatId);
}
