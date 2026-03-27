export type Route = 'chat' | 'canvas';

function parseHash(hash: string): Route {
	return hash === '#/canvas' ? 'canvas' : 'chat';
}

export const routerState = $state({
	route: parseHash(window.location.hash) as Route
});

window.addEventListener('hashchange', () => {
	routerState.route = parseHash(window.location.hash);
});

export function navigate(route: Route) {
	window.location.hash = route === 'canvas' ? '#/canvas' : '#/';
}
