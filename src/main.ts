import { Notice, Plugin } from "obsidian";
import { COMMAND_OPEN_POSTER_WALL, VIEW_TYPE_POSTER_WALL } from "./constants";
import { PosterWallDataStore } from "./data-store";
import { PosterIndex } from "./poster-index";
import { PosterWallSettingTab } from "./settings-tab";
import { PosterWallView } from "./poster-wall-view";

interface AppWithSettings {
	setting?: {
		open(): void;
		openTabById(id: string): void;
	};
}

export default class PosterWallPlugin extends Plugin {
	index!: PosterIndex;
	private store!: PosterWallDataStore;

	override async onload(): Promise<void> {
		this.store = new PosterWallDataStore(this);
		await this.store.load();
		this.index = new PosterIndex(this, this.store);

		this.registerView(VIEW_TYPE_POSTER_WALL, (leaf) => new PosterWallView(leaf, this));
		this.addSettingTab(new PosterWallSettingTab(this.app, this));
		this.addRibbonIcon("layout-grid", "打开海报墙", () => void this.openPosterWall());
		this.addCommand({
			id: COMMAND_OPEN_POSTER_WALL,
			name: "打开海报墙",
			callback: () => void this.openPosterWall(),
		});

		this.app.workspace.onLayoutReady(() => {
			void this.index.start();
		});
	}

	override onunload(): void {
		this.index.dispose();
	}

	async openPosterWall(): Promise<void> {
		const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_POSTER_WALL)[0];
		if (existingLeaf !== undefined) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_POSTER_WALL, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	openSettings(): void {
		const settings = (this.app as typeof this.app & AppWithSettings).setting;
		if (settings === undefined) {
			new Notice("请前往“设置 → 社区插件 → Poster Wall”添加标签。", 6000);
			return;
		}
		settings.open();
		settings.openTabById(this.manifest.id);
	}
}
