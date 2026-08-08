import { normalizePath } from "obsidian";
import type { NoteData, PosterItem, PosterWallData, PosterWallSettings, SortMode } from "./types";
import { DATA_SCHEMA_VERSION, DEFAULT_SETTINGS } from "./constants";

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSearchText(value: string): string {
	return value.normalize("NFKC").toLocaleLowerCase();
}

export function normalizeTag(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
	const body = withHash.slice(1);
	if (
		body.length === 0 ||
		/\s/u.test(body) ||
		body.startsWith("/") ||
		body.endsWith("/") ||
		body.includes("//")
	) {
		return null;
	}
	return withHash;
}

export function normalizeTags(values: readonly unknown[]): string[] {
	const result: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		if (typeof value !== "string") continue;
		const normalized = normalizeTag(value);
		if (normalized === null) continue;
		const key = normalizeSearchText(normalized);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(normalized);
	}
	return result;
}

export function normalizeRating(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2)
		? value
		: undefined;
}

export function tagMatches(configuredTag: string, noteTag: string): boolean {
	const configured = normalizeSearchText(configuredTag);
	const note = normalizeSearchText(noteTag);
	return note === configured || note.startsWith(`${configured}/`);
}

export function noteMatchesConfiguredTags(noteTags: readonly string[], configuredTags: readonly string[]): boolean {
	return configuredTags.some((configured) => noteTags.some((noteTag) => tagMatches(configured, noteTag)));
}

export function validateCoverFolder(value: string, configDir: string): string | null {
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.startsWith("/") || /^[a-zA-Z]:[\\/]/u.test(trimmed)) return null;
	const slashNormalized = trimmed.replaceAll("\\", "/");
	if (slashNormalized.split("/").some((segment) => segment === "..")) return null;
	const normalized = normalizePath(slashNormalized);
	if (normalized.length === 0 || normalized === ".") return null;
	const normalizedConfig = normalizePath(configDir);
	if (normalized === normalizedConfig || normalized.startsWith(`${normalizedConfig}/`)) return null;
	return normalized;
}

export function sanitizeData(raw: unknown, configDir: string): PosterWallData {
	const root = isRecord(raw) ? raw : {};
	const rawSettings = isRecord(root.settings) ? root.settings : {};
	const rawTags = Array.isArray(rawSettings.tags) ? rawSettings.tags : DEFAULT_SETTINGS.tags;
	const coverProperty =
		typeof rawSettings.coverProperty === "string" && rawSettings.coverProperty.trim().length > 0
			? rawSettings.coverProperty.trim()
			: DEFAULT_SETTINGS.coverProperty;
	const requestedFolder =
		typeof rawSettings.coverFolder === "string" ? rawSettings.coverFolder : DEFAULT_SETTINGS.coverFolder;
	const coverFolder = validateCoverFolder(requestedFolder, configDir) ?? DEFAULT_SETTINGS.coverFolder;

	const notes: Record<string, NoteData> = {};
	if (isRecord(root.notes)) {
		for (const [path, value] of Object.entries(root.notes)) {
			if (!isRecord(value)) continue;
			const cover = typeof value.cover === "string" ? value.cover.trim() : "";
			const rating = normalizeRating(value.rating);
			notes[path] = {
				...(cover.length > 0 ? { cover } : {}),
				...(rating === undefined ? {} : { rating }),
			};
		}
	}

	return {
		schemaVersion: DATA_SCHEMA_VERSION,
		settings: {
			tags: normalizeTags(rawTags),
			coverProperty,
			coverFolder,
		},
		notes,
	};
}

export function filterAndSortItems(
	items: readonly PosterItem[],
	search: string,
	selectedTag: string | null,
	sortMode: SortMode,
): PosterItem[] {
	const query = normalizeSearchText(search.trim());
	return items
		.filter((item) => selectedTag === null || item.tags.some((tag) => tagMatches(selectedTag, tag)))
		.filter((item) => {
			if (query.length === 0) return true;
			return normalizeSearchText(`${item.title}\n${item.path}`).includes(query);
		})
		.sort((left, right) => {
			if (sortMode === "modified") {
				const timeComparison = right.mtime - left.mtime;
				if (timeComparison !== 0) return timeComparison;
			}
			const titleComparison = left.title.localeCompare(right.title, "zh-CN", {
				numeric: true,
				sensitivity: "base",
			});
			return titleComparison !== 0 ? titleComparison : left.path.localeCompare(right.path, "zh-CN");
		});
}

export function cloneSettings(settings: PosterWallSettings): PosterWallSettings {
	return {
		tags: [...settings.tags],
		coverProperty: settings.coverProperty,
		coverFolder: settings.coverFolder,
	};
}
