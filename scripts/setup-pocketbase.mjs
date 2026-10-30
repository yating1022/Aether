#!/usr/bin/env node
/**
 * Idempotent PocketBase bootstrap for the Aether nav site.
 *
 * Creates/updates:
 *   - editors     (auth)  — management UI login account
 *   - categories  (base)  — nav categories
 *   - links       (base)  — bookmarks, relation -> categories with cascadeDelete
 *
 * Usage:
 *   node --env-file=.env scripts/setup-pocketbase.mjs
 *   pnpm setup
 *
 * Safe to re-run: existing collections are updated in place, the editor account
 * is only created when missing, and seed data is only written when the
 * `categories` collection is empty.
 */

import PocketBase from 'pocketbase';

/* ------------------------------------------------------------------ */
/* config                                                              */
/* ------------------------------------------------------------------ */

const {
  PB_URL,
  PB_ADMIN_EMAIL,
  PB_ADMIN_PASSWORD,
  PB_EDITOR_EMAIL,
  PB_EDITOR_PASSWORD,
  PB_SEED = 'true',
  PB_PREFIX = 'aether_',
} = process.env;

const REQUIRED = ['PB_URL', 'PB_ADMIN_EMAIL', 'PB_ADMIN_PASSWORD'];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`✗ Missing env vars: ${missing.join(', ')}`);
  console.error('  Run with: node --env-file=.env scripts/setup-pocketbase.mjs');
  process.exit(1);
}

/**
 * Every collection this project owns is namespaced, so several projects can
 * share one PocketBase instance without colliding on generic names like
 * `links` or `categories`.
 *
 * Do not change PB_PREFIX after the first run — it would create a second set of
 * collections instead of reusing the existing ones.
 */
const PREFIX = PB_PREFIX;
const C_EDITORS = `${PREFIX}editors`;
const C_CATEGORIES = `${PREFIX}categories`;
const C_LINKS = `${PREFIX}links`;

/** Pre-namespace collection names, renamed in place on upgrade. */
const LEGACY_RENAMES = {
  editors: C_EDITORS,
  categories: C_CATEGORIES,
  links: C_LINKS,
};

const AUTHED_WRITE = "@request.auth.id != ''";

/* ------------------------------------------------------------------ */
/* collection definitions                                              */
/* ------------------------------------------------------------------ */

const editorsDef = {
  name: C_EDITORS,
  type: 'auth',
  // Public registration disabled; only superusers may create accounts.
  createRule: null,
  listRule: null,
  viewRule: AUTHED_WRITE,
  updateRule: AUTHED_WRITE,
  deleteRule: null,
  fields: [],
};

const categoriesDef = {
  name: C_CATEGORIES,
  type: 'base',
  listRule: '',
  viewRule: '',
  createRule: AUTHED_WRITE,
  updateRule: AUTHED_WRITE,
  deleteRule: AUTHED_WRITE,
  fields: [
    { name: 'name', type: 'text', required: true, max: 100 },
    { name: 'sort_order', type: 'number', onlyInt: true },
  ],
};

const linksDef = (categoriesId) => ({
  name: C_LINKS,
  type: 'base',
  listRule: '',
  viewRule: '',
  createRule: AUTHED_WRITE,
  updateRule: AUTHED_WRITE,
  deleteRule: AUTHED_WRITE,
  fields: [
    {
      name: 'category',
      type: 'relation',
      required: true,
      maxSelect: 1,
      minSelect: 1,
      collectionId: categoriesId,
      cascadeDelete: true,
    },
    { name: 'title', type: 'text', required: true, max: 200 },
    { name: 'url', type: 'url', required: true },
    { name: 'description', type: 'text', max: 500 },
    {
      name: 'icon',
      type: 'file',
      maxSelect: 1,
      maxSize: 2097152,
      // SVG intentionally excluded: it can carry script payloads.
      mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/gif'],
      thumbs: ['64x64'],
    },
    { name: 'sort_order', type: 'number', onlyInt: true },
  ],
});

/* ------------------------------------------------------------------ */
/* seed data                                                           */
/* ------------------------------------------------------------------ */

const SEED = [
  {
    name: '常用效率',
    sort_order: 1,
    links: [
      { title: 'Linear', url: 'https://linear.app', description: '现代软件团队的项目与 Issue 追踪系统' },
      { title: 'Raycast', url: 'https://www.raycast.com', description: '极速键盘启动器与个人效率控制中心' },
      { title: 'Notion', url: 'https://www.notion.so', description: 'All-in-one 模块化知识库与协作文档' },
      { title: 'ChatGPT', url: 'https://chatgpt.com', description: 'OpenAI 智能对话与深度推理助手' },
    ],
  },
  {
    name: '开发与云服务',
    sort_order: 2,
    links: [
      { title: 'GitHub', url: 'https://github.com', description: '全球开源代码托管与工程协作平台' },
      { title: 'Vercel', url: 'https://vercel.com', description: '前端云平台与全球边缘网络极速部署' },
      { title: 'Cloudflare', url: 'https://dash.cloudflare.com', description: 'DNS 解析、Workers 边缘计算与安全防护' },
      { title: 'Supabase', url: 'https://supabase.com', description: '开源 Postgres 后端即服务与实时数据库' },
    ],
  },
  {
    name: '设计与灵感',
    sort_order: 3,
    links: [
      { title: 'Figma', url: 'https://www.figma.com', description: '实时协同界面设计与原型设计系统工具' },
      { title: 'Dribbble', url: 'https://dribbble.com', description: '数字产品设计师视觉作品与灵感社区' },
      { title: 'Are.na', url: 'https://www.are.na', description: '克制纯粹的视觉研究与灵感卡片收集站' },
      { title: 'Godly', url: 'https://godly.website', description: '精选全球顶尖交互与极简排版网页画廊' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function log(...args) {
  console.log(...args);
}

async function findCollection(pb, name) {
  try {
    return await pb.collections.getOne(name);
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

/**
 * Field names PocketBase injects itself. They must survive an update because
 * `fields` REPLACES the whole array — dropping them removes the SQLite columns.
 */
const SYSTEM_FIELD_ORDER = ['id', 'password', 'tokenKey', 'email', 'emailVisibility', 'verified'];
const AUTODATE_FIELDS = [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];

/**
 * Compose the field list for an update: preserved system fields + our custom
 * fields + guaranteed autodate fields. Without this, updating a collection would
 * silently remove `created`/`updated`, and any `sort=created` query would 400.
 */
function buildUpdateFields(def, existing) {
  const existingByName = new Map(existing.fields.map((field) => [field.name, field]));
  const custom = def.fields ?? [];
  const customNames = new Set(custom.map((field) => field.name));

  const preservedSystem = SYSTEM_FIELD_ORDER.filter(
    (name) => existingByName.has(name) && !customNames.has(name),
  ).map((name) => existingByName.get(name));

  const autodate = AUTODATE_FIELDS.map(
    (fallback) => existingByName.get(fallback.name) ?? fallback,
  );

  return [...preservedSystem, ...custom, ...autodate];
}

/**
 * Create the collection, or update it in place when it already exists.
 * Returns the resulting collection record (with its id).
 */
async function upsertCollection(pb, def) {
  const existing = await findCollection(pb, def.name);

  if (existing) {
    const patch = { ...def };
    delete patch.name; // renaming is never intended here
    delete patch.type; // collection type is immutable
    patch.fields = buildUpdateFields(def, existing);
    const updated = await pb.collections.update(existing.id, patch);
    log(`  ↻ updated  ${def.name.padEnd(18)} (${existing.id})`);
    return updated;
  }

  const created = await pb.collections.create(def);
  log(`  + created  ${def.name.padEnd(18)} (${created.id})`);
  return created;
}

async function ensureEditorAccount(pb) {
  if (!PB_EDITOR_EMAIL || !PB_EDITOR_PASSWORD) {
    log('  ! 未设置 PB_EDITOR_EMAIL / PB_EDITOR_PASSWORD，跳过创建编辑者账号');
    log('    两种补救方式（任选其一）：');
    log(`      1. 在 .env 里补上这两个变量后重跑 pnpm setup`);
    log(`      2. 打开 PocketBase 后台 → Collections → ${C_EDITORS} → New record`);
    log('         填 email + password（至少 10 位）即可，效果相同');
    return false;
  }

  const filter = pb.filter('email = {:email}', { email: PB_EDITOR_EMAIL });
  const existing = await pb.collection(C_EDITORS).getFullList({ filter, fields: 'id,email' });
  if (existing.length > 0) {
    log(`  = editor exists: ${PB_EDITOR_EMAIL}`);
    return false;
  }

  await pb.collection(C_EDITORS).create({
    email: PB_EDITOR_EMAIL,
    password: PB_EDITOR_PASSWORD,
    passwordConfirm: PB_EDITOR_PASSWORD,
    verified: true,
  });
  log(`  + editor created: ${PB_EDITOR_EMAIL}`);
  log('    该密码只用于此次创建，之后可在 PocketBase 后台修改；前端产物不含任何凭据。');
  return true;
}

async function seedData(pb) {
  const existing = await pb.collection(C_CATEGORIES).getList(1, 1, { fields: 'id' });
  if (existing.totalItems > 0) {
    log(`  = seed skipped (${C_CATEGORIES} already has ${existing.totalItems}+ records)`);
    return;
  }

  let categoryCount = 0;
  let linkCount = 0;

  for (const category of SEED) {
    const createdCategory = await pb.collection(C_CATEGORIES).create({
      name: category.name,
      sort_order: category.sort_order,
    });
    categoryCount += 1;

    for (const [index, link] of category.links.entries()) {
      await pb.collection(C_LINKS).create({
        category: createdCategory.id,
        title: link.title,
        url: link.url,
        description: link.description,
        sort_order: index + 1,
      });
      linkCount += 1;
    }
  }

  log(`  + seeded ${categoryCount} categories / ${linkCount} links`);
}

/**
 * Rename pre-namespace collections in place so existing records and ids survive.
 * Idempotent: once renamed, the legacy name no longer resolves.
 */
async function migrateLegacyNames(pb) {
  let renamed = 0;
  for (const [legacyName, targetName] of Object.entries(LEGACY_RENAMES)) {
    if (legacyName === targetName) continue;

    const legacy = await findCollection(pb, legacyName);
    if (!legacy) continue;

    const alreadyMigrated = await findCollection(pb, targetName);
    if (alreadyMigrated) continue; // both exist — leave the legacy one alone

    await pb.collections.update(legacy.id, { name: targetName });
    log(`  ⇄ renamed  ${legacyName.padEnd(12)} → ${targetName}`);    renamed += 1;
  }

  if (renamed === 0) log('  = no legacy collection names to migrate');
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);

  log(`\n▸ PocketBase bootstrap → ${PB_URL}`);
  log(`▸ Prefix: "${PREFIX}"\n`);

  log('▸ Authenticating as superuser');
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  log(`  ✓ authenticated as ${PB_ADMIN_EMAIL}\n`);

  log('▸ Legacy name migration');
  await migrateLegacyNames(pb);

  log('\n▸ Collections');
  await upsertCollection(pb, editorsDef);
  const categories = await upsertCollection(pb, categoriesDef);
  await upsertCollection(pb, linksDef(categories.id));

  log('\n▸ Editor account');
  await ensureEditorAccount(pb);

  if (PB_SEED !== 'false') {
    log('\n▸ Seed data');
    await seedData(pb);
  } else {
    log('\n▸ Seed data (skipped: PB_SEED=false)');
  }

  log('\n✓ Bootstrap complete\n');
  log(`  Collections : ${C_EDITORS} (auth), ${C_CATEGORIES} (base), ${C_LINKS} (base)`);
  log('  Read access  : public (`""` rules)');
  log("  Write access : any authenticated request (`@request.auth.id != ''`)");
  log(`  Editor login : ${PB_EDITOR_EMAIL ?? '(not configured)'}`);
  log('');
}

main().catch((error) => {
  console.error('\n✗ Bootstrap failed');
  if (error?.status) console.error(`  HTTP ${error.status}: ${error.message}`);
  else console.error(`  ${error?.message ?? error}`);
  if (error?.response) console.error(`  ${JSON.stringify(error.response, null, 2)}`);
  process.exit(1);
});
