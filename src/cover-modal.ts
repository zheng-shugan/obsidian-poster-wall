import { Modal, Notice, Setting, TFolder, normalizePath, type App, type TFile } from "obsidian";
import { SUPPORTED_IMAGE_EXTENSIONS } from "./constants";

async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const segments = normalizePath(folderPath).split("/");
	let current = "";
	for (const segment of segments) {
		current = current.length === 0 ? segment : `${current}/${segment}`;
		const existing = app.vault.getAbstractFileByPath(current);
		if (existing === null) {
			await app.vault.createFolder(current);
		} else if (!(existing instanceof TFolder)) {
			throw new Error(`“${current}”已经存在且不是文件夹。`);
		}
	}
}

function safeFilename(filename: string): { basename: string; extension: string } | null {
	const dotIndex = filename.lastIndexOf(".");
	if (dotIndex <= 0 || dotIndex === filename.length - 1) return null;
	const extension = filename.slice(dotIndex + 1).toLocaleLowerCase();
	if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) return null;
	const basename = [...filename.slice(0, dotIndex)]
		.map((character) => {
			const codePoint = character.codePointAt(0) ?? 0;
			return codePoint <= 31 || /[<>:"/\\|?*]/u.test(character) ? "_" : character;
		})
		.join("")
		.trim();
	return { basename: basename.length > 0 ? basename : "cover", extension };
}

async function uniqueDestination(app: App, folder: string, filename: string): Promise<string> {
	const parsed = safeFilename(filename);
	if (parsed === null) throw new Error("请选择 PNG、JPEG、WebP、GIF、AVIF 或 SVG 图片。");
	let suffix = 0;
	while (true) {
		const suffixText = suffix === 0 ? "" : `-${suffix}`;
		const path = normalizePath(`${folder}/${parsed.basename}${suffixText}.${parsed.extension}`);
		if (app.vault.getAbstractFileByPath(path) === null) return path;
		suffix += 1;
	}
}

function normalizeHttpsUrl(value: string): string | null {
	try {
		const url = new URL(value.trim());
		return url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

export interface CoverModalOptions {
	coverFolder: string;
	hasDatabaseCover: boolean;
	onSave: (cover: string | null) => Promise<void>;
}

export class CoverModal extends Modal {
	private busy = false;

	constructor(app: App, private readonly options: CoverModalOptions) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.setText("管理封面");
		this.contentEl.addClass("poster-wall-cover-modal");

		const fileInput = this.contentEl.createEl("input", {
			cls: "poster-wall-file-input",
			attr: {
				type: "file",
				accept: ".png,.jpg,.jpeg,.webp,.gif,.avif,.svg,image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml",
			},
		});
		fileInput.addEventListener("change", () => {
			const file = fileInput.files?.[0];
			if (file !== undefined) void this.importFile(file);
			fileInput.value = "";
		});

		new Setting(this.contentEl)
			.setName("从本地导入")
			.setDesc(`图片会复制到 ${this.options.coverFolder}`)
			.addButton((button) => {
				button.setButtonText("选择图片").setCta().onClick(() => fileInput.click());
			});

		let urlValue = "";
		new Setting(this.contentEl)
			.setName("HTTPS 图片")
			.setDesc("保存图片地址，不会下载到 Vault。")
			.addText((text) => {
				text.setPlaceholder("https://example.com/cover.webp").onChange((value) => {
					urlValue = value;
				});
			})
			.addButton((button) => {
				button.setButtonText("保存").onClick(() => void this.saveUrl(urlValue));
			});

		new Setting(this.contentEl)
			.setName("恢复自动封面")
			.setDesc("移除插件数据库中的封面设置，不删除任何图片文件。")
			.addButton((button) => {
				button
					.setButtonText("移除封面设置")
					.setWarning()
					.setDisabled(!this.options.hasDatabaseCover)
					.onClick(() => void this.saveAndClose(null));
			});
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private async importFile(file: File): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			await ensureFolder(this.app, this.options.coverFolder);
			const destination = await uniqueDestination(this.app, this.options.coverFolder, file.name);
			const created: TFile = await this.app.vault.createBinary(destination, await file.arrayBuffer());
			await this.options.onSave(created.path);
			new Notice(`封面已导入到 ${created.path}`);
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "导入封面失败。", 6000);
		} finally {
			this.busy = false;
		}
	}

	private async saveUrl(value: string): Promise<void> {
		const url = normalizeHttpsUrl(value);
		if (url === null) {
			new Notice("请输入有效的 HTTPS 图片地址。");
			return;
		}
		await this.saveAndClose(url);
	}

	private async saveAndClose(cover: string | null): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			await this.options.onSave(cover);
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "保存封面失败。", 6000);
		} finally {
			this.busy = false;
		}
	}
}
