import { DelegateEvent } from 'delegate-it';

import Swup from '../Swup.js';
import { isPromise, runAsPromise } from '../utils.js';
import { Visit } from './Visit.js';
import { FetchOptions, PageData } from './fetchPage.js';

export interface HookDefinitions {
	'animation:out:start': undefined;
	'animation:out:await': { skip: boolean };
	'animation:out:end': undefined;
	'animation:in:start': undefined;
	'animation:in:await': { skip: boolean };
	'animation:in:end': undefined;
	'animation:skip': undefined;
	'cache:clear': undefined;
	'cache:set': { page: PageData };
	'content:replace': { page: PageData };
	'content:scroll': undefined;
	'enable': undefined;
	'disable': undefined;
	'fetch:request': { url: string; options: FetchOptions };
	'fetch:error': { url: string; status: number; response: Response };
	'history:popstate': { event: PopStateEvent };
	'link:click': { el: HTMLAnchorElement; event: DelegateEvent<MouseEvent> };
	'link:self': undefined;
	'link:anchor': { hash: string };
	'link:newtab': { href: string };
	'page:load': { page?: PageData; cache?: boolean; options: FetchOptions };
	'page:view': { url: string; title: string };
	'scroll:top': { options: ScrollIntoViewOptions };
	'scroll:anchor': { hash: string; options: ScrollIntoViewOptions };
	'visit:start': undefined;
	'visit:end': undefined;
}

export type HookArguments<T extends HookName> = HookDefinitions[T];

export type HookName = keyof HookDefinitions;

/** A hook handler. */
export type Handler<T extends HookName> = (
	/** Context about the current visit. */
	visit: Visit,
	/** Local arguments passed into the handler. */
	args: HookArguments<T>,
	/** Default handler to be executed. Available if replacing an internal hook handler. */
	defaultHandler?: Handler<T>
) => Promise<any> | any;

export type Handlers = {
	[K in HookName]: Handler<K>[];
};

/** Unregister a previously registered hook handler. */
export type HookUnregister = () => void;

/** Define when and how a hook handler is executed. */
export type HookOptions = {
	/** Execute the hook once, then remove the handler */
	once?: boolean;
	/** Execute the hook before the internal default handler */
	before?: boolean;
	/** Set a priority for when to execute this hook. Lower numbers execute first. Default: `0` */
	priority?: number;
	/** Replace the internal default handler with this hook handler */
	replace?: boolean;
};

export type HookRegistration<T extends HookName> = {
	id: number;
	hook: T;
	handler: Handler<T>;
	defaultHandler?: Handler<T>;
} & HookOptions;

type HookLedger<T extends HookName> = Map<Handler<T>, HookRegistration<T>>;

interface HookRegistry extends Map<HookName, HookLedger<HookName>> {
	get<K extends HookName>(key: K): HookLedger<K> | undefined;
	set<K extends HookName>(key: K, value: HookLedger<K>): this;
}

/**
 * Hook registry.
 *
 * Create, trigger and handle hooks.
 *
 */
export class Hooks {
	/** Swup instance this registry belongs to */
	protected swup: Swup;

	/** Map of all registered hook handlers. */
	protected registry: HookRegistry = new Map();

	// Can we deduplicate this somehow? Or make it error when not in sync with HookDefinitions?
	// https://stackoverflow.com/questions/53387838/how-to-ensure-an-arrays-values-the-keys-of-a-typescript-interface/53395649
	protected readonly hooks: HookName[] = [
		'animation:out:start',
		'animation:out:await',
		'animation:out:end',
		'animation:in:start',
		'animation:in:await',
		'animation:in:end',
		'animation:skip',
		'cache:clear',
		'cache:set',
		'content:replace',
		'content:scroll',
		'enable',
		'disable',
		'fetch:request',
		'fetch:error',
		'history:popstate',
		'link:click',
		'link:self',
		'link:anchor',
		'link:newtab',
		'page:load',
		'page:view',
		'scroll:top',
		'scroll:anchor',
		'visit:start',
		'visit:end'
	];

	constructor(swup: Swup) {
		this.swup = swup;
		this.init();
	}

	/**
	 * Create ledgers for all core hooks.
	 */
	protected init() {
		this.hooks.forEach((hook) => this.create(hook));
	}

	/**
	 * Create a new hook type.
	 */
	create(hook: string) {
		if (!this.registry.has(hook as HookName)) {
			this.registry.set(hook as HookName, new Map());
		}
	}

	/**
	 * Check if a hook type exists.
	 */
	exists(hook: HookName): boolean {
		return this.registry.has(hook);
	}

	/**
	 * Get the ledger with all registrations for a hook.
	 */
	protected get<T extends HookName>(hook: T): HookLedger<T> | undefined {
		const ledger = this.registry.get(hook);
		if (ledger) {
			return ledger;
		}
		console.error(`Unknown hook '${hook}'`);
	}

	/**
	 * Remove all handlers of all hooks.
	 */
	clear() {
		this.registry.forEach((ledger) => ledger.clear());
	}

	/**
	 * Register a new hook handler.
	 * @param hook Name of the hook to listen for
	 * @param handler The handler function to execute
	 * @param options Object to specify how and when the handler is executed
	 *                Available options:
	 *                - `once`: Only execute the handler once
	 *                - `before`: Execute the handler before the default handler
	 *                - `priority`: Specify the order in which the handlers are executed
	 *                - `replace`: Replace the default handler with this handler
	 * @returns A function to unregister the handler
	 */
	on<T extends HookName>(hook: T, handler: Handler<T>): HookUnregister;
	on<T extends HookName>(hook: T, handler: Handler<T>, options: HookOptions): HookUnregister;
	on<T extends HookName>(
		hook: T,
		handler: Handler<T>,
		options: HookOptions = {}
	): HookUnregister {
		const ledger = this.get(hook);
		if (!ledger) {
			console.warn(`Hook '${hook}' not found.`);
			return () => {};
		}

		const id = ledger.size + 1;
		const registration: HookRegistration<T> = { ...options, id, hook, handler };
		ledger.set(handler, registration);

		return () => this.off(hook, handler);
	}

	/**
	 * Register a new hook handler to run before the default handler.
	 * Shortcut for `hooks.on(hook, handler, { before: true })`.
	 * @param hook Name of the hook to listen for
	 * @param handler The handler function to execute
	 * @param options Any other event options (see `hooks.on()` for details)
	 * @returns A function to unregister the handler
	 * @see on
	 */
	before<T extends HookName>(hook: T, handler: Handler<T>): HookUnregister;
	before<T extends HookName>(hook: T, handler: Handler<T>, options: HookOptions): HookUnregister;
	before<T extends HookName>(
		hook: T,
		handler: Handler<T>,
		options: HookOptions = {}
	): HookUnregister {
		return this.on(hook, handler, { ...options, before: true });
	}

	/**
	 * Register a new hook handler to replace the default handler.
	 * Shortcut for `hooks.on(hook, handler, { replace: true })`.
	 * @param hook Name of the hook to listen for
	 * @param handler The handler function to execute instead of the default handler
	 * @param options Any other event options (see `hooks.on()` for details)
	 * @returns A function to unregister the handler
	 * @see on
	 */
	replace<T extends HookName>(hook: T, handler: Handler<T>): HookUnregister;
	replace<T extends HookName>(hook: T, handler: Handler<T>, options: HookOptions): HookUnregister;
	replace<T extends HookName>(
		hook: T,
		handler: Handler<T>,
		options: HookOptions = {}
	): HookUnregister {
		return this.on(hook, handler, { ...options, replace: true });
	}

	/**
	 * Register a new hook handler to run once.
	 * Shortcut for `hooks.on(hook, handler, { once: true })`.
	 * @param hook Name of the hook to listen for
	 * @param handler The handler function to execute
	 * @param options Any other event options (see `hooks.on()` for details)
	 * @see on
	 */
	once<T extends HookName>(hook: T, handler: Handler<T>): HookUnregister;
	once<T extends HookName>(hook: T, handler: Handler<T>, options: HookOptions): HookUnregister;
	once<T extends HookName>(
		hook: T,
		handler: Handler<T>,
		options: HookOptions = {}
	): HookUnregister {
		return this.on(hook, handler, { ...options, once: true });
	}

	/**
	 * Unregister a hook handler.
	 * @param hook Name of the hook the handler is registered for
	 * @param handler The handler function that was registered.
	 *                If omitted, all handlers for the hook will be removed.
	 */
	off<T extends HookName>(hook: T): void;
	off<T extends HookName>(hook: T, handler: Handler<T>): void;
	off<T extends HookName>(hook: T, handler?: Handler<T>): void {
		const ledger = this.get(hook);
		if (ledger && handler) {
			const deleted = ledger.delete(handler);
			if (!deleted) {
				console.warn(`Handler for hook '${hook}' not found.`);
			}
		} else if (ledger) {
			ledger.clear();
		}
	}

	/**
	 * Trigger a hook asynchronously, executing its default handler and all registered handlers.
	 * Will execute all handlers in order and `await` any `Promise`s they return.
	 * @param hook Name of the hook to trigger
	 * @param args Arguments to pass to the handler
	 * @param defaultHandler A default implementation of this hook to execute
	 * @returns The resolved return value of the executed default handler
	 */
	async call<T extends HookName>(
		hook: T,
		args?: HookArguments<T>,
		defaultHandler?: Handler<T>
	): Promise<any> {
		const { before, handler, after } = this.getHandlers(hook, defaultHandler);
		await this.run(before, args);
		const [result] = await this.run(handler, args);
		await this.run(after, args);
		this.dispatchDomEvent(hook, args);
		return result;
	}

	/**
	 * Trigger a hook synchronously, executing its default handler and all registered handlers.
	 * Will execute all handlers in order, but will **not** `await` any `Promise`s they return.
	 * @param hook Name of the hook to trigger
	 * @param args Arguments to pass to the handler
	 * @param defaultHandler A default implementation of this hook to execute
	 * @returns The (possibly unresolved) return value of the executed default handler
	 */
	callSync<T extends HookName>(
		hook: T,
		args?: HookArguments<T>,
		defaultHandler?: Handler<T>
	): any {
		const { before, handler, after } = this.getHandlers(hook, defaultHandler);
		this.runSync(before, args);
		const [result] = this.runSync(handler, args);
		this.runSync(after, args);
		this.dispatchDomEvent(hook, args);
		return result;
	}

	/**
	 * Execute the handlers for a hook, in order, as `Promise`s that will be `await`ed.
	 * @param registrations The registrations (handler + options) to execute
	 * @param args Arguments to pass to the handler
	 */
	protected async run<T extends HookName>(
		registrations: HookRegistration<T>[],
		args?: HookArguments<T>
	): Promise<any> {
		const results = [];
		for (const { hook, handler, defaultHandler, once } of registrations) {
			const result = await runAsPromise(handler, [this.swup.visit, args, defaultHandler]);
			results.push(result);
			if (once) {
				this.off(hook, handler);
			}
		}
		return results;
	}

	/**
	 * Execute the handlers for a hook, in order, without `await`ing any returned `Promise`s.
	 * @param registrations The registrations (handler + options) to execute
	 * @param args Arguments to pass to the handler
	 */
	protected runSync<T extends HookName>(
		registrations: HookRegistration<T>[],
		args?: HookArguments<T>
	): any[] {
		const results = [];
		for (const { hook, handler, defaultHandler, once } of registrations) {
			const result = handler(this.swup.visit, args as HookArguments<T>, defaultHandler);
			results.push(result);
			if (isPromise(result)) {
				console.warn(
					`Promise returned from handler for synchronous hook '${hook}'.` +
						`Swup will not wait for it to resolve.`
				);
			}
			if (once) {
				this.off(hook, handler);
			}
		}
		return results;
	}

	/**
	 * Get all registered handlers for a hook, sorted by priority and registration order.
	 * @param hook Name of the hook
	 * @param defaultHandler The optional default handler of this hook
	 * @returns An object with the handlers sorted into `before` and `after` arrays,
	 *          as well as a flag indicating if the original handler was replaced
	 */
	protected getHandlers<T extends HookName>(hook: T, defaultHandler?: Handler<T>) {
		const ledger = this.get(hook);
		if (!ledger) {
			return { found: false, before: [], handler: [], after: [], replaced: false };
		}

		const sort = this.sortRegistrations;
		const registrations = Array.from(ledger.values());

		// Filter into before, after, and replace handlers
		const before = registrations.filter(({ before, replace }) => before && !replace).sort(sort);
		const replace = registrations.filter(({ replace }) => replace).sort(sort);
		const after = registrations.filter(({ before, replace }) => !before && !replace).sort(sort);
		const replaced = replace.length > 0;

		// Define main handler registration
		// This is an array to allow passing it into hooks.run() directly
		let handler: HookRegistration<T>[] = [];
		if (defaultHandler) {
			handler = [{ id: 0, hook, handler: defaultHandler }];
			if (replaced) {
				const index = replace.length - 1;
				const replacingHandler = replace[index].handler;
				const createDefaultHandler = (index: number): Handler<T> | undefined => {
					const next = replace[index - 1];
					if (next) {
						return (visit, args) =>
							next.handler(visit, args, createDefaultHandler(index - 1));
					} else {
						return defaultHandler;
					}
				};
				const nestedDefaultHandler = createDefaultHandler(index);
				handler = [
					{ id: 0, hook, handler: replacingHandler, defaultHandler: nestedDefaultHandler }
				];
			}
		}

		return { found: true, before, handler, after, replaced };
	}

	/**
	 * Sort two hook registrations by priority and registration order.
	 * @param a The registration object to compare
	 * @param b The other registration object to compare with
	 * @returns The sort direction
	 */
	protected sortRegistrations<T extends HookName>(
		a: HookRegistration<T>,
		b: HookRegistration<T>
	): number {
		const priority = (a.priority ?? 0) - (b.priority ?? 0);
		const id = a.id - b.id;
		return priority || id || 0;
	}

	/**
	 * Dispatch a custom event on the `document` for a hook. Prefixed with `swup:`
	 * @param hook Name of the hook.
	 */
	protected dispatchDomEvent<T extends HookName>(hook: T, args?: HookArguments<T>): void {
		const detail = { hook, args, visit: this.swup.visit };
		document.dispatchEvent(new CustomEvent(`swup:${hook}`, { detail }));
	}
}