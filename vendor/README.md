# Vendored dependencies

**qrcode.js / qrcode_UTF8.js** — QR Code Generator for JavaScript
Copyright (c) 2009 Kazuhiko Arase. MIT licensed.
https://github.com/kazuhikoarase/qrcode-generator

Vendored locally (not loaded from a CDN) so QR generation works fully
offline, consistent with this app's offline-first architecture, and so the
service worker can precache it like every other asset.
