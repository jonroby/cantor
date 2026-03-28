import { mount } from 'svelte';
import 'katex/dist/katex.min.css';
import './css/index.css';
import './css/layout.css';
import App from './App.svelte';

const app = mount(App, {
	target: document.getElementById('app')!
});

export default app;
