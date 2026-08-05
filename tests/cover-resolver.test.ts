import { describe, expect, it } from "vitest";
import type { App, CachedMetadata, TFile } from "obsidian";
import { CoverResolver } from "../src/cover-resolver";
import { makeFile } from "./helpers";

function makeApp(files: TFile[]): App {
	const fileMap = new Map(files.map((file) => [file.path, file]));
	return {
		vault: {
			getFileByPath: (path: string) => fileMap.get(path) ?? null,
			getResourcePath: (file: TFile) => `app://vault/${file.path}`,
		},
		metadataCache: {
			getFirstLinkpathDest: (path: string) => fileMap.get(path) ?? null,
		},
	} as unknown as App;
}

describe("封面解析", () => {
	it("按 Property、数据库、正文图片顺序生成候选", () => {
		const note = makeFile("Books/A.md");
		const propertyCover = makeFile("Covers/property.webp");
		const databaseCover = makeFile("Covers/database.png");
		const bodyCover = makeFile("Covers/body.jpg");
		const resolver = new CoverResolver(makeApp([propertyCover, databaseCover, bodyCover]));
		const cache = {
			frontmatter: { cover: "[[Covers/property.webp]]" },
			embeds: [
				{ link: "Covers/body.jpg", position: { start: { offset: 50 }, end: { offset: 60 } } },
			],
		} as unknown as CachedMetadata;

		const result = resolver.resolve(note, cache, "cover", "Covers/database.png");
		expect(result.propertyManaged).toBe(true);
		expect(result.candidates.map((candidate) => candidate.source)).toEqual(["property", "database", "body"]);
		expect(result.candidates[0]?.url).toBe("app://vault/Covers/property.webp");
	});

	it("忽略无效 Property 并接受不带扩展名的 HTTPS URL", () => {
		const note = makeFile("Books/A.md");
		const resolver = new CoverResolver(makeApp([]));
		const cache = { frontmatter: { cover: "http://unsafe.test/a.jpg" } } as CachedMetadata;
		const result = resolver.resolve(note, cache, "cover", "https://images.test/cover?id=1");
		expect(result.propertyManaged).toBe(false);
		expect(result.candidates).toEqual([
			{
				kind: "remote",
				source: "database",
				value: "https://images.test/cover?id=1",
				url: "https://images.test/cover?id=1",
			},
		]);
	});

	it("跳过正文中的非图片嵌入并选择第一张有效图片", () => {
		const note = makeFile("Books/A.md");
		const pdf = makeFile("Files/a.pdf");
		const image = makeFile("Files/a.png");
		const resolver = new CoverResolver(makeApp([pdf, image]));
		const cache = {
			embeds: [
				{ link: pdf.path, position: { start: { offset: 1 }, end: { offset: 2 } } },
				{ link: image.path, position: { start: { offset: 3 }, end: { offset: 4 } } },
			],
		} as unknown as CachedMetadata;
		expect(resolver.resolve(note, cache, "cover").candidates[0]?.value).toBe(image.path);
	});
});
