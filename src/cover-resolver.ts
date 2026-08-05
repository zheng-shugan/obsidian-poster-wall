import { getLinkpath, normalizePath, type App, type CachedMetadata, type TFile } from "obsidian";
import { SUPPORTED_IMAGE_EXTENSIONS } from "./constants";
import type { CoverCandidate, CoverSource } from "./types";

export interface ResolvedCovers {
	candidates: CoverCandidate[];
	propertyManaged: boolean;
}

function isSupportedImage(file: TFile): boolean {
	return SUPPORTED_IMAGE_EXTENSIONS.has(file.extension.toLocaleLowerCase());
}

function parseHttpsUrl(value: string): string | null {
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

function extractLinkPath(value: string): string {
	const trimmed = value.trim();
	const wikiMatch = trimmed.match(/^!?\[\[([\s\S]+)\]\]$/u);
	if (wikiMatch?.[1] !== undefined) {
		return getLinkpath(wikiMatch[1].split("|", 1)[0] ?? "").trim();
	}
	return getLinkpath(trimmed).trim();
}

export class CoverResolver {
	constructor(private readonly app: App) {}

	resolve(note: TFile, cache: CachedMetadata | null, propertyName: string, databaseCover?: string): ResolvedCovers {
		const candidates: CoverCandidate[] = [];
		const seen = new Set<string>();
		const propertyValue = cache?.frontmatter?.[propertyName];
		const propertyCandidate =
			typeof propertyValue === "string" ? this.resolveReference(propertyValue, note, "property") : null;

		this.pushUnique(candidates, seen, propertyCandidate);
		this.pushUnique(
			candidates,
			seen,
			databaseCover === undefined ? null : this.resolveReference(databaseCover, note, "database"),
		);

		const embeds = [...(cache?.embeds ?? [])].sort(
			(left, right) => left.position.start.offset - right.position.start.offset,
		);
		for (const embed of embeds) {
			const bodyCandidate = this.resolveReference(embed.link, note, "body");
			if (bodyCandidate !== null) {
				this.pushUnique(candidates, seen, bodyCandidate);
				break;
			}
		}

		return {
			candidates,
			propertyManaged: propertyCandidate !== null,
		};
	}

	resolveReference(value: string, note: TFile, source: CoverSource): CoverCandidate | null {
		const trimmed = value.trim();
		if (trimmed.length === 0) return null;

		const remoteUrl = parseHttpsUrl(trimmed);
		if (remoteUrl !== null) {
			return { kind: "remote", source, value: remoteUrl, url: remoteUrl };
		}

		const linkPath = extractLinkPath(trimmed);
		if (linkPath.length === 0 || /^[a-z][a-z\d+.-]*:/iu.test(linkPath)) return null;
		const normalized = normalizePath(linkPath);
		const directFile = this.app.vault.getFileByPath(normalized);
		const file = directFile ?? this.app.metadataCache.getFirstLinkpathDest(linkPath, note.path);
		if (file === null || !isSupportedImage(file)) return null;

		return {
			kind: "vault",
			source,
			value: file.path,
			url: this.app.vault.getResourcePath(file),
		};
	}

	private pushUnique(
		candidates: CoverCandidate[],
		seen: Set<string>,
		candidate: CoverCandidate | null,
	): void {
		if (candidate === null) return;
		const key = `${candidate.kind}:${candidate.value}`;
		if (seen.has(key)) return;
		seen.add(key);
		candidates.push(candidate);
	}
}

export function isHttpsCover(value: string): boolean {
	return parseHttpsUrl(value) !== null;
}
