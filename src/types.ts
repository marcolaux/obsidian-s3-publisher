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
	background?: string;
	[key: string]: unknown;
}

export interface CanvasEdge {
	id: string;
	fromNode: string;
	fromSide: "top" | "right" | "bottom" | "left";
	toNode: string;
	toSide: "top" | "right" | "bottom" | "left";
	label?: string;
	color?: string;
	[key: string]: unknown;
}

export interface CanvasData {
	nodes?: CanvasNode[];
	edges?: CanvasEdge[];
	share_id?: string;
	[key: string]: unknown;
}

export interface ShareFrontMatter {
	share_id?: string;
	[key: string]: unknown;
}

export interface CompilerModule {
	id: string;
	canCompile(file: import("obsidian").TFile): boolean;
	compile(
		file: import("obsidian").TFile,
		content: string,
		publishedPaths?: Set<string>,
		banner?: string
	): Promise<string>;
	compileEmbed(
		file: import("obsidian").TFile,
		content: string,
		publishedPaths?: Set<string>,
		depth?: number
	): Promise<string>;
}
