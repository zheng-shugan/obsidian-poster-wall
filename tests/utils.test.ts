import { describe, expect, it } from "vitest";
import type { PosterItem } from "../src/types";
import {
	filterAndSortItems,
	normalizeTag,
	normalizeTags,
	normalizeRating,
	noteMatchesConfiguredTags,
	sanitizeData,
	validateCoverFolder,
} from "../src/utils";
import { makeFile } from "./helpers";

describe("标签规则", () => {
	it("规范化、去重并支持层级匹配", () => {
		expect(normalizeTag(" 读书 ")).toBe("#读书");
		expect(normalizeTag("#读书/已读")).toBe("#读书/已读");
		expect(normalizeTag("读 书")).toBeNull();
		expect(normalizeTags(["读书", "#读书", "#电影"])).toEqual(["#读书", "#电影"]);
		expect(noteMatchesConfiguredTags(["#读书/已读"], ["#读书"])).toBe(true);
		expect(noteMatchesConfiguredTags(["#读书会"], ["#读书"])).toBe(false);
	});
});

describe("数据兼容", () => {
	it("接受只有 notes 的旧格式并逐字段回退", () => {
		const data = sanitizeData(
			{ notes: { "Books/A.md": { cover: " Covers/a.webp " }, bad: 4 } },
			".obsidian",
		);
		expect(data.schemaVersion).toBe(1);
		expect(data.settings).toEqual({ tags: [], coverProperty: "cover", coverFolder: "PosterWall/Covers" });
		expect(data.notes).toEqual({ "Books/A.md": { cover: "Covers/a.webp" } });
	});

	it("接受 0.5 步进的 0.5–5 评分，0 表示未评分", () => {
		expect(normalizeRating(4)).toBe(4);
		expect(normalizeRating(0.5)).toBe(0.5);
		expect(normalizeRating(1.5)).toBe(1.5);
		expect(normalizeRating(5)).toBe(5);
		expect(normalizeRating(0)).toBeUndefined();
		expect(normalizeRating(0.25)).toBeUndefined();
		expect(normalizeRating(2.25)).toBeUndefined();
		expect(normalizeRating(5.5)).toBeUndefined();
		expect(
			sanitizeData(
				{ notes: { good: { rating: 5 }, half: { rating: 2.5 }, zero: { rating: 0 }, bad: { rating: 6 } } },
				".obsidian",
			).notes,
		).toEqual({ good: { rating: 5 }, half: { rating: 2.5 }, zero: {}, bad: {} });
	});

	it("拒绝配置目录、绝对目录与向上路径", () => {
		expect(validateCoverFolder("PosterWall/Covers", ".obsidian")).toBe("PosterWall/Covers");
		expect(validateCoverFolder(".obsidian/covers", ".obsidian")).toBeNull();
		expect(validateCoverFolder("../covers", ".obsidian")).toBeNull();
		expect(validateCoverFolder("/covers", ".obsidian")).toBeNull();
	});
});

describe("搜索与排序", () => {
	const items: PosterItem[] = [
		{
			file: makeFile("Books/金钱2.md", 20),
			path: "Books/金钱2.md",
			title: "金钱2",
			tags: ["#读书/已读"],
			mtime: 20,
			covers: [],
			propertyManaged: false,
		},
		{
			file: makeFile("Movies/金钱10.md", 10),
			path: "Movies/金钱10.md",
			title: "金钱10",
			tags: ["#电影"],
			mtime: 10,
			covers: [],
			propertyManaged: false,
		},
	];

	it("搜索标题和路径并提供稳定排序", () => {
		expect(filterAndSortItems(items, "movies", null, "modified").map((item) => item.title)).toEqual(["金钱10"]);
		expect(filterAndSortItems(items, "", null, "name").map((item) => item.title)).toEqual(["金钱2", "金钱10"]);
		expect(filterAndSortItems(items, "", "#读书", "modified").map((item) => item.title)).toEqual(["金钱2"]);
	});
});
