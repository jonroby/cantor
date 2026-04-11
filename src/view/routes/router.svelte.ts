export type Route = 'chat' | 'canvas' | 'landing';

function parsePath(pathname: string): Route {
	if (pathname === '/canvas') return 'canvas';
	if (pathname === '/app') return 'chat';
	return 'landing';
}

export const routerState = $state({
	route: parsePath(window.location.pathname) as Route
});

window.addEventListener('popstate', () => {
	routerState.route = parsePath(window.location.pathname);
});

export function navigate(route: Route) {
	let path: string;
	if (route === 'canvas') path = '/canvas';
	else if (route === 'landing') path = '/';
	else path = '/app';

	window.history.pushState(null, '', path);
	routerState.route = route;
}
