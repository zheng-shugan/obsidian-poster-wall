import { TFile, TFolder } from "obsidian";

export function makeFile(path: string, mtime = 0): TFile {
	const file = new TFile();
	file.path = path;
	file.name = path.split("/").at(-1) ?? path;
	file.extension = file.name.includes(".") ? (file.name.split(".").at(-1) ?? "") : "";
	file.basename = file.extension.length > 0 ? file.name.slice(0, -(file.extension.length + 1)) : file.name;
	file.stat = { ctime: mtime, mtime, size: 0 };
	return file;
}

export function makeFolder(path: string): TFolder {
	const folder = new TFolder();
	folder.path = path;
	folder.name = path.split("/").at(-1) ?? path;
	return folder;
}
