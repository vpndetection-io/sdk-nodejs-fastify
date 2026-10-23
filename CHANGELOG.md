# Changelog

What each release changed for you, newest first. Each line is a commit's summary, linked to its full description and diff. Releases before 2.0.3 are described by their release commits.

## 2.0.20 - 2026-10-23

### Fixes

- Require vpndetection 5.10.1, which types every answer member ([`f02e0f5`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/f02e0f50ae6c0873546994d50f1feac44b23a19b))

## 2.0.19 - 2026-10-20

### Features

- Require vpndetection 5.10.0: lookup results carry location and asn ([`246e720`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/246e72076808e2333704c5b9362ae65846d0d472))

## 2.0.18 - 2026-10-20

### Fixes

- Require vpndetection 5.9.0: oauth.register, and OAuth answers that are not JSON ([`774f07a`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/774f07a02aa6c763e64eb3ec7f783f4da424cb78))

## 2.0.17 - 2026-10-20

### Fixes

- Require vpndetection 5.8.1: a batch entry is read by the answer's own keys ([`8603aae`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/8603aae7e860d64d6e77c383797d23e92f5b035d))

## 2.0.16 - 2026-10-19

### Fixes

- Require vpndetection 5.8.0: num_ports and num_proxies in the pubproxy detail ([`a1f55ea`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/a1f55eabb1d04b4d2a3576a6af9747fd3f1c047d))

## 2.0.15 - 2026-10-18

### Fixes

- Require vpndetection 5.7.0: isPubproxy and the pubproxy detail ([`f1ba720`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/f1ba720300b6becaa274a4a34572115e4e8117dd))

## 2.0.14 - 2026-10-17

### Features

- Require vpndetection 5.6.0: OauthMetadata carries registration_endpoint ([`849f1fe`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/849f1fe91bf4780a028669ba9fb1b4c5783c6e0b))

## 2.0.13 - 2026-10-16

### Fixes

- Require vpndetection 5.5.3: the spec re-pinned to 2026.10.15 ([`e4bb203`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/e4bb203546e976d4da514bc5851c168ecbb593b3))

## 2.0.12 - 2026-10-12

### Fixes

- Require vpndetection 5.5.2: an unreadable answer is retried, a blank key sends none ([`99b782c`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/99b782cc93456aadeccd07044e09ca0822a405d3))

## 2.0.11 - 2026-10-10

### Fixes

- Require vpndetection 5.5.1: no Retry-After is waited out after the last attempt ([`d0a37cf`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/d0a37cfa943fc7349290e8823fa0ac8b5fd1116f))

## 2.0.10 - 2026-10-08

### Fixes

- Allow a nested registration in a scope that already has one ([`bb276f1`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/bb276f1d4786c6870239fa6dd519a9a9287e4b76))

## 2.0.9 - 2026-10-05

### Features

- Require vpndetection 5.4.0: the authorization code sign-in ([`a0bd15c`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/a0bd15c84a003e8178c022440ae8f8eaa268250a))

## 2.0.8 - 2026-10-04

### Fixes

- Require vpndetection 5.3.4, re-pinned to spec 2026.10.03 ([`3c34ed3`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/3c34ed30e2dae43138da3b143bc2b9729bb5be25))

## 2.0.7 - 2026-09-29

### Fixes

- Require vpndetection 5.3.3: 26 more reserved ranges are answered locally ([`067b741`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/067b7417dfec0de41c787e0711a30d986b21f0bc))

## 2.0.6 - 2026-09-28

### Fixes

- Require vpndetection 5.3.2: IPv4-mapped visitors are looked up, not waved through ([`c0afec6`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/c0afec608cd8b136e25683b18472b6ad27975a5b))

## 2.0.5 - 2026-09-27

### Fixes

- Require vpndetection 5.3.1: no doubled slash, impossible timeouts refused, poll cut ([`a33e3be`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/a33e3be2ef0cd05af1018f1d0daf5ea15855cb01))

## 2.0.4 - 2026-09-27

### Features

- Require vpndetection 5.3.0: OauthMetadata carries client_id_metadata_document_supported ([`07625b0`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/07625b02387877504f181f351e0c1e3dbc8076a0))

## 2.0.3 - 2026-09-25

### Fixes

- Raise the base floor to vpndetection 5.2.2 ([`1a97ee8`](https://github.com/vpndetection-io/sdk-nodejs-fastify/commit/1a97ee8e89e5d9cfd3daac8ac6f36ba06505f2f3))
