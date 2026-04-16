import { mount } from 'svelte';
import 'katex/dist/katex.min.css';
import './css/index.css';
import './css/layout.css';
import './css/function-plot.css';
import App from './components/app/App.svelte';
import * as appLayer from '@/app';

const app = mount(App, {
	target: document.getElementById('app')!
});

// Warm the embedding-library chunk in the background so the model is ready
// by the time the user selects the Embedding Similarity context strategy.
queueMicrotask(() => appLayer.providers.primeEmbeddingLib());

export default app;
