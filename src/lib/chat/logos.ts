import claudeLogo from '@/assets/claude.svg';
import deepseekLogo from '@/assets/deepseek.svg';
import geminiLogo from '@/assets/gemini-color.svg';
import gptOssLogo from '@/assets/gpt-oss.svg';
import metaLogo from '@/assets/meta.svg';
import mistralLogo from '@/assets/mistral-color.svg';
import moonshotLogo from '@/assets/moonshot.svg';
import ollamaLogo from '@/assets/ollama.svg';
import qwenLogo from '@/assets/qwen.svg';
import webllmLogo from '@/assets/web-llm.jpeg';

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
