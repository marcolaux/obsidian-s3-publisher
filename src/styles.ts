export const CSS_VARIABLES = `
    :root {
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

        /* Canvas Specific Colors */
        --canvas-bg: #e0e0e0;
        --world-bg: #f5f5f5;
        --node-bg: #ffffff;
        --node-border: #cccccc;
        --node-shadow: rgba(0,0,0,0.1);
    }

    @media (prefers-color-scheme: dark) {
        :root {
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

            /* Canvas Specific Colors */
            --canvas-bg: #010409;
            --world-bg: #0d1117;
            --node-bg: #161b22;
            --node-border: #30363d;
            --node-shadow: rgba(0,0,0,0.5);
        }
    }
`;

export const MARKDOWN_STYLES = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: var(--text-color); background-color: var(--bg-color); }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    
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

// Helper to scope styles under .canvas-node-content if needed,
// or we can just import the raw string if we carefully write CSS selectors.
// But for cleaner reuse, the MARKDOWN_STYLES above is written for global 'body',
// whereas Canvas needs them scoped.
// Let's create a scoped version helper or separate the rules.

export const SCOPED_MARKDOWN_STYLES = `
    /* Shared Markdown Styles applied to .canvas-node-content */
    .canvas-node-content img { max-width: 100%; height: auto; }
    .canvas-node-content h1 { font-size: 1.8em; margin-top: 0; color: var(--text-color); }
    .canvas-node-content h2 { font-size: 1.5em; color: var(--text-color); }
    
    .canvas-node-content a { color: var(--link-color); text-decoration: none; }
    .canvas-node-content a:hover { text-decoration: underline; }
    
    .canvas-node-content code { background: var(--code-bg); padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
    .canvas-node-content pre { background: var(--code-bg); padding: 16px; overflow: auto; border-radius: 6px; }
    .canvas-node-content blockquote { border-left: 4px solid var(--blockquote-border); color: var(--blockquote-color); padding-left: 1em; margin-left: 0; }
    
    .canvas-node-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    .canvas-node-content th, .canvas-node-content td { border: 1px solid var(--table-border); padding: 6px 13px; }
    .canvas-node-content th { background-color: var(--table-header-bg); font-weight: 600; }
    .canvas-node-content tr:nth-child(2n) { background-color: var(--table-row-even-bg); }
    
    .canvas-node-content ul.contains-task-list { list-style-type: none; padding-left: 0; }
    .canvas-node-content li.task-list-item { list-style-type: none; }
    
    .canvas-node-content .tag {
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
`;

export const SYNTAX_HIGHLIGHTING_STYLES = `
pre code.hljs{display:block;overflow-x:auto;}.hljs{color:#24292e;}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#005cc5}.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#032f62}.hljs-built_in,.hljs-symbol{color:#e36209}.hljs-comment,.hljs-code,.hljs-formula{color:#6a737d}.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#22863a}.hljs-subst{color:#24292e}.hljs-section{color:#005cc5;font-weight:bold}.hljs-bullet{color:#735c0f}.hljs-emphasis{color:#24292e;font-style:italic}.hljs-strong{color:#24292e;font-weight:bold}.hljs-addition{color:#22863a;background-color:#f0fff4}.hljs-deletion{color:#b31d28;background-color:#ffeef0}.hljs-char.escape_,.hljs-link,.hljs-params,.hljs-property,.hljs-punctuation,.hljs-tag{}

@media (prefers-color-scheme: dark) {
    pre code.hljs{display:block;overflow-x:auto;}.hljs{color:#c9d1d9;}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#ff7b72}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#d2a8ff}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#79c0ff}.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#a5d6ff}.hljs-built_in,.hljs-symbol{color:#ffa657}.hljs-comment,.hljs-code,.hljs-formula{color:#8b949e}.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#7ee787}.hljs-subst{color:#c9d1d9}.hljs-section{color:#1f6feb;font-weight:bold}.hljs-bullet{color:#f2cc60}.hljs-emphasis{color:#c9d1d9;font-style:italic}.hljs-strong{color:#c9d1d9;font-weight:bold}.hljs-addition{color:#aff5b4;background-color:#033a16}.hljs-deletion{color:#ffdcd7;background-color:#67060c}.hljs-char.escape_,.hljs-link,.hljs-params,.hljs-property,.hljs-punctuation,.hljs-tag{}
}
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

    /* Dark mode adjustment for inactive lines */
    @media (prefers-color-scheme: dark) {
        .toc-indicator {
            background-color: rgba(255,255,255,0.15);
        }
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

    /* Dark mode active color */
    @media (prefers-color-scheme: dark) {
        .toc-item.active .toc-indicator {
            background-color: #ededed;
        }
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
`;
