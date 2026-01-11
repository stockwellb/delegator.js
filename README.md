# delegator.js

A tiny, framework free DOM event delegation kernel with plugin support.

**Zero dependencies** | **ES Modules**

## Why?

Mostly so I can make SSR apps with some vanilla JS interactivity without pulling in a large framework.

- **Single delegated listener** - one event listener handles your entire app
- **Data attributes as the API** - HTML is self-documenting
- **Plugin pipeline** - extensible without bloating the core
- **Ignore zones** - opt-out areas for third-party widgets
- **Fully testable** - injection points for testing without browser APIs

## Install

```bash
npm install @stockwellb/delegator.js
```

## Quick Start

```js
import { createDelegator, createHandlerPlugin } from '@stockwellb/delegator.js';

const delegator = createDelegator({
  ignore: '[data-ignore]', // skip these areas
});

delegator.use(createHandlerPlugin({
  handlers: {
    sayHello: () => alert('Hello!'),
    Counter: {
      increment: (e, el) => { /* ... */ },
      decrement: (e, el) => { /* ... */ },
    },
  },
}));

delegator.start();
```

```html
<button data-handler="sayHello">Greet</button>
<button data-handler="Counter.increment">+1</button>

<div data-ignore>
  <!-- delegator won't intercept events here -->
</div>
```

## Core API

### `createDelegator(options)`

| Option | Default | Description |
|--------|---------|-------------|
| `root` | `document` | EventTarget to attach listener |
| `rootEl` | `documentElement` | Semantic root for context |
| `eventType` | `'click'` | Event type to delegate |
| `capture` | `false` | Use capture phase |
| `passive` | `false` | Mark listener as passive |
| `ignore` | `null` | Selector string or `(ctx) => boolean` |
| `plugins` | `[]` | Initial plugin list |
| `stopOnHandle` | `true` | Stop after first plugin handles |
| `onHandle` | `null` | `(plugin, ctx, el) => void` - called when a plugin handles |
| `onError` | `null` | `(err, plugin, ctx, phase) => void` - called on plugin errors |

**Returns:** `{ start, stop, use, remove, plugins }`

```js
const delegator = createDelegator({ ignore: '.third-party' });

delegator.use(myPlugin);       // Add plugin
delegator.remove(myPlugin);    // Remove by reference
delegator.remove('plugin-name'); // Remove by name
delegator.plugins();           // List active plugins
delegator.start();             // Attach listener
delegator.stop();              // Detach listener
```

### Debugging / Analytics

Use `onHandle` to track which plugins handle events:

```js
const delegator = createDelegator({
  onHandle: (plugin, ctx, el) => {
    console.log(`[${plugin.name}] handled`, el);
    // Or send to analytics
    analytics.track('interaction', { plugin: plugin.name, target: el.id });
  },
});
```

### Error Handling

Use `onError` to capture plugin errors for reporting:

```js
const delegator = createDelegator({
  onError: (err, plugin, ctx, phase) => {
    // phase is "match", "handle", or "onHandle"
    errorReporting.send(err, { plugin: plugin.name, phase });
  },
});
```

Without `onError`, errors are logged to `console.error`.

## Plugins

Plugins have two methods:

```js
const myPlugin = {
  name: 'my-plugin', // optional, useful for remove()

  match(ctx) {
    // Return matched element or null
    return ctx.target?.closest('[data-my-action]');
  },

  handle(ctx, el) {
    // Do something with the matched element
    // Return false to pass to next plugin
    // Return true/void to stop pipeline (if stopOnHandle)
    // Can be async
  },
};
```

### Context Object

```js
{
  event,              // Original DOM event
  target,             // event.target as Element (or null)
  rootEl,             // Root element from options
}
```

## Built-in: Handler Plugin

Dispatch `data-handler` attributes to a registry. Supports dot notation.

```js
import { createHandlerPlugin } from '@stockwellb/delegator.js';

delegator.use(createHandlerPlugin({
  handlers: {
    simple: (e, el) => { /* ... */ },
    Namespaced: {
      action: (e, el) => { /* ... */ },
    },
  },
  selector: '[data-handler]',    // default
  preventDefault: true,          // default
  stopPropagation: true,         // default
  ignore: null,                  // plugin-level ignore
  onMissing: (ctx, el, name) => {},  // missing handler callback
  onInvoke: (ctx, el, fn, name) => {},  // intercept invocation
}));
```

```html
<button data-handler="simple">Click</button>
<button data-handler="Namespaced.action">Namespaced</button>
```

## Built-in: Copy Plugins

Copy text or links to clipboard.

```js
import { copyTextPlugin, copyLinkPlugin } from '@stockwellb/delegator.js/src/plugins/copy.js';

delegator.use(copyTextPlugin({
  onSuccess: (ctx, el, text) => console.log('Copied:', text),
  onError: (ctx, el, err) => console.error(err),
}));

delegator.use(copyLinkPlugin({
  buildURL: (raw, ctx, el) => raw, // customize URL building
}));
```

```html
<!-- Copy text -->
<button data-copy-text="Hello, world!">Copy</button>

<!-- Copy link (hashes expand to full URL) -->
<button data-copy-link="#section-1">Copy Link</button>
<button data-copy-link="https://example.com">Copy URL</button>
```

## Using with HTMX

delegator.js works alongside HTMX for handling non-AJAX interactions. Configure ignore zones to prevent conflicts.

### Basic Setup

```js
const delegator = createDelegator({
  // Ignore elements that HTMX handles
  ignore: '[hx-get],[hx-post],[hx-put],[hx-delete],[hx-patch],[hx-trigger]',
});

delegator.use(createHandlerPlugin({
  handlers: { /* your handlers */ },
  stopPropagation: false, // Let events bubble to HTMX
}));

delegator.start();
```

### Why This Matters

| Issue | Solution |
|-------|----------|
| Both libraries handle same click | Use `ignore` to exclude `hx-*` elements |
| `stopPropagation` blocks HTMX | Set `stopPropagation: false` on handler plugin |
| Element has both `data-handler` and `hx-*` | Add to ignore selector or use plugin-level ignore |

### Plugin-Level Ignore

For finer control, configure ignore at the plugin level:

```js
delegator.use(createHandlerPlugin({
  handlers: myHandlers,
  ignore: '[hx-get],[hx-post]', // Only this plugin ignores HTMX
  stopPropagation: false,
}));

delegator.use(copyTextPlugin({
  // Copy plugin still works on HTMX elements if needed
}));
```

### Predicate Ignore

For complex scenarios, use a predicate function:

```js
const delegator = createDelegator({
  ignore: (ctx) => {
    if (!ctx.target) return false;
    // Ignore any element with an hx-* attribute
    return Array.from(ctx.target.attributes).some(
      attr => attr.name.startsWith('hx-')
    );
  },
});
```

## Testing

All plugins accept injection points for testing:

```js
// Mock clipboard in tests
const writeText = async (text) => { /* mock */ };

copyTextPlugin({ writeText });
copyLinkPlugin({ writeText, buildURL: (raw) => raw });
```

```bash
npm test          # Run tests
npm run test:watch  # Watch mode
```

## Philosophy

- **Data attributes are the API** - look at HTML, understand behavior
- **Keep the core tiny** - push app logic into plugins/handlers
- **Prefer explicitness** - no magic, no hidden behavior
- **Injection over globals** - testable without browser APIs

## License

MIT

---

Built for SSR-first apps where you want interactivity without the framework tax.
