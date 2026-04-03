import claudeLogo from './claude.svg';
import deepseekLogo from './deepseek.svg';
import geminiLogo from './gemini-color.svg';
import gptOssLogo from './gpt-oss.svg';
import metaLogo from './meta.svg';
import mistralLogo from './mistral-color.svg';
import moonshotLogo from './moonshot.svg';
import ollamaLogo from './ollama.svg';
import qwenLogo from './qwen.svg';
import webllmLogo from './web-llm.jpeg';

export const PROVIDER_LOGOS: Record<string, string> = {
	claude: claudeLogo,
	openai: gptOssLogo,
	gemini: geminiLogo,
	moonshot: moonshotLogo,
	qwen: qwenLogo,
	deepseek: deepseekLogo,
	mistral: mistralLogo,
	groq: metaLogo,
	ollama: ollamaLogo,
	webllm: webllmLogo
};
