// main.js - Demo of delegator.js capabilities

import { createDelegator } from './src/delegator.js';
import { createHandlerPlugin } from './src/plugins/handler.js';
import { copyTextPlugin } from './src/plugins/copy-text.js';
import { copyLinkPlugin } from './src/plugins/copy-link.js';
import { toggleClassPlugin } from './src/plugins/toggle.js';
import { dismissPlugin } from './src/plugins/dismiss.js';
import { scrollToPlugin } from './src/plugins/scroll-to.js';
import { disablePlugin } from './src/plugins/disable.js';
import { focusPlugin } from './src/plugins/focus.js';
import { confirmPlugin } from './src/plugins/confirm.js';

// ---------------------------
// Feedback helper (replaces removed library feature)
// ---------------------------

/**
 * Apply icon swap feedback on an element.
 * Reads data-feedback-* attributes or uses provided options.
 *
 * @param {Element} el - The button/element that was clicked
 * @param {Object} opts - Optional overrides
 * @param {string} opts.targetSelector - Selector for icon element (default 'i')
 * @param {string} opts.swap - Class swap in "from:to" format
 * @param {number} opts.ms - Duration before reverting (default 1500)
 */
function applyFeedback(el, opts = {}) {
	const targetSelector = opts.targetSelector || el.getAttribute('data-feedback-target') || 'i';
	const swap = opts.swap || el.getAttribute('data-feedback-swap');
	const ms = opts.ms || Number(el.getAttribute('data-feedback-ms')) || 1500;

	if (!swap) return;

	const [fromClass, toClass] = swap.split(':').map(s => s.trim());
	if (!fromClass || !toClass) return;

	const target = el.querySelector(targetSelector);
	if (!target) return;

	// Save original classes to restore later
	const original = target.className;

	// Swap the classes
	target.classList.remove(fromClass);
	target.classList.add(toClass);

	// Revert after delay
	setTimeout(() => {
		target.className = original;
	}, ms);
}

// ---------------------------
// Logging utility
// ---------------------------

function log(message, type = 'info') {
	const logEl = document.getElementById('log');
	const entry = document.createElement('div');
	entry.className = 'log-entry';

	const timestamp = new Date().toLocaleTimeString();
	const icon = {
		info: '📝',
		success: '✅',
		error: '❌',
		warn: '⚠️',
	}[type] || '📝';

	entry.textContent = `${timestamp} ${icon} ${message}`;
	logEl.appendChild(entry);
	logEl.scrollTop = logEl.scrollHeight;
}

// ---------------------------
// State
// ---------------------------

let count = 0;
let copyPluginInstance = null;
let copyLinkPluginInstance = null;
let copyEnabled = true;

function updateCounter() {
	document.getElementById('counter').textContent = count;
}

function updateCopyStatus() {
	const status = document.getElementById('copy-status');
	status.textContent = copyEnabled ? 'Active' : 'Disabled';
	status.style.background = copyEnabled ? '#dbeafe' : '#fee2e2';
	status.style.color = copyEnabled ? '#1e40af' : '#991b1b';
}

// ---------------------------
// Handler registry
// ---------------------------

const handlers = {
	// Simple handler
	sayHello: (_e, _el) => {
		log('sayHello handler called', 'success');
		alert('Hello from delegator.js! 👋');
	},

	// Namespaced handlers (dot notation)
	Demo: {
		increment: (_e, _el) => {
			count++;
			updateCounter();
			log(`Counter incremented to ${count}`, 'info');
		},
		decrement: (_e, _el) => {
			count--;
			updateCounter();
			log(`Counter decremented to ${count}`, 'info');
		},
		reset: (_e, _el) => {
			count = 0;
			updateCounter();
			log('Counter reset to 0', 'info');
		},
		resetAlerts: (_e, _el) => {
			// Restore dismissed alerts by re-inserting the HTML
			const section = document.querySelector('section:has(.alert-demo)') ||
			                document.querySelector('h3 .fa-xmark')?.closest('section');
			if (section) {
				const container = section.querySelector('h3').nextElementSibling.nextElementSibling ?
				                  section : section;
				// Find the button that triggers reset
				const resetBtn = section.querySelector('[data-handler="Demo.resetAlerts"]');

				// Create alert HTML
				const alertsHTML = `
					<div class="alert-demo" id="alert-demo-1">
						<i class="fa-solid fa-circle-info"></i>
						<span>This is an info alert with a dismiss button.</span>
						<button class="btn-dismiss" data-dismiss="#alert-demo-1">
							<i class="fa-solid fa-xmark"></i>
						</button>
					</div>

					<div class="alert-demo alert-warning" id="alert-demo-2">
						<i class="fa-solid fa-triangle-exclamation"></i>
						<span>Warning! This alert will be removed from the DOM.</span>
						<button class="btn-dismiss" data-dismiss="#alert-demo-2">
							<i class="fa-solid fa-xmark"></i>
						</button>
					</div>

					<div class="alert-demo alert-success">
						<i class="fa-solid fa-circle-check"></i>
						<span>No selector needed - dismisses closest .alert parent automatically.</span>
						<button class="btn-dismiss" data-dismiss>
							<i class="fa-solid fa-xmark"></i>
						</button>
					</div>

					<div class="alert-demo" id="alert-hide-demo">
						<i class="fa-solid fa-eye-slash"></i>
						<span>This one uses <code>data-dismiss-mode="hide"</code> - adds hidden class instead of removing.</span>
						<button class="btn-dismiss" data-dismiss="#alert-hide-demo" data-dismiss-mode="hide">
							<i class="fa-solid fa-xmark"></i>
						</button>
					</div>
				`;

				// Remove existing alerts
				section.querySelectorAll('.alert-demo').forEach(el => el.remove());

				// Insert new alerts before the reset button
				if (resetBtn) {
					resetBtn.insertAdjacentHTML('beforebegin', alertsHTML);
				}

				log('Alerts reset', 'info');
			}
		},
	},

	// Plugin management
	Plugins: {
		toggleCopy: (_e, _el) => {
			if (copyEnabled) {
				delegator.remove(copyPluginInstance);
				delegator.remove(copyLinkPluginInstance);
				copyEnabled = false;
				log('Copy plugins removed', 'warn');
			} else {
				delegator.use(copyPluginInstance);
				delegator.use(copyLinkPluginInstance);
				copyEnabled = true;
				log('Copy plugins added', 'success');
			}
			updateCopyStatus();
		},
		showActive: (_e, _el) => {
			const plugins = delegator.plugins();
			const names = plugins.map(p => p.name || 'anonymous').join(', ');
			log(`Active plugins: ${names}`, 'info');
			alert(`Active plugins (${plugins.length}):\n\n${plugins.map(p => `• ${p.name || 'anonymous'}`).join('\n')}`);
		},
	},

	// Log management
	Log: {
		clear: (_e, _el) => {
			document.getElementById('log').innerHTML = '';
			log('Log cleared', 'info');
		},
	},

	// Error demo
	Error: {
		triggerError: (_e, _el) => {
			throw new Error('Intentional error for demo');
		},
	},
};

// ---------------------------
// Create delegator
// ---------------------------

const delegator = createDelegator({
	root: document,
	eventType: 'click',
	ignore: '[data-ignore]', // Ignore zone selector
	stopOnHandle: true,
	onError: (err, plugin, _ctx, phase) => {
		log(`Error in ${plugin.name} (${phase}): ${err.message}`, 'error');
	},
});

// ---------------------------
// Add plugins
// ---------------------------

// 1. Handler plugin for data-handler dispatch
delegator.use(createHandlerPlugin({
	handlers,
	onMissing: (_ctx, _el, name) => {
		log(`Handler not found: "${name}"`, 'error');
	},
}));

// 2. Copy text plugin
copyPluginInstance = copyTextPlugin({
	onSuccess: (_ctx, el, text) => {
		applyFeedback(el);
		log(`Copied text: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`, 'success');
	},
	onError: (_ctx, _el, err) => {
		log(`Copy failed: ${err.message}`, 'error');
	},
});
delegator.use(copyPluginInstance);

// 3. Copy link plugin
copyLinkPluginInstance = copyLinkPlugin({
	onSuccess: (_ctx, el, url) => {
		applyFeedback(el);
		log(`Copied link: "${url.substring(0, 40)}${url.length > 40 ? '...' : ''}"`, 'success');
	},
	onError: (_ctx, _el, err) => {
		log(`Copy link failed: ${err.message}`, 'error');
	},
});
delegator.use(copyLinkPluginInstance);

// 4. Confirm plugin
delegator.use(confirmPlugin({
	onConfirm: (_ctx, el, message) => {
		log(`User confirmed: "${message}"`, 'success');
	},
	onCancel: (_ctx, el, message) => {
		log(`User cancelled: "${message}"`, 'warn');
	},
}));

// 5. Toggle class plugin
delegator.use(toggleClassPlugin({
	onToggle: (_ctx, el, target, classes) => {
		log(`Toggled [${classes.join(', ')}] on ${target.id || target.tagName}`, 'info');
	},
}));

// 6. Dismiss plugin
delegator.use(dismissPlugin({
	onDismiss: (_ctx, el, target) => {
		log(`Dismissing ${target.id || target.className || target.tagName}`, 'info');
	},
}));

// 7. Scroll-to plugin
delegator.use(scrollToPlugin({
	offset: 20, // Small offset for visual breathing room
	onScroll: (_ctx, el, target) => {
		log(`Scrolling to ${target.id || target.tagName}`, 'info');
	},
}));

// 8. Disable plugin (for preventing double-submits)
delegator.use(disablePlugin({
	onDisable: (_ctx, el) => {
		log(`Disabled: ${el.id || el.textContent.trim()}`, 'info');
	},
	onEnable: (_ctx, el) => {
		log(`Re-enabled: ${el.id || el.textContent.trim()}`, 'success');
	},
}));

// 9. Focus plugin (for accessibility and skip links)
delegator.use(focusPlugin({
	onFocus: (_ctx, el, target) => {
		log(`Focused: ${target.id || target.tagName}`, 'info');
	},
}));

// ---------------------------
// Start delegator
// ---------------------------

delegator.start();
log('Delegator started with plugins: ' + delegator.plugins().map(p => p.name).join(', '), 'success');

// ---------------------------
// Expose for debugging
// ---------------------------

if (typeof window !== 'undefined') {
	window['delegator'] = delegator;
	window['handlers'] = handlers;
}

console.log('🎯 delegator.js demo loaded');
console.log('   Access `window.delegator` and `window.handlers` for debugging');
