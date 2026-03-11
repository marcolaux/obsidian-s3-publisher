import { App, TFile } from "obsidian";

import { CompilerModule, CanvasNode, CanvasEdge, CanvasData } from "../types";
import { CompilerRegistry } from "./registry";
import { generateInteractiveWrapper } from "../components/interactive-viewer";

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

export class CanvasCompiler implements CompilerModule {
	id = "canvas";
	app: App;
	registry: CompilerRegistry;

	constructor(app: App, registry: CompilerRegistry) {
		this.app = app;
		this.registry = registry;
	}

	canCompile(file: TFile): boolean {
		return file.extension === "canvas";
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

	private async _compileInternal(
		file: TFile,
		content: string,
		publishedPaths: Set<string> | undefined,
		isEmbed: boolean
	): Promise<string> {
		const data = JSON.parse(content) as CanvasData;
		if (!data.nodes || data.nodes.length === 0) {
			return isEmbed ? "<div>Empty Canvas</div>" : "<h1>Empty Canvas</h1>";
		}

		const bounds = this.getBounds(data.nodes);
		const nodesHtml = await this.renderNodes(
			data.nodes,
			bounds,
			file,
			publishedPaths
		);
		const edgesHtml = this.renderEdges(data.edges || [], data.nodes, bounds);

		return generateInteractiveWrapper({
			id: isEmbed ? "canvas-" + Math.random().toString(36).substring(2, 9) : "canvas-full",
			content: `${nodesHtml}\n${edgesHtml}`,
			width: bounds.width,
			height: bounds.height,
			isEmbed,
			title: file.basename,
			extraClass: "canvas-wrapper",
			extraStyles: `
        /* Canvas Specifics */
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

        /* Specific Node Overrides */
        .canvas-node-text .canvas-node-content {
             padding-top: 0;
             padding-bottom: 0;
        }
        
        .canvas-node-file-media .canvas-node-content,
				.canvas-node-file-pdf .canvas-node-content {
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
			`
		});
	}

	async compile(
		file: TFile,
		content: string,
		publishedPaths?: Set<string>
	): Promise<string> {
		return this._compileInternal(file, content, publishedPaths, false);
	}

	async compileEmbed(
		file: TFile,
		content: string,
		publishedPaths?: Set<string>
	): Promise<string> {
		return this._compileInternal(file, content, publishedPaths, true);
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
		console.debug("CanvasCompiler: renderNodes called with", nodes.length, "nodes");
		const promises = nodes.map(async (node) => {
			console.debug("CanvasCompiler: Rendering node", node.id, node.type, "file:", 'file' in node ? node.file : "N/A");
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

			if (node.background) {
				const bgFile = this.app.metadataCache.getFirstLinkpathDest(
					node.background,
					""
				);
				if (bgFile) {
					style += `background-image: url('${this.escapeHtml(
						bgFile.name
					)}'); background-size: cover; background-repeat: no-repeat; background-position: center;`;
				}
			}

			let content = "";
			let extraClass = "";

			switch (node.type) {
				case "text":
					if (node.text) {
						if (node.text) {
							const mdCompiler = this.registry.modules.find(m => m.id === "markdown");
							if (mdCompiler) {
								content = await mdCompiler.compileEmbed(
									canvasFile,
									node.text,
									publishedPaths || new Set()
								);
							}
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
							const compiler = this.registry.getCompiler(file);

							if (compiler) {
								if (compiler.id === "excalidraw") {
									content = await compiler.compileEmbed(file, "", publishedPaths);
									extraClass = "canvas-node-file canvas-node-file-excalidraw";
								} else if (compiler.id === "canvas") {
									const subContent = await this.app.vault.read(file);
									content = await compiler.compileEmbed(
										file,
										subContent,
										publishedPaths
									);
									extraClass = "canvas-node-file canvas-node-file-canvas";
								} else {
									let subContent = await this.app.vault.read(file);
									// Strip frontmatter so we can prepend title cleanly
									subContent = subContent.replace(
										/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/,
										""
									);
									subContent = `# ${file.basename}\n\n${subContent}`;

									content = await compiler.compileEmbed(
										file,
										subContent,
										publishedPaths || new Set()
									);
									extraClass = "canvas-node-file canvas-node-file-md"; // Separate class for Markdown
								}
							} else if (file.extension === "pdf") {
								content = `<embed src="${this.escapeHtml(
									file.name
								)}" type="application/pdf" style="width:100%; height:100%;" />`;
								extraClass = "canvas-node-file canvas-node-file-pdf";
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

			console.debug("CanvasCompiler: Finished node", node.id, content.substring(0, 50));
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

}
