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
import { JSDOM } from 'jsdom';

beforeEach(() => {
	vi.useFakeTimers();
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
	global.document = dom.window.document;
	global.window = dom.window;
	global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
	global.HTMLElement = dom.window.HTMLElement;
});

describe('query', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('should return the element matching the selector', () => {
		document.body.innerHTML = '<div class="test"></div>';
		const element = query('.test');
		expect(element).toBeInstanceOf(HTMLElement);
	});

	it('should return null if no element matches the selector', () => {
		const element = query('.non-existent');
		expect(element).toBeNull();
	});
});

describe('queryAll', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('should return all elements matching the selector', () => {
		document.body.innerHTML = '<div class="test"></div><div class="test"></div>';
		const elements = queryAll('.test');
		expect(elements).toHaveLength(2);
		expect(elements[0]).toBeInstanceOf(HTMLElement);
		expect(elements[1]).toBeInstanceOf(HTMLElement);
	});

	it('should return an empty array if no elements match the selector', () => {
		const elements = queryAll('.non-existent');
		expect(elements).toEqual([]);
	});
});

describe('nextTick', () => {
	it('should resolve after the next event loop', async () => {
		const callback = vi.fn();
		const promise = nextTick().then(callback);
		expect(callback).not.toHaveBeenCalled();
		vi.runAllTimers();
		await promise;
		expect(callback).toHaveBeenCalled();
	});
});

describe('isPromise', () => {
	it('should return true for Promise objects', () => {
		expect(isPromise(Promise.resolve())).toBe(true);
	});

	it('should return true for thenable objects', () => {
		const thenable = { then: () => {} };
		expect(isPromise(thenable)).toBe(true);
	});

	it('should return false for non-Promise objects', () => {
		expect(isPromise({})).toBe(false);
		expect(isPromise(null)).toBe(false);
		expect(isPromise(undefined)).toBe(false);
		expect(isPromise(123)).toBe(false);
		expect(isPromise('string')).toBe(false);
	});
});

describe('runAsPromise', () => {
	it('should resolve with the result of a synchronous function', async () => {
		const syncFunc = () => 42;
		await expect(runAsPromise(syncFunc)).resolves.toBe(42);
	});

	it('should resolve with the result of an asynchronous function', async () => {
		const asyncFunc = () => Promise.resolve(42);
		await expect(runAsPromise(asyncFunc)).resolves.toBe(42);
	});

	it('should reject if the function throws an error', async () => {
		const errorFunc = () => {
			throw new Error('Test error');
		};
		await expect(runAsPromise(errorFunc)).rejects.toThrow('Test error');
	});

	it('should reject if the promise is rejected', async () => {
		const rejectFunc = () => Promise.reject(new Error('Test error'));
		await expect(runAsPromise(rejectFunc)).rejects.toThrow('Test error');
	});
});

describe('forceReflow', () => {
	it('should force a reflow on the given element', () => {
		const element = document.createElement('div');
		document.body.appendChild(element);
		expect(() => forceReflow(element)).not.toThrow();
	});

	it('should force a reflow on the body if no element is provided', () => {
		expect(() => forceReflow()).not.toThrow();
	});
});

describe('getContextualAttr', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('should return the attribute value from the closest element', () => {
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
