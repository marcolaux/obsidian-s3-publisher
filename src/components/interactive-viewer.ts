import {
	CSS_VARIABLES,
	SCOPED_MARKDOWN_STYLES,
	EXCALIDRAW_STYLES,
} from "../styles";

export interface InteractiveViewerOptions {
	id: string;
	content: string; // The inner HTML (SVG or Canvas nodes/edges)
	width: number;
	height: number;
	isEmbed: boolean;
	title?: string;
	extraClass?: string; // e.g. 'excalidraw' or 'canvas-wrapper'
	extraStyles?: string; // specific CSS to inject
}

export function generateInteractiveWrapper(options: InteractiveViewerOptions): string {
	const {
		id,
		content,
		width,
		height,
		isEmbed,
		title = "Viewer",
		extraClass = "",
		extraStyles = "",
	} = options;

	const containerId = `${id}-wrapper`;
	const worldId = `${id}-world`;

	// Basic minification to remove newlines and extra spaces
	const minify = (str: string) =>
		str
			.replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
			.replace(/\s+/g, " ") // Collapse whitespace
			.replace(/\s*([{}:;,])\s*/g, "$1") // Remove space around separators
			.replace(/;}/g, "}") // Remove trailing semicolons
			.trim();

	const controlsHtml = `
		<div class="interactive-controls interactive-controls-${id}" ${isEmbed ? 'style="position: absolute; bottom: 10px; right: 10px; z-index: 10; display: flex; flex-direction: column; gap: 4px;"' : 'style="position: fixed; bottom: 20px; right: 20px; z-index: 1000; display: flex; flex-direction: column; gap: 8px; pointer-events: none;"'}>
			<button onclick="window['interactive_${id}'].zoom(1.1)" title="Zoom In" ${isEmbed ? 'style="width: 28px; height: 28px; cursor: pointer;"' : 'style="pointer-events: auto; width: 36px; height: 36px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--interactive-normal); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s ease;"'} onmouseover="this.style.background='var(--interactive-hover)'; this.style.color='var(--text-normal)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';" onmouseout="this.style.background='var(--interactive-normal)'; this.style.color='var(--text-muted)'; this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
				<svg viewBox="0 0 24 24" ${isEmbed ? 'style="width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2;"' : 'style="width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none;"'}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
			</button>
			<button onclick="window['interactive_${id}'].zoom(0.9)" title="Zoom Out" ${isEmbed ? 'style="width: 28px; height: 28px; cursor: pointer;"' : 'style="pointer-events: auto; width: 36px; height: 36px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--interactive-normal); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s ease;"'} onmouseover="this.style.background='var(--interactive-hover)'; this.style.color='var(--text-normal)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';" onmouseout="this.style.background='var(--interactive-normal)'; this.style.color='var(--text-muted)'; this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
				<svg viewBox="0 0 24 24" ${isEmbed ? 'style="width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2;"' : 'style="width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none;"'}><line x1="5" y1="12" x2="19" y2="12"></line></svg>
			</button>
			<button onclick="window['interactive_${id}'].reset()" title="Reset View" ${isEmbed ? 'style="width: 28px; height: 28px; cursor: pointer;"' : 'style="pointer-events: auto; width: 36px; height: 36px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--interactive-normal); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s ease;"'} onmouseover="this.style.background='var(--interactive-hover)'; this.style.color='var(--text-normal)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';" onmouseout="this.style.background='var(--interactive-normal)'; this.style.color='var(--text-muted)'; this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
				<svg viewBox="0 0 24 24" ${isEmbed ? 'style="width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2;"' : 'style="width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none;"'}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
			</button>
		</div>`;

	const script = minify(`
(function() {
	const wrapper = document.getElementById('${containerId}');
	const world = document.getElementById('${worldId}');
	let scale = 1, pX = 0, pY = 0, isDragging = false, startX = 0, startY = 0;
	function updateTransform() { if(world) world.style.transform = \`translate(\${pX}px, \${pY}px) scale(\${scale})\`; }
	function init() {
		if (!wrapper) return;
		const wrapperW = wrapper.clientWidth || 800, wrapperH = wrapper.clientHeight || 500;
		const contentW = ${width}, contentH = ${height};
		const paddingRatio = 0.95;
		scale = (contentW > wrapperW || contentH > wrapperH) ? Math.min(wrapperW / contentW, wrapperH / contentH) * paddingRatio : 1;
		pX = (wrapperW - contentW * scale) / 2;
		pY = (wrapperH - contentH * scale) / 2;
		updateTransform();
	}
	const observer = new ResizeObserver(() => { if (scale === 1 && pX === 0 && pY === 0) init(); });
	if(wrapper) observer.observe(wrapper);
	setTimeout(init, 0);
	if(wrapper) wrapper.addEventListener('wheel', (e) => {
		const contentNode = e.target.closest('.canvas-node-content');
		if (contentNode && contentNode.scrollHeight > contentNode.clientHeight) return;
		e.preventDefault();
		const delta = -e.deltaY * 0.001; 
		const newScale = Math.min(5, Math.max(0.1, scale * Math.exp(delta)));
		const rect = wrapper.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		pX = mouseX - (mouseX - pX) * (newScale / scale);
		pY = mouseY - (mouseY - pY) * (newScale / scale);
		scale = newScale;
		updateTransform();
	});
	if(wrapper) wrapper.addEventListener('mousedown', (e) => {
		if (e.button !== 0) return;
		isDragging = true;
		startX = e.clientX - pX;
		startY = e.clientY - pY;
		wrapper.style.cursor = 'grabbing';
	});
	window.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
		pX = e.clientX - startX;
		pY = e.clientY - startY;
		updateTransform();
	});
	window.addEventListener('mouseup', () => { isDragging = false; if(wrapper) wrapper.style.cursor = 'grab'; });
	window['interactive_${id}'] = {
		zoom: (factor) => { scale *= factor; updateTransform(); },
		reset: () => { init(); }
	};
})();
`);

	const containerStyle = isEmbed
		? `position: relative; width: 100%; height: 500px; overflow: hidden; border: 1px solid var(--embed-border, var(--background-modifier-border)); border-radius: 8px; background-color: var(--canvas-bg); cursor: grab; margin-bottom: 1em;`
		: `width: 100%; height: 100%; overflow: hidden; cursor: grab; position: relative;`;

	const worldStyle = `position: absolute; transform-origin: 0 0; background-color: var(--world-bg); box-shadow: 0 0 20px var(--node-shadow); width: ${width}px; height: ${height}px;`;

	const innerHtml = `
		<style>${minify(extraStyles)}</style>
		<div id="${containerId}" class="${extraClass}" style="${containerStyle}">
			<div id="${worldId}" style="${worldStyle}">
				${content}
			</div>
			${controlsHtml}
		</div>
		<script>${script}</script>
	`;

	if (isEmbed) {
		return innerHtml;
	} else {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	<style>
		${CSS_VARIABLES}
		${SCOPED_MARKDOWN_STYLES}
		${EXCALIDRAW_STYLES}
		body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: var(--canvas-bg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
		${minify(extraStyles)}
	</style>
</head>
<body>
	${innerHtml}
</body>
</html>`;
	}
}
