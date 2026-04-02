import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';

export type Message = domain.tree.Message;

export function getState() {
	return state.agent.agentState;
}

// ── Tool definitions ───────────────────────────────────────────────────────

const TOOLS: external.providers.stream.ToolDefinition[] = [
	{
		name: 'respond',
		description:
			'Send a message to the user without editing the document. ' +
			'Use this when you need to ask a clarifying question, confirm something, or communicate with the user. ' +
			'Do NOT use this when you can directly edit the document.',
		input_schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					description: 'The message to show to the user'
				}
			},
			required: ['message']
		}
	},
	{
		name: 'create_file',
		description:
			'Create a new file in the current folder (or its svg/ subfolder for SVGs). ' +
			'The file will be created and its content written. ' +
			'For SVG files referenced from a markdown document, use the svg/ subfolder convention.',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'Name of the file to create, e.g. "diagram.svg"'
				},
				content: {
					type: 'string',
					description: 'The full content of the file'
				},
				subfolder: {
					type: 'string',
					description: 'Optional subfolder name to create the file in, e.g. "svg"'
				}
			},
			required: ['filename', 'content']
		}
	}
];

interface ToolContext {
	folderId: string | null;
}

function executeTool(
	name: string,
	input: Record<string, unknown>,
	ctx: ToolContext
): { result: string; isResponse?: boolean } {
	if (name === 'respond') {
		const message = input.message as string;
		return { result: 'Message delivered.', isResponse: true };
	}
	if (name === 'create_file') {
		return { result: executeCreateFile(input, ctx) };
	}
	return { result: `Unknown tool: ${name}` };
}

function executeCreateFile(
	input: Record<string, unknown>,
	ctx: ToolContext
): string {
	const filename = input.filename as string;
	const content = input.content as string;
	const subfolder = input.subfolder as string | undefined;

	if (!filename || content === undefined) {
		return 'Error: filename and content are required';
	}

	if (!ctx.folderId) {
		return 'Error: no folder context — open a document in a folder first';
	}

	let targetFolderId = ctx.folderId;

	if (subfolder) {
		const parentFolder = state.documents.findFolder(ctx.folderId);
		if (!parentFolder) return 'Error: parent folder not found';

		let sub = parentFolder.folders?.find((f) => f.name === subfolder);
		if (!sub) {
			targetFolderId = state.documents.newFolder(ctx.folderId);
			const created = state.documents.findFolder(targetFolderId);
			if (created) created.name = subfolder;
		} else {
			targetFolderId = sub.id;
		}
	}

	const fileId = state.documents.createDocumentInFolder(targetFolderId, filename);
	if (!fileId) return `Error: could not create file "${filename}"`;

	const folder = state.documents.findFolder(targetFolderId);
	const file = folder?.files?.find((f) => f.id === fileId);
	if (file) file.content = content;

	return `Created "${subfolder ? subfolder + '/' : ''}${filename}"`;
}

// ── Message building ───────────────────────────────────────────────────────

export function buildMessages(
	prompt: string,
	documentContent: string | undefined,
	chatTree: domain.tree.ChatTree
): Message[] {
	const documentSection = documentContent
		? `\n\n<current_document>\n${documentContent}\n</current_document>`
		: '\n\nThe document is currently empty.';

	const systemPrompt = [
		'You are editing a markdown document. The user will give you instructions about what to change.',
		'',
		'CRITICAL RULES:',
		'- Only change what the user asked for. Do NOT rewrite, rephrase, reformat, or reorganize any content the user did not mention.',
		'- Preserve the existing document exactly as-is, except for the specific change requested.',
		'- Your entire text response becomes the new document. Do NOT wrap it in code fences or add commentary.',
		'',
		'COMMUNICATING WITH THE USER:',
		'If you need to ask a clarifying question or respond to the user without editing the document, use the respond tool.',
		'Do NOT write conversational text as your response — that would overwrite the document.',
		'',
		'CREATING SVG DIAGRAMS:',
		'When the user asks for a diagram, chart, visual, or SVG, you MUST use the create_file tool. Do NOT write SVG markup inline in the document.',
		'1. Call the create_file tool with the SVG content, a descriptive filename, and subfolder "svg".',
		'2. Then in your text response (the updated document), insert a markdown image reference: ![description](svg/filename.svg)',
		'3. Create real, detailed SVGs with proper shapes, text, arrows, colors — never empty or placeholder content.',
		'4. You MUST actually call the create_file tool — do not just write a reference to a file that does not exist.',
		'',
		'MATHEMATICAL PLOTS:',
		'For function graphs, use inline ```plot blocks instead of SVGs:',
		'',
		'```plot',
		'{ "data": [{ "fn": "sin(x)" }] }',
		'```',
		'',
		'Plot options:',
		'- Standard functions: { "fn": "x^2", "nSamples": 1000, "sampler": "builtIn" }',
		'- Implicit equations: { "fn": "x^2 + y^2 - 1", "fnType": "implicit" }',
		'- Parametric curves: { "x": "cos(t)", "y": "sin(t)", "fnType": "parametric" }',
		'- Polar functions: { "r": "theta", "fnType": "polar" }',
		'- Axis domains: "xAxis": { "domain": [-10, 10] }, "yAxis": { "domain": [-2, 2] }',
		'- Multiple functions: "data": [{ "fn": "sin(x)" }, { "fn": "cos(x)" }]',
		documentSection
	].join('\n');

	const chatHistory = domain.tree
		.getMainChat(chatTree)
		.flatMap((exchange) => [
			{ role: 'user', content: exchange.prompt.text } as Message,
			...(exchange.response?.text
				? ([{ role: 'assistant', content: exchange.response.text }] as Message[])
				: [])
		]);

	return [
		...chatHistory,
		{ role: 'user', content: systemPrompt },
		{ role: 'assistant', content: 'Understood.' },
		...state.agent.agentState.history,
		{ role: 'user', content: prompt }
	];
}

// ── Submit with agent loop ─────────────────────────────────────────────────

export interface SubmitDeps {
	getProviderStream: typeof external.providers.stream.getProviderStream;
}

const defaultDeps: SubmitDeps = {
	getProviderStream: external.providers.stream.getProviderStream
};

export async function submit(
	prompt: string,
	model: domain.models.ActiveModel,
	documentContent: string | undefined,
	chatTree: domain.tree.ChatTree,
	folderId: string | null = null,
	deps: SubmitDeps = defaultDeps
): Promise<void> {
	const messages = buildMessages(prompt, documentContent, chatTree);
	state.agent.pushMessage({ role: 'user', content: prompt });
	state.agent.setStreaming(true);

	const abort = new AbortController();
	currentAbort = abort;

	const toolContext: ToolContext = { folderId };
	const useTools = model.provider === 'claude';

	try {
		await agentLoop(messages, model, toolContext, useTools, abort, deps);
	} catch (e) {
		if (abort.signal.aborted) return;
		throw e;
	} finally {
		state.agent.setStreaming(false);
		currentAbort = null;
	}
}

async function agentLoop(
	messages: Message[],
	model: domain.models.ActiveModel,
	toolContext: ToolContext,
	useTools: boolean,
	abort: AbortController,
	deps: SubmitDeps
): Promise<void> {
	// Claude API uses structured content arrays, not plain strings, for multi-turn tool use.
	// We maintain a parallel "raw" message list for the API while keeping domain Messages for history.
	let rawMessages: unknown[] = messages.map((m) => ({
		role: m.role,
		content: m.content
	}));

	const MAX_TOOL_TURNS = 10;

	for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
		let responseText = '';
		const toolCalls: external.providers.stream.ToolUseBlock[] = [];
		let stopReason: string | undefined;

		const stream = deps.getProviderStream(
			model,
			// Cast: the provider accepts Message[] but we may have structured content.
			// For tool result turns, rawMessages contains objects the Claude provider will serialize.
			rawMessages as Message[],
			abort.signal,
			{
				apiKey: state.providers.providerState.apiKeys[model.provider] ?? '',
				ollamaUrl: state.providers.providerState.ollamaUrl
			},
			useTools ? TOOLS : undefined
		);

		for await (const chunk of stream) {
			if (chunk.type === 'delta') {
				responseText += chunk.delta;
			} else if (chunk.type === 'tool_use') {
				toolCalls.push(chunk.toolUse);
			} else if (chunk.type === 'done') {
				stopReason = chunk.stopReason;
			}
		}

		if (toolCalls.length > 0) {
			// Check for respond tool — show message to user, stop loop
			const respondCall = toolCalls.find((tc) => tc.name === 'respond');
			if (respondCall) {
				const message = respondCall.input.message as string;
				state.agent.pushMessage({ role: 'assistant', content: message });
				state.agent.setLastResponse(message);
				break;
			}

			// Build the assistant message with both text and tool_use blocks
			const assistantContent: unknown[] = [];
			if (responseText) {
				assistantContent.push({ type: 'text', text: responseText });
			}
			for (const tc of toolCalls) {
				assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
			}
			rawMessages.push({ role: 'assistant', content: assistantContent });

			// Execute tools and build tool_result message
			const toolResults = toolCalls.map((tc) => {
				const { result } = executeTool(tc.name, tc.input, toolContext);
				return { type: 'tool_result', tool_use_id: tc.id, content: result };
			});
			rawMessages.push({ role: 'user', content: toolResults });

			// If stop_reason is not tool_use, we're done even with tool calls
			if (stopReason !== 'tool_use') break;

			// Continue the loop for another turn
			continue;
		}

		// No tool calls — this is the final response
		if (responseText) {
			state.agent.pushMessage({ role: 'assistant', content: responseText });
			state.agent.setPendingContent(responseText);
		}
		break;
	}
}

let currentAbort: AbortController | null = null;

export function stop() {
	if (currentAbort) {
		currentAbort.abort();
		currentAbort = null;
	}
	state.agent.setStreaming(false);
}

export function acceptPending(openDocumentIndex: number) {
	const pending = state.agent.agentState.pendingContent;
	if (pending !== null && openDocumentIndex >= 0) {
		state.documents.updateDocumentContent(openDocumentIndex, pending);
	}
	state.agent.setPendingContent(null);
}

export function rejectPending() {
	state.agent.setPendingContent(null);
}

export function dismissResponse() {
	state.agent.setLastResponse(null);
}

export function reset() {
	stop();
	state.agent.reset();
}
