import { Events, type App, type CachedMetadata, type Plugin } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PosterWallDataStore } from "../src/data-store";
import { PosterIndex } from "../src/poster-index";
import type { PosterWallSettings } from "../src/types";
import { makeFile, makeFolder } from "./helpers";

describe("PosterIndex 事件同步", () => {
	afterEach(() => vi.useRealTimers());

	it("初始构建并在 Metadata Cache 更新后增量移除笔记", async () => {
		vi.useFakeTimers();
		const file = makeFile("Books/A.md", 10);
		const vaultEvents = new Events();
		const metadataEvents = new Events();
		let cache = { allTags: ["#读书"] } as CachedMetadata;
		const app = {
			vault: {
				configDir: ".obsidian",
				getMarkdownFiles: () => [file],
				getFileByPath: () => null,
				getResourcePath: () => "",
				on: vaultEvents.on.bind(vaultEvents),
			},
			metadataCache: {
				getFileCache: () => cache,
				getFirstLinkpathDest: () => null,
				on: metadataEvents.on.bind(metadataEvents),
			},
		} as unknown as App;
		const settings: PosterWallSettings = {
			tags: ["#读书"],
			coverProperty: "cover",
			coverFolder: "PosterWall/Covers",
		};
		const store = {
			get settings() {
				return { ...settings, tags: [...settings.tags] };
			},
			getNoteCover: () => undefined,
			deletePath: vi.fn(async () => false),
			renamePath: vi.fn(async () => false),
			replaceSettings: vi.fn(async () => undefined),
			setNoteCover: vi.fn(async () => undefined),
		} as unknown as PosterWallDataStore;
		const plugin = {
			app,
			registerEvent: vi.fn(),
		} as unknown as Plugin;
		const index = new PosterIndex(plugin, store);

		await index.start();
		expect(index.getItems().map((item) => item.path)).toEqual([file.path]);
		cache = { allTags: ["#电影"] } as CachedMetadata;
		metadataEvents.trigger("changed", file, "", cache);
		await vi.advanceTimersByTimeAsync(150);
		expect(index.getItems()).toEqual([]);
	});

	it("文件夹重命名和删除会迁移数据库并重建", async () => {
		const folder = makeFolder("New");
		const vaultEvents = new Events();
		const metadataEvents = new Events();
		const app = {
			vault: {
				configDir: ".obsidian",
				getMarkdownFiles: () => [],
				getFileByPath: () => null,
				getResourcePath: () => "",
				on: vaultEvents.on.bind(vaultEvents),
			},
			metadataCache: {
				getFileCache: () => null,
				getFirstLinkpathDest: () => null,
				on: metadataEvents.on.bind(metadataEvents),
			},
		} as unknown as App;
		const store = {
			settings: { tags: ["#读书"], coverProperty: "cover", coverFolder: "PosterWall/Covers" },
			getNoteCover: () => undefined,
			deletePath: vi.fn(async () => true),
			renamePath: vi.fn(async () => true),
		} as unknown as PosterWallDataStore;
		const index = new PosterIndex({ app, registerEvent: vi.fn() } as unknown as Plugin, store);
		await index.start();

		vaultEvents.trigger("rename", folder, "Old");
		await Promise.resolve();
		await Promise.resolve();
		expect(store.renamePath).toHaveBeenCalledWith("Old", "New", true);

		vaultEvents.trigger("delete", folder);
		await Promise.resolve();
		await Promise.resolve();
		expect(store.deletePath).toHaveBeenCalledWith("New", true);
	});
});
