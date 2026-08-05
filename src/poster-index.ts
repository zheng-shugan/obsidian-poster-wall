import { getAllTags, TFile, TFolder, type Plugin, type TAbstractFile } from "obsidian";
import { METADATA_DEBOUNCE_MS } from "./constants";
import { CoverResolver } from "./cover-resolver";
import type { PosterWallDataStore } from "./data-store";
import type { PosterItem, PosterWallSettings } from "./types";
import { normalizeTags, noteMatchesConfiguredTags } from "./utils";

type ChangeListener = () => void;

export class PosterIndex {
	private readonly items = new Map<string, PosterItem>();
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
		const settings = this.store.settings;
		if (settings.tags.length > 0) {
			for (const file of this.plugin.app.vault.getMarkdownFiles()) {
				this.indexFile(file, settings);
			}
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
}
