import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';
import * as documents from '@/app/documents';
import * as chat from '@/app/chat';

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
			'Create a new file in a folder. ' +
			'The file will be created and its content written. ' +
			'For SVG files referenced from a markdown document, use the svg/ subfolder convention. ' +
			'If folder_id is omitted, uses the current folder context.',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'Name of the file to create, e.g. "diagram.svg" or "Notes.md"'
				},
				content: {
					type: 'string',
					description: 'The full content of the file'
				},
				folder_id: {
					type: 'string',
					description: 'ID of the folder to create the file in. Omit to use current folder.'
				},
				subfolder: {
					type: 'string',
					description: 'Optional subfolder name to create the file in, e.g. "svg"'
				}
			},
			required: ['filename', 'content']
		}
	},
	{
		name: 'create_folder',
		description:
			'Create a new folder. Optionally nest it inside an existing folder. ' +
			'Returns the new folder ID which you can use with create_file.',
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'Name for the folder'
				},
				parent_folder_id: {
					type: 'string',
					description: 'Optional parent folder ID to nest this folder inside'
				}
			},
			required: ['name']
		}
	},
	{
		name: 'list_folders',
		description:
			'List all folders and their files. ' +
			'Use this to discover existing folders before creating files or to understand the current workspace.',
		input_schema: {
			type: 'object',
			properties: {},
			required: []
		}
	},
	{
		name: 'create_chat',
		description:
			'Create a new chat conversation. Returns the chat index and name.',
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'Optional name for the chat'
				}
			},
			required: []
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
	if (name === 'create_folder') {
		return { result: executeCreateFolder(input) };
	}
	if (name === 'list_folders') {
		return { result: executeListFolders() };
	}
	if (name === 'create_chat') {
		return { result: executeCreateChat(input) };
	}
	return { result: `Unknown tool: ${name}` };
}

function executeCreateFile(
	input: Record<string, unknown>,
	ctx: ToolContext
): string {
	const filename = input.filename as string;
	const content = input.content as string;
	const folderId = (input.folder_id as string | undefined) ?? ctx.folderId;
	const subfolder = input.subfolder as string | undefined;

	if (!filename || content === undefined) {
		return 'Error: filename and content are required';
	}

	if (!folderId) {
		return 'Error: no folder context — provide folder_id or open a document in a folder first';
	}

	let targetFolderId = folderId;

	if (subfolder) {
		const folder = documents.getFolder(folderId);
		if (!folder) return 'Error: parent folder not found';

		const sub = folder.folders?.find((f) => f.name === subfolder);
		if (!sub) {
			const subId = documents.createFolder(folderId);
			documents.renameFolder(subId, subfolder);
			targetFolderId = subId;
		} else {
			targetFolderId = sub.id;
		}
	}

	const result = documents.createDocument(targetFolderId);
	if (!result) return `Error: could not create file "${filename}"`;

	const renameResult = documents.renameDocument(targetFolderId, result.fileId, filename);
	documents.updateOpenDocumentContent(targetFolderId, result.fileId, content);

	const actualName = renameResult.result ?? filename;
	const path = subfolder ? `${subfolder}/${actualName}` : actualName;
	if (actualName !== filename) {
		return `Created "${path}" (note: renamed from "${filename}" because that name was already taken — use "${path}" in your markdown reference)`;
	}
	return `Created "${path}"`;
}

function executeCreateFolder(input: Record<string, unknown>): string {
	const name = input.name as string;
	const parentFolderId = input.parent_folder_id as string | undefined;

	if (!name) {
		return 'Error: name is required';
	}

	const folderId = documents.createFolder(parentFolderId);
	documents.renameFolder(folderId, name);

	return `Created folder "${name}" (id: ${folderId})`;
}

function executeListFolders(): string {
	const folders = documents.getState().folders;
	if (folders.length === 0) {
		return 'No folders exist yet.';
	}

	function describeFolder(folder: domain.documents.Folder, indent: number): string {
		const prefix = '  '.repeat(indent);
		const files = folder.files ?? [];
		const fileList =
			files.length > 0
				? files.map((f) => `${prefix}  - ${f.name}`).join('\n')
				: `${prefix}  (empty)`;
		let result = `${prefix}📁 ${folder.name} (id: ${folder.id})\n${fileList}`;
		for (const sub of folder.folders ?? []) {
			result += '\n' + describeFolder(sub, indent + 1);
		}
		return result;
	}

	return folders.map((f) => describeFolder(f, 0)).join('\n\n');
}

function executeCreateChat(input: Record<string, unknown>): string {
	const name = input.name as string | undefined;
	const index = chat.createChat();
	if (name) {
		chat.renameChat(index, name);
	}
	const chats = chat.getChats();
	return `Created chat "${chats[index].name}" (index: ${index})`;
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
		'You are an assistant that can edit documents, create files, manage folders, and create chats.',
		'When editing a document, your text response becomes the new document content.',
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
		'WORKSPACE MANAGEMENT:',
		'You can create folders, files, and chats using the available tools.',
		'- Use list_folders to see existing folders and files before creating new ones.',
		'- Use create_folder to create a new folder, then use its returned ID with create_file.',
		'- Use create_file to create documents (.md) or SVGs (.svg) inside a folder.',
		'- Use create_chat to create new chat conversations.',
		'- When creating multiple files in a new folder, create the folder first, then create files using the folder ID.',
		'',
		'CREATING SVG DIAGRAMS:',
		'When the user asks for a diagram, chart, visual, or SVG, you MUST use the create_file tool. Do NOT write SVG markup inline in the document.',
		'1. Call the create_file tool with the SVG content, a descriptive filename, and subfolder "svg".',
		'2. Then in your text response (the updated document), insert a markdown image reference: ![description](svg/filename.svg)',
		'3. You MUST actually call the create_file tool — do not just write a reference to a file that does not exist.',
		'',
		'SVG DESIGN STANDARDS — follow these rules precisely:',
		'',
		'Layout & structure:',
		'- Use width="100%" with a viewBox for responsive sizing',
		'- Use generous whitespace — padding of 40+ px around content, 20-40px between elements',
		'- Center the diagram horizontally. Vertical flow top-to-bottom is the default.',
		'- Group related elements with <g> tags',
		'',
		'Color palette — use soft, muted fills with slightly darker borders. Examples:',
		'- Purple/primary: fill="rgb(238,237,254)" stroke="rgb(83,74,183)" text="rgb(60,52,137)"',
		'- Green/query: fill="rgb(225,245,238)" stroke="rgb(15,110,86)" text="rgb(8,80,65)"',
		'- Orange/key: fill="rgb(250,236,231)" stroke="rgb(153,60,29)" text="rgb(113,43,19)"',
		'- Amber/value: fill="rgb(250,238,218)" stroke="rgb(133,79,11)" text="rgb(99,56,6)"',
		'- Blue/process: fill="rgb(230,241,251)" stroke="rgb(24,95,165)" text="rgb(12,68,124)"',
		'- Lime/weight: fill="rgb(234,243,222)" stroke="rgb(59,109,17)" text="rgb(39,80,10)"',
		'Use semantic colors: same color for same concept throughout the diagram.',
		'',
		'Shapes & nodes:',
		'- Rounded rectangles (rx="6" to rx="10") with thin borders (stroke-width="0.5")',
		'- Prominent nodes: slightly thicker border (stroke-width="1" to "1.5")',
		'- Minimum node size: 52×36 for small labels, 100×40 for medium, 200×48 for prominent',
		'',
		'Typography:',
		'- Font: system sans-serif stack — -apple-system, "system-ui", "Segoe UI", sans-serif',
		'- Labels inside nodes: 14px, font-weight 500, text-anchor="middle", dominant-baseline="central"',
		'- Annotations/captions: 12px, opacity 0.5-0.6, muted gray (rgb(61,61,58))',
		'- Use text-anchor="middle" for all centered text',
		'',
		'Connections:',
		'- Arrows: use <marker> with an open arrowhead (no filled triangles), stroke 1.5px, gray (rgb(115,114,108))',
		'- Dashed lines for indirect relationships: stroke-dasharray="3 3", stroke-width 0.5',
		'- Grouping lines: subtle, 0.5px, opacity 0.4',
		'',
		'NEVER:',
		'- Use black fills or heavy borders',
		'- Use bright saturated colors (pure red, blue, green)',
		'- Leave shapes without rounded corners',
		'- Use tiny text (below 11px) or giant text (above 16px)',
		'- Create diagrams smaller than 400px wide',
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
