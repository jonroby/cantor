import { mount } from 'svelte';
import './index.css';
import './routes/layout.css';
import '@xyflow/svelte/dist/style.css';
import App from './App.svelte';

const app = mount(App, {
	target: document.getElementById('app')!
});

export default app;
