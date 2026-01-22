/* eslint-disable import/no-extraneous-dependencies */
import { App, TFile } from "obsidian";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { visit } from "unist-util-visit";
import LZString from "lz-string";
import { exportToSvg } from "@excalidraw/utils";
import { generateInteractiveExcalidrawWrapper } from "./interactive-excalidraw";
import {
	CSS_VARIABLES,
	MARKDOWN_STYLES,
	SYNTAX_HIGHLIGHTING_STYLES,
	TOC_STYLES,
} from "./styles";

import rehypeSlug from "rehype-slug";
import { linkToIframe } from "link-to-iframe";

export class MarkdownCompiler {
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	async compile(
		file: TFile,
		content: string,
		publishedPaths: Set<string>,
		banner?: string,
	): Promise<string> {
		// Check frontmatter for excalidraw-plugin
		const frontmatterMatch = content.match(
			/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/,
		);
		let isExcalidrawFrontmatter = false;
		if (frontmatterMatch && frontmatterMatch[1]) {
			isExcalidrawFrontmatter =
				frontmatterMatch[1].includes("excalidraw-plugin:");
		}

		if (isExcalidrawFrontmatter) {
			return this.compileExcalidrawInterative(file, content);
		}

		const bodyHtml = await this.render(file, content, publishedPaths);
		return this.wrapHtml(file.basename, bodyHtml, banner);
	}

	async compileExcalidrawInterative(
		file: TFile,
		content: string,
	): Promise<string> {
		// Extract compressed-json block
		const match = content.match(/```compressed-json\s*([\s\S]*?)\s*```/);

		if (!match || !match[1]) {
			return this.wrapHtml(
				file.basename,
				"<p>Error: No Excalidraw data found</p>",
			);
		}

		try {
			const decompressed = LZString.decompressFromBase64(
				match[1].replace(/\s/g, ""),
			);

			if (!decompressed) throw new Error("Decompression failed");

			/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
			const json: any = JSON.parse(decompressed);

			// Hydrate images
			await hydrateExcalidrawFiles(this.app, json, content);

			// Generate SVG
			const svg = await exportToSvg({
				elements: json.elements || [],
				appState: {
					...json.appState,
					exportBackground: false,
					viewBackgroundColor: "transparent",
				},
				files: json.files || null,
			});
			/* eslint-enable */

			// Determine bounds from SVG viewBox or attributes
			const validSvg = svg;
			let width = 1000;
			let height = 1000;

			// exportToSvg usually sets width/height attributes or viewBox
			if (validSvg.hasAttribute("viewBox")) {
				const vb = validSvg.getAttribute("viewBox")?.split(" ").map(Number);
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

			const svgString = validSvg.outerHTML;

			// Return Interactive Shell
			// Use a stable ID for full page, e.g. "fullpage"
			return generateInteractiveExcalidrawWrapper(
				svgString,
				"fullpage",
				width,
				height,
				false,
				file.basename,
			);
		} catch (e) {
			return this.wrapHtml(
				file.basename,
				`<p>Error processing Excalidraw file: ${
					e instanceof Error ? e.message : String(e)
				}</p>`,
			);
		}
	}

	async render(
		file: TFile,
		content: string,
		publishedPaths: Set<string>,
		depth: number = 0,
	): Promise<string> {
		if (depth > 2) return "<p><em>(Embed depth limit reached)</em></p>";

		// Strip Frontmatter (Robust Regex for CRLF and whitespace)
		content = content.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/, "");

		// Pre-process Obsidian Embeds (Async)
		content = await this.transformEmbeds(
			content,
			file.path,
			publishedPaths,
			depth,
		);

		// Pre-process Javascript/External Embeds (e.g. YouTube ![])
		content = this.transformExternalEmbeds(content);

		// Pre-process Wikilinks and Standard Links
		content = await this.transformLinks(content, file.path, publishedPaths);

		// Pre-process Hashtags
		content = this.transformTags(content);

		const processor = unified()
			.use(remarkParse)
			// @ts-ignore
			.use(remarkGfm)
			// @ts-ignore
			.use(remarkBreaks)
			// @ts-ignore
			.use(remarkForceListBreaks)

			.use(remarkExcalidraw, { app: this.app })
			.use(remarkRelativeLinkNormalizer)
			// Switch to remark-rehype -> rehype-raw -> rehype-stringify for HTML handling
			// @ts-ignore
			.use(remarkRehype, { allowDangerousHtml: true })
			// @ts-ignore
			.use(rehypeRaw)
			// @ts-ignore
			.use(rehypeHighlight)
			// @ts-ignore
			.use(rehypeCodeBlockEnhancer)
			// @ts-ignore
			.use(rehypeSlug)
			// @ts-ignore
			.use(rehypeIframeEnhancer)
			// @ts-ignore
			.use(rehypeStringify, { allowDangerousHtml: true });

		// @ts-ignore
		const vfile = await processor.process(content);
		return String(vfile);
	}

	async transformEmbeds(
		markdown: string,
		sourcePath: string,
		publishedPaths: Set<string>,
		depth: number,
	): Promise<string> {
		// Regex to find ![[filename.ext]] or ![[filename.ext|alt]]
		const embedRegex = /!\[\[(.*?)(?:\|(.*?))?\]\]/g;

		// Use a simple replacement strategy that supports async operations by resolving all matches first
		const matches = [...markdown.matchAll(embedRegex)];

		// Map of original full match -> replacement string
		const replacements = new Map<string, string>();

		for (const match of matches) {
			const originalTag = match[0];
			const linkText = match[1];
			if (!linkText) continue;

			const altText = match[2] || linkText;

			// If already processed
			if (replacements.has(originalTag)) continue;

			// Resolve file
			// Handle anchors if any (like Note#Heading), for now strict path
			const cleanLink = linkText.split("#")[0] || linkText;
			const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
				cleanLink,
				sourcePath,
			);

			if (linkedFile instanceof TFile) {
				if (
					linkedFile.extension === "md" ||
					linkedFile.extension === "excalidraw"
				) {
					// Recursive Render
					const subContent = await this.app.vault.read(linkedFile);
					// Render sub-note (depth+1)
					// We wrap it in a div for styling
					const subHtml = await this.render(
						linkedFile,
						subContent,
						publishedPaths,
						depth + 1,
					);

					// If Excalidraw, just show the drawing without the header
					const isExcalidraw =
						linkedFile.extension === "excalidraw" ||
						linkedFile.name.endsWith(".excalidraw.md");

					if (isExcalidraw) {
						replacements.set(
							originalTag,
							`<div class="embedded-excalidraw">${subHtml}</div>`,
						);
					} else {
						replacements.set(
							originalTag,
							`<div class="embedded-note-container"><h3>${linkedFile.basename}</h3>${subHtml}</div>`,
						);
					}
				} else {
					// Asset (Image/Video/PDF/etc)
					// Flatten filename for upload consistency
					const filename = linkedFile.name;
					const ext = linkedFile.extension.toLowerCase();

					let replacement = "";
					switch (ext) {
						case "png":
						case "jpg":
						case "jpeg":
						case "gif":
						case "svg":
						case "webp":
							replacement = `<img src="${filename}" alt="${altText}" />`;
							break;
						case "mp4":
						case "webm":
						case "ogv":
						case "mov":
							replacement = `<video controls src="${filename}" style="max-width: 100%;"><a href="${filename}">Download Video</a></video>`;
							break;
						case "mp3":
						case "wav":
						case "ogg":
						case "m4a":
							replacement = `<audio controls src="${filename}"></audio>`;
							break;
						case "pdf":
							replacement = `<embed src="${filename}" type="application/pdf" class="pdf-embed" />`;
							break;
						default:
							replacement = `<a href="${filename}" download class="download-link">Download ${altText}</a>`;
					}
					replacements.set(originalTag, replacement);
				}
			} else {
				// Unresolved or not a file
				replacements.set(originalTag, match[0]); // Leave as is
			}
		}

		// Apply replacements
		let newMarkdown = markdown;
		replacements.forEach((replacement, original) => {
			// Use plain replace string, replace all instances
			// Escape special chars in search string?
			// matched string comes from regex, so it's literal.
			// Global replace of literal string:
			newMarkdown = newMarkdown.split(original).join(replacement);
		});
		return newMarkdown;
	}

	async transformLinks(
		markdown: string,
		sourcePath: string,
		publishedPaths: Set<string>,
	): Promise<string> {
		let newMarkdown = markdown;

		// 1. Wikilinks [[Link]] or [[Link|Label]]
		const wikiLinkRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
		const wikiMatches = [...newMarkdown.matchAll(wikiLinkRegex)];
		const replacements = new Map<string, string>();

		for (const match of wikiMatches) {
			const original = match[0];
			if (replacements.has(original)) continue;

			const linkText = match[1];
			const alias = match[2];

			if (!linkText) continue;

			const cleanLink = linkText.split("#")[0];
			if (!cleanLink) continue;

			const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
				cleanLink,
				sourcePath,
			);

			const label = alias || linkText;

			if (
				linkedFile instanceof TFile &&
				linkedFile.extension === "md" &&
				publishedPaths.has(linkedFile.path)
			) {
				const frontmatter =
					this.app.metadataCache.getFileCache(linkedFile)?.frontmatter;
				const shareId = frontmatter?.["share_id"] as string | undefined;

				if (shareId) {
					// Preserve Hash
					const hashMatch = linkText.match(/#.*/);
					const hash = hashMatch ? hashMatch[0] : "";

					replacements.set(
						original,
						`<a href="../${shareId}/index.html${hash}" class="internal-link">${label}</a>`,
					);
				} else {
					replacements.set(
						original,
						`<span class="internal-link is-unresolved">${label}</span>`,
					);
				}
			} else {
				// Not a markdown file or not found - leave as text or span?
				// Using span to match style of unresolved
				replacements.set(
					original,
					`<span class="internal-link is-unresolved">${label}</span>`,
				);
			}
		}

		replacements.forEach((val, key) => {
			newMarkdown = newMarkdown.split(key).join(val);
		});

		// 2. Standard Markdown Links [Label](path.md)
		// Capture optional ! to exclude images
		const mdLinkRegex = /(!?)\[(.*?)\]\((.*?)\)/g;
		const mdMatches = [...newMarkdown.matchAll(mdLinkRegex)];
		const mdReplacements = new Map<string, string>();

		for (const match of mdMatches) {
			const prefix = match[1];
			const original = match[0];

			// Skip images
			if (prefix === "!") continue;
			if (mdReplacements.has(original)) continue;

			const label = match[2];
			const url = match[3];

			if (!url) continue;

			if (
				url.startsWith("http") ||
				url.startsWith("mailto:") ||
				url.startsWith("#")
			)
				continue;

			// Only process internal links - if it looks like an external one, skip
			// But allow "Note" (no extension) to be checked against vault
			const cleanUrl = url.split("#")[0]?.split("?")[0];
			if (!cleanUrl) continue;
			// if (cleanUrl.startsWith("http")) continue; // Already checked above with regex/logic

			const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
				cleanUrl,
				sourcePath,
			);

			if (
				linkedFile instanceof TFile &&
				linkedFile.extension === "md" &&
				publishedPaths.has(linkedFile.path)
			) {
				const frontmatter =
					this.app.metadataCache.getFileCache(linkedFile)?.frontmatter;
				const shareId = frontmatter?.["share_id"] as string | undefined;

				if (shareId) {
					// Preserve Hash
					const hashMatch = url.match(/#.*/);
					const hash = hashMatch ? hashMatch[0] : "";

					mdReplacements.set(
						original,
						`<a href="../${shareId}/index.html${hash}" class="internal-link">${label}</a>`,
					);
				} else {
					mdReplacements.set(
						original,
						`<span class="internal-link is-unresolved">${label}</span>`,
					);
				}
			} else if (linkedFile instanceof TFile && linkedFile.extension !== "md") {
				// Linked to a non-md file (PDF, Image, etc.)
				// We assume these are assets that ARE uploaded if linked.
				// Link to the filename (flattened structure usually)
				mdReplacements.set(
					original,
					`<a href="${linkedFile.name}" class="internal-link is-asset">${label}</a>`,
				);
			} else {
				// Not published, not a TFile, or not MD (and not caught above)
				mdReplacements.set(
					original,
					`<span class="internal-link is-unresolved">${label}</span>`,
				);
			}
		}

		mdReplacements.forEach((val, key) => {
			newMarkdown = newMarkdown.split(key).join(val);
		});

		return newMarkdown;
	}

	transformExternalEmbeds(markdown: string): string {
		// Regex to find ![]()
		// We look for ![](url) specifically for video services
		const externalEmbedRegex = /!\[(.*?)\]\((.*?)\)/g;

		return markdown.replace(
			externalEmbedRegex,
			(match: string, alt: string, url: string) => {
				// Only attempt to embed if it resembles a web URL
				if (!url.startsWith("http")) {
					return match;
				}

				// Use link-to-iframe for multiple service support (YouTube, Vimeo, etc.)
				const embed = linkToIframe(url);
				if (embed) {
					// link-to-iframe returns a raw iframe string.
					// We wrap it in a container for responsiveness.
					// The container has a 16:9 aspect ratio padding (56.25%).
					return `<div class="external-embed-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
                            ${embed.replace(
															"<iframe",
															'<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"',
														)}
                        </div>`;
				}

				// Fallback: standard image or whatever remark handles
				return match;
			},
		);
	}

	transformTags(markdown: string): string {
		// Regex for tags: # followed by alphanumeric/underscore/dash/slash
		// Must be preceded by start of line or space
		// Must not be a hex color logic (usually hex colors are like #abc or #abcdef, but this regex might match them if they are in text)
		// Obsidian tags: #tagName
		const tagRegex = /(^|\s)(#[a-zA-Z0-9_/-]+)(?=$|\s|[.,!?])/g;

		return markdown.replace(
			tagRegex,
			(match: string, prefix: string, tag: string) => {
				// Avoid matching common hex codes if they look like tags?
				// Obsidian validation is intricate, but let's stick to the regex above.
				// If the tag is all numbers, it's not a tag in Obsidian usually, but let's allow it for now or check.
				// Actually Obsidian requires at least one non-numeric char.
				if (/^#\d+$/.test(tag)) return match;

				return `${prefix}<span class="tag">${tag}</span>`;
			},
		);
	}

	wrapHtml(title: string, body: string, banner?: string): string {
		// Extract headings for TOC
		const tocHtml = this.generateTocHtml(body);

		const bannerHtml = banner
			? `<div class="banner-container"><img src="${banner}" alt="Banner" class="banner-image"></div>`
			: "";

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        ${CSS_VARIABLES}
        ${MARKDOWN_STYLES}
        ${SYNTAX_HIGHLIGHTING_STYLES}
        ${TOC_STYLES}
    </style>
</head>
<body>
    ${tocHtml}
    ${bannerHtml}
    <h1>${title}</h1>
    <div class="markdown-preview-view">
    ${body}
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.copy-button').forEach(button => {
                button.addEventListener('click', () => {
                    const wrapper = button.closest('.code-block-wrapper');
                    const codeBlock = wrapper.querySelector('code');
                    if (codeBlock) {
                        const text = codeBlock.innerText; // Preserve newlines
                        navigator.clipboard.writeText(text).then(() => {
                            const originalText = button.textContent;
                            button.textContent = 'Copied!';
                            button.classList.add('copy-success');
                            setTimeout(() => {
                                button.textContent = originalText;
                                button.classList.remove('copy-success');
                            }, 2000);
                        }).catch(err => {
                            console.error('Failed to copy', err);
                            button.textContent = 'Error';
                        });
                    }
                });
            });

            // TOC Logic
            const updateActiveToc = () => {
                const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
                const viewportHeight = window.innerHeight;

                document.querySelectorAll('.toc-item').forEach(item => {
                    item.classList.remove('active');
                });

                headers.forEach((header, index) => {
                    const rect = header.getBoundingClientRect();
                    
                    // Logic: A header is "active" if it has started (top < viewportHeight)
                    // AND it has not finished (next header has not scrolled past top yet).
                    // This creates a cumulative/range highlight for all content currently passing through the viewport.
                    
                    const nextHeader = headers[index + 1];
                    const nextRect = nextHeader ? nextHeader.getBoundingClientRect() : null;

                    const isStarted = rect.top < viewportHeight;
                    const isNotFinished = nextRect ? nextRect.top > 0 : true; // Last header implies not finished until end of page

                    if (isStarted && isNotFinished) {
                        const id = header.getAttribute('id');
                        const activeItem = document.querySelector('.toc-item[data-target="' + id + '"]');
                        if (activeItem) {
                            activeItem.classList.add('active');
                        }
                    }
                });
            };

            // Throttle function
            let isTicking = false;
            window.addEventListener('scroll', () => {
                if (!isTicking) {
                    window.requestAnimationFrame(() => {
                        updateActiveToc();
                        isTicking = false;
                    });
                    isTicking = true;
                }
            });

            // Initial check
            updateActiveToc();

            // Smooth Scroll with Offset
            document.querySelectorAll('.toc-item').forEach(item => {
                item.addEventListener('click', () => {
                   const targetId = item.getAttribute('data-target');
                   const targetElement = document.getElementById(targetId);
                   if (targetElement) {
                       targetElement.scrollIntoView({ behavior: 'smooth' });
                   }
                });
            });
        });
    </script>
</body>
</html>`;
	}

	generateTocHtml(html: string): string {
		const headingRegex = /<h([1-6])\s+id="([^"]+)">([^<]+)<\/h\1>/g;
		let match;
		const items = [];

		while ((match = headingRegex.exec(html)) !== null) {
			const level = match[1];
			const id = match[2];
			const text = match[3];
			items.push({ level, id, text });
		}

		if (items.length === 0) return "";

		let tocHtml = '<div class="affine-toc-container">';
		items.forEach((item) => {
			tocHtml += `
                <div class="toc-item" data-level="${item.level}" data-target="${item.id}" title="${item.text}">
                    <div class="toc-text">${item.text}</div>
                    <div class="toc-indicator"></div>
                </div>
            `;
		});
		tocHtml += "</div>";

		return tocHtml;
	}
}

function remarkForceListBreaks() {
	/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
	return (tree: any) => {
		visit(tree, "listItem", (node: any) => {
			if (!node.children || node.children.length < 2) return;

			const newChildren = [];
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];
				newChildren.push(child);

				if (i < node.children.length - 1) {
					const next = node.children[i + 1];
					// If we have Text (or Paragraph containing text) followed by HTML in a list item
					// Inject a <br> to force a visual line break
					// The AST analysis showed the text is often wrapped in a paragraph node
					if (
						(child.type === "text" || child.type === "paragraph") &&
						next.type === "html"
					) {
						newChildren.push({ type: "html", value: "<br>" });
					}
				}
			}
			node.children = newChildren;
		});
	};
	/* eslint-enable */
}

function remarkExcalidraw(options: { app: App }) {
	/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
	return async (tree: any, file: any) => {
		let svgHtml = "";

		// First, find the Excalidraw block
		visit(tree, "code", (node: any, index: number, parent: any) => {
			if (node.lang === "compressed-json" && !svgHtml) {
				try {
					const decompressed = LZString.decompressFromBase64(
						node.value.replace(/\s/g, "") as string,
					);

					if (decompressed) {
						svgHtml = decompressed; // Store for valid check
					}
				} catch (e) {
					console.error("Failed to parse Excalidraw block", e);
				}
			}
		});

		if (svgHtml) {
			/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
			const json = JSON.parse(svgHtml);

			// Hydrate images
			if (options && options.app && file) {
				const content = file.toString();
				await hydrateExcalidrawFiles(options.app, json, content);
			}

			const svg = await exportToSvg({
				elements: json.elements || [],
				appState: {
					...json.appState,
					exportBackground: false,
					viewBackgroundColor: "transparent",
				},
				files: json.files || null,
			});
			/* eslint-enable */

			const svgString = svg.outerHTML;

			// Determine bounds
			const validSvg = svg;
			let width = 1000;
			let height = 1000;

			if (validSvg.hasAttribute("viewBox")) {
				const vb = validSvg.getAttribute("viewBox")?.split(" ").map(Number);
				if (vb && vb.length === 4) {
					width = vb[2] ?? 0;
					height = vb[3] ?? 0;
				}
			} else {
				width = Number(validSvg.getAttribute("width")) || 1000;
				height = Number(validSvg.getAttribute("height")) || 1000;
			}
			if (width <= 0) width = 1000;
			if (height <= 0) height = 1000;

			// Generate unique ID
			// Simple random ID
			const uniqueId = Math.random().toString(36).substring(2, 10);

			const interactiveHtml = generateInteractiveExcalidrawWrapper(
				svgString,
				uniqueId,
				width,
				height,
				true,
			);

			// Replace contents
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			tree.children = [
				{
					type: "html",
					value: interactiveHtml,
				},
			];
		}
	};
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
async function hydrateExcalidrawFiles(app: App, json: any, markdown: string) {
	// Parse '## Embedded Files' section
	const embeddedFilesRegex = /^([a-f0-9]{20,40}):\s*\[\[(.*?)\]\]/gm;
	let match;
	const fileMap = new Map<string, string>();

	while ((match = embeddedFilesRegex.exec(markdown)) !== null) {
		if (match[1] && match[2]) {
			fileMap.set(match[1], match[2]);
		}
	}

	// Initialize json.files if missing
	if (!json.files) {
		json.files = {};
	}

	// 1. Scan Elements for missing file references
	if (json.elements && Array.isArray(json.elements)) {
		for (const element of json.elements) {
			if (element.type === "image" && element.fileId) {
				// If file entry is missing in json.files, create a placeholder
				if (!json.files[element.fileId]) {
					json.files[element.fileId] = {
						id: element.fileId,
						// We'll try to guess mime type later or default
					};
				}
			}
		}
	}

	// 2. Iterate over json.files to hydrate
	for (const fileId in json.files) {
		const fileData = json.files[fileId];
		if (!fileData) continue;

		// If dataURL is missing or empty, try to resolve it
		if (!fileData.dataURL) {
			const linkText = fileMap.get(fileId);
			if (linkText) {
				// Resolve file
				const cleanLink = linkText.split("|")[0]; // Remove alias if any
				if (cleanLink) {
					const file = app.metadataCache.getFirstLinkpathDest(cleanLink, "");
					if (file instanceof TFile) {
						try {
							const arrayBuffer = await app.vault.readBinary(file);
							const base64 = arrayBufferToBase64(arrayBuffer);

							// Guess Mime Type if missing
							if (!fileData.mimeType) {
								const ext = file.extension.toLowerCase();
								switch (ext) {
									case "png":
										fileData.mimeType = "image/png";
										break;
									case "jpg":
									case "jpeg":
										fileData.mimeType = "image/jpeg";
										break;
									case "svg":
										fileData.mimeType = "image/svg+xml";
										break;
									case "gif":
										fileData.mimeType = "image/gif";
										break;
									case "webp":
										fileData.mimeType = "image/webp";
										break;
									default:
										fileData.mimeType = "application/octet-stream";
								}
							}

							fileData.dataURL = `data:${fileData.mimeType};base64,${base64}`;
						} catch (e) {
							console.error(
								`Failed to read embedded excalidraw file ${cleanLink}`,
								e,
							);
						}
					}
				}
			}
		}
	}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}
	return window.btoa(binary);
}
/* eslint-enable */

function rehypeCodeBlockEnhancer() {
	/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
	return (tree: any) => {
		visit(tree, "element", (node: any, index: any, parent: any) => {
			if (node.tagName === "pre" && node.children && node.children.length > 0) {
				const codeNode = node.children.find((c: any) => c.tagName === "code");
				if (codeNode && codeNode.properties && codeNode.properties.className) {
					const classes = codeNode.properties.className as string[];
					let lang = "";
					for (const c of classes) {
						if (c.startsWith("language-")) {
							lang = c.replace("language-", "");
							break;
						}
					}

					const displayLang = lang || "text";

					const wrapper = {
						type: "element",
						tagName: "div",
						properties: { className: ["code-block-wrapper"] },
						children: [
							{
								type: "element",
								tagName: "div",
								properties: { className: ["code-block-header"] },
								children: [
									{
										type: "element",
										tagName: "span",
										properties: { className: ["language-label"] },
										children: [{ type: "text", value: displayLang }],
									},
									{
										type: "element",
										tagName: "button",
										properties: { className: ["copy-button"] },
										children: [{ type: "text", value: "Copy" }],
									},
								],
							},
							node,
						],
					};

					if (
						parent &&
						parent.properties &&
						parent.properties.className &&
						parent.properties.className.includes("code-block-wrapper")
					) {
						return;
					}

					if (parent && typeof index === "number") {
						parent.children[index] = wrapper;
					}
				}
			}
		});
	};
	/* eslint-enable */
}

function remarkRelativeLinkNormalizer() {
	/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
	return (tree: any) => {
		const visitor = (node: any) => {
			if (
				node.url &&
				!node.url.startsWith("http") &&
				!node.url.startsWith("mailto:") &&
				!node.url.startsWith("#")
			) {
				// Flatten path to just filename
				const cleanUrl = node.url.split(/[?#]/)[0];
				if (cleanUrl) {
					const parts = cleanUrl.split("/");
					const filename = parts[parts.length - 1];
					node.url = filename;

					// Handle Embed Transformation for "image" nodes (which syntax ![]() parses to)
					// If the extension is not an image, convert to HTML embed
					if (node.type === "image") {
						const ext = filename.split(".").pop()?.toLowerCase();
						const altText = node.alt || filename;
						let replacement = "";

						switch (ext) {
							case "png":
							case "jpg":
							case "jpeg":
							case "gif":
							case "svg":
							case "webp":
								// Normal image, do nothing (url already flattened)
								break;
							case "mp4":
							case "webm":
							case "ogv":
							case "mov":
								replacement = `<video controls src="${filename}" style="max-width: 100%;"><a href="${filename}">Download Video</a></video>`;
								break;
							case "mp3":
							case "wav":
							case "ogg":
							case "m4a":
								replacement = `<audio controls src="${filename}"></audio>`;
								break;
							case "pdf":
								replacement = `<embed src="${filename}" type="application/pdf" class="pdf-embed" />`;
								break;
							default:
								// Fallback for other files (zip, doc, etc) -> Download Link
								// ![]() syntax for non-media usually implies embedding, but if we can't embed, link it?
								// Or leave it valid so user can click?
								// Converting to <a> makes sense for downloads.
								replacement = `<a href="${filename}" download class="download-link">Download ${altText}</a>`;
								break;
						}

						if (replacement) {
							node.type = "html";
							node.value = replacement;
							// Clear other image properties to be safe
							delete node.url;
							delete node.alt;
							delete node.title;
						}
					}
				}
			}
		};

		visit(tree, "image", visitor);
		visit(tree, "link", visitor);
	};
	/* eslint-enable */
}

function rehypeIframeEnhancer() {
	/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
	return (tree: any) => {
		visit(tree, "element", (node: any) => {
			if (node.tagName === "iframe") {
				const properties = node.properties || {};
				const { width, height, style } = properties;

				// Check if style already defines height (e.g. from transformExternalEmbeds which sets height: 100%)
				const styleString = String(
					Array.isArray(style) ? style.join(";") : style || "",
				);
				const hasHeightInStyle = /height\s*:/i.test(styleString);

				if (width && height) {
					// Scenario: Inline attributes present
					// User wants full width, and height based on aspect ratio
					const w = parseInt(String(width), 10);
					const h = parseInt(String(height), 10);

					if (!isNaN(w) && !isNaN(h)) {
						const newStyle = `width: 100%; aspect-ratio: ${w} / ${h};`;
						// Append to existing style
						node.properties.style = styleString
							? `${styleString}; ${newStyle}`
							: newStyle;
					}
				} else if (!hasHeightInStyle) {
					// Scenario: No attributes, no existing height style
					// Default to 3:2 aspect ratio (1.5)
					const defaultStyle = "width: 100%; aspect-ratio: 3 / 2;";
					node.properties.style = styleString
						? `${styleString}; ${defaultStyle}`
						: defaultStyle;
				}
			}
		});
	};
	/* eslint-enable */
}
