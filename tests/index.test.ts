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

// Setup jsdom
import { JSDOM } from 'jsdom';

beforeEach(() => {
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
	global.document = dom.window.document;
	global.window = dom.window;
	global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

describe('query', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="test"></div>';
	});

	it('should find a single element by selector', () => {
		const element = query('#test');
		expect(element).not.toBeNull();
		expect(element?.id).toBe('test');
	});

	it('should return null if no element matches the selector', () => {
		const element = query('#nonexistent');
		expect(element).toBeNull();
	});
});

describe('queryAll', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div class="test"></div><div class="test"></div>';
	});

	it('should find all elements matching the selector', () => {
		const elements = queryAll('.test');
		expect(elements.length).toBe(2);
	});

	it('should return an empty array if no elements match the selector', () => {
		const elements = queryAll('.nonexistent');
		expect(elements.length).toBe(0);
	});
});

describe('nextTick', () => {
	it('should resolve after the next event loop', async () => {
		const callback = vi.fn();
		nextTick().then(callback);
		expect(callback).not.toHaveBeenCalled();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(callback).toHaveBeenCalled();
	});
});

describe('isPromise', () => {
	it('should return true for Promise objects', () => {
		expect(isPromise(Promise.resolve())).toBe(true);
	});

	it('should return false for non-Promise objects', () => {
		expect(isPromise({})).toBe(false);
		expect(isPromise(() => {})).toBe(false);
		expect(isPromise(null)).toBe(false);
		expect(isPromise(undefined)).toBe(false);
	});
});

describe('runAsPromise', () => {
	it('should resolve with the result of a synchronous function', async () => {
		const result = await runAsPromise(() => 42);
		expect(result).toBe(42);
	});

	it('should resolve with the result of an asynchronous function', async () => {
		const asyncFunc = () => Promise.resolve(42);
		const result = await runAsPromise(asyncFunc);
		expect(result).toBe(42);
	});

	it('should reject if the function throws an error', async () => {
		const errorFunc = () => {
			throw new Error('Test error');
		};
		await expect(runAsPromise(errorFunc)).rejects.toThrow('Test error');
	});
});

describe('forceReflow', () => {
	it('should force a layout reflow on the given element', () => {
		const element = document.createElement('div');
		document.body.appendChild(element);
		const spy = vi.spyOn(element, 'getBoundingClientRect');
		forceReflow(element);
		expect(spy).toHaveBeenCalled();
	});

	it('should force a layout reflow on document.body if no element is provided', () => {
		const spy = vi.spyOn(document.body, 'getBoundingClientRect');
		forceReflow();
		expect(spy).toHaveBeenCalled();
	});
});

describe('getContextualAttr', () => {
	beforeEach(() => {
		document.body.innerHTML = `
      <div id="parent" data-test="value">
        <div id="child"></div>
      </div>
    `;
	});

	it('should return the attribute value from the closest element', () => {
		const child = document.getElementById('child');
		const value = getContextualAttr(child, 'data-test');
		expect(value).toBe('value');
	});

	it('should return true if the attribute is present without a value', () => {
		document.body.innerHTML = `
      <div id="parent" data-test>
        <div id="child"></div>
      </div>
    `;
		const child = document.getElementById('child');
		const value = getContextualAttr(child, 'data-test');
		expect(value).toBe(true);
	});

	it('should return undefined if no element with the attribute is found', () => {
		const child = document.getElementById('child');
		const value = getContextualAttr(child, 'data-nonexistent');
		expect(value).toBeUndefined();
	});
});
