export const LIGHT_VARS = `
    /* Shared Markdown Colors */
    --bg-color: #ffffff;
    --text-color: #333333;
    --heading-border: #eaecef;
    --code-bg: #f6f8fa;
    --blockquote-border: #dfe2e5;
    --blockquote-color: #6a737d;
    --table-border: #dfe2e5;
    --table-header-bg: #f6f8fa;
    --table-row-even-bg: #f6f8fa;
    --tag-bg: #f6f8fa;
    --tag-border: #d1d5da;
    --tag-text: #0969da;
    --link-color: #0969da;
    --embed-border: #dfe2e5;
    --embed-bg: #fafafa;
    
    /* Interactive Controls defaults (Light) */
    --text-muted: #888888;
    --interactive-normal: #ffffff;
    --interactive-hover: #f0f0f0;
    --background-modifier-border: #ddd;

    /* Canvas Specific Colors */
    --canvas-bg: #e0e0e0;
    --world-bg: #f5f5f5;
    --node-bg: #ffffff;
    --node-border: #cccccc;
    --node-shadow: rgba(0,0,0,0.1);
`;

export const DARK_VARS = `
    /* Shared Markdown Colors */
    --bg-color: #0d1117;
    --text-color: #c9d1d9;
    --heading-border: #21262d;
    --code-bg: #161b22;
    --blockquote-border: #30363d;
    --blockquote-color: #8b949e;
    --table-border: #30363d;
    --table-header-bg: #161b22;
    --table-row-even-bg: #161b22;
    --tag-bg: #161b22;
    --tag-border: #30363d;
    --tag-text: #58a6ff;
    --link-color: #58a6ff;
    --embed-border: #30363d;
    --embed-bg: #0d1117;

    /* Interactive Controls defaults (Dark) */
    --text-muted: #8b949e;
    --interactive-normal: #161b22;
    --interactive-hover: #1f2428;
    --background-modifier-border: #30363d;

    /* Canvas Specific Colors */
    --canvas-bg: #010409;
    --world-bg: #0d1117;
    --node-bg: #161b22;
    --node-border: #30363d;
    --node-shadow: rgba(0,0,0,0.5);
`;

export const CSS_VARIABLES = `
    :root {
        ${LIGHT_VARS}
    }

    @media (prefers-color-scheme: dark) {
        :root {
            ${DARK_VARS}
        }
    }
    
    /* Class-based Dark Mode Support */
    .theme-dark, .theme--dark {
        ${DARK_VARS}
    }
`;

const BASE_MARKDOWN_STYLES = `
    img { max-width: 100%; height: auto; border-radius: 8px; }
    
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    
    code { background: var(--code-bg); padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
    pre { background: var(--code-bg); padding: 16px; overflow: auto; border-radius: 6px; }
    blockquote { border-left: 4px solid var(--blockquote-border); color: var(--blockquote-color); padding-left: 1em; margin-left: 0; }
    
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--table-border); padding: 6px 13px; }
    th { background-color: var(--table-header-bg); font-weight: 600; }
    tr:nth-child(2n) { background-color: var(--table-row-even-bg); }
    
    ul.contains-task-list { list-style-type: none; padding-left: 0; }
    li.task-list-item { list-style-type: none; }
    
    .tag {
        background-color: var(--tag-bg);
        border: 1px solid var(--tag-border);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 0.9em;
        color: var(--tag-text);
        display: inline-block;
        vertical-align: top;
        margin: 0 2px;
        line-height: 1.2;
    }

    /* Code Block Enhancements */
    .code-block-wrapper {
        position: relative;
        margin: 1em 0;
        border-radius: 6px;
        overflow: hidden;
        background: var(--code-bg);
    }

    .code-block-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 16px;
        background: rgba(0, 0, 0, 0.05);
        color: var(--text-color);
        font-size: 0.8em;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        border-bottom: 1px solid var(--embed-border);
    }

    .code-block-header .language-label {
        font-weight: 600;
        text-transform: uppercase;
        opacity: 0.7;
    }

    .copy-button {
        background: none;
        border: 1px solid var(--tag-border);
        border-radius: 4px;
        color: var(--text-color);
        cursor: pointer;
        padding: 2px 8px;
        font-size: 0.9em;
        opacity: 0.7;
        transition: all 0.2s ease;
    }

    .copy-button:hover {
        opacity: 1;
        background: var(--tag-bg);
    }

    .copy-success {
        color: #22863a;
        border-color: #22863a;
    }

    /* Adjust PRE to generally fit inside wrapper without double styling if possible */
    .code-block-wrapper pre {
        margin: 0;
        border-top-left-radius: 0;
        border-top-right-radius: 0;
    }
`;

// Helper to scope styles
function scopeStyles(css: string, selectorPrefix: string): string {
	// Naive replace for simple selectors.
	// This assumes straightforward CSS formatting as in BASE_MARKDOWN_STYLES.
	// We'll replace newline + selector with newline + prefix + space + selector
	// But we need to be careful with media queries or nested blocks if any.
	// The BASE_MARKDOWN_STYLES above is flat.
	return css
		.split("}")
		.map((chunk) => {
			const trimmed = chunk.trim();
			if (!trimmed) return "";
			const parts = trimmed.split("{");
			if (parts.length < 2) return chunk;

			const selectors = parts[0];
			const body = parts[1];

			if (selectors === undefined) return chunk;

			const scopedSelectors = selectors
				.split(",")
				.map((s) => {
					const cleanS = s.trim();
					// If it starts with @media or keyframes, we can't scope it easily this way, but our base styles don't have them.
					return `${selectorPrefix} ${cleanS}`;
				})
				.join(", ");

			return `${scopedSelectors} { ${body} }`;
		})
		.join("\n");
}

export const MARKDOWN_STYLES = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: var(--text-color); background-color: var(--bg-color); }
    
    .banner-container { width: 100%; height: 200px; overflow: hidden; margin-bottom: 20px; border-radius: 8px; }
    .banner-image { width: 100%; height: 100%; object-fit: cover; }
    
    .embedded-note-container {
        border-left: 4px solid var(--embed-border); 
        padding-left: 1em; 
        margin: 1em 0;
        background: var(--embed-bg);
        border-radius: 4px;
        padding-top: 5px;
        padding-bottom: 5px;
    }

    ${BASE_MARKDOWN_STYLES}
`;

export const SCOPED_MARKDOWN_STYLES = `
    .canvas-node-content h1 { font-size: 1.8em; margin-top: 0; color: var(--text-color); }
    .canvas-node-content h2 { font-size: 1.5em; color: var(--text-color); }
    
    ${scopeStyles(BASE_MARKDOWN_STYLES, ".canvas-node-content")}
`;

const HLJS_LIGHT = `pre code.hljs{display:block;overflow-x:auto;}.hljs{color:#24292e;}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#005cc5}.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#032f62}.hljs-built_in,.hljs-symbol{color:#e36209}.hljs-comment,.hljs-code,.hljs-formula{color:#6a737d}.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#22863a}.hljs-subst{color:#24292e}.hljs-section{color:#005cc5;font-weight:bold}.hljs-bullet{color:#735c0f}.hljs-emphasis{color:#24292e;font-style:italic}.hljs-strong{color:#24292e;font-weight:bold}.hljs-addition{color:#22863a;background-color:#f0fff4}.hljs-deletion{color:#b31d28;background-color:#ffeef0}.hljs-char.escape_,.hljs-link,.hljs-params,.hljs-property,.hljs-punctuation,.hljs-tag{}`;
const HLJS_DARK = `pre code.hljs{display:block;overflow-x:auto;}.hljs{color:#c9d1d9;}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#ff7b72}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#d2a8ff}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#79c0ff}.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#a5d6ff}.hljs-built_in,.hljs-symbol{color:#ffa657}.hljs-comment,.hljs-code,.hljs-formula{color:#8b949e}.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#7ee787}.hljs-subst{color:#c9d1d9}.hljs-section{color:#1f6feb;font-weight:bold}.hljs-bullet{color:#f2cc60}.hljs-emphasis{color:#c9d1d9;font-style:italic}.hljs-strong{color:#c9d1d9;font-weight:bold}.hljs-addition{color:#aff5b4;background-color:#033a16}.hljs-deletion{color:#ffdcd7;background-color:#67060c}.hljs-char.escape_,.hljs-link,.hljs-params,.hljs-property,.hljs-punctuation,.hljs-tag{}`;

export const SYNTAX_HIGHLIGHTING_STYLES = `
    ${HLJS_LIGHT}
    
    @media (prefers-color-scheme: dark) {
        ${HLJS_DARK}
    }
    
    .theme-dark ${HLJS_DARK}
    .theme--dark ${HLJS_DARK}
`;

export const TOC_STYLES = `
    /* TOC Container */
    .affine-toc-container {
        position: fixed;
        right: 20px;
        top: 100px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        /* Increase hover area slightly without moving elements */
        padding-left: 20px; 
    }

    /* Individual Item Wrapper */
    .toc-item {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        cursor: pointer;
        position: relative;
        height: 20px; /* Hit area height */
    }

    /* The Text Label (Hidden by default, expands on global hover) */
    .toc-text {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        color: var(--text-color);
        white-space: nowrap;
        opacity: 0;
        transform: translateX(10px);
        margin-right: 12px;
        /* Transitions */
        transition: opacity 0.12s 0.12s, transform 0.12s 0.12s;
        pointer-events: none; /* Let clicks pass through to item */
    }

    /* The Indicator Line */
    .toc-indicator {
        height: 2px;
        border-radius: 2px;
        background-color: rgba(0,0,0,0.1);
        transition: all 0.2s ease;
    }

    /* Hierarchy Widths */
    .toc-item[data-level="1"] .toc-indicator { width: 24px; }
    .toc-item[data-level="2"] .toc-indicator { width: 20px; }
    .toc-item[data-level="3"] .toc-indicator { width: 16px; }
    .toc-item[data-level="4"] .toc-indicator { width: 14px; }
    .toc-item[data-level="5"] .toc-indicator { width: 12px; }
    .toc-item[data-level="6"] .toc-indicator { width: 12px; }

    /* Active State */
    .toc-item.active .toc-indicator {
        width: 24px; /* Always expands to full width */
        background-color: #1e1e1e; /* Dark/Black */
    }

    .toc-item.active .toc-text {
        color: var(--link-color);
        font-weight: 500;
    }

    /* Global Hover Effect: Show all text when hovering the container */
    .affine-toc-container:hover .toc-text {
        opacity: 1;
        transform: translateX(0);
        pointer-events: auto;
    }
    
    /* Hide on mobile/small screens */
    @media (max-width: 1000px) {
        .affine-toc-container {
            display: none;
        }
    }

    /* Dark Mode Support */
    @media (prefers-color-scheme: dark) {
        .toc-indicator { background-color: rgba(255,255,255,0.15); }
        .toc-item.active .toc-indicator { background-color: #ededed; }
    }
    
    .theme-dark .toc-indicator, .theme--dark .toc-indicator {
        background-color: rgba(255,255,255,0.15);
    }
    
    .theme-dark .toc-item.active .toc-indicator, .theme--dark .toc-item.active .toc-indicator {
        background-color: #ededed;
    }
`;

const EXCALIDRAW_VARS_LIGHT = `
  --theme-filter: none;
  --button-destructive-bg-color: #ffe3e3;
  --button-destructive-color: #c92a2a;
  --button-gray-1: #e9ecef;
  --button-gray-2: #ced4da;
  --button-gray-3: #adb5bd;
  --mobile-action-button-bg: rgba(255, 255, 255, 0.35);
  --mobile-color-border: var(--default-border-color);
  --button-special-active-bg-color: #ebfbee;
  --dialog-border-color: var(--color-gray-20);
  --dropdown-icon: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="292.4" height="292.4" viewBox="0 0 292 292"><path d="M287 197L159 69c-4-3-8-5-13-5s-9 2-13 5L5 197c-3 4-5 8-5 13s2 9 5 13c4 4 8 5 13 5h256c5 0 9-1 13-5s5-8 5-13-1-9-5-13z"/></svg>');
  --focus-highlight-color: #d0ebff;
  --icon-fill-color: var(--color-on-surface);
  --icon-green-fill-color: #2b8a3e;
  --default-bg-color: #ffffff;
  --input-bg-color: #ffffff;
  --input-border-color: #ced4da;
  --input-hover-bg-color: #f1f3f5;
  --input-label-color: #495057;
  --island-bg-color: #ffffff;
  --keybinding-color: var(--color-gray-40);
  --link-color: #228be6;
  --overlay-bg-color: rgba(255, 255, 255, 0.88);
  --popup-bg-color: var(--island-bg-color);
  --popup-secondary-bg-color: #f1f3f5;
  --popup-text-color: #000000;
  --popup-text-inverted-color: #ffffff;
  --select-highlight-color: #4dabf7;
  --shadow-island: 0px 0px 0.9310142993927002px 0px rgba(0, 0, 0, 0.17),
    0px 0px 3.1270833015441895px 0px rgba(0, 0, 0, 0.08),
    0px 7px 14px 0px rgba(0, 0, 0, 0.05);

  --button-hover-bg: var(--color-surface-high);
  --button-active-bg: var(--color-surface-high);
  --button-active-border: var(--color-brand-active);
  --default-border-color: var(--color-surface-high);

  --default-button-size: 2rem;
  --default-icon-size: 1rem;
  --lg-button-size: 2.25rem;
  --lg-icon-size: 1rem;
  --editor-container-padding: 1rem;
  --mobile-action-button-size: 2rem;

  --scrollbar-thumb: var(--button-gray-2);
  --scrollbar-thumb-hover: var(--button-gray-3);

  --color-slider-track: hsl(240, 100%, 90%);
  --color-slider-thumb: var(--color-gray-80);

  --modal-shadow: 0px 100px 80px rgba(0, 0, 0, 0.07),
    0px 41.7776px 33.4221px rgba(0, 0, 0, 0.0503198),
    0px 22.3363px 17.869px rgba(0, 0, 0, 0.0417275),
    0px 12.5216px 10.0172px rgba(0, 0, 0, 0.035),
    0px 6.6501px 5.32008px rgba(0, 0, 0, 0.0282725),
    0px 2.76726px 2.21381px rgba(0, 0, 0, 0.0196802);
  --avatar-border-color: var(--color-gray-20);
  --sidebar-shadow: 0px 100px 80px rgba(0, 0, 0, 0.07),
    0px 41.7776px 33.4221px rgba(0, 0, 0, 0.0503198),
    0px 22.3363px 17.869px rgba(0, 0, 0, 0.0417275),
    0px 12.5216px 10.0172px rgba(0, 0, 0, 0.035),
    0px 6.6501px 5.32008px rgba(0, 0, 0, 0.0282725),
    0px 2.76726px 2.21381px rgba(0, 0, 0, 0.0196802);
  --sidebar-border-color: var(--color-surface-high);
  --sidebar-bg-color: var(--island-bg-color);
  --library-dropdown-shadow: 0px 15px 6px rgba(0, 0, 0, 0.01),
    0px 8px 5px rgba(0, 0, 0, 0.05), 0px 4px 4px rgba(0, 0, 0, 0.09),
    0px 1px 2px rgba(0, 0, 0, 0.1), 0px 0px 0px rgba(0, 0, 0, 0.1);

  --space-factor: 0.25rem;
  --text-primary-color: var(--color-on-surface);

  --color-selection: #6965db;

  --color-icon-white: #ffffff;

  --color-primary: #6965db;
  --color-primary-darker: #5b57d1;
  --color-primary-darkest: #4a47b1;
  --color-primary-light: #e3e2fe;
  --color-primary-light-darker: #d7d5ff;
  --color-primary-hover: #5753d0;

  --color-gray-10: #f5f5f5;
  --color-gray-20: #ebebeb;
  --color-gray-30: #d6d6d6;
  --color-gray-40: #b8b8b8;
  --color-gray-50: #999999;
  --color-gray-60: #7a7a7a;
  --color-gray-70: #5c5c5c;
  --color-gray-80: #3d3d3d;
  --color-gray-85: #242424;
  --color-gray-90: #1e1e1e;
  --color-gray-100: #121212;

  --color-disabled: var(--color-gray-40);

  --color-warning: #fceeca;
  --color-warning-dark: #f5c354;
  --color-warning-darker: #f3ab2c;
  --color-warning-darkest: #ec8b14;
  --color-text-warning: var(--text-primary-color);

  --color-danger: #db6965;
  --color-danger-dark: #db6965;
  --color-danger-darker: #d65550;
  --color-danger-darkest: #d1413c;
  --color-danger-text: black;

  --color-danger-background: #fff0f0;
  --color-danger-icon-background: #ffdad6;
  --color-danger-color: #700000;
  --color-danger-icon-color: #700000;

  --color-warning-background: var(--color-warning);
  --color-warning-icon-background: var(--color-warning-dark);
  --color-warning-color: var(--text-primary-color);
  --color-warning-icon-color: var(--text-primary-color);

  --color-muted: var(--color-gray-30);
  --color-muted-darker: var(--color-gray-60);
  --color-muted-darkest: var(--color-gray-100);
  --color-muted-background: var(--color-gray-80);
  --color-muted-background-darker: var(--color-gray-100);

  --color-promo: var(--color-primary);

  --color-success: #cafccc;
  --color-success-darker: #bafabc;
  --color-success-darkest: #a5eba8;
  --color-success-text: #268029;
  --color-success-contrast: #65bb6a;
  --color-success-contrast-hover: #6bcf70;
  --color-success-contrast-active: #6edf74;

  --color-logo-icon: var(--color-primary);
  --color-logo-text: #190064;

  --border-radius-md: 0.375rem;
  --border-radius-lg: 0.5rem;

  --color-surface-high: #f1f0ff;
  --color-surface-mid: #f6f6f9;
  --color-surface-low: #ececf4;
  --color-surface-lowest: #ffffff;
  --color-on-surface: #1b1b1f;
  --color-brand-hover: #5753d0;
  --color-on-primary-container: #030064;
  --color-surface-primary-container: #e0dfff;
  --color-brand-active: #4440bf;
  --color-border-outline: #767680;
  --color-border-outline-variant: #c5c5d0;
  --color-surface-primary-container: #e0dfff;

  --color-badge: #0b6513;
  --background-color-badge: #d3ffd2;
`;

const EXCALIDRAW_VARS_DARK = `
    --theme-filter: invert(93%) hue-rotate(180deg);
    --button-destructive-bg-color: #5a0000;
    --button-destructive-color: #ffa8a8;

    --button-gray-1: #363636;
    --button-gray-2: #272727;
    --button-gray-3: #222;
    --mobile-action-button-bg: var(--island-bg-color);
    --mobile-color-border: rgba(255, 255, 255, 0.85);
    --button-special-active-bg-color: #204624;
    --dialog-border-color: var(--color-gray-80);
    --dropdown-icon: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="292.4" height="292.4" viewBox="0 0 292 292"><path fill="%23ced4da" d="M287 197L159 69c-4-3-8-5-13-5s-9 2-13 5L5 197c-3 4-5 8-5 13s2 9 5 13c4 4 8 5 13 5h256c5 0 9-1 13-5s5-8 5-13-1-9-5-13z"/></svg>');
    --focus-highlight-color: #339af0;
    --icon-green-fill-color: #69db7c;
    --default-bg-color: #121212;
    --input-bg-color: #121212;
    --input-border-color: #2e2e2e;
    --input-hover-bg-color: #181818;
    --input-label-color: #e9ecef;
    --island-bg-color: #232329;
    --keybinding-color: var(--color-gray-60);
    --link-color: #74c0fc;
    --overlay-bg-color: rgba(52, 58, 64, 0.12);
    --popup-secondary-bg-color: #222;
    --popup-text-color: #ced4da;
    --popup-text-inverted-color: #2c2c2c;
    --select-highlight-color: #74c0fc;
    --shadow-island: 0px 0px 0.9310142993927002px 0px rgba(0, 0, 0, 0.17),
      0px 0px 3.1270833015441895px 0px rgba(0, 0, 0, 0.08),
      0px 7px 14px 0px rgba(0, 0, 0, 0.05);

    --modal-shadow: 0px 100px 80px rgba(0, 0, 0, 0.07),
      0px 41.7776px 33.4221px rgba(0, 0, 0, 0.0503198),
      0px 22.3363px 17.869px rgba(0, 0, 0, 0.0417275),
      0px 12.5216px 10.0172px rgba(0, 0, 0, 0.035),
      0px 6.6501px 5.32008px rgba(0, 0, 0, 0.0282725),
      0px 2.76726px 2.21381px rgba(0, 0, 0, 0.0196802);
    --avatar-border-color: var(--color-gray-85);

    --scrollbar-thumb: #343a40;
    --scrollbar-thumb-hover: #495057;

    --color-slider-track: hsl(244, 23%, 39%);

    --color-selection: #3530c4;

    --color-icon-white: var(--color-gray-90);

    --color-primary: #a8a5ff;
    --color-primary-darker: #b2aeff;
    --color-primary-darkest: #beb9ff;
    --color-primary-light: #4f4d6f;
    --color-primary-light-darker: #43415e;
    --color-primary-hover: #bbb8ff;

    --color-disabled: var(--color-gray-70);

    --color-text-warning: var(--color-gray-80);

    --color-danger: #ffa8a5;
    --color-danger-dark: #672120;
    --color-danger-darker: #8f2625;
    --color-danger-darkest: #ac2b29;
    --color-danger-text: #fbcbcc;

    --color-danger-background: #fbcbcc;
    --color-danger-icon-background: #672120;
    --color-danger-color: #261919;
    --color-danger-icon-color: #fbcbcc;

    --color-warning-background: var(--color-warning);
    --color-warning-icon-background: var(--color-warning-dark);
    --color-warning-color: var(--color-gray-80);
    --color-warning-icon-color: var(--color-gray-80);

    --color-muted: var(--color-gray-80);
    --color-muted-darker: var(--color-gray-60);
    --color-muted-darkest: var(--color-gray-20);
    --color-muted-background: var(--color-gray-40);
    --color-muted-background-darker: var(--color-gray-20);

    --color-logo-text: #e2dfff;

    --color-surface-high: #2e2d39;
    --color-surface-low: hsl(240, 8%, 15%);
    --color-surface-mid: hsl(240 6% 10%);
    --color-surface-lowest: hsl(0, 0%, 7%);
    --color-on-surface: #e3e3e8;
    --color-brand-hover: #bbb8ff;
    --color-on-primary-container: #e0dfff;
    --color-surface-primary-container: #403e6a;
    --color-brand-active: #d0ccff;
    --color-border-outline: #8e8d9c;
    --color-border-outline-variant: #46464f;
    --color-surface-primary-container: #403e6a;
    
    /* Ensure icon color is explicit */
    --icon-fill-color: var(--color-on-surface);
`;

export const EXCALIDRAW_STYLES = `
.excalidraw {
    ${EXCALIDRAW_VARS_LIGHT}
}

/* Apply the filter to the SVG */
.excalidraw svg {
  filter: var(--theme-filter);
  width: 100%;
  height: 100%;
}

@media screen and (min-device-width: 1921px) {
  .excalidraw {
    --lg-button-size: 2.5rem;
    --lg-icon-size: 1.25rem;
    --default-button-size: 2.25rem;
    --default-icon-size: 1.25rem;
  }
}

@media (max-width: 768px) {
  .excalidraw {
    --editor-container-padding: 0.75rem;
  }
}

@media (prefers-color-scheme: dark) {
  .excalidraw {
    ${EXCALIDRAW_VARS_DARK}
  }
}

/* Replicate for Class-based Dark Mode */
.theme-dark .excalidraw, .theme--dark .excalidraw {
    ${EXCALIDRAW_VARS_DARK}
}
`;
