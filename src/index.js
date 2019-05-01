import delegate from 'delegate';

// modules
import Cache from './modules/cache';
import loadPage from './modules/loadPage';
import renderPage from './modules/renderPage';
import triggerEvent from './modules/triggerEvent';
import on from './modules/on';
import off from './modules/off';
import updateTransition from './modules/updateTransition';
import preloadPage from './modules/preloadPage';
import preloadPages from './modules/preloadPages';
import log from './modules/log';
import { usePlugin, removePlugin, findPlugin } from './modules/plugins';

import { queryAll } from './utils';
import {
	getDataFromHTML,
	fetch,
	transitionEnd,
	getCurrentUrl,
	markSwupElements,
	Link
} from './helpers';

export default class Swup {
	constructor(setOptions) {
		// default options
		let defaults = {
			cache: true,
			animationSelector: '[class*="transition-"]',
			elements: ['#swup'],
			pageClassPrefix: '',
			debugMode: false,

			preload: true,
			support: true,
			plugins: [],

			skipPopStateHandling: function(event) {
				if (event.state && event.state.source == 'swup') {
					return false;
				}
				return true;
			},
			animateHistoryBrowsing: false,

			LINK_SELECTOR:
				'a[href^="' +
				window.location.origin +
				'"]:not([data-no-swup]), a[href^="/"]:not([data-no-swup]), a[href^="#"]:not([data-no-swup])'
		};

		/**
		 * current transition object
		 */
		this.transition = {};

		let options = {
			...defaults,
			...setOptions
		};

		/**
		 * handler arrays
		 */
		this._handlers = {
			animationInDone: [],
			animationInStart: [],
			animationOutDone: [],
			animationOutStart: [],
			animationSkipped: [],
			clickLink: [],
			contentReplaced: [],
			disabled: [],
			enabled: [],
			hoverLink: [],
			openPageInNewTab: [],
			pageLoaded: [],
			pagePreloaded: [],
			pageRetrievedFromCache: [],
			pageView: [],
			popState: [],
			samePage: [],
			samePageWithHash: [],
			serverError: [],
			transitionStart: [],
			transitionEnd: [],
			willReplaceContent: []
		};

		/**
		 * helper variables
		 */
		// id of element to scroll to after render
		this.scrollToElement = null;
		// promise used for preload, so no new loading of the same page starts while page is loading
		this.preloadPromise = null;
		// save options
		this.options = options;
		// plugins array
		this.plugins = [];

		/**
		 * make modules accessible in instance
		 */
		this.cache = new Cache();
		this.loadPage = loadPage;
		this.renderPage = renderPage;
		this.triggerEvent = triggerEvent;
		this.on = on;
		this.off = off;
		this.updateTransition = updateTransition;
		this.preloadPage = preloadPage;
		this.preloadPages = preloadPages;
		this.log = log;
		this.usePlugin = usePlugin;
		this.removePlugin = removePlugin;
		this.findPlugin = findPlugin;
		this.enable = this.enable;
		this.destroy = this.destroy;

		// attach instance to window in debug mode
		if (this.options.debugMode) {
			window.swup = this;
		}

		this.enable();
	}

	enable() {
		/**
		 * support check
		 */
		if (this.options.support) {
			// check pushState support
			if (!('pushState' in window.history)) {
				console.warn('pushState is not supported');
				return;
			}
			// check transitionEnd support
			if (!transitionEnd()) {
				console.warn('transitionEnd detection is not supported');
				return;
			}
			// check Promise support
			if (
				typeof Promise === 'undefined' ||
				Promise.toString().indexOf('[native code]') === -1
			) {
				console.warn('Promise is not supported');
				return;
			}
		}

		// variable to keep event listeners from "delegate"
		this.delegatedListeners = {};

		/**
		 * link click handler
		 */
		this.delegatedListeners.click = delegate(
			document,
			this.options.LINK_SELECTOR,
			'click',
			this.linkClickHandler.bind(this)
		);

		/**
		 * link mouseover handler (preload)
		 */
		this.delegatedListeners.mouseover = delegate(
			document.body,
			this.options.LINK_SELECTOR,
			'mouseover',
			this.linkMouseoverHandler.bind(this)
		);

		/**
		 * popstate handler
		 */
		window.addEventListener('popstate', this.popStateHandler.bind(this));

		/**
		 * initial save to cache
		 */
		let page = getDataFromHTML(document.documentElement.outerHTML, null, this.options.elements);
		page.url = getCurrentUrl();
		if (this.options.cache) {
			this.cache.cacheUrl(page, this.options.debugMode);
		}

		/**
		 * mark swup blocks in html
		 */
		markSwupElements(document.documentElement, this.options.elements, this.options.elements);

		/**
		 * mount plugins
		 */
		this.options.plugins.forEach((plugin) => {
			this.usePlugin(plugin);
		});

		/**
		 * modify initial history record
		 */
		window.history.replaceState(
			Object.assign({}, window.history.state, {
				url: window.location.href,
				random: Math.random(),
				source: 'swup'
			}),
			document.title,
			window.location.href
		);

		/**
		 * trigger enabled event
		 */
		this.triggerEvent('enabled');
		document.documentElement.classList.add('swup-enabled');

		/**
		 * trigger page view event
		 */
		this.triggerEvent('pageView');

		/**
		 * preload pages if possible
		 */
		this.preloadPages();
	}

	destroy() {
		// remove delegated listeners
		this.delegatedListeners.click.destroy();
		this.delegatedListeners.mouseover.destroy();

		// remove popstate listener
		window.removeEventListener('popstate', this.popStateHandler.bind(this));

		// empty cache
		this.cache.empty();

		/**
		 * unmount plugins
		 */
		this.options.plugins.forEach((plugin) => {
			this.removePlugin(plugin);
		});

		// remove swup data atributes from blocks
		queryAll('[data-swup]').forEach((element) => {
			delete element.dataset.swup;
		});

		// remove handlers
		this.off();

		this.triggerEvent('disabled');
		document.documentElement.classList.remove('swup-enabled');
	}

	linkClickHandler(event) {
		// no control key pressed
		if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
			// index of pressed button needs to be checked because Firefox triggers click on all mouse buttons
			if (event.button === 0) {
				this.triggerEvent('clickLink', event);
				event.preventDefault();
				const link = new Link(event.delegateTarget);
				if (link.getAddress() == getCurrentUrl() || link.getAddress() == '') {
					// link to the same URL
					if (link.getHash() != '') {
						// link to the same URL with hash
						this.triggerEvent('samePageWithHash', event);
						const element = document.querySelector(link.getHash());
						if (element != null) {
							history.replaceState(
								{
									url: link.getAddress() + link.getHash(),
									random: Math.random(),
									source: 'swup'
								},
								document.title,
								link.getAddress() + link.getHash()
							);
						} else {
							// referenced element not found
							console.warn(`Element for offset not found (${link.getHash()})`);
						}
					} else {
						// link to the same URL without hash
						this.triggerEvent('samePage', event);
					}
				} else {
					// link to different url
					if (link.getHash() != '') {
						this.scrollToElement = link.getHash();
					}

					// get custom transition from data
					let customTransition = event.delegateTarget.dataset.swupTransition;

					// load page
					this.loadPage(
						{ url: link.getAddress(), customTransition: customTransition },
						false
					);
				}
			}
		} else {
			// open in new tab (do nothing)
			this.triggerEvent('openPageInNewTab', event);
		}
	}

	linkMouseoverHandler(event) {
		this.triggerEvent('hoverLink', event);
		if (this.options.preload) {
			const link = new Link(event.delegateTarget);
			if (
				link.getAddress() !== getCurrentUrl() &&
				!this.cache.exists(link.getAddress()) &&
				this.preloadPromise == null
			) {
				this.preloadPromise = new Promise((resolve, reject) => {
					fetch({ url: link.getAddress() }, (response, request) => {
						if (request.status === 500) {
							this.triggerEvent('serverError', event);
							reject(link.getAddress());
							return;
						} else {
							// get json data
							let page = getDataFromHTML(response, request, this.options.elements);
							if (page != null) {
								page.url = link.getAddress();
								this.cache.cacheUrl(page, this.options.debugMode);
								this.triggerEvent('pagePreloaded', event);
							} else {
								reject(link.getAddress());
								return;
							}
						}
						resolve();
						this.preloadPromise = null;
					});
				});
				this.preloadPromise.route = link.getAddress();
			}
		}
	}

	popStateHandler(event) {
		if (this.options.skipPopStateHandling(event)) return;
		const link = new Link(event.state ? event.state.url : window.location.pathname);
		if (link.getHash() !== '') {
			this.scrollToElement = link.getHash();
		} else {
			event.preventDefault();
		}
		this.triggerEvent('popState', event);
		this.loadPage({ url: link.getAddress() }, event);
	}
}
