# Obsidian S3/MinIO Publisher - Developer Guide

## Project Overview

**Obsidian S3 Publisher** is a high-performance publishing tool that statically renders Obsidian notes, Canvas files, and Excalidraw drawings to HTML and deploys them to any S3-compatible storage.

- **Core Tech**: TypeScript, Obsidian API, `@aws-sdk/client-s3`.
- **Rendering**:
  - **Markdown**: Unified ecosystem (`unified`, `remark`, `rehype`) for robust AST transformations.
  - **Canvas**: Custom `CanvasCompiler` utilizing HTML5 SVG + Cubic Bézier curves for interactive rendering.
  - **Excalidraw**: Native support via `compress/decompress` and SVG export.
- **Architecture**:
  - **Publisher**: Agnostic S3 interface for uploading, deleting, and recursive asset discovery.
  - **Compilers**: Decoupled rendering logic for Markdown, Canvas, and Excalidraw.
  - **UI**: Native Obsidian DOM approach for settings and context menus.

## Build & Run

- **Build**: `npm run build` (Outputs `main.js`, `manifest.json`, `styles.css` to release structure).
- **Dev**: `npm run dev` (Watches for changes).
- **Lint**: `npm run lint` (Checks standard Obsidian rules + strict typing).

## Code Style & Conventions

- **Strict TypeScript**: No implicit `any`. Interfaces for all data structures (e.g., `CanvasData`, `ShareFrontMatter`).
  - **Lint**: `npm run lint` (Checks standard Obsidian rules + strict typing). Always lint after you changed more than 10 lines of code.
  - IMPORTANT: Try to avoid any es lint ignores and create proper type definitions.
  - Type definitions always have to be defined at the start of the file after the imports.
- **Async/Await**: Preferred over Promises.
- **Error Handling**: Wrap all network and parsing logic in `try/catch` with user-facing `Notice()` feedback.
- **CSS Variables**: Use Obsidian's native variables (`--background-primary`, `--text-normal`) for dark mode compatibility.

## File Structure

```
src/
  main.ts                # Plugin entry & lifecycle (Commands, Context Menu, Events)
  settings.ts            # Tabbed Settings UI & Data Persistence
  publisher.ts           # S3/MinIO logic (Upload, Delete, Policy)
  compiler.ts            # Markdown -> HTML Compiler (Unified Pipeline)
  canvas-compiler.ts     # Canvas JSON -> Interactive HTML/SVG
  interactive-excalidraw.ts # Excalidraw Interactive Wrapper
  styles.ts              # Global CSS & HTML Boilerplates
```

## Key Workflows

### 1. Publishing Flow

1.  **User Action**: Command or Context Menu triggers `publishNote(file)`.
2.  **Asset Discovery**:
    - Recursive scan of imports (`![[image.png]]`, embedded notes).
    - Detects `banner` frontmatter.
3.  **Compilation**:
    - **Markdown**: Transformed to HTML, assets rewritten to relative paths.
    - **Canvas**: Parsed to JSON, nodes rendered as interactive HTML/SVG.
4.  **Upload**:
    - Files uploaded with `public-read` ACL (or bucket policy relies on public access).
    - Metadata (Share ID) saved to file frontmatter/JSON to track state.

### 2. Context Menu Logic

- Menu items are dynamic based on state:
  - **New Note**: Shows "S3: Publish Note".
  - **Published Note**: Shows "S3: Update published note" and "S3: Unpublish".
  - **View Online**: Only appears if `share_id` exists.

## Testing

- **Manual**: Use `install-local.sh` (if available) or copy artifacts to `.obsidian/plugins/obsidian-s3-publisher`.
- **Validation**:
  - Check "Test Connection" in settings for S3 reachability.
  - Verify "View Online" opens the correct URL.
  - Confirm Dark Mode toggling works on published pages.

## Release Process

1.  Bump version in `manifest.json` and `package.json`.
2.  Run `npm run build` to generate artifacts.
3.  Commit and Tag release in git.
4.  Upload `main.js`, `manifest.json`, `styles.css` to GitHub Release.

---
