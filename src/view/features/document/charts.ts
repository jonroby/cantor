import Plotly from 'plotly.js-dist-min';
import functionPlot from 'function-plot';

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
			const fns = (config.data ?? [])
				.map((d: { fn?: string }) => d.fn)
				.filter(Boolean);
			if (fns.length > 0) {
				const katexHtml = fns
					.map((fn: string) => {
						const tex = `y = ${fn.replace(
							/\b(log|ln|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|exp|sqrt|abs|min|max)\b/g,
							'\\$1'
						)}`;
						return renderKatex(tex, true);
					})
					.join('');
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
function mountPlotlyCharts(container: HTMLElement): void {
	const els = container.querySelectorAll('.plotly-chart[data-plotly-config]');
	for (const el of els) {
		if (el.children.length > 0) continue;
		try {
			const config = JSON.parse(
				decodeURIComponent(el.getAttribute('data-plotly-config')!)
			);
			Plotly.newPlot(
				el as HTMLDivElement,
				config.data ?? [],
				config.layout ?? {},
				{ responsive: true }
			);
		} catch {
			el.textContent = 'Invalid plotly config';
		}
	}
}

/** Mount function-plot charts on placeholder elements inside a container. */
function mountFunctionPlotCharts(container: HTMLElement): void {
	const els = container.querySelectorAll(
		'.function-plot-chart[data-fplot-config]'
	);
	for (const el of els) {
		if (el.children.length > 0) continue;
		try {
			const config = JSON.parse(
				decodeURIComponent(el.getAttribute('data-fplot-config')!)
			);
			const { xAxis, yAxis, ...rest } = config;

			const tooltip = document.createElement('div');
			tooltip.className = 'fplot-tooltip';
			tooltip.style.display = 'none';
			(el as HTMLElement).style.position = 'relative';
			el.appendChild(tooltip);

			const data = (rest.data ?? []).map(
				(d: Record<string, unknown>) => ({
					graphType: 'polyline',
					sampler: 'builtIn',
					nSamples: 2000,
					...d
				})
			);

			const parentWidth =
				el.closest('.docs-content-inner')?.clientWidth ?? 600;
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
						if (t.textContent?.trim() === '0')
							(t as SVGElement).style.display = 'none';
					});
				};
				fixGrid();
				chart.on('all:zoom', () => requestAnimationFrame(fixGrid));

				svg.addEventListener('mousemove', () => {
					const innerTip = el.querySelector(
						'.inner-tip'
					) as HTMLElement | null;
					if (
						!innerTip ||
						innerTip.style.display === 'none'
					) {
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
		} catch {
			el.textContent = 'Invalid plot config';
		}
	}
}

/** Mount all chart types (Plotly + function-plot) inside a container. */
export function mountCharts(container: HTMLElement): void {
	mountPlotlyCharts(container);
	mountFunctionPlotCharts(container);
}
