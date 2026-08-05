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
						"Old/A.md": { cover: "Old/Covers/a.webp" },
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
});
