import { Notice, PluginSettingTab, Setting, type App, type TextComponent } from "obsidian";
import type PosterWallPlugin from "./main";
import { normalizeTag, validateCoverFolder } from "./utils";

export class PosterWallSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: PosterWallPlugin) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("poster-wall-settings");

		new Setting(containerEl).setName("标签").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "添加参与海报墙的标签。父标签会同时匹配其层级子标签。",
		});

		for (const tag of this.plugin.index.settings.tags) {
			new Setting(containerEl).setName(tag).addExtraButton((button) => {
				button.setIcon("trash-2").setTooltip(`删除 ${tag}`).onClick(() => {
					void this.removeTag(tag);
				});
			});
		}

		let tagDraft = "";
		new Setting(containerEl)
			.setName("添加标签")
			.setDesc("可输入 #读书 或 读书。")
			.addText((text) => {
				text.setPlaceholder("#读书").onChange((value) => {
					tagDraft = value;
				});
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key !== "Enter") return;
					event.preventDefault();
					void this.addTag(tagDraft);
				});
			})
			.addButton((button) => button.setButtonText("添加").setCta().onClick(() => void this.addTag(tagDraft)));

		new Setting(containerEl).setName("封面").setHeading();
		new Setting(containerEl)
			.setName("封面字段")
			.setDesc("从笔记 Properties 中读取封面的字段名。")
			.addText((text) => {
				text.setValue(this.plugin.index.settings.coverProperty);
				this.commitTextOnBlur(text, (value) => this.commitCoverProperty(value));
			});

		new Setting(containerEl)
			.setName("封面目录")
			.setDesc("从 Finder 导入的图片会保存到这个 Vault 相对目录。")
			.addText((text) => {
				text.setValue(this.plugin.index.settings.coverFolder);
				this.commitTextOnBlur(text, (value) => this.commitCoverFolder(value));
			});
	}

	private commitTextOnBlur(text: TextComponent, commit: (value: string) => Promise<void>): void {
		const run = (): void => {
			void commit(text.getValue());
		};
		text.inputEl.addEventListener("blur", run);
		text.inputEl.addEventListener("keydown", (event) => {
			if (event.key !== "Enter") return;
			event.preventDefault();
			text.inputEl.blur();
		});
	}

	private async addTag(value: string): Promise<void> {
		const tag = normalizeTag(value);
		if (tag === null) {
			new Notice("标签不能为空、不能包含空格，层级标签也不能包含空层级。");
			return;
		}
		const settings = this.plugin.index.settings;
		if (settings.tags.some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
			new Notice("这个标签已经存在。");
			return;
		}
		settings.tags.push(tag);
		await this.plugin.index.updateSettings(settings);
		this.display();
	}

	private async removeTag(tag: string): Promise<void> {
		const settings = this.plugin.index.settings;
		settings.tags = settings.tags.filter((value) => value !== tag);
		await this.plugin.index.updateSettings(settings);
		this.display();
	}

	private async commitCoverProperty(value: string): Promise<void> {
		const trimmed = value.trim();
		if (trimmed.length === 0) {
			new Notice("封面字段不能为空。");
			this.display();
			return;
		}
		const settings = this.plugin.index.settings;
		if (settings.coverProperty === trimmed) return;
		settings.coverProperty = trimmed;
		await this.plugin.index.updateSettings(settings);
	}

	private async commitCoverFolder(value: string): Promise<void> {
		const folder = validateCoverFolder(value, this.app.vault.configDir);
		if (folder === null) {
			new Notice("请输入有效的 Vault 相对目录，且不要使用配置目录或 ..。");
			this.display();
			return;
		}
		const settings = this.plugin.index.settings;
		if (settings.coverFolder === folder) return;
		settings.coverFolder = folder;
		await this.plugin.index.updateSettings(settings);
	}
}
