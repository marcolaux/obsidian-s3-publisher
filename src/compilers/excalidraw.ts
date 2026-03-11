import { App, TFile } from "obsidian";
import { CompilerModule } from "../types";
import { generateInteractiveWrapper } from "../components/interactive-viewer";

interface ExcalidrawAutomate {
	createSVG(
		path: string,
		b: boolean,
		opts: Record<string, unknown>,
	): Promise<Element | null>;
}

export class ExcalidrawCompiler implements CompilerModule {
	id = "excalidraw";
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	canCompile(file: TFile): boolean {
		return this.app.metadataCache.getFileCache(file)?.frontmatter?.["excalidraw-plugin"] !== undefined;
	}

	async compile(
		file: TFile,
		content: string,
		publishedPaths?: Set<string>,
		banner?: string
	): Promise<string> {
		return this._compileInternal(file, false);
	}

	async compileEmbed(
		file: TFile,
		content: string,
		publishedPaths?: Set<string>,
		depth?: number
	): Promise<string> {
		return this._compileInternal(file, true);
	}

	private async _compileInternal(file: TFile, isEmbed: boolean): Promise<string> {
		/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
		const excalidrawPlugin = (this.app as any).plugins.plugins["obsidian-excalidraw-plugin"];
		/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
		const ea = (excalidrawPlugin?.api || excalidrawPlugin?.ea) as ExcalidrawAutomate | undefined;

		if (!ea) {
			const errorHtml = "<p>Error: Excalidraw plugin is not enabled or its API is unavailable.</p>";
			return isEmbed ? errorHtml : `<!DOCTYPE html><html><body>${errorHtml}</body></html>`;
		}

		try {
			const svg = await ea.createSVG(file.path, true, {
				withBackground: false,
				withTheme: false,
			});
			if (!svg) throw new Error("Could not generate SVG from Excalidraw api");

			const svgString = svg.outerHTML;

			// Determine bounds from SVG viewBox or attributes
			const validSvg = svg;
			let width = 1000;
			let height = 1000;

			// exportToSvg usually sets width/height attributes or viewBox
			if (validSvg.hasAttribute("viewBox")) {
				const vb = (validSvg.getAttribute("viewBox") as string)?.split(" ").map(Number);
				if (vb && vb.length === 4) {
					width = vb[2] ?? 0;
					height = vb[3] ?? 0;
				}
			} else {
				width = Number(validSvg.getAttribute("width")) || 1000;
				height = Number(validSvg.getAttribute("height")) || 1000;
			}
			 
			// Valid dimensions check
			if (width <= 0) width = 1000;
			if (height <= 0) height = 1000;

			// Generate stable or unique ID based on embed status
			const id = isEmbed ? Math.random().toString(36).substring(2, 10) : "fullpage";

			// Return Interactive Shell
			return generateInteractiveWrapper({
				id,
				content: svgString,
				width,
				height,
				isEmbed,
				title: file.basename,
				extraClass: "excalidraw-wrapper",
				extraStyles: ""
			});
		} catch (e) {
			const errorMsg = `<p>Error processing Excalidraw file: ${
					e instanceof Error ? e.message : String(e)
				}</p>`;
			return isEmbed ? errorMsg : `<!DOCTYPE html><html><body>${errorMsg}</body></html>`;
		}
	}
}
