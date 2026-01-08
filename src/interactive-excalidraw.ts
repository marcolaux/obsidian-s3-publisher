import { CSS_VARIABLES, SCOPED_MARKDOWN_STYLES } from "./styles";

/**
 * Generates the HTML/JS for an interactive Excalidraw viewer.
 * @param svg - The SVG string to render.
 * @param id - A unique ID for this instance (to scope variables/DOM).
 * @param width - The intrinsic width of the drawing.
 * @param height - The intrinsic height of the drawing.
 * @param isEmbed - If true, generates a div container with resize capability. If false, generates a full HTML document.
 * @param title - Title for the full page (ignored if isEmbed).
 */
export function generateInteractiveExcalidrawWrapper(
	svg: string,
	id: string,
	width: number,
	height: number,
	isEmbed: boolean,
	title: string = "Excalidraw"
): string {
	const containerId = `excalidraw-wrapper-${id}`;
	const worldId = `excalidraw-world-${id}`;
	const containerClass = `excalidraw-wrapper-${id}`;
	const worldClass = `excalidraw-world-${id}`;

	// CSS for the controls and wrapper
	const styles = `
.${containerClass} { width: 100%; height: ${isEmbed ? "600px" : "100%"}; ${
		isEmbed
			? "resize: vertical; overflow: hidden; border: 1px solid var(--background-modifier-border); border-radius: 8px;"
			: "overflow: hidden;"
	} background-color: var(--canvas-bg); cursor: grab; position: relative; margin-bottom: ${
		isEmbed ? "1em" : "0"
	}; }
.${containerClass}:active { cursor: grabbing; }
.${worldClass} { position: absolute; transform-origin: 0 0; background-color: var(--world-bg); box-shadow: 0 0 20px var(--node-shadow); }
/* Controls scoped to this instance */
.excalidraw-controls-${id} { position: absolute; bottom: 20px; right: 20px; z-index: 10; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.excalidraw-controls-${id} button { pointer-events: auto; width: 36px; height: 36px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--interactive-normal); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s ease; }
.excalidraw-controls-${id} button:hover { background: var(--interactive-hover); color: var(--text-normal); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.excalidraw-controls-${id} button svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }
`;

	const controlsHtml = `<div class="excalidraw-controls-${id}"><button onclick="window.excalidraw_${id}.zoom(1.1)" title="Zoom In"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button><button onclick="window.excalidraw_${id}.zoom(0.9)" title="Zoom Out"><svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button><button onclick="window.excalidraw_${id}.reset()" title="Reset View"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg></button></div>`;

	const script = `
(function() {
	const wrapper = document.getElementById('${containerId}');
	const world = document.getElementById('${worldId}');
	let scale = 1, pX = 0, pY = 0, isDragging = false, startX = 0, startY = 0;
	function updateTransform() { world.style.transform = \`translate(\${pX}px, \${pY}px) scale(\${scale})\`; }
	function init() {
		const wrapperW = wrapper.clientWidth, wrapperH = wrapper.clientHeight;
		const contentW = ${width}, contentH = ${height};
		const paddingRatio = 0.95;
		scale = (contentW > wrapperW || contentH > wrapperH) ? Math.min(wrapperW / contentW, wrapperH / contentH) * paddingRatio : 1;
		pX = (wrapperW - contentW * scale) / 2;
		pY = (wrapperH - contentH * scale) / 2;
		updateTransform();
	}
	const observer = new ResizeObserver(() => { if (scale === 1 && pX === 0 && pY === 0) init(); });
	observer.observe(wrapper);
	setTimeout(init, 0);
	wrapper.addEventListener('wheel', (e) => {
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
	wrapper.addEventListener('mousedown', (e) => {
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
	window.addEventListener('mouseup', () => { isDragging = false; wrapper.style.cursor = 'grab'; });
	window.excalidraw_${id} = {
		zoom: (factor) => { scale *= factor; updateTransform(); },
		reset: () => { init(); }
	};
})();
`;

	const content = `<style>${styles}</style><div id="${containerId}" class="${containerClass}"><div id="${worldId}" class="${worldClass}" style="width: ${width}px; height: ${height}px;">${svg}</div>${controlsHtml}</div><script>${script}</script>`;

	if (isEmbed) {
		return content; // Just the div and script
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
		body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: var(--canvas-bg); }
	</style>
</head>
<body>
	${content}
</body>
</html>`;
	}
}
