import { App, TFile } from "obsidian";
import { CSS_VARIABLES, SCOPED_MARKDOWN_STYLES } from "./styles";
import { MarkdownCompiler } from "./compiler";

export interface CanvasNode {
	id: string;
	type: "text" | "file" | "link" | "group";
	text?: string;
	file?: string;
	url?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
}

export interface CanvasEdge {
	id: string;
	fromNode: string;
	fromSide: "top" | "right" | "bottom" | "left";
	toNode: string;
	toSide: "top" | "right" | "bottom" | "left";
	label?: string;
	color?: string;
}

export interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

// Default Obsidian Canvas Colors
const CANVAS_COLORS: Record<string, string> = {
	"0": "#7e7e7e",
	"1": "#fb464c",
	"2": "#e9973f",
	"3": "#e0de71",
	"4": "#45cf6e",
	"5": "#53dfdd",
	"6": "#a881ff",
};

export class CanvasCompiler {
	app: App;
	markdownCompiler: MarkdownCompiler;

	constructor(app: App, markdownCompiler: MarkdownCompiler) {
		this.app = app;
		this.markdownCompiler = markdownCompiler;
	}

	escapeHtml(str: string): string {
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	getColor(colorCode?: string): string | undefined {
		if (!colorCode) return undefined;
		// Check if it's a known code
		if (CANVAS_COLORS[colorCode]) return CANVAS_COLORS[colorCode];
		// Ensure it's a valid hex if not a code (simple check)
		if (colorCode.startsWith("#")) return colorCode;
		return undefined; // fallback
	}

	async compile(
		file: TFile,
		content: string,
		publishedPaths?: Set<string>
	): Promise<string> {
		const data = JSON.parse(content) as CanvasData;
		if (!data.nodes || data.nodes.length === 0) return "<h1>Empty Canvas</h1>";

		const bounds = this.getBounds(data.nodes);
		const nodesHtml = await this.renderNodes(
			data.nodes,
			bounds,
			file,
			publishedPaths
		);
		const edgesHtml = this.renderEdges(data.edges, data.nodes, bounds);

		return this.wrapHtml(file.basename, nodesHtml, edgesHtml, bounds);
	}

	getBounds(nodes: CanvasNode[]) {
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		for (const node of nodes) {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
		}
		// Add some padding
		const padding = 100;
		return {
			minX: minX - padding,
			minY: minY - padding,
			width: maxX - minX + padding * 2,
			height: maxY - minY + padding * 2,
		};
	}

	async renderNodes(
		nodes: CanvasNode[],
		bounds: { minX: number; minY: number },
		canvasFile: TFile,
		publishedPaths?: Set<string>
	): Promise<string> {
		const promises = nodes.map(async (node) => {
			const left = node.x - bounds.minX;
			const top = node.y - bounds.minY;
			let style = `position: absolute; left: ${left}px; top: ${top}px; width: ${node.width}px; height: ${node.height}px;`;

			// Color Handling for Nodes
			const color = this.getColor(node.color);
			if (color) {
				// Apply background or border? Obsidian usually tints background or adds a colored border.
				// For 'text' nodes, it's often a background tint.
				// Let's use a subtle background tint and border.
				// We need to convert hex to rgba for transparency if possible, OR just use the solid color for border.
				style += `border: 2px solid ${color}; background-color: ${color}20;`; // 20 = approx 12% opacity
			}

			let content = "";
			let extraClass = "";

			switch (node.type) {
				case "text":
					if (node.text) {
						if (node.text) {
							// Pass the canvas file itself as context so relative links resolve relative to the canvas
							content = await this.markdownCompiler.render(
								canvasFile,
								node.text,
								publishedPaths || new Set()
							);
						}
					}
					extraClass = "canvas-node-text";
					break;
				case "file":
					if (node.file) {
						const file = this.app.metadataCache.getFirstLinkpathDest(
							node.file,
							""
						);
						if (file) {
							if (file.extension === "md") {
								let subContent = await this.app.vault.read(file);
								// Strip frontmatter so we can prepend title cleanly
								subContent = subContent.replace(
									/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/,
									""
								);
								subContent = `# ${file.basename}\n\n${subContent}`;

								subContent = `# ${file.basename}\n\n${subContent}`;

								content = await this.markdownCompiler.render(
									file,
									subContent,
									publishedPaths || new Set()
								);
								extraClass = "canvas-node-file canvas-node-file-md"; // Separate class for Markdown
							} else if (
								["png", "jpg", "jpeg", "gif", "webp"].includes(file.extension)
							) {
								content = `<img src="${this.escapeHtml(
									file.name
								)}" style="width:100%; height:100%; object-fit:cover;">`;
								extraClass = "canvas-node-file canvas-node-file-media";
							} else {
								content = `<a href="${this.escapeHtml(
									file.name
								)}">File: ${this.escapeHtml(file.name)}</a>`;
								extraClass = "canvas-node-file canvas-node-file-media";
							}
						} else {
							content = `File not found: ${this.escapeHtml(node.file)}`;
							extraClass = "canvas-node-file";
						}
					}
					// removing the default one below as we set it above specific cases
					break;
				case "link":
					content = `<a href="${this.escapeHtml(
						node.url || ""
					)}" target="_blank">${this.escapeHtml(node.url || "")}</a>`;
					extraClass = "canvas-node-link";
					break;
				case "group":
					extraClass = "canvas-node-group";
					// Groups often have background labels
					break;
			}

			return `<div class="canvas-node ${extraClass}" id="${node.id}" style="${style}">
                <div class="canvas-node-content">${content}</div>
            </div>`;
		});

		return (await Promise.all(promises)).join("\n");
	}

	renderEdges(
		edges: CanvasEdge[],
		nodes: CanvasNode[],
		bounds: { minX: number; minY: number }
	): string {
		// Basic SVG Edge rendering
		// We need node map to lookup coordinates
		if (!edges) return "";

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));
		const usedColors = new Set<string>();

		const paths = edges
			.map((edge) => {
				const from = nodeMap.get(edge.fromNode);
				const to = nodeMap.get(edge.toNode);
				if (!from || !to) return "";

				// Calculate start and end points relative to bounds
				// Simple logic: center of side
				const getPoint = (node: CanvasNode, side: string) => {
					const x = node.x - bounds.minX;
					const y = node.y - bounds.minY;
					switch (side) {
						case "top":
							return { x: x + node.width / 2, y: y };
						case "bottom":
							return { x: x + node.width / 2, y: y + node.height };
						case "left":
							return { x: x, y: y + node.height / 2 };
						case "right":
							return { x: x + node.width, y: y + node.height / 2 };
						default:
							return { x: x + node.width / 2, y: y + node.height / 2 };
					}
				};

				const start = getPoint(from, edge.fromSide);
				const end = getPoint(to, edge.toSide);

				// Bezier curve
				// Control points?
				// Calculate Control Points for Bezier Curve
				// We want smooth curves leaving the node perpendicular to the side

				const getControlPoint = (
					x: number,
					y: number,
					side: string,
					dist: number
				) => {
					switch (side) {
						case "top":
							return { x, y: y - dist };
						case "bottom":
							return { x, y: y + dist };
						case "left":
							return { x: x - dist, y };
						case "right":
							return { x: x + dist, y };
						default:
							return { x, y };
					}
				};

				// Euclidean distance
				const dist = Math.sqrt(
					Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
				);
				// Control point distance factor - usually 0.3 to 0.5 of the total distance works well
				// But for very close nodes, we might want a minimum
				// Obsidian Canvas seems to use a fairly generous curve.
				const cpDist = Math.max(dist * 0.4, 50);

				const cp1 = getControlPoint(start.x, start.y, edge.fromSide, cpDist);
				const cp2 = getControlPoint(end.x, end.y, edge.toSide, cpDist);

				const color = this.getColor(edge.color) || "#999";
				usedColors.add(color);

				const colorId = color.replace(/[^a-zA-Z0-9]/g, "");

				return `<path d="M ${start.x} ${start.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}" stroke="${color}" stroke-width="2" fill="none" marker-end="url(#arrowhead-${colorId})" />`;
				// Actually, straight line is safer for first pass
				// return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#999" stroke-width="2" marker-end="url(#arrowhead)" />`;
			})
			.join("\n");

		// Generate Markers for all used colors
		const markers = Array.from(usedColors)
			.map((color) => {
				const colorId = color.replace(/[^a-zA-Z0-9]/g, "");
				return `<marker id="arrowhead-${colorId}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="${color}" />
                </marker>`;
			})
			.join("\n");

		return `<svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
            <defs>
                ${markers}
            </defs>
            ${paths}
        </svg>`;
	}

	wrapHtml(
		title: string,
		nodesHtml: string,
		edgesHtml: string,
		bounds: { width: number; height: number }
	): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        ${CSS_VARIABLES}
        
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: var(--canvas-bg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        
        /* Canvas Specifics */
        .canvas-wrapper { width: 100%; height: 100%; overflow: hidden; cursor: grab; position: relative; }
        .canvas-wrapper:active { cursor: grabbing; }
        .canvas-world { position: absolute; transform-origin: 0 0; background-color: var(--world-bg); box-shadow: 0 0 20px var(--node-shadow); }
        
        .canvas-node { 
            position: absolute; 
            background: var(--node-bg); 
            border: 1px solid var(--node-border); 
            border-radius: 6px; 
            box-shadow: 0 2px 5px var(--node-shadow); 
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .canvas-node-content { 
            padding: 20px; 
            overflow-y: auto; 
            height: 100%; 
            box-sizing: border-box;
            line-height: 1.6;
            color: var(--text-color);
        }

        ${SCOPED_MARKDOWN_STYLES}
        
        /* Specific Node Overrides */
        .canvas-node-text .canvas-node-content {
             padding-top: 0;
             padding-bottom: 0;
        }
        
        .canvas-node-file-media .canvas-node-content {
            padding: 0;
            overflow: hidden; /* Ensure images don't overflow */
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Prevent dragging content directly */
        .canvas-node-content img {
            pointer-events: none;
            -webkit-user-drag: none;
            user-select: none;
        }
        
        .canvas-node-content {
            /* Existing padding is 20px, we override for text/file above specific cases if needed, 
               but user said "text nodes... should not have padding top and bottom"
               and "image nodes should not have a padding overall"
            */
        }

        /* Pan Zoom Controls */
        .controls { 
            position: fixed; 
            bottom: 20px; 
            right: 20px; 
            z-index: 1000; 
            display: flex; 
            flex-direction: column; 
            gap: 8px; 
            pointer-events: none; /* Let clicks pass through container */
        }
        .controls button { 
            pointer-events: auto;
            width: 36px; 
            height: 36px; 
            border-radius: 6px; 
            border: 1px solid var(--background-modifier-border); 
            background: var(--interactive-normal); 
            color: var(--text-muted);
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            padding: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
        }
        .controls button:hover {
            background: var(--interactive-hover);
            color: var(--text-normal);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .controls button svg {
            width: 20px; 
            height: 20px;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            fill: none;
        }
        
        @media (prefers-color-scheme: dark) {
            .controls button { 
                background: #2b2d31; /* Fallback if var not set */
                background: var(--interactive-normal);
                border-color: var(--background-modifier-border);
            }
        }
        
        .theme-dark .controls button, .theme--dark .controls button {
            background: var(--interactive-normal);
            border-color: var(--background-modifier-border);
        }
    </style>
</head>
<body>
    <div class="canvas-wrapper" id="canvas-wrapper">
        <div class="canvas-world" id="canvas-world" style="width: ${bounds.width}px; height: ${bounds.height}px;">
            ${edgesHtml}
            ${nodesHtml}
        </div>
    </div>
    <div class="controls">
        <button onclick="zoom(1.1)" title="Zoom In">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button onclick="zoom(0.9)" title="Zoom Out">
            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button onclick="reset()" title="Reset View">
            <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        </button>
    </div>
    <script>
        const wrapper = document.getElementById('canvas-wrapper');
        const world = document.getElementById('canvas-world');
        
        let scale = 1;
        let pX = 0;
        let pY = 0;
        
        let isDragging = false;
        let startX = 0;
        let startY = 0;

        function updateTransform() {
            world.style.transform = \`translate(\${pX}px, \${pY}px) scale(\${scale})\`;
        }

        // Center initially
        const wrapperW = wrapper.clientWidth;
        const wrapperH = wrapper.clientHeight;
        
        // Determine initial scale (fit to screen if larger, with padding)
        const paddingRatio = 0.95;
        if (${bounds.width} > wrapperW || ${bounds.height} > wrapperH) {
             scale = Math.min(wrapperW / ${bounds.width}, wrapperH / ${bounds.height}) * paddingRatio;
        } else {
             scale = 1;
        }
        
        // Calculate centered position based on the final scale
        // The world div has dimensions ${bounds.width} x ${bounds.height}
        // We want to center it within wrapperW x wrapperH
        // pX = (wrapperW - (worldW * scale)) / 2
        pX = (wrapperW - ${bounds.width} * scale) / 2;
        pY = (wrapperH - ${bounds.height} * scale) / 2;

        updateTransform();

        wrapper.addEventListener('wheel', (e) => {
            const contentNode = e.target.closest('.canvas-node-content');
            if (contentNode) {
                if (contentNode.scrollHeight > contentNode.clientHeight) {
                     return; 
                }
            }

            e.preventDefault();
            const delta = -e.deltaY * 0.001; 
            const newScale = Math.min(5, Math.max(0.1, scale * Math.exp(delta)));
            
            // Calculate mouse position relative to wrapper
            const rect = wrapper.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Zoom towards mouse pointer
            // Formula: newTranslate = mouse - (mouse - oldTranslate) * (newScale / oldScale)
            pX = mouseX - (mouseX - pX) * (newScale / scale);
            pY = mouseY - (mouseY - pY) * (newScale / scale);

            scale = newScale;
            updateTransform();
        });

        wrapper.addEventListener('mousedown', (e) => {
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

        window.addEventListener('mouseup', () => { 
            isDragging = false; 
            wrapper.style.cursor = 'grab';
        });

        window.zoom = (factor) => {
            scale *= factor;
            updateTransform();
        }
        window.reset = () => {
            const wW = wrapper.clientWidth;
            const wH = wrapper.clientHeight;
             if (${bounds.width} > wW || ${bounds.height} > wH) {
                 scale = Math.min(wW / ${bounds.width}, wH / ${bounds.height}) * 0.95;
            } else {
                 scale = 1;
            }
            pX = (wW - ${bounds.width} * scale) / 2;
            pY = (wH - ${bounds.height} * scale) / 2;
            updateTransform();
        }
    </script>
</body>
</html>`;
	}
}
