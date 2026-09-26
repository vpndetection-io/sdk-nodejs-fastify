# [<img src="https://s3.vpndetection.io/vpndetection-public/brand/mark.svg" alt="VPNDetection" height="28"/>](https://vpndetection.io/) VPNDetection Fastify Plugin

[![npm](https://img.shields.io/npm/v/vpndetection-fastify.svg)](https://www.npmjs.com/package/vpndetection-fastify)
[![license](https://img.shields.io/npm/l/vpndetection-fastify.svg)](LICENSE)

The official [Fastify](https://fastify.dev) plugin for the [VPNDetection](https://vpndetection.io) API.

It classifies the visitor behind each request — VPN, residential proxy, Tor, hosting, CDN, relay — and hands the answer to your handlers. Blocking is opt-in.

## Getting Started

```bash
npm install vpndetection-fastify
```

Requires Node.js 22 or newer and Fastify 4 or 5. TypeScript types are included.

You need an API key. Create one in the [console](https://app.vpndetection.io); the free tier's allowance is counted per source address, and a server is a single source address, so a key is what makes this usable in production rather than optional.

```js
import Fastify from 'fastify';
import { vpndetection } from 'vpndetection-fastify';

// trustProxy tells Fastify to believe X-Forwarded-For; see "Where the client
// address comes from" below.
const app = Fastify({ trustProxy: true });

await app.register(vpndetection, { apiKey: process.env.VPNDETECTION_API_KEY });

app.get('/', async (request) => {
    const { result } = request.vpndetection;
    return result.isVpn ? 'Hello, VPN user' : 'Hello';
});

await app.listen({ port: 3000 });
```

By default nothing is blocked. Every request gets a `request.vpndetection` and your own code decides what that means — which is usually what you want, because whether a VPN visitor is a problem depends entirely on what they are doing.

## Blocking

Pass a `blockCondition` and a matching request is answered with `403` and never reaches your handlers.

```js
await app.register(vpndetection, {
    apiKey: process.env.VPNDETECTION_API_KEY,
    blockCondition: { isVpn: true },
});
```

A condition is written in the shape of a result, and only the members you name are considered. That lets it reach the evidence, not just the flags:

```js
blockCondition: { isVpn: true, vpn: { provider: 'nordvpn' } }         // one provider
blockCondition: { isResproxy: true, resproxy: { hits: { gte: 5 } } }  // a numeric threshold
blockCondition: { vpn: { confidence: ['high', 'medium'] } }           // any of these
blockCondition: [{ isTor: true }, { isResproxy: true }]               // a list is OR
```

Values are matched by equality, strings without regard to case. An array means any-of. `{ gte, gt, lte, lt }` compares numbers, and every bound you give must hold, so two of them are a range. Members you set to `false` or `null` are ignored, so a condition states the signals you act on; one that constrains nothing would match every request, and is refused when the middleware is created rather than silently blocking all your traffic.

Replace the refusal with `onBlocked`:

```js
await app.register(vpndetection, {
    apiKey: process.env.VPNDETECTION_API_KEY,
    blockCondition: { isVpn: true },
    onBlocked: (request, reply) => reply.status(403).send({ error: 'VPN not allowed' }),
});
```

`onBlocked` may be async; it is awaited, so the route handler never runs.

## Where the client address comes from

This is the setting that decides whether any of the above works, and it is the one thing only you can get right.

By default the plugin uses `request.ip`, which is Fastify's own accessor. **Fastify resolves `request.ip` to the socket peer unless you built the server with `trustProxy`.** So if your app sits behind nginx, a load balancer, or a CDN and you have not set it, every visitor arrives wearing your proxy's address — which is a datacenter address, so a hosting rule would block all of them.

If you are behind a proxy you control, setting Fastify's own option is the right fix and everything else here follows from it:

```js
const app = Fastify({ trustProxy: true });
```

For an edge that writes the address into its own header, name the header:

```js
import { headerIpSelector } from 'vpndetection-fastify';

await app.register(vpndetection, {
    apiKey: process.env.VPNDETECTION_API_KEY,
    ipSelector: headerIpSelector('CF-Connecting-IP'),  // or True-Client-IP, or your own
});
```

`xffIpSelector()` reads `X-Forwarded-For` directly. Be aware that the left-most entry is whatever the caller sent, because proxies append to that header — it is only trustworthy when an edge you control overwrites it. If you know how many proxies sit in front, count from the right instead: `xffIpSelector({ depth: 1 })` is the address your nearest proxy saw.

Anything else, pass your own function. It receives the Fastify request and returns an address:

```js
ipSelector: (request) => request.headers['x-real-ip'] ?? request.ip,
```

If the address resolves to a private one, the middleware says so once on `console.warn`. That is expected on localhost and is the signal to fix your configuration anywhere else.

## When a lookup fails

The request is let through, and the reason is recorded on `request.vpndetection.error`. Our outage should not become yours, so a network failure, an exhausted quota or a rejected key all fail open.

```js
app.get('/', async (request) => {
    const { result, error } = request.vpndetection;
    if (error) {
        request.log.warn({ kind: error.kind }, 'vpndetection unavailable');
    }
    return result?.isVpn ? 'Hello, VPN user' : 'Hello';
});
```

Pass `failClosed: true` to block instead. Private addresses are answered locally and never fail, so this will not lock you out in development.

## Cost and latency

Answers are cached per plugin registration for an hour, so a returning visitor costs nothing, and private addresses never leave the process. A cache miss is one request to our API, bounded at 2500 ms by default and not retried — on a request path, failing open quickly beats holding a visitor while we try again. Both are adjustable, along with the cache itself:

```js
await app.register(vpndetection, {
    apiKey: KEY, timeoutMs: 1000, retries: 1, cache: { max: 50000, ttlMs: 600000 },
});
```

Register it inside a scope to confine it to those routes, or skip what you do not care about:

```js
await app.register(async (scope) => {
    await scope.register(vpndetection, { apiKey: KEY });
    scope.get('/checkout', handler);
});

await app.register(vpndetection, {
    apiKey: KEY, skip: (request) => request.url.startsWith('/static'),
});
```

If you already hold a `VPNDetection` client, pass it as `client` and the plugin will share it rather than building a second cache.

Beyond a few million distinct visitors a day, stop calling the API per request: [download the dataset](https://vpndetection.io/databases) and look addresses up locally instead.

## Absent is not false

Only `ip` and `isVpn` come back on every plan. A field your plan does not include is `undefined`, which means "not in your plan" rather than "checked, and no".

```js
request.vpndetection.result.isHosting ?? false   // when you only want the flag
```

A `blockCondition` naming a member your plan does not serve can never match, so the plugin warns once instead of failing silently. Set `onMissingField: 'throw'` to make it an error.

## Other Libraries

There are official VPNDetection client libraries available for many languages including PHP, Python, Go, Java, Ruby, and many popular frameworks such as Django, Rails, and Laravel. See our GitHub at https://github.com/vpndetection-io for more.

## About VPNDetection

VPN Detection API: Accurate anonymity detection identifying VPNs, residential proxies, hosting servers, Tor nodes, CDNs, relays and more.

[<img src="https://s3.vpndetection.io/vpndetection-public/brand/mark.svg" alt="VPNDetection" height="64"/>](https://vpndetection.io/)

## License

This project is licensed under the [MIT License](LICENSE).
