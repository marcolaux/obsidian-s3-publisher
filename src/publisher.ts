import {
	S3Client,
	PutObjectCommand,
	DeleteObjectsCommand,
	ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { TFile, FrontMatterCache } from "obsidian";
import { S3PublisherSettings } from "./settings";
import { v4 as uuidv4 } from "uuid";

function getMimeType(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "html":
			return "text/html";
		case "css":
			return "text/css";
		case "js":
			return "text/javascript";
		case "png":
			return "image/png";
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "gif":
			return "image/gif";
		case "svg":
			return "image/svg+xml";
		case "pdf":
			return "application/pdf";
		default:
			return "application/octet-stream";
	}
}

export class S3Publisher {
	settings: S3PublisherSettings;

	constructor(settings: S3PublisherSettings) {
		this.settings = settings;
	}

	private getClient(): S3Client {
		// Handle "localhost" or HTTP endpoints for MinIO appropriately if needed,
		// but AWS SDK generally handles URLs fine. Force path style for MinIO compatibility often necessary.
		return new S3Client({
			endpoint: this.settings.s3Endpoint,
			region: this.settings.s3Region,
			credentials: {
				accessKeyId: this.settings.s3AccessKey,
				secretAccessKey: this.settings.s3SecretKey,
			},
			forcePathStyle: true, // Important for MinIO/Self-hosted
		});
	}

	async testConnection(): Promise<void> {
		if (!this.settings.s3Bucket) throw new Error("Bucket name is missing.");
		const client = this.getClient();
		try {
			await client.send(
				new ListObjectsV2Command({
					Bucket: this.settings.s3Bucket,
					MaxKeys: 1,
				})
			);
		} catch (err) {
			console.error("Test Connection Failed", err);
			throw err;
		}
	}

	public getPublicUrl(shareId: string): string {
		const baseUrl =
			this.settings.publicUrlBase ||
			`${this.settings.s3Endpoint}/${this.settings.s3Bucket}`;

		// Ensure no double slashes
		const cleanBase = baseUrl.replace(/\/$/, "");
		return `${cleanBase}/${shareId}/index.html`;
	}

	async publish(
		file: TFile,
		htmlContent: string,
		assets: { path: string; content: ArrayBuffer }[],
		frontmatter: FrontMatterCache | undefined,
		onUpdateFrontmatter: (key: string, value: string) => Promise<void>
	): Promise<string> {
		if (!this.settings.s3Bucket)
			throw new Error("Bucket name is missing in settings.");

		const client = this.getClient();
		let shareId = frontmatter?.["share_id"] as string | undefined;

		if (!shareId) {
			shareId = uuidv4();
			await onUpdateFrontmatter("share_id", shareId);
		}

		const shareUrl = this.getPublicUrl(shareId);
		await onUpdateFrontmatter("share_url", shareUrl);

		try {
			// 1. Upload index.html
			await client.send(
				new PutObjectCommand({
					Bucket: this.settings.s3Bucket,
					Key: `${shareId}/index.html`,
					Body: htmlContent,
					ContentType: "text/html",
					ACL: "public-read", // May fail on some buckets if Block Public Access is on, but generally needed for sharing
				})
			);

			// 2. Upload Assets
			for (const asset of assets) {
				// Asset path should be relative to the note.
				// We'll store them in /{shareId}/assets/{filename}
				const filename = asset.path.split("/").pop();
				if (!filename) continue;

				// Simple mime lookup
				const type = getMimeType(filename);

				await client.send(
					new PutObjectCommand({
						Bucket: this.settings.s3Bucket,
						Key: `${shareId}/${filename}`, // Flattening structure for simplicity
						Body: new Uint8Array(asset.content),
						ContentType: type,
						ACL: "public-read",
					})
				);
			}

			return shareUrl;
		} catch (e) {
			console.error("Failed to publish to S3", e);
			throw new Error(`Publish failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	async unpublish(
		file: TFile,
		frontmatter: FrontMatterCache | undefined,
		onUpdateFrontmatter: (key: string, value: string | null) => Promise<void>
	): Promise<void> {
		const shareId = frontmatter?.["share_id"] as string | undefined;
		if (!shareId)
			throw new Error("This note is not published (no share_id found).");

		if (!this.settings.s3Bucket) throw new Error("Bucket name is missing.");

		const client = this.getClient();

		try {
			// List objects to delete
			const listCmd = new ListObjectsV2Command({
				Bucket: this.settings.s3Bucket,
				Prefix: `${shareId}/`,
			});

			const listedObjects = await client.send(listCmd);

			if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
				// Nothing to delete remote, just clean up local
				await onUpdateFrontmatter("share_id", null);
				await onUpdateFrontmatter("share_url", null);
				return;
			}

			const deleteParams = {
				Bucket: this.settings.s3Bucket,
				Delete: {
					Objects: listedObjects.Contents.filter((o) => o.Key).map((o) => ({
						Key: o.Key as string,
					})),
				},
			};

			const deleteRes = await client.send(new DeleteObjectsCommand(deleteParams));

			if (deleteRes.Errors && deleteRes.Errors.length > 0) {
				console.error("Failed to delete some objects in S3:", deleteRes.Errors);
				throw new Error(`Failed to delete ${deleteRes.Errors.length} objects. See console for details.`);
			}

			if (listedObjects.IsTruncated) {
				// Recursive delete if more than 1000 objects
				await this.unpublish(file, frontmatter, onUpdateFrontmatter);
				return;
			}

			// Clean up Frontmatter
			await onUpdateFrontmatter("share_id", null);
			await onUpdateFrontmatter("share_url", null);
		} catch (e) {
			console.error("Failed to unpublish note", e);
			throw new Error(`Unpublish failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
}
