import { App } from "obsidian";

/**
 * Interface for the SecretStorage API (available in Obsidian v1.11.4+).
 * Note: These methods are synchronous in the Obsidian API.
 */
interface SecretStorage {
	getSecret(key: string): string | null;
	setSecret(key: string, value: string): void;
	listSecrets(): string[];
}

// Extend App interface to include secretStorage
declare module "obsidian" {
	interface App {
		secretStorage?: SecretStorage;
	}
}

export class SecretsWrapper {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Check if SecretStorage is available in the current Obsidian version.
	 */
	isAvailable(): boolean {
		return (
			!!this.app.secretStorage &&
			typeof this.app.secretStorage.getSecret === "function" &&
			typeof this.app.secretStorage.setSecret === "function"
		);
	}

	/**
	 * Save a secret.
	 */
	async saveSecret(key: string, value: string): Promise<void> {
		if (this.isAvailable() && this.app.secretStorage) {
			this.app.secretStorage.setSecret(key, value);
		}
	}

	/**
	 * Get a secret.
	 */
	async getSecret(key: string): Promise<string | null> {
		if (this.isAvailable() && this.app.secretStorage) {
			return this.app.secretStorage.getSecret(key);
		}
		return null;
	}

	/**
	 * Delete a secret.
	 * Note: Obsidian SecretStorage does not have an explicit delete method.
	 * We overwrite it with an empty string to effectively clear it.
	 */
	async deleteSecret(key: string): Promise<void> {
		if (this.isAvailable() && this.app.secretStorage) {
			this.app.secretStorage.setSecret(key, "");
		}
	}
}
