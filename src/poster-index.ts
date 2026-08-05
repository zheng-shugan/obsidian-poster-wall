import { getAllTags, TFile, TFolder, type Plugin, type TAbstractFile } from "obsidian";
import { METADATA_DEBOUNCE_MS } from "./constants";
import { CoverResolver } from "./cover-resolver";
import type { PosterWallDataStore } from "./data-store";
import type { AvailableTag, PosterItem, PosterWallSettings } from "./types";
import { normalizeSearchText, normalizeTags, noteMatchesConfiguredTags } from "./utils";

type ChangeListener = () => void;

export class PosterIndex {
	private readonly items = new Map<string, PosterItem>();
	private readonly tagsByFile = new Map<string, Map<string, string>>();
	private readonly tagCatalog = new Map<string, AvailableTag>();
	private readonly listeners = new Set<ChangeListener>();
	private readonly debounceTimers = new Map<string, number>();
	private readonly resolver: CoverResolver;
	private started = false;

	constructor(
		private readonly plugin: Plugin,
		private readonly store: PosterWallDataStore,
	) {
		this.resolver = new CoverResolver(plugin.app);
	}

	get settings(): PosterWallSettings {
		return this.store.settings;
	}

	getItems(): PosterItem[] {
		return [...this.items.values()];
	}

	getAvailableTags(query: string): AvailableTag[] {
		const normalizedQuery = normalizeSearchText(query.trim().replace(/^#/u, ""));
		const configuredTags = new Set(this.store.settings.tags.map((tag) => normalizeSearchText(tag)));
		return [...this.tagCatalog.entries()]
			.filter(([key]) => !configuredTags.has(key))
			.map(([, suggestion]) => suggestion)
			.filter((suggestion) => normalizeSearchText(suggestion.tag.slice(1)).includes(normalizedQuery))
			.sort((left, right) => {
				const countComparison = right.noteCount - left.noteCount;
				return countComparison !== 0
					? countComparison
					: left.tag.localeCompare(right.tag, "zh-CN", { sensitivity: "base" });
			})
			.slice(0, 50);
	}

	subscribe(listener: ChangeListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async start(): Promise<void> {
		if (this.started) return;
		this.started = true;
		this.registerEvents();
		await this.rebuild();
	}

	async rebuild(): Promise<void> {
		this.items.clear();
		this.tagsByFile.clear();
		this.tagCatalog.clear();
		const settings = this.store.settings;
		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			this.indexFile(file, settings);
		}
		this.emitChange();
	}

	async updateSettings(settings: PosterWallSettings): Promise<void> {
		await this.store.replaceSettings(settings);
		await this.rebuild();
	}

	async setNoteCover(path: string, cover: string | null): Promise<void> {
		await this.store.setNoteCover(path, cover);
		const file = this.plugin.app.vault.getFileByPath(path);
		if (file !== null && file.extension === "md") {
			this.indexFile(file, this.store.settings);
			this.emitChange();
		}
	}

	dispose(): void {
		for (const timer of this.debounceTimers.values()) window.clearTimeout(timer);
		this.debounceTimers.clear();
		this.listeners.clear();
	}

	private registerEvents(): void {
		this.plugin.registerEvent(
			this.plugin.app.metadataCache.on("changed", (file) => this.scheduleFile(file)),
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.extension === "md") this.scheduleFile(file);
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on("delete", (file) => {
				void this.handleDelete(file);
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on("rename", (file, oldPath) => {
				void this.handleRename(file, oldPath);
			}),
		);
	}

	private scheduleFile(file: TFile): void {
		const previousTimer = this.debounceTimers.get(file.path);
		if (previousTimer !== undefined) window.clearTimeout(previousTimer);
		const timer = window.setTimeout(() => {
			this.debounceTimers.delete(file.path);
			this.indexFile(file, this.store.settings);
			this.emitChange();
		}, METADATA_DEBOUNCE_MS);
		this.debounceTimers.set(file.path, timer);
	}

	private indexFile(file: TFile, settings: PosterWallSettings): void {
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const tags = cache === null ? [] : normalizeTags(getAllTags(cache) ?? []);
		this.replaceFileTags(file.path, tags);
		if (settings.tags.length === 0 || !noteMatchesConfiguredTags(tags, settings.tags)) {
			this.items.delete(file.path);
			return;
		}

		const covers = this.resolver.resolve(
			file,
			cache,
			settings.coverProperty,
			this.store.getNoteCover(file.path),
		);
		this.items.set(file.path, {
			file,
			path: file.path,
			title: file.basename,
			tags,
			mtime: file.stat.mtime,
			covers: covers.candidates,
			propertyManaged: covers.propertyManaged,
		});
	}

	private async handleDelete(file: TAbstractFile): Promise<void> {
		const includeChildren = file instanceof TFolder;
		this.removeFileTags(file.path, includeChildren);
		await this.store.deletePath(file.path, includeChildren);
		await this.rebuild();
	}

	private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
		await this.store.renamePath(oldPath, file.path, file instanceof TFolder);
		await this.rebuild();
	}

	private emitChange(): void {
		for (const listener of this.listeners) listener();
	}

	private replaceFileTags(path: string, tags: readonly string[]): void {
		this.removeFileTags(path, false);
		const expandedTags = this.expandTagHierarchy(tags);
		this.tagsByFile.set(path, expandedTags);
		for (const [key, tag] of expandedTags) {
			const existing = this.tagCatalog.get(key);
			if (existing === undefined) {
				this.tagCatalog.set(key, { tag, noteCount: 1 });
			} else {
				existing.noteCount += 1;
			}
		}
	}

	private removeFileTags(path: string, includeChildren: boolean): void {
		for (const [filePath, tags] of this.tagsByFile) {
			if (filePath !== path && (!includeChildren || !filePath.startsWith(`${path}/`))) continue;
			for (const key of tags.keys()) {
				const existing = this.tagCatalog.get(key);
				if (existing === undefined) continue;
				if (existing.noteCount <= 1) this.tagCatalog.delete(key);
				else existing.noteCount -= 1;
			}
			this.tagsByFile.delete(filePath);
		}
	}

	private expandTagHierarchy(tags: readonly string[]): Map<string, string> {
		const expanded = new Map<string, string>();
		for (const tag of tags) {
			const segments = tag.slice(1).split("/");
			for (let index = 1; index <= segments.length; index += 1) {
				const hierarchyTag = `#${segments.slice(0, index).join("/")}`;
				expanded.set(normalizeSearchText(hierarchyTag), hierarchyTag);
			}
		}
		return expanded;
	}
}
