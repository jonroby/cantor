// Lazy-loaded to avoid crashing in test environments (jsdom)
const loadPlotly = () => import('plotly.js-dist-min').then((m) => m.default);
const loadFunctionPlot = () => import('function-plot').then((m) => m.default);

/**
 * Preprocess markdown: replace ```plotly and ```plot code blocks with placeholder HTML.
 * `renderKatex` is passed in to avoid importing katex here.
 */
export function preprocessChartBlocks(
	md: string,
	renderKatex: (tex: string, displayMode: boolean) => string
): string {
	// ```plotly code blocks
	md = md.replace(/```plotly\s*\n([\s\S]*?)```/g, (_match, json: string, offset: number) => {
		const id = `plotly-${offset}`;
		return `<div class="plotly-chart" data-plotly-id="${id}" data-plotly-config="${encodeURIComponent(json.trim())}"></div>`;
	});

	// ```plot code blocks (function-plot)
	md = md.replace(/```plot\s*\n([\s\S]*?)```/g, (_match, json: string, offset: number) => {
		const id = `fplot-${offset}`;
		let caption = '';
		try {
			const config = JSON.parse(json.trim());
			const texExprs: string[] = [];
			for (const d of config.data ?? []) {
				const escapeMath = (s: string) =>
					s.replace(
						/\b(log|ln|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|exp|sqrt|abs|min|max)\b/g,
						'\\$1'
					);
				if (d.fnType === 'implicit' && d.fn) {
					texExprs.push(`${escapeMath(d.fn)} = 0`);
				} else if (d.fnType === 'polar' && d.r) {
					texExprs.push(`r = ${escapeMath(d.r)}`);
				} else if (d.fnType === 'parametric' && d.x && d.y) {
					texExprs.push(`x = ${escapeMath(d.x)},\\; y = ${escapeMath(d.y)}`);
				} else if (d.fn) {
					texExprs.push(`y = ${escapeMath(d.fn)}`);
				}
			}
			if (texExprs.length > 0) {
				const katexHtml = texExprs.map((tex: string) => renderKatex(tex, true)).join('');
				caption = `<div class="fplot-caption">${katexHtml}</div>`;
			}
		} catch {
			/* ignore — chart render will handle errors */
		}
		return `<div class="function-plot-wrap"><div class="function-plot-chart" data-fplot-id="${id}" data-fplot-config="${encodeURIComponent(json.trim())}"></div>${caption}</div>`;
	});

	return md;
}

/** Mount Plotly charts on placeholder elements inside a container. */
async function mountPlotlyCharts(container: HTMLElement): Promise<void> {
	const els = container.querySelectorAll('.plotly-chart[data-plotly-config]');
	if (els.length === 0) return;
	const Plotly = await loadPlotly();
	for (const el of els) {
		if (el.children.length > 0) continue;
		try {
			const config = JSON.parse(decodeURIComponent(el.getAttribute('data-plotly-config')!));
			Plotly.newPlot(el as HTMLDivElement, config.data ?? [], config.layout ?? {}, {
				responsive: true
			});
		} catch {
			el.textContent = 'Invalid plotly config';
		}
	}
}

/** Mount function-plot charts on placeholder elements inside a container. */
async function mountFunctionPlotCharts(container: HTMLElement): Promise<void> {
	const els = container.querySelectorAll('.function-plot-chart[data-fplot-config]');
	if (els.length === 0) return;
	const functionPlot = await loadFunctionPlot();
	for (const el of els) {
		if (el.children.length > 0) continue;
		try {
			const config = JSON.parse(decodeURIComponent(el.getAttribute('data-fplot-config')!));
			const { xAxis, yAxis, ...rest } = config;

			const tooltip = document.createElement('div');
			tooltip.className = 'fplot-tooltip';
			tooltip.style.display = 'none';
			(el as HTMLElement).style.position = 'relative';
			el.appendChild(tooltip);

			const data = (rest.data ?? []).map((d: Record<string, unknown>) => {
				const isImplicit = d.fnType === 'implicit';
				return {
					...(!isImplicit ? { graphType: 'polyline', sampler: 'builtIn', nSamples: 2000 } : {}),
					...d
				};
			});

			const parentWidth = el.closest('.docs-content-inner')?.clientWidth ?? 600;
			const size = Math.round(parentWidth * 0.5);

			const chart = functionPlot({
				target: el as HTMLDivElement,
				width: size + 60,
				height: size + 40,
				tip: {
					renderer: (x: number, y: number) => {
						tooltip.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}`;
						return `${x.toFixed(2)}, ${y.toFixed(2)}`;
					}
				},
				...rest,
				data,
				grid: true,
				xAxis: { position: 'sticky' as const, ...xAxis },
				yAxis: { position: 'sticky' as const, ...yAxis }
			});

			const svg = el.querySelector('svg');
			if (svg) {
				const fixGrid = () => {
					svg.querySelectorAll('.axis line').forEach((line) => {
						line.setAttribute('opacity', '0.4');
					});
					svg.querySelectorAll('.tick text').forEach((t) => {
						if (t.textContent?.trim() === '0') (t as SVGElement).style.display = 'none';
					});
				};
				fixGrid();
				chart.on('all:zoom', () => requestAnimationFrame(fixGrid));

				svg.addEventListener('mousemove', () => {
					const innerTip = el.querySelector('.inner-tip') as HTMLElement | null;
					if (!innerTip || innerTip.style.display === 'none') {
						tooltip.style.display = 'none';
						return;
					}
					const circle = innerTip.querySelector('circle');
					if (!circle) {
						tooltip.style.display = 'none';
						return;
					}
					const circleRect = circle.getBoundingClientRect();
					const elRect = el.getBoundingClientRect();
					tooltip.style.display = 'block';
					tooltip.style.left = `${circleRect.left - elRect.left + circleRect.width / 2}px`;
					tooltip.style.top = `${circleRect.top - elRect.top - 40}px`;
				});
				svg.addEventListener('mouseleave', () => {
					tooltip.style.display = 'none';
				});
			}
		} catch (e) {
			console.error('function-plot error:', e);
			el.textContent = `Invalid plot config: ${e instanceof Error ? e.message : String(e)}`;
		}
	}
}

/** Mount all chart types (Plotly + function-plot) inside a container. */
export async function mountCharts(container: HTMLElement): Promise<void> {
	await Promise.all([mountPlotlyCharts(container), mountFunctionPlotCharts(container)]);
}
