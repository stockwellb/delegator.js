// main.js - Demo of delegator.js capabilities

import { createDelegator, createHandlerPlugin } from './src/delegator.js';
import { copyTextPlugin, copyLinkPlugin } from './src/plugins/copy.js';

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
};

// ---------------------------
// Custom confirm plugin
// ---------------------------

const confirmPlugin = {
	name: 'confirm-dialog',
	match(ctx) {
		if (!ctx.target) return null;
		return ctx.target.closest('[data-confirm]');
	},
	handle(ctx, el) {
		ctx.event.preventDefault();
		ctx.event.stopPropagation();

		const message = el.getAttribute('data-confirm');
		log(`Confirm dialog triggered: "${message}"`, 'info');

		if (confirm(message)) {
			log('User confirmed action', 'success');
			// In a real app, you might dispatch a custom event or call a callback
		} else {
			log('User cancelled action', 'warn');
		}

		return true;
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

// 2. Copy text plugin with feedback
copyPluginInstance = copyTextPlugin({
	onSuccess: (_ctx, _el, text) => {
		log(`Copied text: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`, 'success');
	},
	onError: (_ctx, _el, err) => {
		log(`Copy failed: ${err.message}`, 'error');
	},
});
delegator.use(copyPluginInstance);

// 3. Copy link plugin with feedback
copyLinkPluginInstance = copyLinkPlugin({
	onSuccess: (_ctx, _el, url) => {
		log(`Copied link: "${url.substring(0, 40)}${url.length > 40 ? '...' : ''}"`, 'success');
	},
	onError: (_ctx, _el, err) => {
		log(`Copy link failed: ${err.message}`, 'error');
	},
});
delegator.use(copyLinkPluginInstance);

// 4. Custom confirm plugin
delegator.use(confirmPlugin);

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
