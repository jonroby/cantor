import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';

export type Message = domain.tree.Message;

export function getState() {
	return state.agent.agentState;
}

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
		'You have access to the chat history above for context.',
		'Respond with the COMPLETE updated document content. Do NOT wrap it in code fences or backticks.',
		'Do NOT add any preamble, explanation, or commentary — your entire response becomes the document.',
		'',
		'You can embed mathematical plots using ```plot blocks with JSON configuration:',
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
	deps: SubmitDeps = defaultDeps
): Promise<void> {
	const messages = buildMessages(prompt, documentContent, chatTree);
	state.agent.pushMessage({ role: 'user', content: prompt });
	state.agent.setStreaming(true);

	const abort = new AbortController();
	currentAbort = abort;

	let responseText = '';
	try {
		const stream = deps.getProviderStream(model, messages, abort.signal, {
			apiKey: state.providers.providerState.apiKeys[model.provider] ?? '',
			ollamaUrl: state.providers.providerState.ollamaUrl
		});
		for await (const chunk of stream) {
			if (chunk.type === 'delta') {
				responseText += chunk.delta;
			}
		}
		state.agent.pushMessage({ role: 'assistant', content: responseText });
		state.agent.setPendingContent(responseText);
	} catch (e) {
		if (abort.signal.aborted) return;
		throw e;
	} finally {
		state.agent.setStreaming(false);
		currentAbort = null;
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

export function reset() {
	stop();
	state.agent.reset();
}
