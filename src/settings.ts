/* eslint-disable obsidianmd/ui/sentence-case */
import {
	App,
	PluginSettingTab,
	Setting,
	Plugin,
	Notice,
	setIcon,
	TAbstractFile,
} from "obsidian";

export interface PublishedFile {
	path: string;
	url: string;
	shareId: string;
}

export interface S3PublisherSettings {
	s3Endpoint: string;
	s3Region: string;
	s3Bucket: string;
	s3AccessKey: string;
	s3SecretKey: string;
	publicUrlBase: string; // Optional custom domain
	publishedFiles: PublishedFile[];
}

export const DEFAULT_SETTINGS: S3PublisherSettings = {
	s3Endpoint: "",
	s3Region: "us-east-1",
	s3Bucket: "",
	s3AccessKey: "",
	s3SecretKey: "",
	publicUrlBase: "",
	publishedFiles: [],
};

export interface IS3PublishPlugin extends Plugin {
	settings: S3PublisherSettings;
	saveSettings(): Promise<void>;
	publisher: { testConnection(): Promise<void> };
	unpublishNote(file: TAbstractFile): Promise<void>;
}

export class S3PublisherSettingTab extends PluginSettingTab {
	plugin: IS3PublishPlugin;
	activeTab: "files" | "connection" = "files";

	constructor(app: App, plugin: IS3PublishPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Tab Header starts here, no main heading needed if tabs are self-explanatory or use simple 'Configuration'
		// But 'S3 Publisher' was flagged. Let's just remove it or use 'General'.
		// Actually, let's omit the heading for now as tabs serve as headings.
		const tabHeader = containerEl.createDiv({ cls: "settings-tab-header" });

		// Helper to create tabs
		const createTab = (
			id: "files" | "connection",
			label: string,
			iconId: string
		) => {
			const tab = tabHeader.createDiv({
				cls: [
					"settings-tab-item",
					this.activeTab === id ? "settings-tab-active" : "",
				],
			});

			const iconSpan = tab.createSpan({ cls: "settings-tab-icon" });
			setIcon(iconSpan, iconId);

			tab.createSpan({ text: label });

			tab.onclick = () => {
				this.activeTab = id;
				this.display();
			};
		};

		createTab("files", "Published Files", "globe");
		createTab("connection", "Connection Settings", "settings");

		// Render Content
		if (this.activeTab === "files") {
			this.displayPublishedFiles(containerEl);
		} else {
			this.displayConnectionSettings(containerEl);
		}
	}

	displayConnectionSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Connection").setHeading();
		containerEl.createEl("p", {
			text: "Configure your object storage provider below.",
		});

		const helpDiv = containerEl.createDiv();
		helpDiv.addClass("setting-item-description"); // Use standard description class? Or just custom.
		helpDiv.addClass("s3-help-box"); // Custom class for spacing

		helpDiv.createEl("strong", { text: "MinIO example defaults:" });
		const ul = helpDiv.createEl("ul");

		const li1 = ul.createEl("li");
		li1.appendText("endpoint: ");
		li1.createEl("code", { text: "http://localhost:9000" });

		const li2 = ul.createEl("li");
		li2.appendText("region: ");
		li2.createEl("code", { text: "us-east-1" });

		const li3 = ul.createEl("li");
		li3.appendText("bucket: ");
		li3.createEl("code", { text: "my-notes" });

		new Setting(containerEl)
			.setName("S3 endpoint")
			.setDesc(
				"API endpoint URL (e.g. https://sfo3.digitaloceanspaces.com or http://localhost:9000)"
			)
			.addText((text) =>
				text
					.setPlaceholder("https://...")
					.setValue(this.plugin.settings.s3Endpoint)
					.onChange(async (value) => {
						this.plugin.settings.s3Endpoint = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Region")
			.setDesc("Bucket region")
			.addText((text) =>
				text
					.setPlaceholder("us-east-1")
					.setValue(this.plugin.settings.s3Region)
					.onChange(async (value) => {
						this.plugin.settings.s3Region = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Bucket name")
			.setDesc("Name of the S3 bucket")
			.addText((text) =>
				text
					.setPlaceholder("my-notes-bucket")
					.setValue(this.plugin.settings.s3Bucket)
					.onChange(async (value) => {
						this.plugin.settings.s3Bucket = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Access key ID")
			.setDesc("S3 access key")
			.addText((text) =>
				text
					.setPlaceholder("ACCESS_KEY")
					.setValue(this.plugin.settings.s3AccessKey)
					.onChange(async (value) => {
						this.plugin.settings.s3AccessKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Secret access key")
			.setDesc("S3 secret key")
			.addText((text) => {
				text
					.setPlaceholder("SECRET_KEY")
					.setValue(this.plugin.settings.s3SecretKey)
					.onChange(async (value: string) => {
						this.plugin.settings.s3SecretKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Verify your S3 connection settings")
			.addButton((button) =>
				button
					.setButtonText("Test Connection")
					.setCta()
					.onClick(async () => {
						const btnEl = button.buttonEl;
						const originalText = "Test connection";

						btnEl.addClass("s3-test-conn-btn");

						button.setButtonText("Testing...");
						button.setDisabled(true);

						try {
							await this.plugin.publisher.testConnection();

							// Success State
							btnEl.addClass("fade-out");
							setTimeout(() => {
								button.setButtonText("Connection successful");
								button.removeCta();
								btnEl.addClass("is-success");
								btnEl.removeClass("fade-out");
							}, 300);
						} catch (e) {
							// Error State
							btnEl.addClass("fade-out");
							setTimeout(() => {
								button.setButtonText("Connection failed");
								button.removeCta();
								btnEl.addClass("is-error");
								btnEl.removeClass("fade-out");
								new Notice(
									"Error details: " +
										(e instanceof Error ? e.message : String(e))
								);
							}, 300);
						}

						// Reset after delay
						setTimeout(() => {
							btnEl.addClass("fade-out");
							setTimeout(() => {
								button.setButtonText(originalText);
								btnEl.removeClass("is-success");
								btnEl.removeClass("is-error");
								button.setCta();
								button.setDisabled(false);
								btnEl.removeClass("fade-out");
							}, 300);
						}, 3500);
					})
			);

		new Setting(containerEl).setName("Public URL configuration").setHeading();

		new Setting(containerEl)
			.setName("Public access base URL")
			.setDesc(
				"Optional. If set, this URL will be used instead of the raw S3 URL. Good for custom domains. (e.g., https://notes.mysite.com)"
			)
			.addText((text) =>
				text
					.setPlaceholder("https://notes.mysite.com")
					.setValue(this.plugin.settings.publicUrlBase)
					.onChange(async (value) => {
						this.plugin.settings.publicUrlBase = value;
						await this.plugin.saveSettings();
					})
			);
	}

	displayPublishedFiles(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Published files").setHeading();
		const publishedList = this.plugin.settings.publishedFiles || [];

		if (publishedList.length === 0) {
			containerEl.createEl("p", { text: "No files published yet." });
		} else {
			const table = containerEl.createEl("table", { cls: "s3-publish-table" });

			const thead = table.createEl("thead");
			const headerRow = thead.createEl("tr");
			headerRow.createEl("th", { text: "File", cls: "s3-publish-th" });
			headerRow.createEl("th", {
				text: "Actions",
				cls: "s3-publish-th align-right",
			});

			const tbody = table.createEl("tbody");

			publishedList.forEach((file: PublishedFile) => {
				const row = tbody.createEl("tr", { cls: "s3-publish-tr" });

				const nameCell = row.createEl("td", { cls: "s3-publish-td" });
				nameCell.createEl("div", { text: file.path });

				const actionsCell = row.createEl("td", {
					cls: "s3-publish-td align-right",
				});

				const viewBtn = actionsCell.createEl("button", { text: "View" });
				viewBtn.onclick = () => {
					window.open(file.url, "_blank");
				};
				viewBtn.addClass("s3-view-btn");

				const copyBtn = actionsCell.createEl("button", { text: "Copy URL" });
				copyBtn.onclick = () => {
					void navigator.clipboard.writeText(file.url);
					copyBtn.innerText = "Copied!";
					setTimeout(() => (copyBtn.innerText = "Copy URL"), 1000);
				};
				copyBtn.addClass("s3-copy-btn");

				const unpublishBtn = actionsCell.createEl("button", {
					text: "Unpublish",
				});
				unpublishBtn.addClass("mod-warning");
				unpublishBtn.onclick = async () => {
					const abstractFile = this.plugin.app.vault.getAbstractFileByPath(
						file.path
					);
					if (abstractFile) {
						await this.plugin.unpublishNote(abstractFile);
						this.display();
						this.display();
					} else {
						const idx = this.plugin.settings.publishedFiles.indexOf(file);
						if (idx !== -1) {
							this.plugin.settings.publishedFiles.splice(idx, 1);
							await this.plugin.saveSettings();
							this.display();
							new Notice("Removed from list (file not found locally).");
						}
					}
				};

				actionsCell.appendChild(copyBtn);
				actionsCell.appendChild(unpublishBtn);
			});
		}
	}
}
