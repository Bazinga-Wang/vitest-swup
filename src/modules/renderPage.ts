import { Location, updateHistoryRecord, getCurrentUrl } from '../helpers.js';
import Swup from '../Swup.js';
import { PageRecord } from './Cache.js';

export type PageRenderOptions = {
	event?: PopStateEvent;
	skipTransition?: boolean;
};

export const renderPage = async function (
	this: Swup,
	page: PageRecord,
	{ event, skipTransition }: PageRenderOptions = {}
) {
	document.documentElement.classList.remove('is-leaving');

	// do nothing if another page was requested in the meantime
	if (!this.isSameResolvedUrl(getCurrentUrl(), page.url)) {
		return;
	}

	const { url } = Location.fromUrl(page.responseURL);

	// update cache and state if the url was redirected
	if (!this.isSameResolvedUrl(getCurrentUrl(), url)) {
		this.cache.cacheUrl({ ...page, url });
		this.currentPageUrl = getCurrentUrl();
		updateHistoryRecord(url);
	}

	// only add for page loads with transitions
	if (!skipTransition) {
		document.documentElement.classList.add('is-rendering');
	}

	await this.events.run('willReplaceContent', event);
	await this.replaceContent(page);
	await this.events.run('contentReplaced', event);
	await this.events.run('pageView', event);

	// empty cache if it's disabled (in case preload plugin filled it)
	if (!this.options.cache) {
		this.cache.empty();
	}

	// Perform in transition
	this.enterPage({ event, skipTransition });

	// reset scroll-to element
	this.scrollToElement = null;
};
