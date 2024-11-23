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

// Set up a DOM-like environment using jsdom
import { JSDOM } from 'jsdom';

beforeEach(() => {
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
	global.document = dom.window.document;
	global.window = dom.window;
	global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

describe('query', () => {
	it('should return the element for a valid selector', () => {
		const element = document.createElement('div');
		element.className = 'test-element';
		document.body.appendChild(element);

		const result = query('.test-element');
		expect(result).toBe(element);

		document.body.removeChild(element);
	});

	it('should return null for an invalid selector', () => {
		const result = query('.non-existent-element');
		expect(result).toBeNull();
	});
});

describe('queryAll', () => {
	it('should return an array of elements for a valid selector', () => {
		const element1 = document.createElement('div');
		const element2 = document.createElement('div');
		element1.className = 'test-element';
		element2.className = 'test-element';
		document.body.appendChild(element1);
		document.body.appendChild(element2);

		const result = queryAll('.test-element');
		expect(result).toEqual([element1, element2]);

		document.body.removeChild(element1);
		document.body.removeChild(element2);
	});

	it('should return an empty array for an invalid selector', () => {
		const result = queryAll('.non-existent-element');
		expect(result).toEqual([]);
	});
});

describe('nextTick', () => {
	it('should resolve after the next event loop', async () => {
		const mockFn = vi.fn();
		nextTick().then(mockFn);

		expect(mockFn).not.toHaveBeenCalled();
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mockFn).toHaveBeenCalled();
	});
});

describe('isPromise', () => {
	it('should return true for a Promise object', () => {
		const promise = Promise.resolve();
		expect(isPromise(promise)).toBe(true);
	});

	it('should return false for non-Promise objects', () => {
		expect(isPromise({})).toBe(false);
		expect(isPromise(() => {})).toBe(false);
		expect(isPromise(null)).toBe(false);
		expect(isPromise(undefined)).toBe(false);
	});
});

describe('runAsPromise', () => {
	it('should resolve with the return value of a synchronous function', async () => {
		const syncFunc = () => 42;
		const result = await runAsPromise(syncFunc);
		expect(result).toBe(42);
	});

	it('should resolve with the resolved value of an asynchronous function', async () => {
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

	it('should reject if the asynchronous function rejects', async () => {
		const asyncErrorFunc = () => Promise.reject(new Error('Test error'));
		await expect(runAsPromise(asyncErrorFunc)).rejects.toThrow('Test error');
	});
});

describe('forceReflow', () => {
	it('should force a layout reflow', () => {
		const element = document.createElement('div');
		document.body.appendChild(element);

		const spy = vi.spyOn(element, 'getBoundingClientRect');
		forceReflow(element);
		expect(spy).toHaveBeenCalled();

		document.body.removeChild(element);
	});
});

describe('getContextualAttr', () => {
	it('should return the attribute value from the closest element', () => {
		const parent = document.createElement('div');
		const child = document.createElement('div');
		parent.setAttribute('data-test', 'value');
		parent.appendChild(child);
		document.body.appendChild(parent);

		const result = getContextualAttr(child, 'data-test');
		expect(result).toBe('value');

		document.body.removeChild(parent);
	});

	it('should return true if the attribute is present without a value', () => {
		const parent = document.createElement('div');
		const child = document.createElement('div');
		parent.setAttribute('data-test', '');
		parent.appendChild(child);
		document.body.appendChild(parent);

		const result = getContextualAttr(child, 'data-test');
		expect(result).toBe(true);

		document.body.removeChild(parent);
	});

	it('should return undefined if the attribute is not found', () => {
		const element = document.createElement('div');
		document.body.appendChild(element);

		const result = getContextualAttr(element, 'data-nonexistent');
		expect(result).toBeUndefined();

		document.body.removeChild(element);
	});
});
