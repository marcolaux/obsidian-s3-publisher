# Obsidian S3/MinIO Publisher

Publish your Obsidian notes, Canvas files, and Excalidraw drawings as beautiful, static HTML to any S3-compatible object storage (MinIO, AWS S3, DigitalOcean Spaces, Cloudflare R2).

## Features

- **🌐 Universal S3 Support**: Works with AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces, and more.
- **🎨 Infinite Canvas Publishing**: Full support for Obsidian Canvas.
  - Renders nodes, edges, groups, and colors.
  - **Interactive**: Pan, zoom-to-cursor, and drag support (D3-like controls).
  - **Embedded Content**: Supports images and nested Markdown files within Canvas.
- **✏️ Excalidraw Support**:
  - **Full-Page View**: Publish `.excalidraw.md` files as zoomable, pannable interactive pages.
  - **Interactive Embeds**: Use `![[drawing.excalidraw]]` inside notes. Embeds are **fully interactive** (pan/zoom) and responsive.
  - **Smart Rendering**: Automatically handles light/dark mode transparency and embedded images.
- **📝 Rich Markdown Rendering**:
  - Supports **Core Obsidian syntax** (bold, italic, lists, blockquotes).
  - **Images & Assets**: Automatically uploads local images and attachments to S3.
  - **Embeds**: Recursively resolves and includes `![[Note]]` embeds.
  - **Callouts & Tables**: Renders standard Markdown tables and callouts.
  - **Dark Mode**: Respects system preferences for light/dark themes.
- **🔐 Private Link Generation**: Generates obfuscated UUID paths (e.g., `.../share_id/index.html`) for secure sharing.
- **🛠️ Developer Friendly**:
  - **Test Connection**: Verify your S3 credentials directly from settings with animated feedback.
  - **Tabbed Settings**: Organized UI for managing connections and published files.
  - **Smart Context Menu**:
    - **Publish/Update**: Scans if a file is already live and toggles between "S3: Publish" and "S3: Update published note".
    - **Safe Unpublish**: "Unpublish" option only appears for active files.

## Screenshots

### 1. Published Canvas

_A complex Obsidian Canvas rendered with full interactivity and styling._

<!-- Add screenshot of published canvas here -->

### 2. Interactive Excalidraw Embed

_Excalidraw drawings embedded in notes retain full pan/zoom capabilities w/ responsive scaling._

<!-- Add screenshot of excalidraw here -->

### 3. Published Note

_Clean, readable Markdown rendering with dark mode support._

<!-- Add screenshot of published note here -->

## Installation

1. Install the **Obsidian S3 Publisher** plugin (Marketplace or Manual).
2. Enable the plugin in settings.

## Configuration

Navigate to **Settings > S3 Publisher** to configure your provider.

| Setting        | Description                                                                                                                   |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **Endpoint**   | Your S3 API URL (e.g., `https://s3.amazonaws.com` or `http://localhost:9000`)                                                 |
| **Region**     | Bucket region (e.g., `us-east-1` or `auto` for some providers)                                                                |
| **Bucket**     | The name of your bucket (must store content publicly or generate presigned URLs - this plugin uses public read ACL currently) |
| **Access Key** | Your S3 Access Key ID                                                                                                         |
| **Secret Key** | Your S3 Secret Access Key                                                                                                     |
| **Public URL** | (Optional) Custom domain for sharing links (e.g., `https://notes.mysite.com`)                                                 |

> **Tip**: Use the **"Test Connection"** button to verify your settings before publishing!

### MinIO Quick Start (Docker)

Run your own private S3 cloud in seconds:

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=admin" \
  -e "MINIO_ROOT_PASSWORD=password" \
  quay.io/minio/minio server /data --console-address ":9001"
```

- **Endpoint**: `http://localhost:9000`
- **Access/Secret**: `admin` / `password`
- **Bucket**: Create a bucket (e.g., `notes`) and set its policy to **Public Read**.

## Usage

### Publishing

1. Open a **Note (.md)**, **Canvas (.canvas)**, or **Excalidraw** file.
2. Open Command Palette (`Cmd/Ctrl+P`) -> `S3 Publisher: Publish`.
3. **Or** Right-click the file in the explorer -> `S3: Publish Note` (or `Update published note`).
4. Wait for the "Published!" toast. The link is copied to your clipboard.

### Managing Files

- **View Online**: Right-click a published file -> `S3: View Online`.
- **Unpublish**: Right-click -> `S3: Unpublish Note` to remove it from the server.
- **Settings**: Go to the **Published Files** tab in settings to see a full list of all active shares.

## Advanced

### Canvas & Excalidraw Compiler

The plugin includes custom compilers for visual formats:

- **Canvas**: Converts JSON -> Interactive HTML5/SVG with Cubic Bézier curves.
- **Excalidraw**: Uses lightweight wrappers to render compressed Excalidraw JSON -> SVG.
- **Zero Runtime Dependencies**: The generated HTML is standalone; it does **not** fetch large JS bundles from CDNs.

### Styling

Styles are injected automatically.

- **Markdown**: Uses a clean, GitHub-like typography.
- **Colors**: Mapped to standard Obsidian colors.
- **Tags**: Renders `#tags` with pill styling.

---

_Built for the Obsidian Community._
