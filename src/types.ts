import type { TFile } from "obsidian";

export interface PosterWallSettings {
	tags: string[];
	coverProperty: string;
	coverFolder: string;
}

export interface NoteData {
	cover?: string;
}

export interface PosterWallData {
	schemaVersion: 1;
	settings: PosterWallSettings;
	notes: Record<string, NoteData>;
}

export type CoverKind = "vault" | "remote";
export type CoverSource = "property" | "database" | "body";

export interface CoverCandidate {
	kind: CoverKind;
	source: CoverSource;
	value: string;
	url: string;
}

export interface PosterItem {
	file: TFile;
	path: string;
	title: string;
	tags: string[];
	mtime: number;
	covers: CoverCandidate[];
	propertyManaged: boolean;
}

export type SortMode = "modified" | "name";

export interface AvailableTag {
	tag: string;
	noteCount: number;
}
