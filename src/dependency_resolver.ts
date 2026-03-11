import { App, TFile } from "obsidian";
import { S3PublisherSettings } from "./settings";
import { CanvasData } from "./types";

export class DependencyResolver {
	app: App;
	settings: S3PublisherSettings;

	constructor(app: App, settings: S3PublisherSettings) {
		this.app = app;
		this.settings = settings;
	}

	async processFileAssets(
		file: TFile,
		assets: { path: string; content: ArrayBuffer }[],
		visited: Set<string>
	) {
		if (visited.has(file.path)) return;
		visited.add(file.path);

		if (file.extension === "canvas") {
			await this.processCanvasAssets(file, assets, visited);
			return;
		}

		const cache = this.app.metadataCache.getFileCache(file);

		// 1. Frontmatter Banner
		const bannerPath = cache?.frontmatter?.["banner"] as string | undefined;
		if (bannerPath) {
			const cleanPath = bannerPath.replace(/\\[\\[|\\]\\]/g, "");
			const bannerFile = this.app.metadataCache.getFirstLinkpathDest(
				cleanPath,
				file.path
			);
			if (
				bannerFile instanceof TFile &&
				!assets.some((a) => a.path === bannerFile.name)
			) {
				const ab = await this.app.vault.readBinary(bannerFile);
				assets.push({ path: bannerFile.name, content: ab });
			}
		}

		// 2. Embeds (Wikilinks)
		const embeds = cache?.embeds;
		if (embeds) {
			for (const embed of embeds) {
				const cleanLink = embed.link.split("#")[0] || embed.link;
				const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
					cleanLink,
					file.path
				);

				if (linkedFile instanceof TFile) {
					if (
						linkedFile.extension === "md" ||
						linkedFile.extension === "excalidraw" ||
						linkedFile.extension === "canvas"
					) {
						await this.processFileAssets(linkedFile, assets, visited);
					} else {
						if (!assets.some((a) => a.path === linkedFile.name)) {
							const ab = await this.app.vault.readBinary(linkedFile);
							assets.push({ path: linkedFile.name, content: ab });
						}
					}
				}
			}
		}

		// 3. Standard Markdown Images ![alt](path) and Links [text](path)
		try {
			const fileContent = await this.app.vault.read(file);
			const imageRegex = /!\\[.*?\\]\\((.*?)\\)/g;
			const linkRegex = /\\[.*?\\]\\((.*?)\\)/g;

			const queries = [imageRegex, linkRegex];

			for (const regex of queries) {
				const matches = fileContent.matchAll(regex);
				for (const match of matches) {
					const linkText = match[1];
					if (
						!linkText ||
						linkText.startsWith("http") ||
						linkText.startsWith("mailto:") ||
						linkText.startsWith("#")
					)
						continue;

					const cleanLink =
						linkText.split("#")[0]?.split("?")[0] || linkText;

					const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
						cleanLink,
						file.path
					);

					if (linkedFile instanceof TFile && linkedFile.extension !== "md") {
						if (!assets.some((a) => a.path === linkedFile.name)) {
							const ab = await this.app.vault.readBinary(linkedFile);
							assets.push({ path: linkedFile.name, content: ab });
						}
					}
				}
			}
		} catch (e) {
			console.error("Error scanning for standard links/images", e);
		}
	}

	async processCanvasAssets(
		file: TFile,
		assets: { path: string; content: ArrayBuffer }[],
		visited: Set<string>
	) {
		try {
			const canvasData = JSON.parse(await this.app.vault.read(file)) as CanvasData;
			if (canvasData.nodes) {
				for (const node of canvasData.nodes) {
					if (node.type === "file" && node.file) {
						const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
							node.file,
							file.path
						);
						if (linkedFile instanceof TFile) {
							if (
								linkedFile.extension === "md" ||
								linkedFile.extension === "excalidraw" ||
								linkedFile.extension === "canvas"
							) {
								await this.processFileAssets(linkedFile, assets, visited);
							} else {
								if (!assets.some((a) => a.path === linkedFile.name)) {
									const ab = await this.app.vault.readBinary(linkedFile);
									assets.push({ path: linkedFile.name, content: ab });
								}
							}
						}
					}
					// Background Image Check
					if (node.background) {
						const bgFile = this.app.metadataCache.getFirstLinkpathDest(
							node.background,
							file.path
						);
						if (
							bgFile instanceof TFile &&
							!assets.some((a) => a.path === bgFile.name)
						) {
							const ab = await this.app.vault.readBinary(bgFile);
							assets.push({ path: bgFile.name, content: ab });
						}
					}
				}
			}
		} catch (e) {
			console.error("Error parsing canvas for assets", e);
		}
	}

	getBannerFilename(file: TFile): string | undefined {
		if (file.extension !== "md") return undefined;

		const topLevelBannerPath = this.app.metadataCache.getFileCache(file)
			?.frontmatter?.["banner"] as string | undefined;

		if (topLevelBannerPath) {
			const cleanPath = topLevelBannerPath.replace(/\\[\\[|\\]\\]/g, "");
			const f = this.app.metadataCache.getFirstLinkpathDest(cleanPath, file.path);
			if (f instanceof TFile) return f.name;
		}
		return undefined;
	}

	getLinksToVisit(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return [];

		const linksToVisit: string[] = [];

		if (cache.links) {
			for (const link of cache.links) {
				linksToVisit.push(link.link);
			}
		}

		if (cache.embeds) {
			for (const embed of cache.embeds) {
				linksToVisit.push(embed.link);
			}
		}

		const banner = cache.frontmatter?.["banner"] as string | undefined;
		if (banner) {
			linksToVisit.push(banner.replace(/\\[\\[|\\]\\]/g, ""));
		}

		return linksToVisit;
	}
}
