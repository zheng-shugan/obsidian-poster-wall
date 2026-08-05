export const VIEW_TYPE_POSTER_WALL = "poster-wall-view";
export const COMMAND_OPEN_POSTER_WALL = "open-poster-wall";
export const DATA_SCHEMA_VERSION = 1;
export const METADATA_DEBOUNCE_MS = 150;

export const DEFAULT_SETTINGS = {
	tags: [] as string[],
	coverProperty: "cover",
	coverFolder: "PosterWall/Covers",
};

export const SUPPORTED_IMAGE_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"webp",
	"gif",
	"avif",
	"svg",
]);
