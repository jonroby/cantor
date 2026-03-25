export type StreamChunk =
	| { type: 'delta'; delta: string }
	| { type: 'done'; promptTokens: number; responseTokens: number };
