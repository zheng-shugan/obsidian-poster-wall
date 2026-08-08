import { describe, expect, it, vi } from "vitest";
import type { Plugin } from "obsidian";
import { PosterWallDataStore } from "../src/data-store";

function makePlugin(raw: unknown, saveData: (data: unknown) => Promise<void>): Plugin {
	return {
		app: { vault: { configDir: ".obsidian" } },
		loadData: vi.fn(async () => raw),
		saveData: vi.fn(saveData),
	} as unknown as Plugin;
}

describe("PosterWallDataStore", () => {
	it("迁移笔记与封面目录路径，并在删除附件时清除覆盖", async () => {
		const snapshots: unknown[] = [];
		const store = new PosterWallDataStore(
			makePlugin(
				{
					notes: {
						"Old/A.md": { cover: "Old/Covers/a.webp", rating: 4 },
						"Other/B.md": { cover: "https://images.test/b" },
					},
				},
				async (data) => {
					snapshots.push(data);
				},
			),
		);
		await store.load();
		await store.renamePath("Old", "New", true);
		expect(store.getNoteCover("New/A.md")).toBe("New/Covers/a.webp");
		await store.deletePath("New/Covers/a.webp", false);
		expect(store.getNoteCover("New/A.md")).toBeUndefined();
		expect(store.getNoteRating("New/A.md")).toBe(4);
		expect(store.getNoteCover("Other/B.md")).toBe("https://images.test/b");
		expect(snapshots).toHaveLength(2);
	});

	it("将并发保存严格串行化且保留每次调用的快照", async () => {
		let active = 0;
		let maxActive = 0;
		const covers: Array<string | undefined> = [];
		const store = new PosterWallDataStore(
			makePlugin(null, async (data) => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				covers.push((data as { notes: Record<string, { cover?: string }> }).notes["A.md"]?.cover);
				await new Promise((resolve) => window.setTimeout(resolve, 5));
				active -= 1;
			}),
		);
		await store.load();
		const first = store.setNoteCover("A.md", "one.png");
		const second = store.setNoteCover("A.md", "two.png");
		await Promise.all([first, second]);
		expect(maxActive).toBe(1);
		expect(covers).toEqual(["one.png", "two.png"]);
	});

	it("保存、清除并迁移评分，同时保留同一笔记的封面", async () => {
		const snapshots: unknown[] = [];
		const store = new PosterWallDataStore(
			makePlugin(
				{ notes: { "A.md": { cover: "cover.png", rating: 3 }, "Invalid.md": { rating: 9 } } },
				async (data) => {
					snapshots.push(data);
				},
			),
		);
		await store.load();
		expect(store.getNoteRating("A.md")).toBe(3);
		expect(store.getNoteRating("Invalid.md")).toBeUndefined();

		await store.setNoteRating("A.md", 5);
		expect(store.getNoteRating("A.md")).toBe(5);
		await store.setNoteRating("A.md", null);
		expect(store.getNoteRating("A.md")).toBeUndefined();
		expect(store.getNoteCover("A.md")).toBe("cover.png");
		await store.renamePath("A.md", "B.md", false);
		expect(store.getNoteRating("B.md")).toBeUndefined();

		expect(snapshots).toHaveLength(3);
	});
});
