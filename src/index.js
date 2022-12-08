import delegate from 'delegate-it';

// modules
import Cache from './modules/Cache.js';
import loadPage from './modules/loadPage.js';
import leavePage from './modules/leavePage.js';
import renderPage from './modules/renderPage.js';
import enterPage from './modules/enterPage.js';
import triggerEvent from './modules/triggerEvent.js';
import on from './modules/on.js';
import off from './modules/off.js';
import updateTransition from './modules/updateTransition.js';
import getAnchorElement from './modules/getAnchorElement.js';
import getAnimationPromises from './modules/getAnimationPromises.js';
import getPageData from './modules/getPageData.js';
import { use, unuse, findPlugin } from './modules/plugins.js';

import { queryAll } from './utils.js';
import {
	getCurrentUrl,
	markSwupElements,
	Link,
	cleanupAnimationClasses,
	updateHistoryRecord
} from './helpers.js';

export default class Swup {
	constructor(setOptions) {
		// default options
		let defaults = {
			animateHistoryBrowsing: false,
			animationSelector: '[class*="transition-"]',
			cache: true,
			containers: ['#swup'],
			ignoreLink: (el) => {
				return el.origin !== window.location.origin || el.closest('[data-no-swup]');
			},
			linkSelector: 'a[href]',
			plugins: [],
			resolvePath: (path) => path,
			requestHeaders: {
				'X-Requested-With': 'swup',
				Accept: 'text/html, application/xhtml+xml'
			},
			skipPopStateHandling: (event) => event.state?.source !== 'swup'
		};

		// merge options
		const options = {
			...defaults,
			...setOptions
		};

		// handler arrays
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
			openPageInNewTab: [],
			pageLoaded: [],
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

		// variable for anchor to scroll to after render
		this.scrollToElement = null;
		// variable for promise used for preload, so no new loading of the same page starts while page is loading
		this.preloadPromise = null;
		// variable for save options
		this.options = options;
		// variable for plugins array
		this.plugins = [];
		// variable for current transition object
		this.transition = {};
		// variable for keeping event listeners from "delegate"
		this.delegatedListeners = {};
		// so we are able to remove the listener
		this.boundPopStateHandler = this.popStateHandler.bind(this);
		// allows us to compare the current and new path inside popStateHandler
		this.currentPageUrl = getCurrentUrl();

		// make modules accessible in instance
		this.cache = new Cache();
		this.cache.swup = this;
		this.loadPage = loadPage;
		this.leavePage = leavePage;
		this.renderPage = renderPage;
		this.enterPage = enterPage;
		this.triggerEvent = triggerEvent;
		this.on = on;
		this.off = off;
		this.updateTransition = updateTransition;
		this.getAnimationPromises = getAnimationPromises;
		this.getPageData = getPageData;
		this.getAnchorElement = getAnchorElement;
		this.log = () => {}; // here so it can be used by plugins
		this.use = use;
		this.unuse = unuse;
		this.findPlugin = findPlugin;
		this.getCurrentUrl = getCurrentUrl;
		this.cleanupAnimationClasses = cleanupAnimationClasses;

		// enable swup
		this.enable();
	}

	enable() {
		// check for Promise support
		if (typeof Promise === 'undefined') {
			console.warn('Promise is not supported');
			return;
		}

		// add event listeners
		this.delegatedListeners.click = delegate(
			document,
			this.options.linkSelector,
			'click',
			this.linkClickHandler.bind(this)
		);
		window.addEventListener('popstate', this.boundPopStateHandler);

		// initial save to cache
		if (this.options.cache) {
			// disabled to avoid caching modified dom state
			// https://github.com/swup/swup/issues/475
			// logic moved to preload plugin
		}

		// mark swup blocks in html
		markSwupElements(document.documentElement, this.options.containers);

		// mount plugins
		this.options.plugins.forEach((plugin) => {
			this.use(plugin);
		});

		// modify initial history record
		updateHistoryRecord();

		// trigger enabled event
		this.triggerEvent('enabled');

		// add swup-enabled class to html tag
		document.documentElement.classList.add('swup-enabled');

		// trigger page view event
		this.triggerEvent('pageView');
	}

	destroy() {
		// remove delegated listeners
		this.delegatedListeners.click.destroy();

		// remove popstate listener
		window.removeEventListener('popstate', this.boundPopStateHandler);

		// empty cache
		this.cache.empty();

		// unmount plugins
		this.options.plugins.forEach((plugin) => {
			this.unuse(plugin);
		});

		// remove swup data atributes from blocks
		queryAll('[data-swup]').forEach((element) => {
			element.removeAttribute('data-swup');
		});

		// remove handlers
		this.off();

		// trigger disable event
		this.triggerEvent('disabled');

		// remove swup-enabled class from html tag
		document.documentElement.classList.remove('swup-enabled');
	}

	linkClickHandler(event) {
		const linkEl = event.delegateTarget;

		// Exit early if the link would open new window (or none at all)
		if (this.triggerWillOpenNewWindow(linkEl)) {
			return;
		}

		// Exit early if the link should be ignored
		if (this.options.ignoreLink(linkEl)) {
			return;
		}

		// Exit early if control key pressed
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			this.triggerEvent('openPageInNewTab', event);
			return;
		}

		// Exit early if other than left mouse button
		if (event.button !== 0) {
			return;
		}

		this.triggerEvent('clickLink', event);
		event.preventDefault();

		const link = new Link(linkEl);
		const url = link.getAddress();
		const hash = link.getHash();

		// Handle links to the same page and exit early, where applicable
		if (!url || url === getCurrentUrl()) {
			this.handleLinkToSamePage(url, hash, event);
			return;
		}

		// Exit early if the resolved path hasn't changed
		if (this.isSameResolvedPath(url, getCurrentUrl())) return;

		// Store the element that should be scrolled to after loading the next page
		this.scrollToElement = hash || null;

		// Get the custom transition name, if present
		const customTransition = linkEl.getAttribute('data-swup-transition');

		// Finally, proceed with loading the page
		this.loadPage({ url, customTransition }, false);
	}

	handleLinkToSamePage(url, hash, event) {
		// Emit event and exit early if the url points to the same page without hash
		if (!hash) {
			this.triggerEvent('samePage', event);
			return;
		}

		// link to the same URL with hash
		this.triggerEvent('samePageWithHash', event);

		const element = getAnchorElement(hash);

		// Warn and exit early if no matching element was found for the hash
		if (!element) {
			return console.warn(`Element for offset not found (#${hash})`);
		}

		updateHistoryRecord(url + hash);
	}

	triggerWillOpenNewWindow(triggerEl) {
		if (triggerEl.matches('[download], [target="_blank"]')) {
			return true;
		}
		return false;
	}

	popStateHandler(event) {
		// Exit early if this event should be ignored
		if (this.options.skipPopStateHandling(event)) {
			return;
		}

		// Exit early if the resolved path hasn't changed
		if (this.isSameResolvedPath(getCurrentUrl(), this.currentPageUrl)) {
			return;
		}

		const url = event.state?.url ?? location.href;

		const link = new Link(url);
		if (link.getHash()) {
			this.scrollToElement = link.getHash();
		} else {
			event.preventDefault();
		}

		this.triggerEvent('popState', event);

		if (!this.options.animateHistoryBrowsing) {
			document.documentElement.classList.remove('is-animating');
			cleanupAnimationClasses();
		}

		this.loadPage({ url: link.getAddress() }, event);
	}

	/**
	 * Utility function to validate and run the global option 'resolvePath'
	 * @param {string} path
	 * @returns {string} the resolved path
	 */
	resolvePath(path) {
		if (typeof this.options.resolvePath !== 'function') {
			console.warn(`[swup] options.resolvePath needs to be a function.`);
			return path;
		}
		const result = this.options.resolvePath(path);
		if (!result || typeof result !== 'string') {
			console.warn(`[swup] options.resolvePath needs to return a path`);
			return path;
		}
		return result;
	}

	/**
	 * Compares the resolved version of two paths and returns true if they are the same
	 * @param {string} path1
	 * @param {string} path2
	 * @returns {boolean}
	 */
	isSameResolvedPath(path1, path2) {
		return this.resolvePath(path1) === this.resolvePath(path2);
	}
}
