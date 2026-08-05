import {
	ItemView,
	Notice,
	SearchComponent,
	setIcon,
	type WorkspaceLeaf,
} from "obsidian";
import { VIEW_TYPE_POSTER_WALL } from "./constants";
import { CoverModal } from "./cover-modal";
import type PosterWallPlugin from "./main";
import type { PosterItem, SortMode } from "./types";
import { filterAndSortItems } from "./utils";

export class PosterWallView extends ItemView {
	private search = "";
	private selectedTag: string | null = null;
	private sortMode: SortMode = "modified";
	private gridEl!: HTMLElement;
	private tagsEl!: HTMLElement;
	private countEl!: HTMLElement;
	private unsubscribe: (() => void) | null = null;
	private renderFrame: number | null = null;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: PosterWallPlugin) {
		super(leaf);
	}

	override getViewType(): string {
		return VIEW_TYPE_POSTER_WALL;
	}

	override getDisplayText(): string {
		return "Poster Wall";
	}

	override getIcon(): string {
		return "layout-grid";
	}

	override async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("poster-wall-view");
		this.renderShell();
		this.unsubscribe = this.plugin.index.subscribe(() => this.requestRender());
		this.renderContent();
	}

	override async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		if (this.renderFrame !== null) this.contentEl.win.cancelAnimationFrame(this.renderFrame);
		this.renderFrame = null;
		this.contentEl.empty();
	}

	private renderShell(): void {
		const toolbar = this.contentEl.createDiv("poster-wall-toolbar");
		const toolbarTop = toolbar.createDiv("poster-wall-toolbar-top");
		const search = new SearchComponent(toolbarTop);
		search.setPlaceholder("搜索标题或路径…").onChange((value) => {
			this.search = value;
			this.requestRender();
		});
		search.inputEl.setAttr("aria-label", "搜索海报");

		const sort = toolbarTop.createEl("select", {
			cls: "dropdown poster-wall-sort",
			attr: { "aria-label": "排序方式" },
		});
		sort.createEl("option", { text: "最近修改", value: "modified" });
		sort.createEl("option", { text: "按名称", value: "name" });
		sort.value = this.sortMode;
		sort.addEventListener("change", () => {
			this.sortMode = sort.value === "name" ? "name" : "modified";
			this.requestRender();
		});

		this.tagsEl = toolbar.createDiv("poster-wall-tags");
		this.countEl = toolbar.createDiv("poster-wall-count");
		this.gridEl = this.contentEl.createDiv("poster-wall-grid");
	}

	private requestRender(): void {
		if (this.renderFrame !== null) return;
		this.renderFrame = this.contentEl.win.requestAnimationFrame(() => {
			this.renderFrame = null;
			this.renderContent();
		});
	}

	private renderContent(): void {
		const settings = this.plugin.index.settings;
		if (this.selectedTag !== null && !settings.tags.includes(this.selectedTag)) this.selectedTag = null;
		this.renderTags(settings.tags);
		this.gridEl.empty();

		if (settings.tags.length === 0) {
			this.countEl.setText("");
			this.renderEmptyConfiguration();
			return;
		}

		const items = filterAndSortItems(
			this.plugin.index.getItems(),
			this.search,
			this.selectedTag,
			this.sortMode,
		);
		this.countEl.setText(`${items.length} 项`);
		if (items.length === 0) {
			this.gridEl.createDiv({ cls: "poster-wall-empty", text: "没有符合当前条件的笔记。" });
			return;
		}
		for (const item of items) this.renderCard(item);
	}

	private renderTags(tags: string[]): void {
		this.tagsEl.empty();
		this.createTagButton("全部", null);
		for (const tag of tags) this.createTagButton(tag, tag);
	}

	private createTagButton(label: string, tag: string | null): void {
		const button = this.tagsEl.createEl("button", {
			cls: "poster-wall-tag",
			text: label,
			attr: { type: "button", "aria-pressed": String(this.selectedTag === tag) },
		});
		if (this.selectedTag === tag) button.addClass("is-active");
		button.addEventListener("click", () => {
			this.selectedTag = tag;
			this.requestRender();
		});
	}

	private renderEmptyConfiguration(): void {
		const empty = this.gridEl.createDiv("poster-wall-empty poster-wall-empty-config");
		const icon = empty.createDiv("poster-wall-empty-icon");
		setIcon(icon, "tags");
		empty.createEl("h3", { text: "先添加要展示的标签" });
		empty.createEl("p", { text: "Poster Wall 只会展示包含所选标签的 Markdown 笔记。" });
		const button = empty.createEl("button", { cls: "mod-cta", text: "打开插件设置", attr: { type: "button" } });
		button.addEventListener("click", () => this.plugin.openSettings());
	}

	private renderCard(item: PosterItem): void {
		const card = this.gridEl.createDiv({
			cls: "poster-wall-card",
			attr: { role: "link", tabindex: "0", "aria-label": `打开笔记：${item.title}` },
		});
		card.addEventListener("click", (event) => {
			void this.openNote(item, event.metaKey);
		});
		card.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			void this.openNote(item, false);
		});

		const poster = card.createDiv("poster-wall-poster");
		this.renderCover(poster, item);
		const actions = poster.createDiv("poster-wall-actions");
		const openButton = actions.createEl("button", {
			cls: "clickable-icon",
			attr: { type: "button", "aria-label": "打开笔记", title: "打开笔记" },
		});
		setIcon(openButton, "file-text");
		openButton.addEventListener("click", (event) => {
			event.stopPropagation();
			void this.openNote(item, event.metaKey);
		});

		const editButton = actions.createEl("button", {
			cls: "clickable-icon poster-wall-cover-action",
			attr: {
				type: "button",
				"aria-label": item.propertyManaged ? "封面由 Property 管理" : "添加或修改封面",
				title: item.propertyManaged
					? `封面由 Property “${this.plugin.index.settings.coverProperty}” 管理`
					: "添加或修改封面",
			},
		});
		setIcon(editButton, item.propertyManaged ? "lock" : "image-plus");
		editButton.disabled = item.propertyManaged;
		editButton.addEventListener("click", (event) => {
			event.stopPropagation();
			this.openCoverModal(item);
		});

		if (item.covers.length === 0 && !item.propertyManaged) {
			const addCover = poster.createEl("button", {
				cls: "poster-wall-add-cover",
				text: "添加封面",
				attr: { type: "button" },
			});
			addCover.addEventListener("click", (event) => {
				event.stopPropagation();
				this.openCoverModal(item);
			});
		}

		card.createDiv({ cls: "poster-wall-title", text: item.title, attr: { title: item.path } });
	}

	private renderCover(container: HTMLElement, item: PosterItem): void {
		const placeholder = container.createDiv("poster-wall-placeholder");
		const placeholderIcon = placeholder.createDiv("poster-wall-placeholder-icon");
		setIcon(placeholderIcon, "image");
		let index = 0;
		const tryCandidate = (): void => {
			const candidate = item.covers[index];
			if (candidate === undefined) {
				placeholder.removeClass("is-loading");
				return;
			}
			placeholder.addClass("is-loading");
			const image = container.createEl("img", {
				cls: "poster-wall-image",
				attr: {
					alt: item.title,
					loading: "lazy",
					decoding: "async",
					referrerpolicy: "no-referrer",
				},
			});
			image.addEventListener("load", () => {
				placeholder.addClass("is-hidden");
			});
			image.addEventListener("error", () => {
				image.remove();
				index += 1;
				tryCandidate();
			});
			image.src = candidate.url;
		};
		tryCandidate();
	}

	private openCoverModal(item: PosterItem): void {
		if (item.propertyManaged) {
			new Notice(`请在笔记的 ${this.plugin.index.settings.coverProperty} Property 中修改封面。`);
			return;
		}
		new CoverModal(this.app, {
			coverFolder: this.plugin.index.settings.coverFolder,
			hasDatabaseCover: item.covers.some((candidate) => candidate.source === "database"),
			onSave: async (cover) => this.plugin.index.setNoteCover(item.path, cover),
		}).open();
	}

	private async openNote(item: PosterItem, newLeaf: boolean): Promise<void> {
		await this.app.workspace.openLinkText(item.path, "", newLeaf);
	}
}
