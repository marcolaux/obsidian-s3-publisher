/* eslint-disable obsidianmd/ui/sentence-case */
import { Plugin, TFile, Notice, Editor, MarkdownView } from "obsidian";
import { S3Publisher } from "./publisher";
import {
	S3PublisherSettings,
	DEFAULT_SETTINGS,
	S3PublisherSettingTab,
} from "./settings";
import { MarkdownCompiler } from "./compiler";
import { CanvasCompiler } from "./canvas-compiler";
import { SecretsWrapper } from "./secrets_wrapper";

interface CanvasNode {
	type: string;
	file?: string;
	[key: string]: unknown;
}

interface CanvasData {
	nodes?: CanvasNode[];
	share_id?: string;
	[key: string]: unknown;
}

interface ShareFrontMatter {
	share_id?: string;
	[key: string]: unknown;
}

export default class S3PublishPlugin extends Plugin {
	settings: S3PublisherSettings;
	publisher: S3Publisher;
	compiler: MarkdownCompiler;
	canvasCompiler: CanvasCompiler;
	secretsWrapper: SecretsWrapper;

	async onload() {
		this.secretsWrapper = new SecretsWrapper(this.app);
		await this.loadSettings();

		this.publisher = new S3Publisher(this.settings);
		this.compiler = new MarkdownCompiler(this.app);
		this.canvasCompiler = new CanvasCompiler(this.app, this.compiler);

		this.addCommand({
			id: "publish-note",
			name: "Publish to S3/MinIO",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const file = view.file;
				if (!file) return;
				await this.publishNote(file);
			},
		});

		this.addCommand({
			id: "unpublish-note",
			name: "Unpublish (Delete from S3)",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const file = view.file;
				if (!file) return;
				await this.unpublishNote(file);
			},
		});

		// Add Context Menu Items
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (
					file instanceof TFile &&
					(file.extension === "md" || file.extension === "canvas")
				) {
					// Check if published
					const publishedFile = this.settings.publishedFiles.find(
						(p) => p.path === file.path,
					);

					menu.addItem((item) => {
						item
							.setTitle(
								publishedFile
									? "S3: Update published note"
									: "S3: Publish Note",
							)
							.setIcon("upload-cloud")
							.onClick(async () => {
								await this.publishNote(file);
							});
					});

					menu.addItem((item) => {
						item
							.setTitle("S3: Publish Recursively")
							.setIcon("sheets-in-box")
							.onClick(async () => {
								await this.publishNoteRecursively(file);
							});
					});

					if (publishedFile) {
						menu.addItem((item) => {
							item
								.setTitle("S3: View Online")
								.setIcon("globe")
								.onClick(() => {
									window.open(publishedFile.url, "_blank");
								});
						});

						menu.addItem((item) => {
							item
								.setTitle("S3: Unpublish Note")
								.setIcon("trash")
								.onClick(async () => {
									await this.unpublishNote(file);
								});
						});

						// Recursive Unpublish Visibility Logic
						// 1. Is published (already checked)
						// 2. Has Outgoing Published OR Has Incoming Published
						const cache = this.app.metadataCache.getFileCache(file);
						let hasOutgoingPublished = false;

						if (cache) {
							const outgoingLinks: string[] = [];
							if (cache.links)
								outgoingLinks.push(...cache.links.map((l) => l.link));
							if (cache.embeds)
								outgoingLinks.push(...cache.embeds.map((l) => l.link));
							if (cache.frontmatter?.["banner"]) {
								const b = cache.frontmatter["banner"] as unknown;
								if (typeof b === "string")
									outgoingLinks.push(b.replace(/\[\[|\]\]/g, ""));
							}

							for (const link of outgoingLinks) {
								const clean = link.split("#")[0]?.split("?")[0];
								if (!clean) continue;

								const dest = this.app.metadataCache.getFirstLinkpathDest(
									clean,
									file.path,
								);
								if (
									dest &&
									this.settings.publishedFiles.some((p) => p.path === dest.path)
								) {
									hasOutgoingPublished = true;
									break;
								}
							}
						}

						let hasIncomingPublished = false;
						const resolvedLinks = this.app.metadataCache.resolvedLinks;
						if (resolvedLinks && !hasOutgoingPublished) {
							// Only check incoming if outgoing didn't already trigger it
							for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
								if (Object.prototype.hasOwnProperty.call(links, file.path)) {
									if (
										this.settings.publishedFiles.some(
											(p) => p.path === sourcePath,
										)
									) {
										hasIncomingPublished = true;
										break;
									}
								}
							}
						}

						if (hasOutgoingPublished || hasIncomingPublished) {
							menu.addItem((item) => {
								item
									.setTitle("S3: Unpublish Recursively")
									.setIcon("trash-2")
									.onClick(async () => {
										if (
											// eslint-disable-next-line no-alert
											confirm(
												"Are you sure you want to recursively unpublish this note and all connected published notes? This cannot be undone.",
											)
										) {
											await this.unpublishNoteRecursively(file);
										}
									});
							});
						}
					}
				}
			}),
		);

		// Track Renames
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					const entryIndex = this.settings.publishedFiles.findIndex(
						(p) => p.path === oldPath,
					);
					if (entryIndex !== -1 && this.settings.publishedFiles[entryIndex]) {
						this.settings.publishedFiles[entryIndex].path = file.path;
						void this.saveSettings();
					}
				}
			}),
		);

		// Track Deletes
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					const entryIndex = this.settings.publishedFiles.findIndex(
						(p) => p.path === file.path,
					);
					if (entryIndex !== -1) {
						// Remove from list to keep it clean, as user can't unpublish easily anymore if file is gone.
						this.settings.publishedFiles.splice(entryIndex, 1);
						void this.saveSettings();
					}
				}
			}),
		);

		// Layout Change Listener
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.updateFileMarkers();
			}),
		);

		// Initial marker update
		this.app.workspace.onLayoutReady(() => {
			this.updateFileMarkers();
		});

		this.addSettingTab(new S3PublisherSettingTab(this.app, this));
	}

	updateFileMarkers() {
		const publishedPaths = new Set(
			this.settings.publishedFiles.map((p) => p.path),
		);

		// Find all file explorer leaves
		const explorerLeaves = this.app.workspace.getLeavesOfType("file-explorer");

		for (const leaf of explorerLeaves) {
			const view = leaf.view;
			if (view instanceof MarkdownView) continue; // Should be FileExplorerView but type is internal

			// Safe DOM manipulation
			const container = view.containerEl;
			const fileItems = container.querySelectorAll(".nav-file-title");

			fileItems.forEach((item) => {
				const path = item.getAttribute("data-path");
				if (!path) return;

				// Check if we already have a marker
				let marker = item.querySelector(".s3-published-marker");

				if (publishedPaths.has(path)) {
					if (!marker) {
						marker = document.createElement("div");
						marker.addClass("s3-published-marker");
						// Icon can be simple text or SVG. Let's use a small dot or generic icon standard usually provided by CSS
						// Or just a unicode char for simplicity/performance in this DOM loop
						marker.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm2.36-5.24a2 2 0 0 0 .25-2.56A2 2 0 0 0 13 6.93a2 2 0 0 0-2.05 1.28l1.55.9a1 1 0 0 1 .5-.9 1 1 0 0 1 1.25.1 1 1 0 0 1-.25 1.5c-.75.45-.75 1.5-.75 1.5h1.5s0-.75 1.5-1.5z"></path></svg>`; // Globe/World Icon or Cloud? Let's use Cloud Upload for "Published"
						// Actually let's use the Globe icon to match "View Online"
						marker.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

						item.appendChild(marker);
					}
				} else {
					if (marker) {
						marker.remove();
					}
				}
			});
		}
	}

	async publishNoteRecursively(file: TFile, visited: Set<string> = new Set()) {
		if (visited.has(file.path)) return;
		visited.add(file.path);

		await this.publishNote(file, true);

		// Find outgoing links
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return;

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

		// Frontmatter links (banner)
		const banner = cache.frontmatter?.["banner"] as unknown;
		if (typeof banner === "string") {
			linksToVisit.push(banner.replace(/\[\[|\]\]/g, ""));
		}

		for (const linkPath of linksToVisit) {
			const cleanPathParts = linkPath.split("#")[0];
			const cleanPath = cleanPathParts
				? cleanPathParts.split("?")[0]
				: linkPath;

			if (!cleanPath) continue;
			const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
				cleanPath,
				file.path,
			);

			if (linkedFile instanceof TFile && linkedFile.extension === "md") {
				await this.publishNoteRecursively(linkedFile, visited);
			}
		}
	}

	async publishNote(file: TFile, updateBacklinks: boolean = true) {
		new Notice(`Publishing ${file.basename}...`);
		try {
			const content = await this.app.vault.read(file);

			// Recursive Asset Discovery
			const assets: { path: string; content: ArrayBuffer }[] = [];
			const visited = new Set<string>();

			const processFileAssets = async (f: TFile) => {
				if (visited.has(f.path)) return;
				visited.add(f.path);

				if (f.extension === "canvas") {
					// Parse Canvas JSON for assets
					try {
						const canvasData = JSON.parse(
							await this.app.vault.read(f),
						) as CanvasData;
						if (canvasData.nodes) {
							for (const node of canvasData.nodes) {
								if (node.type === "file" && node.file) {
									const linkedFile =
										this.app.metadataCache.getFirstLinkpathDest(
											node.file,
											f.path,
										);
									if (linkedFile instanceof TFile) {
										if (linkedFile.extension === "md") {
											await processFileAssets(linkedFile);
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
										node.background as string,
										f.path,
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
					return;
				}

				const cache = this.app.metadataCache.getFileCache(f);

				// 1. Frontmatter Banner
				const bannerPath = cache?.frontmatter?.["banner"] as string | undefined;
				if (bannerPath) {
					const cleanPath = bannerPath.replace(/\[\[|\]\]/g, "");
					const bannerFile = this.app.metadataCache.getFirstLinkpathDest(
						cleanPath,
						f.path,
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
							f.path,
						);

						if (linkedFile instanceof TFile) {
							if (linkedFile.extension === "md") {
								// Recurse into embedded note
								await processFileAssets(linkedFile);
							} else {
								// Asset (Image, etc)
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
					const fileContent = await this.app.vault.read(f);
					const imageRegex = /!\[.*?\]\((.*?)\)/g;
					const linkRegex = /\[.*?\]\((.*?)\)/g;

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
								f.path,
							);

							if (linkedFile instanceof TFile) {
								if (linkedFile.extension !== "md") {
									if (!assets.some((a) => a.path === linkedFile.name)) {
										const ab = await this.app.vault.readBinary(linkedFile);
										assets.push({ path: linkedFile.name, content: ab });
									}
								}
							}
						}
					}
				} catch (e) {
					console.error("Error scanning for standard links/images", e);
				}
			};

			await processFileAssets(file);

			// Extract top-level banner filename for passing to compile
			// Only for MD files basically
			let bannerFilename: string | undefined;
			if (file.extension === "md") {
				const topLevelBannerPath = this.app.metadataCache.getFileCache(file)
					?.frontmatter?.["banner"] as string | undefined;
				if (topLevelBannerPath) {
					const cleanPath = topLevelBannerPath.replace(/\[\[|\]\]/g, "");
					const f = this.app.metadataCache.getFirstLinkpathDest(
						cleanPath,
						file.path,
					);
					if (f instanceof TFile) bannerFilename = f.name;
				}
			}

			// 4. Generate HTML
			let html = "";
			const publishedPaths = new Set(
				this.settings.publishedFiles.map((p) => p.path),
			);

			if (file.extension === "canvas") {
				html = await this.canvasCompiler.compile(file, content);
			} else {
				html = await this.compiler.compile(
					file,
					content,
					publishedPaths,
					bannerFilename,
				);
			}

			// 5. Publish
			// Define a type for our frontmatter needs
			interface ShareFrontMatter {
				share_id?: string;
				[key: string]: unknown;
			}
			let frontmatter: ShareFrontMatter | undefined = {};

			if (file.extension === "md") {
				frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as
					| ShareFrontMatter
					| undefined;
			} else if (file.extension === "canvas") {
				// Parse canvas to find share_id
				try {
					const json = JSON.parse(content) as ShareFrontMatter;
					if (json.share_id) {
						frontmatter = { share_id: json.share_id };
					}
				} catch (e) {
					console.error("Failed to parse canvas for share_id check", e);
				}
			}

			const url = await this.publisher.publish(
				file,
				html,
				assets,
				frontmatter,
				async (key, value) => {
					// Update metadata logic
					if (key === "share_id" && value) {
						// Update local settings list
					}

					if (file.extension === "md") {
						await this.app.fileManager.processFrontMatter(
							file,
							(fm: Record<string, unknown>) => {
								if (value === null) delete fm[key];
								else fm[key] = value;
							},
						);
					} else if (file.extension === "canvas") {
						// Manually update JSON
						try {
							const currentContent = await this.app.vault.read(file);
							const json = JSON.parse(currentContent) as CanvasData;

							if (value === null) {
								delete json[key];
							} else {
								json[key] = value;
							}

							await this.app.vault.modify(
								file,
								JSON.stringify(json, null, "\t"),
							);
						} catch (e) {
							console.error(`Failed to update canvas JSON for key ${key}`, e);
							new Notice(`Warning: Could not save ${key} to canvas file.`);
						}
					}
				},
			);

			// Post-publish: Update list.
			// We try to extract the share_id from the returned URL or the frontmatter.
			let finalShareId = frontmatter?.share_id;
			if (!finalShareId) {
				// Parse ID from URL: .../share_id/index.html
				if (file.extension === "md" || file.extension === "canvas") {
					const match = url.match(/\/([a-z0-9-]+)\/index\.html$/);
					if (match) finalShareId = match[1];
				}
			}

			if (finalShareId) {
				const entryIndex = this.settings.publishedFiles.findIndex(
					(p) => p.path === file.path,
				);
				const newEntry = { path: file.path, url: url, shareId: finalShareId };
				if (entryIndex !== -1) {
					this.settings.publishedFiles[entryIndex] = newEntry;
				} else {
					this.settings.publishedFiles.push(newEntry);
				}
				await this.saveSettings();
				// Refresh markers
				this.updateFileMarkers();
			}

			// Copy to clipboard
			await navigator.clipboard.writeText(url);
			new Notice(`Published! Link copied:\n${url}`);

			// --- Backlinks Update Logic ---
			if (updateBacklinks) {
				const resolvedLinks = this.app.metadataCache.resolvedLinks;
				if (resolvedLinks) {
					for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
						// Check if sourcePath links to our file
						if (Object.prototype.hasOwnProperty.call(links, file.path)) {
							// Check if sourcePath is published
							if (
								this.settings.publishedFiles.some((p) => p.path === sourcePath)
							) {
								const refFile = this.app.metadataCache.getFirstLinkpathDest(
									sourcePath,
									"",
								);
								if (refFile instanceof TFile) {
									new Notice(`Updating referring note: ${refFile.basename}`);
									// Recursively publish
									await this.publishNote(refFile, false);
								}
							}
						}
					}
				}
			}
		} catch (err) {
			console.error(err);
			new Notice(
				`Error publishing: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	async unpublishNoteRecursively(
		file: TFile,
		visited: Set<string> = new Set(),
	) {
		if (visited.has(file.path)) return;
		visited.add(file.path);

		await this.unpublishNote(file);

		// Find outgoing links to recurse
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return;

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

		// Frontmatter links (banner)
		const banner = cache.frontmatter?.["banner"] as unknown;
		if (typeof banner === "string") {
			linksToVisit.push(banner.replace(/\[\[|\]\]/g, ""));
		}

		for (const linkPath of linksToVisit) {
			const cleanPath = linkPath.split("#")[0]?.split("?")[0];
			if (!cleanPath) continue;

			const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
				cleanPath,
				file.path,
			);

			if (linkedFile instanceof TFile) {
				// Only recurse if the linked file is also published
				// We need to check if it's in the published list OR if it has frontmatter indicating it's published.
				// The publishedFiles list is the fastest check.
				const isPublished = this.settings.publishedFiles.some(
					(p) => p.path === linkedFile.path,
				);

				if (isPublished) {
					if (linkedFile.extension === "md") {
						await this.unpublishNoteRecursively(linkedFile, visited);
					} else {
						// For non-MD files (assets), unpublishNote might work IF they were treated as "notes" but usually assets are just deleted during unpublish of the note?
						// Actually, unpublishNote is designed for TFile (MD/Canvas).
						// Assets uploaded alongside a note are deleted when the note is unpublished if they are in the folder?
						// Wait, current unpublish logic only deletes the 'share_id' folder.
						// If assets are shared, this might be tricky.
						// But for now, let's just trace MD files.
					}
				}
			}
		}
	}

	async unpublishNote(file: TFile) {
		new Notice(`Unpublishing ${file.basename}...`);
		try {
			let frontmatter: ShareFrontMatter | undefined = {};

			if (file.extension === "md") {
				frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as
					| ShareFrontMatter
					| undefined;
			} else if (file.extension === "canvas") {
				try {
					const content = await this.app.vault.read(file);
					const json = JSON.parse(content) as CanvasData;
					if (json.share_id) {
						frontmatter = { share_id: json.share_id };
					}
				} catch (e) {
					console.error("Failed to parse canvas for unpublish", e);
				}
			}

			if (!frontmatter || !frontmatter["share_id"]) {
				new Notice("This note does not appear to be published.");
				return;
			}

			await this.publisher.unpublish(file, frontmatter, async (key, value) => {
				if (file.extension === "md") {
					await this.app.fileManager.processFrontMatter(
						file,
						(fm: Record<string, unknown>) => {
							if (value === null) delete fm[key];
							else fm[key] = value;
						},
					);
				} else if (file.extension === "canvas") {
					// Canvas Fix
					try {
						const currentContent = await this.app.vault.read(file);
						const json = JSON.parse(currentContent) as CanvasData;

						if (value === null) {
							delete json[key];
						} else {
							json[key] = value;
						}

						await this.app.vault.modify(file, JSON.stringify(json, null, "\t"));
					} catch (e) {
						console.error(`Failed to update canvas JSON for key ${key}`, e);
						new Notice(`Warning: Could not save ${key} to canvas file.`);
					}
				}
			});

			// Remove from settings list
			const entryIndex = this.settings.publishedFiles.findIndex(
				(p) => p.path === file.path,
			);
			if (entryIndex !== -1) {
				this.settings.publishedFiles.splice(entryIndex, 1);
				await this.saveSettings();
				this.updateFileMarkers();
			}

			new Notice("Unpublished. Files deleted from server.");
		} catch (err) {
			console.error(err);
			new Notice(
				`Error unpublishing: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as S3PublisherSettings,
		);

		// Overlay SecretStorage if available
		if (this.secretsWrapper.isAvailable()) {
			const s3AccessKey = await this.secretsWrapper.getSecret("s3-access-key");
			const s3SecretKey = await this.secretsWrapper.getSecret("s3-secret-key");

			if (s3AccessKey) this.settings.s3AccessKey = s3AccessKey;
			if (s3SecretKey) this.settings.s3SecretKey = s3SecretKey;
		}
	}

	async saveSettings() {
		if (this.secretsWrapper.isAvailable()) {
			// Save secrets
			// If value is empty, we delete the secret.
			if (this.settings.s3AccessKey) {
				await this.secretsWrapper.saveSecret(
					"s3-access-key",
					this.settings.s3AccessKey,
				);
			} else {
				await this.secretsWrapper.deleteSecret("s3-access-key");
			}

			if (this.settings.s3SecretKey) {
				await this.secretsWrapper.saveSecret(
					"s3-secret-key",
					this.settings.s3SecretKey,
				);
			} else {
				await this.secretsWrapper.deleteSecret("s3-secret-key");
			}

			// Save others to disk, excluding secrets
			const settingsToSave = { ...this.settings };
			settingsToSave.s3AccessKey = "";
			settingsToSave.s3SecretKey = "";
			await this.saveData(settingsToSave);
		} else {
			await this.saveData(this.settings);
		}

		// Refresh publisher instances if needed
		this.publisher.settings = this.settings;
	}
}
