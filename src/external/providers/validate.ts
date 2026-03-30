import type * as domain from '@/domain';
import * as catalog from './catalog';

export async function validateApiKey(
	provider: domain.models.KeyBasedProvider,
	apiKey: string
): Promise<void> {
	if (provider === 'claude') return validateClaude(apiKey);
	if (provider === 'gemini') return validateGemini(apiKey);
	return validateOpenAICompat(provider, apiKey);
}

async function validateClaude(apiKey: string): Promise<void> {
	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model: 'claude-haiku-4-5',
			max_tokens: 1,
			messages: [{ role: 'user', content: 'hi' }]
		})
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(parseErrorMessage(text, response.status));
	}
}

async function validateGemini(apiKey: string): Promise<void> {
	const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
	const response = await fetch(url);
	if (!response.ok) {
		const text = await response.text();
		throw new Error(parseErrorMessage(text, response.status));
	}
}

async function validateOpenAICompat(
	provider: domain.models.KeyBasedProvider,
	apiKey: string
): Promise<void> {
	const config = catalog.PROVIDER_CONFIG[provider];
	const baseOrigin = new URL(config.baseUrl).origin;
	const modelsUrl = `${baseOrigin}/v1/models`;

	const response = await fetch(modelsUrl, {
		headers: { Authorization: `Bearer ${apiKey}` }
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(parseErrorMessage(text, response.status));
	}
}

function parseErrorMessage(body: string, status: number): string {
	try {
		const parsed = JSON.parse(body) as { error?: { message?: string } };
		if (parsed.error?.message) return parsed.error.message;
	} catch {
		// not JSON
	}
	if (status === 401) return 'Invalid API key.';
	if (status === 403) return 'Access denied. Check your API key permissions.';
	return `Validation failed (${status}).`;
}
