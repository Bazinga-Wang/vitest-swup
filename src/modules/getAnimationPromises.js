import { queryAll } from '../utils';
import { transitionEnd, transitionProperty } from '../helpers';

const getAnimationPromises = function() {
	const promises = [];
	const animatedElements = queryAll(this.options.animationSelector, document.body);

	if (!animatedElements.length) {
		console.error(`No animated elements found by selector ${this.options.animationSelector}`);
		return [Promise.resolve()];
	}

	animatedElements.forEach((element) => {
		const transitionDuration = window.getComputedStyle(element)[`${transitionProperty()}Duration`];
		// Resolve immediately if no transition defined
		if (!transitionDuration || transitionDuration == '0s') {
			console.error(`No CSS transition defined for element of selector ${this.options.animationSelector}`);
			promises.push(Promise.resolve());
			return;
		}
		const promise = new Promise((resolve) => {
			element.addEventListener(transitionEnd(), (event) => {
				if (element == event.target) {
					resolve();
				}
			});
		});
		promises.push(promise);
	});

	return promises;
};

export default getAnimationPromises;
