import { mount } from 'svelte';
import 'katex/dist/katex.min.css';
import './css/index.css';
import './css/layout.css';
import './css/function-plot.css';
import App from './components/app/App.svelte';

const app = mount(App, {
	target: document.getElementById('app')!
});

export default app;
