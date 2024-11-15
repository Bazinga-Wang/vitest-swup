import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runAsPromise,
  getContextualAttr,
  query,
  queryAll,
  nextTick,
  isPromise,
  forceReflow,
} from './index';

// Mock the DOM environment
const mockElement = {
  setAttribute: vi.fn(),
  getAttribute: vi.fn(() => null),
  hasAttribute: vi.fn(() => false),
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  closest: vi.fn(),
  getBoundingClientRect: vi.fn(),
};

vi.stubGlobal('document', {
  createElement: vi.fn(() => mockElement),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    getBoundingClientRect: vi.fn(),
  },
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
});

vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(callback, 0));

describe('runAsPromise', () => {
  it('should resolve with the result of a synchronous function', async () => {
    const syncFunc = (a: number, b: number) => a + b;
    const result = await runAsPromise(syncFunc, [2, 3]);
    expect(result).toBe(5);
  });

  it('should resolve with the result of an asynchronous function', async () => {
    const asyncFunc = async (a: number, b: number) => a * b;
    const result = await runAsPromise(asyncFunc, [2, 3]);
    expect(result).toBe(6);
  });

  it('should reject if the function throws an error', async () => {
    const errorFunc = () => {
      throw new Error('Test error');
    };
    await expect(runAsPromise(errorFunc)).rejects.toThrow('Test error');
  });

  it('should reject if the asynchronous function rejects', async () => {
    const rejectFunc = async () => {
      throw new Error('Async error');
    };
    await expect(runAsPromise(rejectFunc)).rejects.toThrow('Async error');
  });
});

describe('getContextualAttr', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should return undefined if no element with the attribute is found', () => {
    const el = document.createElement('div');
    container.appendChild(el);
    el.closest = vi.fn().mockReturnValueOnce(null);
    const result = getContextualAttr(el, 'data-test');
    expect(result).toBeUndefined();
  });

  it('should return true if the attribute is present without a value', () => {
    const el = document.createElement('div');
    el.setAttribute('data-test', '');
    container.appendChild(el);
    el.closest = vi.fn().mockReturnValueOnce(el);
    el.hasAttribute = vi.fn().mockReturnValueOnce(true);
    const result = getContextualAttr(el, 'data-test');
    expect(result).toBe(true);
  });

  it('should return the attribute value if present', () => {
    const el = document.createElement('div');
    el.setAttribute('data-test', 'value');
    container.appendChild(el);
    el.closest = vi.fn().mockReturnValueOnce(el);
    el.hasAttribute = vi.fn().mockReturnValueOnce(true);
    el.getAttribute = vi.fn().mockReturnValueOnce('value');
    const result = getContextualAttr(el, 'data-test');
    expect(result).toBe('value');
  });

  it('should find the attribute on the closest ancestor', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-test', 'ancestor-value');
    const child = document.createElement('div');
    parent.appendChild(child);
    container.appendChild(parent);
    child.closest = vi.fn().mockReturnValueOnce(parent);
    parent.hasAttribute = vi.fn().mockReturnValueOnce(true);
    parent.getAttribute = vi.fn().mockReturnValueOnce('ancestor-value');
    const result = getContextualAttr(child, 'data-test');
    expect(result).toBe('ancestor-value');
  });
});

// Minimal tests for other functions

describe('query', () => {
  it('should return the first matching element', () => {
    const el = document.createElement('div');
    el.className = 'test';
    document.body.appendChild(el);
    document.querySelector = vi.fn(() => el);
    const result = query('.test');
    expect(result).toBe(el);
    document.body.removeChild(el);
  });
});

describe('queryAll', () => {
  it('should return all matching elements', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    el1.className = 'test';
    el2.className = 'test';
    document.body.appendChild(el1);
    document.body.appendChild(el2);
    document.querySelectorAll = vi.fn(() => [el1, el2]);
    const result = queryAll('.test');
    expect(result).toEqual([el1, el2]);
    document.body.removeChild(el1);
    document.body.removeChild(el2);
  });
});

describe('nextTick', () => {
  it('should resolve after the next event loop', async () => {
    const spy = vi.fn();
    await nextTick().then(spy);
    expect(spy).toHaveBeenCalled();
  });
});

describe('isPromise', () => {
  it('should return true for a Promise', () => {
    expect(isPromise(Promise.resolve())).toBe(true);
  });

  it('should return false for a non-Promise', () => {
    expect(isPromise(42)).toBe(false);
  });
});

describe('forceReflow', () => {
  it('should force a reflow on the given element', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const spy = vi.spyOn(el, 'getBoundingClientRect');
    forceReflow(el);
    expect(spy).toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('should force a reflow on document.body if no element is provided', () => {
    const spy = vi.spyOn(document.body, 'getBoundingClientRect');
    forceReflow();
    expect(spy).toHaveBeenCalled();
  });
});
