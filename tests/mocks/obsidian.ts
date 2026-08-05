export interface EventRef {
	off?: () => void;
}

export class Events {
	private readonly handlers = new Map<string, Set<(...args: unknown[]) => void>>();

	on(name: string, callback: (...args: never[]) => unknown): EventRef {
		const callbacks = this.handlers.get(name) ?? new Set<(...args: unknown[]) => void>();
		callbacks.add(callback as (...args: unknown[]) => void);
		this.handlers.set(name, callbacks);
		return { off: () => callbacks.delete(callback as (...args: unknown[]) => void) };
	}

	trigger(name: string, ...args: unknown[]): void {
		for (const callback of this.handlers.get(name) ?? []) callback(...args);
	}
}

export class TAbstractFile {
	path = "";
	name = "";
	parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
	basename = "";
	extension = "";
	stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}

export function normalizePath(path: string): string {
	const segments: string[] = [];
	for (const segment of path.replaceAll("\\", "/").split("/")) {
		if (segment.length === 0 || segment === ".") continue;
		if (segment === "..") segments.pop();
		else segments.push(segment);
	}
	return segments.join("/");
}

export function getLinkpath(link: string): string {
	return link.split("#", 1)[0] ?? "";
}

export function getAllTags(cache: { allTags?: string[]; tags?: Array<{ tag: string }> }): string[] | null {
	if (cache.allTags !== undefined) return cache.allTags;
	return cache.tags?.map((tag) => tag.tag) ?? null;
}

export class Component {
	registerEvent(_event: EventRef): void {}
}

export class WorkspaceLeaf {
	app: unknown;
	view: unknown;

	constructor(app?: unknown) {
		this.app = app;
	}

	async setViewState(_state: unknown): Promise<void> {}
}

export class ItemView extends Component {
	app: Record<string, unknown>;
	contentEl: HTMLElement;
	leaf: WorkspaceLeaf;

	constructor(leaf: WorkspaceLeaf) {
		super();
		this.leaf = leaf;
		this.app = leaf.app as Record<string, unknown>;
		this.contentEl = document.createElement("div");
	}
}

export class SearchComponent {
	inputEl: HTMLInputElement;
	private changeCallback: (value: string) => void = () => undefined;

	constructor(containerEl: HTMLElement) {
		const wrapper = containerEl.createDiv("search-input-container");
		this.inputEl = wrapper.createEl("input", { attr: { type: "search" } });
		this.inputEl.addEventListener("input", () => this.changeCallback(this.inputEl.value));
	}

	setPlaceholder(value: string): this {
		this.inputEl.placeholder = value;
		return this;
	}

	onChange(callback: (value: string) => void): this {
		this.changeCallback = callback;
		return this;
	}
}

export class Notice {
	static messages: string[] = [];

	constructor(message: string) {
		Notice.messages.push(message);
	}
}

export class Modal {
	app: Record<string, unknown>;
	containerEl = document.createElement("div");
	contentEl = this.containerEl.createDiv();
	titleEl = this.containerEl.createDiv();

	constructor(app: unknown) {
		this.app = app as Record<string, unknown>;
	}

	open(): void {
		this.onOpen();
	}

	close(): void {
		this.onClose();
	}

	onOpen(): void {}
	onClose(): void {}
}

class ButtonComponent {
	buttonEl: HTMLButtonElement;

	constructor(containerEl: HTMLElement) {
		this.buttonEl = containerEl.createEl("button", { attr: { type: "button" } });
	}

	setButtonText(value: string): this {
		this.buttonEl.setText(value);
		return this;
	}
	setCta(): this {
		this.buttonEl.addClass("mod-cta");
		return this;
	}
	setWarning(): this {
		this.buttonEl.addClass("mod-warning");
		return this;
	}
	setDisabled(value: boolean): this {
		this.buttonEl.disabled = value;
		return this;
	}
	onClick(callback: () => void): this {
		this.buttonEl.addEventListener("click", callback);
		return this;
	}
}

export class TextComponent {
	inputEl: HTMLInputElement;

	constructor(containerEl: HTMLElement) {
		this.inputEl = containerEl.createEl("input", { attr: { type: "text" } });
	}
	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}
	getValue(): string {
		return this.inputEl.value;
	}
	setPlaceholder(value: string): this {
		this.inputEl.placeholder = value;
		return this;
	}
	onChange(callback: (value: string) => void): this {
		this.inputEl.addEventListener("input", () => callback(this.inputEl.value));
		return this;
	}
}

class ExtraButtonComponent extends ButtonComponent {
	setIcon(value: string): this {
		setIcon(this.buttonEl, value);
		return this;
	}
	setTooltip(value: string): this {
		this.buttonEl.title = value;
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv("setting-item");
		this.controlEl = this.settingEl.createDiv("setting-item-control");
	}
	setName(value: string): this {
		this.settingEl.dataset.name = value;
		return this;
	}
	setDesc(value: string): this {
		this.settingEl.dataset.desc = value;
		return this;
	}
	setHeading(): this {
		this.settingEl.addClass("setting-item-heading");
		return this;
	}
	addButton(callback: (button: ButtonComponent) => void): this {
		callback(new ButtonComponent(this.controlEl));
		return this;
	}
	addExtraButton(callback: (button: ExtraButtonComponent) => void): this {
		callback(new ExtraButtonComponent(this.controlEl));
		return this;
	}
	addText(callback: (text: TextComponent) => void): this {
		callback(new TextComponent(this.controlEl));
		return this;
	}
}

export class PluginSettingTab {
	containerEl = document.createElement("div");
	app: Record<string, unknown>;

	constructor(app: unknown, _plugin: unknown) {
		this.app = app as Record<string, unknown>;
	}
}

export class Plugin extends Component {
	app: Record<string, unknown> = {};
	manifest = { id: "poster-wall" };
	async loadData(): Promise<unknown> {
		return null;
	}
	async saveData(_data: unknown): Promise<void> {}
	registerView(_type: string, _creator: (leaf: WorkspaceLeaf) => ItemView): void {}
	addSettingTab(_tab: PluginSettingTab): void {}
	addRibbonIcon(_icon: string, _title: string, _callback: () => void): HTMLElement {
		return document.createElement("div");
	}
	addCommand(_command: unknown): unknown {
		return _command;
	}
}

export function setIcon(element: HTMLElement, icon: string): void {
	element.dataset.icon = icon;
	element.createSpan({ attr: { "data-icon": icon } });
}
