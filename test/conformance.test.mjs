// The shared conformance corpus, asserted through a real Fastify server rather
// than against the core directly. The core has its own suite in the client
// SDK; what this adds is proof that the adapter wires it up - that a matching
// condition actually refuses the request and a plan gap actually surfaces.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';

import Fastify from 'fastify';
import { VPNDetection } from 'vpndetection';

import { vpndetection } from '../dist/index.js';

const data = JSON.parse(readFileSync(new URL('../testdata/testdata.json', import.meta.url), 'utf8'));
const servers = [];

after(async () => {
    for (const s of servers) {
        await s.close();
    }
});

// The corpus speaks the wire's names so every language can read it. Only the
// top-level members are renamed, exactly as a response is: the detail objects
// keep their wire keys in this SDK too.
const MEMBER = {
    is_vpn: 'isVpn', is_hosting: 'isHosting', is_relay: 'isRelay', is_tor: 'isTor',
    is_cdn: 'isCdn', is_resproxy: 'isResproxy', is_dcproxy: 'isDcproxy', is_mobproxy: 'isMobproxy',
};

function toIdiom(condition) {
    if (Array.isArray(condition)) {
        return condition.map(toIdiom);
    }
    return Object.fromEntries(Object.entries(condition).map(([k, v]) => [MEMBER[k] ?? k, v]));
}

async function serve(options) {
    const app = Fastify();
    await app.register(vpndetection, options);
    app.get('/', async () => ({ ok: true }));
    await app.listen({ port: 0, host: '127.0.0.1' });
    servers.push(app);
    return `http://127.0.0.1:${app.server.address().port}/`;
}

for (const c of data.middleware.conditions) {
    test(`corpus: ${c.name}`, async () => {
        const ip = c.bogon ?? c.body.ip;
        const client = new VPNDetection({
            cache: false,
            retries: 0,
            fetch: async () => new Response(JSON.stringify(c.body ?? {}), {
                status: 200, headers: { 'content-type': 'application/json' },
            }),
        });
        const warnings = [];
        const url = await serve({
            client: client,
            ipSelector: () => ip,
            blockCondition: toIdiom(c.condition),
            onWarn: (m) => warnings.push(m),
        });
        const res = await fetch(url);

        assert.equal(res.status, c.expect.blocked ? 403 : 200, c.why);
        const missing = c.expect.missing.map((m) => MEMBER[m] ?? m);
        const reported = warnings.filter((w) => w.includes('does not include'));
        assert.equal(reported.length, missing.length === 0 ? 0 : 1, c.why);
        for (const member of missing) {
            assert.match(reported[0], new RegExp(member), c.why);
        }
    });
}

for (const c of data.middleware.invalidConditions) {
    test(`corpus: refuses ${c.name}`, () => {
        return assert.rejects(
            () => Fastify().register(vpndetection, { blockCondition: toIdiom(c.condition) }).ready(),
            /constrains nothing/,
            c.why,
        );
    });
}

test('the corpus is the one emitted for this repo', () => {
    assert.ok(data.middleware.conditions.length > 0, 'no middleware corpus - run emit.mjs');
    assert.ok(data.isBogon.length > 0, 'no bogon corpus - run emit.mjs');
});
