export type Route = 'chat' | 'canvas' | 'landing';

function parseHash(hash: string): Route {
	if (hash === '#/canvas') return 'canvas';
	if (hash === '#/landing') return 'landing';
	return 'chat';
}

export const routerState = $state({
	route: parseHash(window.location.hash) as Route
});

window.addEventListener('hashchange', () => {
	routerState.route = parseHash(window.location.hash);
});

export function navigate(route: Route) {
	if (route === 'canvas') window.location.hash = '#/canvas';
	else if (route === 'landing') window.location.hash = '#/landing';
	else window.location.hash = '#/';
}
