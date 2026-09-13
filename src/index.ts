import { bindSelectors, createCore } from 'vpndetection/middleware';
import type { IpSelector, Lookup, MiddlewareOptions } from 'vpndetection/middleware';

import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export type { BlockCondition, IpSelector, Lookup, NumericBound } from 'vpndetection/middleware';

declare module 'fastify' {
    interface FastifyRequest {
        /**
         * What the plugin found out about this visitor. Absent when the plugin
         * has not run for this route, or when `skip` claimed it.
         */
        vpndetection?: Lookup;
    }
}

export interface Options extends MiddlewareOptions<FastifyRequest> {
    /**
     * How a blocked request is answered. Defaults to `403` with a short JSON
     * body. Whatever you pass must send a reply.
     */
    onBlocked?: (request: FastifyRequest, reply: FastifyReply, lookup: Lookup) => unknown;
}

/**
 * Classify the visitor and hang the answer off `request.vpndetection`.
 *
 * Without a `blockCondition` this only enriches the request and never refuses
 * one, leaving the decision to your own handlers. With one, a matching request
 * is answered by `onBlocked` and never reaches them.
 *
 * A lookup that fails - network, quota, an outage of ours - lets the request
 * through and records why on `request.vpndetection.error`, unless you set
 * `failClosed`.
 *
 * Registered through `fastify-plugin`, so the decorator and the hook apply to
 * the instance you register it on rather than to a child Fastify would
 * otherwise create. Register it inside a scope to confine it to those routes.
 */
export const vpndetection: FastifyPluginAsync<Options> = fp(
    async (fastify: FastifyInstance, options: Options) => {
        const core = createCore<FastifyRequest>(options, defaultIpSelector);
        const onBlocked = options.onBlocked ?? refuse;

        // Decorated up front so the property exists on every request object
        // rather than being added per request, which deoptimizes the shape
        // Fastify builds for them.
        fastify.decorateRequest('vpndetection', undefined);

        fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
            const lookup = await core.evaluate(request);
            if (lookup === undefined) {
                return;
            }
            request.vpndetection = lookup;
            if (lookup.blocked) {
                // Returned, not just called: a `reply.send()` already ends the
                // lifecycle, but an ASYNC onBlocked has not sent anything yet
                // when the hook resolves, so without awaiting it the handler
                // runs and answers the request it was meant to refuse.
                return await onBlocked(request, reply, lookup);
            }
        });
    },
    { name: 'vpndetection', fastify: '4.x || 5.x' },
);

const view = (request: FastifyRequest) => ({
    header: (name: string) => {
        const value = request.headers[name.toLowerCase()];
        return Array.isArray(value) ? value[0] : value;
    },
    frameworkIp: () => request.ip,
});

// Each of these is annotated rather than inferred: the inferred shape reaches
// through `fastify`'s own types into its transitive ones, which TypeScript
// refuses to name in a declaration file a consumer would have to resolve.
const selectors = bindSelectors<FastifyRequest>(view);

/**
 * `request.ip`, which is the socket peer unless you built the server with
 * `trustProxy`. Behind a load balancer without it, every visitor looks like the
 * load balancer - so if you are behind one, set it or pick another selector.
 */
export const defaultIpSelector: IpSelector<FastifyRequest> = selectors.defaultIpSelector;

/**
 * An address from `X-Forwarded-For`.
 *
 * **The left-most entry is whatever the caller sent**, since proxies append, so
 * this is only trustworthy when an edge you control overwrites the header. When
 * you know how many proxies sit in front, count from the right instead:
 * `xffIpSelector({ depth: 1 })` is the address your nearest proxy saw.
 */
export const xffIpSelector: (options?: { depth?: number }) => IpSelector<FastifyRequest>
    = selectors.xffIpSelector;

/**
 * An address from a single-value header your edge writes -
 * `headerIpSelector('CF-Connecting-IP')` behind Cloudflare,
 * `headerIpSelector('True-Client-IP')` behind Akamai. Falls back to
 * `request.ip` when the header is absent.
 */
export const headerIpSelector: (name: string) => IpSelector<FastifyRequest>
    = selectors.headerIpSelector;

function refuse(_request: FastifyRequest, reply: FastifyReply) {
    return reply.status(403).send({ error: 'access denied' });
}

export default vpndetection;
