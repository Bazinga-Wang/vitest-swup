import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	query,
	queryAll,
	nextTick,
	isPromise,
	runAsPromise,
	forceReflow,
	getContextualAttr
} from '../src/utils/index';

// Setup a DOM-like environment using jsdom
import { JSDOM } from 'jsdom';

beforeEach(() => {
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
	global.document = dom.window.document;
	global.window = dom.window;
	global.HTMLElement = dom.window.HTMLElement;
	global.requestAnimationFrame = dom.window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
});

describe('query', () => {
	it('should return the first matching element for a given selector', () => {
		document.body.innerHTML = '<div class="test"></div><div class="test"></div>';
		const element = query('.test');
		expect(element).toBeInstanceOf(HTMLElement);
		expect(element?.classList.contains('test')).toBe(true);
	});

	it('should return null if no matching element is found', () => {
		document.body.innerHTML = '';
		const element = query('.non-existent');
		expect(element).toBeNull();
	});
});

describe('queryAll', () => {
	it('should return all matching elements for a given selector', () => {
		document.body.innerHTML = '<div class="test"></div><div class="test"></div>';
		const elements = queryAll('.test');
		expect(elements.length).toBe(2);
		elements.forEach((element) => expect(element.classList.contains('test')).toBe(true));
	});

	it('should return an empty array if no matching elements are found', () => {
		document.body.innerHTML = '';
		const elements = queryAll('.non-existent');
		expect(elements).toEqual([]);
	});
});

describe('nextTick', () => {
	it('should resolve after the next event loop', async () => {
		const callback = vi.fn();
		nextTick().then(callback);
		expect(callback).not.toHaveBeenCalled();
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		expect(callback).toHaveBeenCalled();
	});
});

describe('isPromise', () => {
	it('should return true if the object is a Promise', () => {
		const promise = Promise.resolve();
		expect(isPromise(promise)).toBe(true);
	});

	it('should return false if the object is not a Promise', () => {
		const notAPromise = {};
		expect(isPromise(notAPromise)).toBe(false);
	});
});

describe('runAsPromise', () => {
	it('should resolve with the result of a synchronous function', async () => {
		const func = () => 42;
		await expect(runAsPromise(func)).resolves.toBe(42);
	});

	it('should resolve with the result of an asynchronous function', async () => {
		const func = async () => 42;
		await expect(runAsPromise(func)).resolves.toBe(42);
	});

	it('should reject if the function throws an error', async () => {
		const func = () => {
			throw new Error('error');
		};
		await expect(runAsPromise(func)).rejects.toThrow('error');
	});
});

describe('forceReflow', () => {
	it('should force a reflow on the given element', () => {
		const element = document.createElement('div');
		const getBoundingClientRectSpy = vi.spyOn(element, 'getBoundingClientRect');
		forceReflow(element);
		expect(getBoundingClientRectSpy).toHaveBeenCalled();
	});

	it('should force a reflow on document.body if no element is provided', () => {
		const getBoundingClientRectSpy = vi.spyOn(document.body, 'getBoundingClientRect');
		forceReflow();
		expect(getBoundingClientRectSpy).toHaveBeenCalled();
	});
});

describe('getContextualAttr', () => {
	it('should return the attribute value from the closest element with that attribute', () => {
		document.body.innerHTML = '<div data-test="value"><span id="child"></span></div>';
		const child = document.getElementById('child');
		const attrValue = getContextualAttr(child, 'data-test');
		expect(attrValue).toBe('value');
	});

	it('should return true if the attribute is present without a value', () => {
		document.body.innerHTML = '<div data-test><span id="child"></span></div>';
		const child = document.getElementById('child');
		const attrValue = getContextualAttr(child, 'data-test');
		expect(attrValue).toBe(true);
	});

	it('should return undefined if no element with the attribute is found', () => {
		document.body.innerHTML = '<div><span id="child"></span></div>';
		const child = document.getElementById('child');
		const attrValue = getContextualAttr(child, 'data-test');
		expect(attrValue).toBeUndefined();
	});
});
