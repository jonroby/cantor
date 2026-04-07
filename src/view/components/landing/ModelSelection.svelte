<script lang="ts">
	import { PROVIDER_LOGOS } from '../../assets/provider-logos';

	let activeTab = $state(0);
	const tabs = ['Frontier', 'Ollama', 'WebLLM'];

	const frontierProviders = [
		{
			id: 'claude',
			name: 'CLAUDE',
			models: ['Claude Opus 4.6', 'Claude Sonnet 4.6', 'Claude Haiku 4.5'],
		},
		{
			id: 'openai',
			name: 'OPENAI',
			models: ['ChatGPT 5.4', 'ChatGPT 5.4 mini', 'ChatGPT 5.4 nano', 'OpenAI o3', 'OpenAI o4 mini', 'ChatGPT 4o'],
		},
		{
			id: 'gemini',
			name: 'GEMINI',
			models: ['Gemini 3.1 Pro', 'Gemini 3 Pro', 'Gemini 3 Flash', 'Gemini 3.1 Flash-Lite', 'Gemini 2.5 Pro', 'Gemini 2.5 Flash'],
		},
		{
			id: 'deepseek',
			name: 'DEEPSEEK',
			models: ['DeepSeek Chat V3.2', 'DeepSeek Reasoner V3.2'],
		},
		{
			id: 'mistral',
			name: 'MISTRAL',
			models: ['Mistral Large 3', 'Mistral Small 4', 'Mistral Medium 3.1', 'Codestral', 'Magistral Medium', 'Magistral Small'],
		},
		{
			id: 'moonshot',
			name: 'KIMI',
			models: ['Kimi K2', 'Kimi K2 Thinking', 'Moonshot v1 8k', 'Moonshot v1 32k'],
		},
		{
			id: 'qwen',
			name: 'QWEN',
			models: ['Qwen Max', 'Qwen Plus', 'Qwen Turbo', 'Qwen 2.5 72B Instruct'],
		},
		{
			id: 'groq',
			name: 'LLAMA',
			models: ['Llama 3.3 70B', 'Llama 3.1 70B', 'Llama 3.1 8B', 'Llama 3 70B'],
		},
	];

	const ollamaModels = [
		'gemma4:latest',
		'gemma2:9b',
		'deepseek-r1:8b',
		'qwen3:1.7b',
		'qwen3:0.6b',
		'qwen2.5-coder:7b-instruct-q8_0',
		'qwen2.5-coder:14b',
		'gemma3:4b',
		'llama3.2:1b',
		'mistral:7b-instruct-v0.2-q6_K',
		'llama3:latest',
	];

	const webllmModels = [
		{ name: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',       size: '1.1GB' },
		{ name: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',       size: '879.04MB' },
		{ name: 'Llama-3.2-1B-Instruct-q0f16-MLC',         size: '2.5GB' },
		{ name: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',       size: '2.9GB' },
		{ name: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',       size: '2.2GB' },
		{ name: 'Llama-3.1-8B-Instruct-q4f32_1-MLC-1k',    size: '5.2GB' },
		{ name: 'Llama-3.1-8B-Instruct-q4f16_1-MLC-1k',    size: '4.5GB' },
		{ name: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',       size: '6.0GB' },
		{ name: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',       size: '4.9GB' },
		{ name: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC', size: '5.8GB' },
		{ name: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC', size: '5.0GB' },
		{ name: 'DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC',size: '5.8GB' },
		{ name: 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC',size: '4.9GB' },
		{ name: 'Hermes-2-Theta-Llama-3-8B-q4f32_1-MLC',   size: '5.9GB' },
		{ name: 'Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC',   size: '4.9GB' },
		{ name: 'Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC',     size: '5.9GB' },
		{ name: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',     size: '4.9GB' },
		{ name: 'Hermes-3-Llama-3.2-3B-q4f32_1-MLC',       size: '2.9GB' },
		{ name: 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC',       size: '2.2GB' },
		{ name: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',       size: '5.6GB' },
	];

	let ollamaSearch = $state('');
	let webllmSearch = $state('');
	let webllmContext = $state('4K');
	const contextOptions = ['4K', '8K', '16K', 'Low memory'];

	const filteredOllama = $derived(
		ollamaSearch
			? ollamaModels.filter(m => m.toLowerCase().includes(ollamaSearch.toLowerCase()))
			: ollamaModels
	);

	const filteredWebllm = $derived(
		webllmSearch
			? webllmModels.filter(m => m.name.toLowerCase().includes(webllmSearch.toLowerCase()))
			: webllmModels
	);
</script>

<div class="model-selection">

	<!-- Tab bar -->
	<div class="tab-row">
		{#each tabs as label, i}
			<button class="tab" class:tab-active={activeTab === i} onclick={() => activeTab = i}>
				{label}
			</button>
		{/each}
	</div>

	<!-- Frontier -->
	{#if activeTab === 0}
		<div class="provider-grid">
			{#each frontierProviders as p}
				<div class="provider-card">
					<div class="provider-header">
						<img src={PROVIDER_LOGOS[p.id]} alt={p.name} class="provider-logo" />
						<span class="provider-name">{p.name}</span>
					</div>
					<div class="model-list">
						{#each p.models as model}
							<div class="model-item">{model}</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Ollama -->
	{#if activeTab === 1}
		<div class="single-card-wrap">
			<div class="provider-card single-card">
				<div class="provider-header">
					<img src={PROVIDER_LOGOS['ollama']} alt="Ollama" class="provider-logo" />
					<span class="provider-name">OLLAMA</span>
				</div>
				<input
					class="search-bar"
					type="text"
					placeholder="Search models..."
					bind:value={ollamaSearch}
				/>
				<div class="ollama-model-list">
					{#each filteredOllama as model}
						<div class="ollama-model-item">{model}</div>
					{/each}
					{#if filteredOllama.length === 0}
						<div class="no-results">No models match "{ollamaSearch}"</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- WebLLM -->
	{#if activeTab === 2}
		<div class="single-card-wrap">
			<div class="provider-card single-card">
				<div class="provider-header">
					<img src={PROVIDER_LOGOS['webllm']} alt="WebLLM" class="provider-logo" />
					<span class="provider-name">WEBLLM</span>
				</div>
				<div class="context-row">
					<span class="context-label">Context window:</span>
					{#each contextOptions as opt}
						<button
							class="context-btn"
							class:context-btn-active={webllmContext === opt}
							onclick={() => webllmContext = opt}
						>{opt}</button>
					{/each}
				</div>
				<input
					class="search-bar"
					type="text"
					placeholder="Search models (e.g. Llama, Phi, Qwen, SmolLM...)"
					bind:value={webllmSearch}
				/>
				<div class="webllm-grid">
					{#each filteredWebllm as m}
						<div class="webllm-row">
							<span class="webllm-name">{m.name}</span>
							<span class="webllm-size">{m.size}</span>
						</div>
					{/each}
					{#if filteredWebllm.length === 0}
						<div class="no-results" style="grid-column: span 2">No models match "{webllmSearch}"</div>
					{/if}
				</div>
				<div class="webllm-footer">139 models available.</div>
			</div>
		</div>
	{/if}

</div>

<style>
	.model-selection {
		width: 100%;
		height: 100%;
		background: white;
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		font-family: Inter, system-ui, sans-serif;
		overflow: hidden;
	}

	/* ── Tabs ─────────────────────────────────────────────── */
	.tab-row {
		display: flex;
		border-bottom: 1px solid hsl(0 0% 91%);
		flex-shrink: 0;
	}

	.tab {
		flex: 1;
		padding: 12px 0;
		border: none;
		background: transparent;
		font-size: 13px;
		font-weight: 500;
		color: rgba(23,23,23,0.45);
		cursor: pointer;
		font-family: inherit;
		position: relative;
		transition: color 0.15s;
	}

	.tab:hover { color: rgba(23,23,23,0.75); }

	.tab-active {
		color: rgba(23,23,23,0.9);
		font-weight: 600;
	}

	.tab-active::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		height: 2px;
		background: hsl(0 0% 9%);
		border-radius: 999px 999px 0 0;
	}

	/* ── Shared ───────────────────────────────────────────── */
	.provider-logo {
		width: 16px;
		height: 16px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.provider-name {
		font-size: 11px;
		font-weight: 700;
		color: rgba(23,23,23,0.75);
		letter-spacing: 0.05em;
	}

	.search-bar {
		width: 100%;
		padding: 7px 10px;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 6px;
		font-size: 12.5px;
		color: rgba(23,23,23,0.7);
		background: white;
		font-family: inherit;
		box-sizing: border-box;
		outline: none;
		margin-bottom: 0;
		flex-shrink: 0;
	}

	.search-bar::placeholder { color: rgba(23,23,23,0.3); }
	.search-bar:focus { border-color: hsl(0 0% 70%); }

	.no-results {
		padding: 12px 16px;
		font-size: 12.5px;
		color: rgba(23,23,23,0.35);
	}

	/* ── Frontier grid ────────────────────────────────────── */
	.provider-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 10px;
		overflow-y: auto;
		flex: 1;
	}

	.provider-card {
		border: 1px solid hsl(0 0% 91%);
		border-radius: 10px;
		padding: 12px 14px;
	}

	.provider-header {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-bottom: 9px;
	}

	.model-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.model-item {
		font-size: 12.5px;
		color: rgba(23,23,23,0.45);
		line-height: 1.5;
	}

	/* ── Single-card layout (Ollama + WebLLM) ────────────── */
	.single-card-wrap {
		padding: 10px;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.single-card {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.ollama-model-list {
		flex: 1;
		overflow-y: auto;
		margin: 4px -14px 0;
	}

	.ollama-model-item {
		padding: 7px 14px;
		font-size: 13px;
		color: rgba(23,23,23,0.7);
	}

	/* ── WebLLM ───────────────────────────────────────────── */
	.context-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}

	.context-label {
		font-size: 12px;
		color: rgba(23,23,23,0.45);
		margin-right: 2px;
	}

	.context-btn {
		padding: 3px 9px;
		border: 1px solid hsl(0 0% 85%);
		border-radius: 5px;
		background: white;
		font-size: 12px;
		color: rgba(23,23,23,0.55);
		cursor: pointer;
		font-family: inherit;
	}

	.context-btn-active {
		background: hsl(0 0% 18%);
		border-color: hsl(0 0% 18%);
		color: white;
	}

	.webllm-grid {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 1fr;
		column-gap: 24px;
		overflow-y: auto;
		align-content: start;
		margin: 4px -14px 0;
		padding: 0 14px;
	}

	.webllm-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 5px 0;
		border-bottom: 1px solid hsl(0 0% 94%);
		gap: 12px;
	}

	.webllm-name {
		font-size: 11.5px;
		color: rgba(23,23,23,0.6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.webllm-size {
		font-size: 11.5px;
		color: rgba(23,23,23,0.35);
		flex-shrink: 0;
	}

	.webllm-footer {
		padding: 8px 0 2px;
		font-size: 12px;
		color: rgba(23,23,23,0.3);
		flex-shrink: 0;
	}
</style>
