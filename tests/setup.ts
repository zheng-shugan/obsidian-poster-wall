import { afterEach, vi } from "vitest";

interface ElementOptions {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string>;
	value?: string;
}

function applyOptions<T extends HTMLElement>(element: T, options?: ElementOptions | string): T {
	if (typeof options === "string") element.className = options;
	else if (options !== undefined) {
		if (options.cls !== undefined) {
			element.className = Array.isArray(options.cls) ? options.cls.join(" ") : options.cls;
		}
		if (options.text !== undefined) element.textContent = options.text;
		if (options.value !== undefined && element instanceof HTMLInputElement) element.value = options.value;
		for (const [name, value] of Object.entries(options.attr ?? {})) element.setAttribute(name, value);
	}
	return element;
}

Node.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options?: ElementOptions | string,
): HTMLElementTagNameMap[K] {
	const element = applyOptions(this.ownerDocument?.createElement(tag) ?? document.createElement(tag), options);
	this.appendChild(element);
	return element;
};
Node.prototype.createDiv = function (options?: ElementOptions | string): HTMLDivElement {
	return this.createEl("div", options);
};
Node.prototype.createSpan = function (options?: ElementOptions | string): HTMLSpanElement {
	return this.createEl("span", options);
};
Node.prototype.empty = function (): void {
	this.replaceChildren();
};
Element.prototype.setText = function (value: string): void {
	this.textContent = value;
};
Element.prototype.addClass = function (...classes: string[]): void {
	this.classList.add(...classes);
};
Element.prototype.removeClass = function (...classes: string[]): void {
	this.classList.remove(...classes);
};
Element.prototype.setAttr = function (name: string, value: string): void {
	this.setAttribute(name, value);
};

Object.defineProperty(Node.prototype, "win", {
	get(this: Node): Window {
		return this.ownerDocument?.defaultView ?? window;
	},
});

if (window.requestAnimationFrame === undefined) {
	window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(performance.now()), 0);
	window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
}

afterEach(() => {
	document.body.empty();
	vi.restoreAllMocks();
});
