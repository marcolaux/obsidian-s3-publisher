import { App } from "obsidian";

/**
 * Interface for the SecretStorage API (available in newer Obsidian versions).
 */
interface SecretStorage {
	has(key: string): Promise<boolean>;
	get(key: string): Promise<string | null>;
	save(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

// Extend App interface to include secretStorage
declare module "obsidian" {
	interface App {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
		return !!this.app.secretStorage;
	}

	/**
	 * Save a secret.
	 */
	async saveSecret(key: string, value: string): Promise<void> {
		if (this.isAvailable() && this.app.secretStorage) {
			await this.app.secretStorage.save(key, value);
		}
	}

	/**
	 * Get a secret.
	 */
	async getSecret(key: string): Promise<string | null> {
		if (this.isAvailable() && this.app.secretStorage) {
			return await this.app.secretStorage.get(key);
		}
		return null;
	}

	/**
	 * Delete a secret.
	 */
	async deleteSecret(key: string): Promise<void> {
		if (this.isAvailable() && this.app.secretStorage) {
			await this.app.secretStorage.delete(key);
		}
	}
}
