// The plugin, against a real Fastify server on a real socket. The shared
// conformance corpus is asserted in conformance.test.mjs.
//
// A test server answers on the loopback, so `request.ip` is a bogon and is
// answered locally without a request. Anything that needs a served answer
// therefore has to arrive wearing a public address - through `trustProxy`, or a
// selector.

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import Fastify from 'fastify';
import { VPNDetection } from 'vpndetection';

import {
    defaultIpSelector, headerIpSelector, vpndetection, xffIpSelector,
} from '../dist/index.js';

const PUBLIC_IP = '45.83.91.1';
const servers = [];

after(async () => {
    for (const s of servers) {
        await s.close();
    }
});

function stubClient(body = { is_vpn: true, vpn: { provider: 'nordvpn' } }) {
    const asked = [];
    const client = new VPNDetection({
        cache: false,
        retries: 0,
        fetch: async (input) => {
            const url = new URL(typeof input === 'string' ? input : input.url);
            const ip = decodeURIComponent(url.pathname.slice(1));
            asked.push(ip);
            return new Response(JSON.stringify({ ip: ip, ...body }), {
                status: 200, headers: { 'content-type': 'application/json' },
            });
        },
    });
    return { client: client, asked: asked };
}

async function serve(options, fastifyOptions = {}) {
    const app = Fastify(fastifyOptions);
    await app.register(vpndetection, options);
    app.get('/', async (request) => ({
        ip: request.vpndetection?.ip ?? null,
        isVpn: request.vpndetection?.result?.isVpn ?? null,
        isBogon: request.vpndetection?.result?.isBogon ?? null,
        error: request.vpndetection?.error?.kind ?? null,
        attached: request.vpndetection !== undefined,
    }));
    await app.listen({ port: 0, host: '127.0.0.1' });
    servers.push(app);
    const base = `http://127.0.0.1:${app.server.address().port}`;
    return async (headers = {}) => {
        const res = await fetch(`${base}/`, { headers: headers });
        return { status: res.status, body: await res.json().catch(() => null) };
    };
}

const fixedIp = () => PUBLIC_IP;

test('enriches the request and leaves the decision to the app', async () => {
    const { client: client, asked: asked } = stubClient();
    const call = await serve({ client: client, ipSelector: fixedIp });
    const res = await call();
    assert.equal(res.status, 200);
    assert.equal(res.body.attached, true);
    assert.equal(res.body.isVpn, true);
    assert.equal(res.body.ip, PUBLIC_IP);
    assert.deepEqual(asked, [PUBLIC_IP]);
});

test('blocks with 403 when the condition matches, and passes when it does not', async () => {
    const vpn = stubClient({ is_vpn: true, vpn: { provider: 'nordvpn' } });
    const blocked = await serve({
        client: vpn.client, ipSelector: fixedIp, blockCondition: { isVpn: true },
    });
    const denied = await blocked();
    assert.equal(denied.status, 403);
    assert.deepEqual(denied.body, { error: 'access denied' });

    const clean = stubClient({ is_vpn: false, vpn: {} });
    const allowed = await serve({
        client: clean.client, ipSelector: fixedIp, blockCondition: { isVpn: true },
    });
    assert.equal((await allowed()).status, 200);
});

test('a blocked request never reaches the handler', async () => {
    const { client: client } = stubClient();
    const call = await serve({
        client: client, ipSelector: fixedIp, blockCondition: { isVpn: true },
    });
    const res = await call();
    assert.equal(res.status, 403);
    assert.equal(res.body.attached, undefined, 'the route handler answered a blocked request');
});

// The case where awaiting onBlocked is load-bearing. A synchronous
// `reply.send()` ends the lifecycle on its own, so the default refusal passes
// whether or not the hook awaits - which is why that alone proves nothing. An
// async one has sent nothing by the time an un-awaited hook resolves, and
// Fastify goes on to the handler.
test('an async onBlocked is awaited, so the handler still never runs', async () => {
    const { client: client } = stubClient();
    const call = await serve({
        client: client,
        ipSelector: fixedIp,
        blockCondition: { isVpn: true },
        onBlocked: async (request, reply) => {
            await new Promise((r) => setTimeout(r, 25));
            return reply.status(451).send({ refused: true });
        },
    });
    const res = await call();
    assert.equal(res.status, 451);
    assert.deepEqual(res.body, { refused: true });
});

test('a condition reaching the evidence fields is what a flag list cannot do', async () => {
    const nord = stubClient({ is_vpn: true, vpn: { provider: 'nordvpn' } });
    const call = await serve({
        client: nord.client, ipSelector: fixedIp, blockCondition: { vpn: { provider: 'mullvad' } },
    });
    assert.equal((await call()).status, 200, 'a different provider must not match');

    const mullvad = stubClient({ is_vpn: true, vpn: { provider: 'mullvad' } });
    const call2 = await serve({
        client: mullvad.client, ipSelector: fixedIp,
        blockCondition: { vpn: { provider: 'mullvad' } },
    });
    assert.equal((await call2()).status, 403);
});

test('onBlocked replaces the refusal entirely', async () => {
    const { client: client } = stubClient();
    const call = await serve({
        client: client,
        ipSelector: fixedIp,
        blockCondition: { isVpn: true },
        onBlocked: (request, reply, lookup) => reply.status(451)
            .send({ why: lookup.result.vpn.provider }),
    });
    const res = await call();
    assert.equal(res.status, 451);
    assert.deepEqual(res.body, { why: 'nordvpn' });
});

test('skip leaves the request untouched', async () => {
    const { client: client, asked: asked } = stubClient();
    const call = await serve({
        client: client, ipSelector: fixedIp, blockCondition: { isVpn: true },
        skip: (request) => request.url === '/',
    });
    const res = await call();
    assert.equal(res.status, 200);
    assert.equal(res.body.attached, false);
    assert.deepEqual(asked, []);
});

test('a failing lookup lets the visitor through', async () => {
    const failing = new VPNDetection({
        retries: 0,
        fetch: async () => new Response('{"error":"boom"}', { status: 500 }),
    });
    const call = await serve({
        client: failing, ipSelector: fixedIp, blockCondition: { isVpn: true },
    });
    const res = await call();
    assert.equal(res.status, 200);
    assert.equal(res.body.error, 'server_error');
});

test('onMissingField: throw becomes a 500 rather than a silent pass', async () => {
    const free = stubClient({ is_vpn: true });
    const call = await serve({
        client: free.client, ipSelector: fixedIp,
        blockCondition: { isHosting: true }, onMissingField: 'throw',
    });
    assert.equal((await call()).status, 500);
});

// The test that matters. Every other assertion here would pass whether or not
// the selector is right, because a direct connection has nothing to confuse.
test('a forged X-Forwarded-For is ignored by default and honoured only on request', async () => {
    const forgery = { 'x-forwarded-for': PUBLIC_IP };

    const plain = stubClient();
    const untrusting = await serve({ client: plain.client });
    const direct = await untrusting(forgery);
    assert.equal(direct.body.ip, '127.0.0.1',
        'without trustProxy, request.ip is the socket peer and the header is a forgery');
    assert.deepEqual(plain.asked, [], 'and a bogon is answered locally, so nothing was asked');

    const trusting = stubClient();
    const trusted = await serve({ client: trusting.client }, { trustProxy: true });
    assert.equal((await trusted(forgery)).body.ip, PUBLIC_IP,
        'trustProxy is the application saying it believes the header');
    assert.deepEqual(trusting.asked, [PUBLIC_IP]);

    const explicit = stubClient();
    const viaSelector = await serve({ client: explicit.client, ipSelector: xffIpSelector() });
    assert.equal((await viaSelector(forgery)).body.ip, PUBLIC_IP);
    assert.deepEqual(explicit.asked, [PUBLIC_IP]);
});

test('a header selector reads the edge that writes it', async () => {
    const { client: client, asked: asked } = stubClient();
    const call = await serve({
        client: client, ipSelector: headerIpSelector('CF-Connecting-IP'),
    });
    assert.equal((await call({ 'cf-connecting-ip': '45.83.91.9' })).body.ip, '45.83.91.9');
    assert.equal((await call({})).body.ip, '127.0.0.1',
        'and falls back to request.ip when the edge did not write one');
    assert.deepEqual(asked, ['45.83.91.9']);
});

test('depth counts trusted hops from the right', async () => {
    const { client: client, asked: asked } = stubClient();
    const call = await serve({ client: client, ipSelector: xffIpSelector({ depth: 1 }) });
    await call({ 'x-forwarded-for': `${PUBLIC_IP}, 70.41.3.18, 150.172.238.178` });
    assert.deepEqual(asked, ['150.172.238.178']);
});

test('the default selector is request.ip', async () => {
    const { client: client } = stubClient();
    const call = await serve({ client: client, ipSelector: defaultIpSelector });
    assert.equal((await call()).body.ip, '127.0.0.1');
});

test('a private client address is answered locally and never blocks', async () => {
    const { client: client, asked: asked } = stubClient();
    const warnings = [];
    const call = await serve({
        client: client, blockCondition: { isVpn: true }, onWarn: (m) => warnings.push(m),
    });
    const res = await call();
    assert.equal(res.status, 200, 'local development must not lock you out of your own app');
    assert.equal(res.body.isBogon, true);
    assert.deepEqual(asked, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /not a public address/);
});

test('the deadline bounds the request rather than the visitor waiting on us', async () => {
    const hung = new VPNDetection({ retries: 0, fetch: () => new Promise(() => {}) });
    const call = await serve({
        client: hung, ipSelector: fixedIp, timeoutMs: 150, blockCondition: { isVpn: true },
    });
    const started = Date.now();
    const res = await call();
    assert.equal(res.status, 200);
    assert.equal(res.body.error, 'network');
    assert.ok(Date.now() - started < 3000, 'the visitor was held past the budget');
});

// fastify-plugin is what stops Fastify wrapping this in a child scope, where
// the decorator and the hook would apply to nothing the app registered.
test('the plugin applies to the instance it is registered on', async () => {
    const { client: client } = stubClient();
    const call = await serve({ client: client, ipSelector: fixedIp });
    assert.equal((await call()).body.attached, true);
});

test('a condition that constrains nothing is refused when the plugin registers', async () => {
    const app = Fastify();
    await assert.rejects(
        () => app.register(vpndetection, { blockCondition: { isVpn: false } }).ready(),
        /constrains nothing/,
    );
    await app.close();
});
