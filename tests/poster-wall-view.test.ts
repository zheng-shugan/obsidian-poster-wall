import { WorkspaceLeaf, type App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type PosterWallPlugin from "../src/main";
import { PosterWallView } from "../src/poster-wall-view";
import type { PosterItem, PosterWallSettings } from "../src/types";
import { makeFile } from "./helpers";

function makeHarness(items: PosterItem[], settings?: Partial<PosterWallSettings>) {
	const resolvedSettings: PosterWallSettings = {
		tags: ["#读书"],
		coverProperty: "cover",
		coverFolder: "PosterWall/Covers",
		...settings,
	};
	const openLinkText = vi.fn(async () => undefined);
	const app = { workspace: { openLinkText } } as unknown as App;
	const leaf = new WorkspaceLeaf();
	Object.assign(leaf, { app });
	const openSettings = vi.fn();
	const plugin = {
		app,
		index: {
			get settings() {
				return { ...resolvedSettings, tags: [...resolvedSettings.tags] };
			},
			getItems: () => items,
			subscribe: () => () => undefined,
			setNoteCover: vi.fn(async () => undefined),
			setNoteRating: vi.fn(async () => undefined),
		},
		openSettings,
	} as unknown as PosterWallPlugin;
	const view = new PosterWallView(leaf, plugin);
	return { view, openLinkText, openSettings };
}

describe("PosterWallView", () => {
	it("渲染卡片、打开笔记并在图片失败时尝试下一候选", async () => {
		const file = makeFile("Books/A.md", 10);
		const item: PosterItem = {
			file,
			path: file.path,
			title: file.basename,
			tags: ["#读书"],
			mtime: 10,
			propertyManaged: false,
			rating: 4,
			covers: [
				{ kind: "remote", source: "database", value: "https://one.test/a", url: "https://one.test/a" },
				{ kind: "remote", source: "body", value: "https://two.test/a", url: "https://two.test/a" },
			],
		};
		const { view, openLinkText } = makeHarness([item]);
		await view.onOpen();

		const card = view.contentEl.querySelector<HTMLElement>(".poster-wall-card");
		expect(card).not.toBeNull();
		card?.dispatchEvent(new MouseEvent("click", { bubbles: true, metaKey: true }));
		expect(openLinkText).toHaveBeenCalledWith(file.path, "", true);

		const firstImage = view.contentEl.querySelector<HTMLImageElement>(".poster-wall-image");
		expect(firstImage?.src).toContain("one.test/a");
		firstImage?.dispatchEvent(new Event("error"));
		const secondImage = view.contentEl.querySelector<HTMLImageElement>(".poster-wall-image");
		expect(secondImage?.src).toContain("two.test/a");
	});

	it("评分按钮支持点击、清除和键盘操作，且不会打开笔记", async () => {
		const file = makeFile("Books/A.md");
		const item: PosterItem = {
			file,
			path: file.path,
			title: file.basename,
			tags: ["#读书"],
			mtime: 0,
			propertyManaged: false,
			covers: [],
			rating: 4,
		};
		const setNoteRating = vi.fn(async () => undefined);
		const openLinkText = vi.fn(async () => undefined);
		const app = { workspace: { openLinkText } } as unknown as App;
		const leaf = new WorkspaceLeaf();
		Object.assign(leaf, { app });
		const plugin = {
			app,
			index: {
				settings: { tags: ["#读书"], coverProperty: "cover", coverFolder: "PosterWall/Covers" },
				getItems: () => [item],
				subscribe: () => () => undefined,
				setNoteCover: vi.fn(async () => undefined),
				setNoteRating,
			},
		} as unknown as PosterWallPlugin;
		const view = new PosterWallView(leaf, plugin);
		await view.onOpen();

		const stars = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".poster-wall-rating-star")];
		expect(stars.map((star) => star.textContent)).toEqual(["★", "★", "★", "★", "☆"]);
		stars[4]?.click();
		expect(setNoteRating).toHaveBeenCalledWith(file.path, 5);
		expect(openLinkText).not.toHaveBeenCalled();

		stars[4]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(setNoteRating).toHaveBeenLastCalledWith(file.path, null);
		expect(openLinkText).not.toHaveBeenCalled();

		view.contentEl.querySelector<HTMLElement>(".poster-wall-card")?.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		);
		expect(openLinkText).toHaveBeenCalledWith(file.path, "", false);
	});

	it("Property 管理的卡片禁用封面操作", async () => {
		const file = makeFile("Books/A.md");
		const { view } = makeHarness([
			{
				file,
				path: file.path,
				title: file.basename,
				tags: ["#读书"],
				mtime: 0,
				propertyManaged: true,
				covers: [{ kind: "remote", source: "property", value: "https://one.test/a", url: "https://one.test/a" }],
			},
		]);
		await view.onOpen();
		const button = view.contentEl.querySelector<HTMLButtonElement>(".poster-wall-cover-action");
		expect(button?.disabled).toBe(true);
		expect(button?.title).toContain("Property");
	});

	it("没有标签时显示设置入口", async () => {
		const { view, openSettings } = makeHarness([], { tags: [] });
		await view.onOpen();
		const button = [...view.contentEl.querySelectorAll("button")].find((element) => element.textContent === "打开插件设置");
		button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(openSettings).toHaveBeenCalledOnce();
	});
});
