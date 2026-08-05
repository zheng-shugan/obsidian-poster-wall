import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type PosterWallPlugin from "../src/main";
import { PosterWallSettingTab } from "../src/settings-tab";
import type { AvailableTag, PosterWallSettings } from "../src/types";
import { getLatestInputSuggest } from "./mocks/obsidian";

function makeTab(availableTags: AvailableTag[]): {
	tab: PosterWallSettingTab;
	updateSettings: ReturnType<typeof vi.fn>;
	settings: PosterWallSettings;
} {
	const settings: PosterWallSettings = {
		tags: [],
		coverProperty: "cover",
		coverFolder: "PosterWall/Covers",
	};
	const updateSettings = vi.fn(async (next: PosterWallSettings) => {
		settings.tags = [...next.tags];
		settings.coverProperty = next.coverProperty;
		settings.coverFolder = next.coverFolder;
	});
	const plugin = {
		index: {
			get settings(): PosterWallSettings {
				return { ...settings, tags: [...settings.tags] };
			},
			getAvailableTags: vi.fn((query: string) => {
				const normalized = query.trim().replace(/^#/u, "").toLocaleLowerCase();
				return availableTags.filter((tag) => tag.tag.slice(1).toLocaleLowerCase().includes(normalized));
			}),
			updateSettings,
		},
	} as unknown as PosterWallPlugin;
	const app = { vault: { configDir: ".obsidian" } } as unknown as App;
	const tab = new PosterWallSettingTab(app, plugin);
	tab.display();
	return { tab, updateSettings, settings };
}

describe("PosterWallSettingTab 标签建议", () => {
	it("匹配 Vault 标签并在选择后立即保存", async () => {
		const { tab, updateSettings, settings } = makeTab([
			{ tag: "#读书", noteCount: 4 },
			{ tag: "#读书/已读", noteCount: 2 },
		]);
		const suggest = getLatestInputSuggest<AvailableTag>();
		expect(suggest).not.toBeNull();
		expect(suggest?.getMockSuggestions("#读书")).toEqual([
			{ tag: "#读书", noteCount: 4 },
			{ tag: "#读书/已读", noteCount: 2 },
		]);

		suggest?.selectSuggestion({ tag: "#读书", noteCount: 4 }, new MouseEvent("click"));
		await vi.waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));

		expect(settings.tags).toEqual(["#读书"]);
		expect(tab.containerEl.querySelector("input[placeholder='#读书']")).not.toBeNull();
	});

	it("保留手动输入和回车添加", async () => {
		const { tab, updateSettings, settings } = makeTab([]);
		const input = tab.containerEl.querySelector<HTMLInputElement>("input[placeholder='#读书']");
		expect(input).not.toBeNull();
		if (input === null) throw new Error("标签输入框不存在");

		input.value = "游戏/年度";
		input.dispatchEvent(new Event("input"));
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		await vi.waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));

		expect(settings.tags).toEqual(["#游戏/年度"]);
	});
});
