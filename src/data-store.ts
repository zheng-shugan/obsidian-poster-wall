import type { Plugin } from "obsidian";
import type { PosterWallData, PosterWallSettings } from "./types";
import { cloneSettings, normalizeRating, sanitizeData } from "./utils";

function pathIsWithin(candidate: string, path: string, includeChildren: boolean): boolean {
	return candidate === path || (includeChildren && candidate.startsWith(`${path}/`));
}

function replacePathPrefix(candidate: string, oldPath: string, newPath: string, includeChildren: boolean): string {
	if (candidate === oldPath) return newPath;
	if (includeChildren && candidate.startsWith(`${oldPath}/`)) {
		return `${newPath}${candidate.slice(oldPath.length)}`;
	}
	return candidate;
}

function isRemoteCover(value: string): boolean {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}

export class PosterWallDataStore {
	private data!: PosterWallData;
	private saveQueue: Promise<void> = Promise.resolve();

	constructor(private readonly plugin: Plugin) {}

	async load(): Promise<void> {
		this.data = sanitizeData(await this.plugin.loadData(), this.plugin.app.vault.configDir);
	}

	get settings(): PosterWallSettings {
		return cloneSettings(this.data.settings);
	}

	getNoteCover(path: string): string | undefined {
		return this.data.notes[path]?.cover;
	}

	getNoteRating(path: string): number | undefined {
		return this.data.notes[path]?.rating;
	}

	async replaceSettings(settings: PosterWallSettings): Promise<void> {
		this.data.settings = cloneSettings(settings);
		await this.queueSave();
	}

	async setNoteCover(path: string, cover: string | null): Promise<void> {
		const noteData = { ...this.data.notes[path] };
		if (cover === null || cover.trim().length === 0) delete noteData.cover;
		else noteData.cover = cover.trim();
		this.replaceNoteData(path, noteData);
		await this.queueSave();
	}

	async setNoteRating(path: string, rating: number | null): Promise<void> {
		const noteData = { ...this.data.notes[path] };
		const normalizedRating = normalizeRating(rating);
		if (normalizedRating === undefined) delete noteData.rating;
		else noteData.rating = normalizedRating;
		this.replaceNoteData(path, noteData);
		await this.queueSave();
	}

	async renamePath(oldPath: string, newPath: string, includeChildren: boolean): Promise<boolean> {
		let changed = false;
		const nextNotes: PosterWallData["notes"] = {};

		for (const [notePath, noteData] of Object.entries(this.data.notes)) {
			const nextNotePath = replacePathPrefix(notePath, oldPath, newPath, includeChildren);
			const nextCover =
				noteData.cover !== undefined && !isRemoteCover(noteData.cover)
					? replacePathPrefix(noteData.cover, oldPath, newPath, includeChildren)
					: noteData.cover;
			if (nextNotePath !== notePath || nextCover !== noteData.cover) changed = true;
			nextNotes[nextNotePath] = {
				...(nextCover === undefined ? {} : { cover: nextCover }),
				...(noteData.rating === undefined ? {} : { rating: noteData.rating }),
			};
		}

		if (changed) {
			this.data.notes = nextNotes;
			await this.queueSave();
		}
		return changed;
	}

	async deletePath(path: string, includeChildren: boolean): Promise<boolean> {
		let changed = false;
		const nextNotes: PosterWallData["notes"] = {};

		for (const [notePath, noteData] of Object.entries(this.data.notes)) {
			if (pathIsWithin(notePath, path, includeChildren)) {
				changed = true;
				continue;
			}

			const cover = noteData.cover;
			if (cover !== undefined && !isRemoteCover(cover) && pathIsWithin(cover, path, includeChildren)) {
				changed = true;
				if (noteData.rating !== undefined) nextNotes[notePath] = { rating: noteData.rating };
				continue;
			}
			nextNotes[notePath] = { ...noteData };
		}

		if (changed) {
			this.data.notes = nextNotes;
			await this.queueSave();
		}
		return changed;
	}

	async flush(): Promise<void> {
		await this.saveQueue;
	}

	private queueSave(): Promise<void> {
		const snapshot = structuredClone(this.data);
		this.saveQueue = this.saveQueue
			.catch(() => undefined)
			.then(async () => {
				await this.plugin.saveData(snapshot);
			});
		return this.saveQueue;
	}

	private replaceNoteData(path: string, noteData: PosterWallData["notes"][string]): void {
		if (noteData.cover === undefined && noteData.rating === undefined) delete this.data.notes[path];
		else this.data.notes[path] = noteData;
	}
}
