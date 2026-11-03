#!/usr/bin/env node
/**
 * Fetch favicons for every bookmark from Node and store them in PocketBase.
 *
 * Why this exists: the browser cannot read an icon from `http://host:port`.
 * `fetch()` needs the target to send `Access-Control-Allow-Origin`, which
 * self-hosted nginx/IIS never does, and an `https` deployment cannot load
 * `http` images at all (mixed content). Node has neither restriction — no CORS,
 * no mixed content — so the icon can be downloaded here and then served from
 * PocketBase over HTTPS, where every client can display it.
 *
 * Usage:
 *   pnpm icons              # only links that have no icon yet
 *   pnpm icons --force      # re-fetch and overwrite existing icons
 *   pnpm icons --dry        # report what would be fetched, upload nothing
 *
 * Strategy per link:
 *   1. parse the page HTML for `<link rel="icon">` (largest `sizes` wins) —
 *      this catches sites whose icons are not at /favicon.ico
 *   2. otherwise probe the usual paths
 *   3. validate the bytes (magic number + minimum size) before uploading, so a
 *      HTML error page or a placeholder never lands in the file field
 */

import PocketBase from 'pocketbase';

const {
  PB_URL,
  PB_ADMIN_EMAIL,
  PB_ADMIN_PASSWORD,
  PB_PREFIX = 'aether_',
  PB_ICON_TIMEOUT_MS = '8000',
  PB_ICON_MAX_BYTES = '2097152',
} = process.env;

const REQUIRED = ['PB_URL', 'PB_ADMIN_EMAIL', 'PB_ADMIN_PASSWORD'];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`✗ Missing env vars: ${missing.join(', ')}`);
  console.error('  Run with: node --env-file=.env scripts/fetch-icons.mjs');
  process.exit(1);
}

const C_LINKS = `${PB_PREFIX}links`;
const TIMEOUT_MS = Number(PB_ICON_TIMEOUT_MS) || 8000;
const MAX_BYTES = Number(PB_ICON_MAX_BYTES) || 2097152;
/** Anything smaller is an error body or a blank pixel, not an icon. */
const MIN_BYTES = 200;
const HTML_CAP = 512 * 1024;

const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry');

/* ------------------------------------------------------------------ */
/* image sniffing                                                      */
/* ------------------------------------------------------------------ */

const MIME_BY_KIND = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  gif: 'image/gif',
};

const EXT_BY_KIND = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  ico: 'ico',
  gif: 'gif',
};

/** PocketBase's file field only accepts these; SVG is excluded on purpose. */
function detectImageKind(bytes) {
  const at = (i) => bytes[i] ?? 0;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png';
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpeg';
  if (
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  ) {
    return 'webp';
  }
  if (at(0) === 0x00 && at(1) === 0x00 && at(2) === 0x01 && at(3) === 0x00) return 'ico';
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return 'gif';
  return null;
}

/* ------------------------------------------------------------------ */
/* network                                                             */
/* ------------------------------------------------------------------ */

async function fetchWithTimeout(url, { accept } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: accept ? { accept } : undefined,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Read at most `cap` bytes so a huge response cannot exhaust memory. */
async function readCapped(response, cap) {
  const limit = Math.min(cap, MAX_BYTES);
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.byteLength > limit ? null : buffer;
  }

  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/* ------------------------------------------------------------------ */
/* candidate discovery                                                 */
/* ------------------------------------------------------------------ */

const ORIGIN_PATHS = ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png'];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Hostname-keyed icon services that answer with a raster image.
 *
 * Needed because plenty of sites declare **only** an SVG icon
 * (`<link rel="icon" href="/logo.svg">`), and PocketBase's file field
 * deliberately rejects `image/svg+xml` — SVG can carry script payloads. These
 * services return PNG/JPEG instead, so the icon can be stored safely.
 *
 * They resolve hostnames only: for an IP literal they either cannot answer or
 * reply with a meaningless placeholder, so IP targets skip them entirely.
 */
function thirdPartyCandidates(hostname) {
  return [
    `https://unavatar.io/${hostname}?fallback=false`,
    `https://icon.horse/icon/${hostname}`,
  ];
}

/**
 * Parse `<link rel="...icon...">` from the page head. This is the only way to
 * find an icon that lives at a non-standard path, e.g. `/static/img/logo.png`.
 */
function iconsFromHtml(html, baseUrl) {
  const found = [];
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

  for (const tag of linkTags) {
    const rel = tag.match(/\brel\s*=\s*["']?([^"'>]+)/i)?.[1]?.toLowerCase() ?? '';
    if (!rel.includes('icon')) continue;
    if (rel.includes('mask')) continue; // decorative, usually monochrome

    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;

    const sizes = tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    // Prefer the largest declared square: "any" (svg) is skipped later anyway.
    const best = Math.max(
      0,
      ...sizes
        .split(/\s+/)
        .map((s) => s.match(/^(\d+)x\d+$/i)?.[1])
        .filter(Boolean)
        .map(Number),
    );

    let url;
    if (href.startsWith('data:')) {
      url = href;
    } else {
      try {
        url = new URL(href, baseUrl).href;
      } catch {
        continue;
      }
    }

    // PocketBase's file field refuses `image/svg+xml`, and a large share of
    // sites publish only a vector logo (e.g. AList declares logo.svg but also
    // ships logo.png next to it). Try the raster sibling first; if it does not
    // exist the magic-byte check rejects the HTML error body and we move on.
    if (/\.svg(\?.*)?$/i.test(url)) {
      found.push({ url: url.replace(/\.svg(\?.*)?$/i, '.png$1'), score: best + 1 });
    }

    found.push({ url, score: best });
  }

  found.sort((a, b) => b.score - a.score);
  return found.map((item) => item.url);
}

function decodeDataUri(uri) {
  const match = uri.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const [, , isBase64, payload] = match;
  try {
    return isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));
  } catch {
    return null;
  }
}

/** Try one URL and return validated image bytes, or null. */
async function tryIconUrl(url) {
  if (url.startsWith('data:')) {
    const buffer = decodeDataUri(url);
    if (!buffer || buffer.byteLength <= MIN_BYTES) return null;
    const kind = detectImageKind(buffer);
    return kind ? { buffer, kind } : null;
  }

  try {
    const response = await fetchWithTimeout(url, { accept: 'image/*,*/*;q=0.8' });
    if (!response.ok) return null;

    const buffer = await readCapped(response, MAX_BYTES);
    if (!buffer || buffer.byteLength <= MIN_BYTES) return null;

    const kind = detectImageKind(buffer);
    if (!kind) return null;
    return { buffer, kind };
  } catch {
    return null;
  }
}

/**
 * Two routes, mirroring `src/lib/icon.ts`:
 *
 *   https → ORIGINAL route. The hostname-keyed icon services have always handled
 *           these; keep the same order as before (the site's own paths first,
 *           then the services) and do not change anything about it.
 *
 *   http  → NEW route. These targets are self-hosted nginx/IIS on an IP or a
 *           custom port, which the services cannot resolve and whose responses
 *           the browser cannot read (no CORS header). Here we additionally parse
 *           the page's own `<link rel="icon">`, which is the only way to find an
 *           icon that lives at a non-standard path (e.g. GitLab's
 *           /assets/favicon-<hash>.png).
 */
function routeFor(url) {
  try {
    return new URL(url).protocol === 'http:' ? 'direct' : 'service';
  } catch {
    return null;
  }
}

async function findIcon(link) {
  const route = routeFor(link.url);
  if (!route) return { icon: null, reason: 'invalid-url' };

  let origin;
  let hostname;
  try {
    const parsed = new URL(link.url);
    origin = parsed.origin;
    hostname = parsed.hostname;
  } catch {
    return { icon: null, reason: 'invalid-url' };
  }

  const isIpLiteral = IPV4.test(hostname) || hostname.startsWith('[');
  const candidates = [];

  // New route only: read what the page itself declares.
  if (route === 'direct') {
    try {
      const response = await fetchWithTimeout(link.url, { accept: 'text/html,*/*' });
      if (response.ok) {
        const html = (await readCapped(response, HTML_CAP))?.toString('utf8') ?? '';
        candidates.push(...iconsFromHtml(html, response.url || link.url));
      }
    } catch {
      // Page unreachable; the path probes below still run.
    }
  }

  // Both routes probe the conventional locations.
  candidates.push(...ORIGIN_PATHS.map((path) => `${origin}${path}`));

  // Services are hostname-keyed: useless (and misleading) for IP literals.
  if (!isIpLiteral) candidates.push(...thirdPartyCandidates(hostname));

  const tried = new Set();
  for (const candidate of candidates) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);

    const icon = await tryIconUrl(candidate);
    if (icon) return { icon, source: candidate, route };
  }

  return {
    icon: null,
    route,
    reason: isIpLiteral ? 'no-icon-on-this-host' : 'no-icon-found',
  };
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);

  console.log(`\n▸ Fetching favicons → ${PB_URL}`);
  if (DRY) console.log('▸ DRY RUN — nothing will be uploaded');
  if (FORCE) console.log('▸ FORCE — existing icons will be overwritten');

  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  console.log(`  ✓ authenticated as ${PB_ADMIN_EMAIL}\n`);

  const links = await pb.collection(C_LINKS).getFullList({ sort: 'sort_order,created' });
  const targets = FORCE ? links : links.filter((link) => !link.icon);

  console.log(`▸ ${links.length} bookmarks, ${targets.length} to process\n`);

  let saved = 0;
  let skipped = 0;
  const failures = [];

  for (const [index, link] of targets.entries()) {
    const label = `[${String(index + 1).padStart(3)}/${targets.length}] ${link.title}`;
    const { icon, source, reason, route } = await findIcon(link);

    if (!icon) {
      skipped += 1;
      failures.push({ title: link.title, url: link.url, reason });
      console.log(`${label}  ✗ [${route}] ${reason}`);
      continue;
    }

    if (DRY) {
      saved += 1;
      console.log(`${label}  → [${route}] ${source} (${icon.kind}, ${icon.buffer.byteLength} B)`);
      continue;
    }

    try {
      const form = new FormData();
      form.set('icon', new Blob([icon.buffer], { type: MIME_BY_KIND[icon.kind] }), `icon.${EXT_BY_KIND[icon.kind]}`);
      await pb.collection(C_LINKS).update(link.id, form);
      saved += 1;
      console.log(
        `${label}  ✓ [${route}] ${icon.kind} ${Math.round(icon.buffer.byteLength / 1024)}KB  ← ${source}`,
      );
    } catch (error) {
      skipped += 1;
      failures.push({ title: link.title, url: link.url, reason: `upload failed: ${error?.message ?? error}` });
      console.log(`${label}  ✗ upload failed: ${error?.message ?? error}`);
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`  saved   : ${saved}`);
  console.log(`  no icon : ${skipped}`);

  if (failures.length > 0) {
    console.log('\n  Still without an icon (upload one manually in the UI):');
    for (const failure of failures) {
      console.log(`    · ${failure.title} — ${failure.url} (${failure.reason})`);
    }
  }

  console.log('\n✓ Done. Reload the site to see the icons.\n');
}

main().catch((error) => {
  console.error('\n✗ Icon fetch failed');
  if (error?.status) console.error(`  HTTP ${error.status}: ${error.message}`);
  else console.error(`  ${error?.message ?? error}`);
  process.exit(1);
});
