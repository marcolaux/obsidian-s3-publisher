import { TFile } from "obsidian";
import { CompilerModule } from "../types";

export class CompilerRegistry {
	modules: CompilerModule[] = [];

	register(module: CompilerModule) {
		this.modules.push(module);
	}

	getCompiler(file: TFile): CompilerModule | undefined {
		// Module priority is based on registration order
		// We expect the first registered module that says canCompile=true to handle it.
		// Register more specific modules (like Excalidraw) before more generic ones (like Markdown).
		return this.modules.find(m => m.canCompile(file));
	}
}
