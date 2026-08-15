import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const THEME_ROOT = path.resolve(SCRIPT_DIR, '..');

const THEME_DIRS = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const REQUIRED_ROUTES = [
  '404.json',
  'cart.json',
  'collection.json',
  'index.json',
  'page.about-docked.json',
  'page.accessibility.json',
  'page.contact.json',
  'page.faq.json',
  'page.how-it-works.json',
  'page.privacy.json',
  'page.returns.json',
  'page.safety-and-care.json',
  'page.shipping.json',
  'page.terms.json',
  'page.track-order.json',
  'page.warranty.json',
  'password.json',
  'product.json',
  'search.json',
];
const REQUIRED_HOME_SECTION_TYPES = [
  'docked-hero',
  'docked-adult-statement',
  'featured-collection',
  'docked-how-it-works',
  'docked-safety-callout',
  'docked-faq',
];
const EXPECTED_PRODUCT_IMPORTS = [
  ['Docked Cruise D2', 'docked-cruise-d2', 'Powered pool lounger concept'],
];
const EXPECTED_PRODUCTS = EXPECTED_PRODUCT_IMPORTS.map(([title]) => title);
const SHOPIFY_DRAFT_IMPORT_HEADERS = [
  'Title',
  'URL handle',
  'Vendor',
  'Product type',
  'Option1 name',
  'Option1 value',
  'Published on online store',
  'Status',
];

function normalise(filePath, root) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(resolved));
    else if (entry.isFile()) files.push(resolved);
  }
  return files;
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function getJson(root, relativePath) {
  return JSON.parse(read(root, relativePath));
}

function addCheck(report, condition, code, message, details = undefined) {
  const item = { code, message };
  if (details !== undefined) item.details = details;
  if (condition) report.passed.push(item);
  else report.errors.push(item);
  return condition;
}

function addWarning(report, code, message, details = undefined) {
  const item = { code, message };
  if (details !== undefined) item.details = details;
  report.warnings.push(item);
}

function collectObjects(value, predicate, result = []) {
  if (value && typeof value === 'object') {
    if (predicate(value)) result.push(value);
    for (const child of Object.values(value)) collectObjects(child, predicate, result);
  }
  return result;
}

function templateSectionTypes(template) {
  return Object.values(template.sections ?? {})
    .map((section) => section?.type)
    .filter((type) => typeof type === 'string');
}

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  while (rows.length && rows.at(-1).every((cell) => cell === '')) rows.pop();
  return rows;
}

export function parseCsv(source) {
  const rows = parseCsvRows(source);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header));
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
  );
}

function productImportKey(title, handle, productType) {
  return [title, handle, productType].join('\u001f');
}

export function auditShopifyDraftProductImport(source) {
  let rows;
  try {
    rows = parseCsvRows(source);
  } catch (error) {
    return { ok: false, parseError: error.message };
  }

  if (rows.length === 0) {
    return { ok: false, parseError: 'CSV is empty.' };
  }

  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header));
  const dataRows = rows.slice(1);
  const invalidRowWidths = dataRows
    .map((row, index) => ({ row: index + 2, columns: row.length }))
    .filter(({ columns }) => columns !== SHOPIFY_DRAFT_IMPORT_HEADERS.length);
  const safeSchema =
    headers.length === SHOPIFY_DRAFT_IMPORT_HEADERS.length &&
    headers.every((header, index) => header === SHOPIFY_DRAFT_IMPORT_HEADERS[index]) &&
    invalidRowWidths.length === 0;
  const products = dataRows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
  );

  const expectedKeys = new Set(
    EXPECTED_PRODUCT_IMPORTS.map(([title, handle, productType]) => productImportKey(title, handle, productType)),
  );
  const actualKeys = products.map((product) =>
    productImportKey(product.Title, product['URL handle'], product['Product type']),
  );
  const actualKeySet = new Set(actualKeys);
  const missingConcepts = EXPECTED_PRODUCT_IMPORTS
    .filter(([title, handle, productType]) => !actualKeySet.has(productImportKey(title, handle, productType)))
    .map(([title, handle, productType]) => ({ title, handle, productType }));
  const unexpectedConcepts = products
    .filter((product) => !expectedKeys.has(productImportKey(product.Title, product['URL handle'], product['Product type'])))
    .map((product) => ({
      title: product.Title,
      handle: product['URL handle'],
      productType: product['Product type'],
    }));
  const duplicateConcepts = actualKeys
    .filter((key, index) => actualKeys.indexOf(key) !== index)
    .map((key) => {
      const [title, handle, productType] = key.split('\u001f');
      return { title, handle, productType };
    });
  const plannedConcepts =
    products.length === EXPECTED_PRODUCT_IMPORTS.length &&
    actualKeySet.size === EXPECTED_PRODUCT_IMPORTS.length &&
    missingConcepts.length === 0 &&
    unexpectedConcepts.length === 0 &&
    duplicateConcepts.length === 0;

  const lockFailures = products
    .map((product, index) => {
      const failures = [];
      if (product.Vendor !== 'Requires verification') failures.push('Vendor');
      if (product['Option1 name'] !== 'Title') failures.push('Option1 name');
      if (product['Option1 value'] !== 'Default Title') failures.push('Option1 value');
      if (product['Published on online store'] !== 'false') failures.push('Published on online store');
      if (product.Status !== 'draft') failures.push('Status');
      return failures.length ? { row: index + 2, title: product.Title, fields: failures } : null;
    })
    .filter(Boolean);

  return {
    ok: safeSchema && plannedConcepts && lockFailures.length === 0,
    parseError: null,
    headers,
    invalidRowWidths,
    rows: products.length,
    safeSchema,
    plannedConcepts,
    missingConcepts,
    unexpectedConcepts,
    duplicateConcepts,
    lockFailures,
  };
}

function validateJsonAndSchemas(root, report) {
  const jsonFiles = THEME_DIRS.flatMap((directory) => walk(path.join(root, directory))).filter(
    (file) => path.extname(file).toLowerCase() === '.json',
  );
  const invalidJson = [];
  for (const file of jsonFiles) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      invalidJson.push(`${normalise(file, root)}: ${error.message}`);
    }
  }
  addCheck(
    report,
    invalidJson.length === 0,
    'json.valid',
    `${jsonFiles.length} theme JSON files parse successfully`,
    invalidJson,
  );
  report.stats.jsonFiles = jsonFiles.length;

  const liquidFiles = THEME_DIRS.flatMap((directory) => walk(path.join(root, directory))).filter(
    (file) => path.extname(file).toLowerCase() === '.liquid',
  );
  const schemaPattern = /{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/g;
  const invalidSchemas = [];
  const sectionSchemas = new Map();
  let schemaCount = 0;
  for (const file of liquidFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(schemaPattern)) {
      schemaCount += 1;
      try {
        const schema = JSON.parse(match[1]);
        if (normalise(file, root).startsWith('sections/')) {
          sectionSchemas.set(path.basename(file, '.liquid'), schema);
        }
      } catch (error) {
        invalidSchemas.push(`${normalise(file, root)}: ${error.message}`);
      }
    }
  }
  addCheck(
    report,
    invalidSchemas.length === 0 && schemaCount > 0,
    'schema.valid',
    `${schemaCount} Liquid schema blocks parse successfully`,
    invalidSchemas,
  );
  report.stats.schemaBlocks = schemaCount;

  const platformSchemaErrors = [];
  const settingsSchema = getJson(root, 'config/settings_schema.json');
  const themeAuthor = settingsSchema.find((group) => typeof group?.theme_author === 'string')?.theme_author;
  if (typeof themeAuthor !== 'string' || themeAuthor.length > 25) {
    platformSchemaErrors.push(`config/settings_schema.json: theme_author must contain at most 25 characters (found ${themeAuthor?.length ?? 0})`);
  }
  const settingsData = getJson(root, 'config/settings_data.json');
  const configuredPresets = Object.entries(settingsData.presets ?? {});
  if (settingsData.current && typeof settingsData.current === 'object') {
    configuredPresets.push(['current', settingsData.current]);
  }
  const rangeSettings = settingsSchema
    .flatMap((group) => group.settings ?? [])
    .filter((setting) => setting.type === 'range');
  for (const [presetName, preset] of configuredPresets) {
    for (const setting of rangeSettings) {
      const value = preset?.[setting.id];
      if (value === undefined) continue;
      const offset = (Number(value) - Number(setting.min)) / Number(setting.step);
      const onStep = Number.isFinite(offset) && Math.abs(offset - Math.round(offset)) < 1e-9;
      if (
        typeof value !== 'number' ||
        value < Number(setting.min) ||
        value > Number(setting.max) ||
        !onStep
      ) {
        platformSchemaErrors.push(
          'config/settings_data.json: ' +
            presetName +
            '.' +
            setting.id +
            '=' +
            value +
            ' must be within ' +
            setting.min +
            '-' +
            setting.max +
            ' on step ' +
            setting.step,
        );
      }
    }
  }

  const allowedRichTextRoot = /^\s*<(p|ul|ol|h[1-6])(?:\s|>)/i;
  const configuredSectionFiles = [
    ...walk(path.join(root, 'templates')).filter((file) => path.extname(file).toLowerCase() === '.json'),
    ...walk(path.join(root, 'sections')).filter((file) => path.extname(file).toLowerCase() === '.json'),
  ];
  for (const file of configuredSectionFiles) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const configuredSections = collectObjects(
      parsed,
      (value) => typeof value?.type === 'string' && value.settings && sectionSchemas.has(value.type),
    );
    for (const configuredSection of configuredSections) {
      const schema = sectionSchemas.get(configuredSection.type);
      for (const setting of schema.settings ?? []) {
        if (setting.type !== 'richtext') continue;
        const value = configuredSection.settings?.[setting.id];
        if (typeof value === 'string' && value.trim() && !allowedRichTextRoot.test(value)) {
          platformSchemaErrors.push(
            `${normalise(file, root)}: ${configuredSection.type}.${setting.id} richtext must start with an allowed top-level HTML element`,
          );
        }
      }
      const blockSchemas = new Map((schema.blocks ?? []).map((block) => [block.type, block]));
      for (const configuredBlock of Object.values(configuredSection.blocks ?? {})) {
        const blockSchema = blockSchemas.get(configuredBlock?.type);
        if (!blockSchema) continue;
        for (const setting of blockSchema.settings ?? []) {
          if (setting.type !== 'richtext') continue;
          const value = configuredBlock.settings?.[setting.id];
          if (typeof value === 'string' && value.trim() && !allowedRichTextRoot.test(value)) {
            platformSchemaErrors.push(
              `${normalise(file, root)}: ${configuredSection.type}.${configuredBlock.type}.${setting.id} richtext must start with an allowed top-level HTML element`,
            );
          }
        }
      }
    }
  }
  addCheck(
    report,
    platformSchemaErrors.length === 0,
    'shopify.platform-schema',
    'Configured theme metadata and rich-text values satisfy Shopify upload constraints',
    platformSchemaErrors,
  );
}

function validateReferences(root, report) {
  const liquidFiles = THEME_DIRS.flatMap((directory) => walk(path.join(root, directory))).filter(
    (file) => path.extname(file).toLowerCase() === '.liquid',
  );
  const assetDirectory = path.join(root, 'assets');
  const exactAssetNames = new Set(
    fs.existsSync(assetDirectory)
      ? fs.readdirSync(assetDirectory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name)
      : [],
  );
  const assetPattern = /['"]([^'"]+)['"]\s*\|\s*(asset_url|inline_asset_content)/gi;
  const references = [];
  const missingAssets = [];
  for (const file of liquidFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(assetPattern)) {
      references.push(match[1]);
      if (!exactAssetNames.has(match[1])) {
        missingAssets.push(`${normalise(file, root)} (${match[2]}) -> assets/${match[1]}`);
      }
    }
  }
  addCheck(
    report,
    missingAssets.length === 0,
    'assets.resolved',
    `${new Set(references).size} literal asset_url and inline_asset_content references resolve exactly`,
    [...new Set(missingAssets)],
  );
  report.stats.referencedAssets = new Set(references).size;

  const templateFiles = [
    ...walk(path.join(root, 'templates')).filter((file) => path.extname(file) === '.json'),
    ...walk(path.join(root, 'sections')).filter((file) => path.extname(file) === '.json'),
  ];
  const sectionTypes = [];
  for (const file of templateFiles) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    sectionTypes.push(
      ...collectObjects(parsed, (value) => value.sections && typeof value.sections === 'object')
        .flatMap((value) => templateSectionTypes(value)),
    );
  }
  const missingSections = [...new Set(sectionTypes)]
    .filter((type) => !type.startsWith('@'))
    .filter((type) => !fs.existsSync(path.join(root, 'sections', `${type}.liquid`)));
  addCheck(
    report,
    missingSections.length === 0,
    'sections.resolved',
    `${new Set(sectionTypes).size} referenced section types resolve`,
    missingSections,
  );
  report.stats.referencedSectionTypes = new Set(sectionTypes).size;
}

function validateBrandIdentity(root, report) {
  const identityExpectations = [
    { file: 'docked-wordmark.svg', aspect: 'wide wordmark', validAspect: (ratio) => ratio >= 4 && ratio <= 6 },
    { file: 'docked-mark.svg', aspect: 'square mark', validAspect: (ratio) => Math.abs(ratio - 1) <= 0.001 },
    { file: 'docked-wake.svg', aspect: 'wide wake', validAspect: (ratio) => ratio >= 2 && ratio <= 3 },
    {
      file: 'docked-social-template.svg',
      aspect: '1200:630 social canvas',
      validAspect: (ratio) => Math.abs(ratio - 1200 / 630) <= 0.001,
    },
    { file: 'favicon.svg', aspect: 'square favicon', validAspect: (ratio) => Math.abs(ratio - 1) <= 0.001 },
  ];
  const identityNames = new Set(identityExpectations.map(({ file }) => file));
  const failures = [];
  const fail = (control, file, reason) => failures.push({ control, file, reason });
  const sourceFor = (relativePath) => {
    const resolved = path.join(root, relativePath);
    return fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : '';
  };

  const liquidFiles = THEME_DIRS.flatMap((directory) => walk(path.join(root, directory))).filter(
    (file) => path.extname(file).toLowerCase() === '.liquid',
  );
  const inlineIdentityAssets = new Set();
  for (const file of liquidFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/['"]([^'"]+)['"]\s*\|\s*inline_asset_content/gi)) {
      if (identityNames.has(match[1])) inlineIdentityAssets.add(match[1]);
    }
  }

  const disallowedMarkup = [
    ['DOCTYPE declaration', /<!DOCTYPE\b/i],
    ['entity declaration', /<!ENTITY\b/i],
    ['executable or embedded element', /<\s*(?:script|foreignObject|iframe|object|embed|image|text|style)\b/i],
    ['SMIL animation', /<\s*(?:animate(?:Color|Motion|Transform)?|set|mpath)\b/i],
    ['event-handler attribute', /\son[a-z][\w:.-]*\s*=/i],
    [
      'remote, data or JavaScript link',
      /(?:href|xlink:href|src)\s*=\s*['"]\s*(?:https?:|\/\/|data:|javascript:)|url\(\s*['"]?\s*(?:https?:|\/\/|data:|javascript:)/i,
    ],
  ];
  const prohibitedIdentityTerms = /\b(?:ducks?|ducklings?|propell(?:er|or)s?)\b/i;

  for (const expectation of identityExpectations) {
    const relativePath = `assets/${expectation.file}`;
    const resolved = path.join(root, relativePath);
    if (!fs.existsSync(resolved)) {
      fail('identity SVG set', relativePath, 'required identity asset is missing');
      continue;
    }

    const source = fs.readFileSync(resolved, 'utf8');
    const rootTag = source.match(/<svg\b[^>]*>/i)?.[0] ?? '';
    const viewBoxValue = rootTag.match(/\bviewBox\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    const viewBox = viewBoxValue?.trim().split(/[\s,]+/).map(Number) ?? [];
    const validViewBox =
      viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0;
    if (!validViewBox) {
      fail('SVG viewBox', relativePath, 'viewBox must contain four finite numbers with positive width and height');
    } else {
      const ratio = viewBox[2] / viewBox[3];
      if (!expectation.validAspect(ratio)) {
        fail('SVG aspect', relativePath, `${expectation.aspect} expected; received ${ratio.toFixed(4)}:1`);
      }
    }

    if (!/\bxmlns\s*=\s*['"]http:\/\/www\.w3\.org\/2000\/svg['"]/i.test(rootTag)) {
      fail('SVG root', relativePath, 'root SVG namespace is missing or invalid');
    }
    if (!/\baria-hidden\s*=\s*['"]true['"]/i.test(rootTag)) {
      fail('SVG accessibility', relativePath, 'identity artwork must be decorative with aria-hidden="true"');
    }
    if (!/\bfocusable\s*=\s*['"]false['"]/i.test(rootTag)) {
      fail('SVG accessibility', relativePath, 'identity artwork must declare focusable="false"');
    }
    const pathHasGeometry = [...source.matchAll(/<path\b[^>]*>/gi)].some((match) =>
      /\bd\s*=\s*['"][^'"]*[a-z][^'"]*['"]/i.test(match[0]),
    );
    if (!pathHasGeometry) fail('SVG geometry', relativePath, 'at least one path with drawing geometry is required');

    for (const [description, pattern] of disallowedMarkup) {
      if (pattern.test(source)) fail('SVG safety', relativePath, description);
    }
    if (prohibitedIdentityTerms.test(source)) {
      fail('identity metadata', relativePath, 'duck or propeller terminology is prohibited in production identity SVGs');
    }
    if (inlineIdentityAssets.has(expectation.file)) {
      if (/\s(?:xml:)?id\s*=\s*['"]/i.test(source)) {
        fail('inline SVG isolation', relativePath, 'inline identity SVGs must not declare IDs');
      }
      if (/url\(\s*['"]?\s*#/i.test(source)) {
        fail('inline SVG isolation', relativePath, 'inline identity SVGs must not contain url(#...) references');
      }
      if (/(?:href|xlink:href)\s*=\s*['"]\s*#/i.test(source)) {
        fail('inline SVG isolation', relativePath, 'inline identity SVGs must not contain hash references');
      }
    }
  }

  const wordmarkSnippetPath = 'snippets/docked-brand-wordmark.liquid';
  const wordmarkSnippet = sourceFor(wordmarkSnippetPath);
  const directWordmarkUsers = liquidFiles
    .filter((file) => /['"]docked-wordmark\.svg['"]\s*\|\s*inline_asset_content/i.test(fs.readFileSync(file, 'utf8')))
    .map((file) => normalise(file, root));
  if (
    directWordmarkUsers.length !== 1 ||
    directWordmarkUsers[0] !== wordmarkSnippetPath ||
    !/\baccessible_name\b/.test(wordmarkSnippet) ||
    !/class\s*=\s*['"]visually-hidden['"]/.test(wordmarkSnippet) ||
    !/aria-hidden\s*=\s*['"]true['"]/.test(wordmarkSnippet)
  ) {
    fail('shared wordmark', wordmarkSnippetPath, 'the shared accessible wordmark snippet must be the sole inline wordmark renderer');
  }

  const header = sourceFor('sections/header.liquid');
  const passwordHeader = sourceFor('sections/main-password-header.liquid');
  const footer = sourceFor('sections/footer.liquid');
  const wordmarkRender = /render\s+['"]docked-brand-wordmark['"]/;
  if (
    !wordmarkRender.test(header) ||
    !/if\s+settings\.logo\s*!=\s*blank/.test(header) ||
    !/settings\.logo\s*\|\s*image_url/.test(header)
  ) {
    fail('shared wordmark', 'sections/header.liquid', 'header must retain the merchant logo override and shared wordmark fallback');
  }
  if (
    !wordmarkRender.test(passwordHeader) ||
    !/if\s+settings\.logo\s*!=\s*blank/.test(passwordHeader) ||
    !/settings\.logo\s*\|\s*image_url/.test(passwordHeader)
  ) {
    fail(
      'shared wordmark',
      'sections/main-password-header.liquid',
      'password header must retain the merchant logo override and shared wordmark fallback',
    );
  }
  if (
    !wordmarkRender.test(footer) ||
    !/if\s+settings\.brand_image\s*!=\s*blank/.test(footer) ||
    !/settings\.brand_image\s*\|\s*image_url/.test(footer)
  ) {
    fail('shared wordmark', 'sections/footer.liquid', 'footer must retain the merchant brand-image override and shared wordmark fallback');
  }

  const hero = sourceFor('sections/docked-hero.liquid');
  for (const asset of ['docked-mark.svg', 'docked-wake.svg']) {
    const escapedAsset = asset.replace('.', '\\.');
    if (!new RegExp(`['"]${escapedAsset}['"]\\s*\\|\\s*inline_asset_content`).test(hero)) {
      fail('hero identity', 'sections/docked-hero.liquid', `hero must inline ${asset}`);
    }
  }

  const giftCard = sourceFor('templates/gift_card.liquid');
  const giftCardFaviconFallback =
    /if\s+settings\.favicon\s*!=\s*blank[\s\S]{0,750}?settings\.favicon\s*\|\s*image_url[\s\S]{0,750}?else[\s\S]{0,500}?['"]favicon\.svg['"]\s*\|\s*asset_url/.test(
      giftCard,
    );
  if (!giftCardFaviconFallback) {
    fail('gift-card identity', 'templates/gift_card.liquid', 'gift card must retain the merchant favicon override and SVG fallback');
  }

  const organizationFallback =
    /if\s+settings\.logo[\s\S]{0,500}?settings\.logo\s*\|\s*image_url[\s\S]{0,500}?else[\s\S]{0,300}?['"]docked-mark\.svg['"]\s*\|\s*asset_url/.test(
      header,
    );
  if (!organizationFallback) {
    fail('Organization identity', 'sections/header.liquid', 'Organization JSON-LD must use the configured logo or Docked mark fallback');
  }

  let footerGroup;
  try {
    footerGroup = getJson(root, 'sections/footer-group.json');
  } catch {
    footerGroup = undefined;
  }
  const configuredFooter = footerGroup?.sections?.footer;
  const brandBlockEntry = Object.entries(configuredFooter?.blocks ?? {}).find(([, block]) => block?.type === 'brand_information');
  const brandBlockConfigured = Boolean(
    brandBlockEntry && configuredFooter?.block_order?.includes(brandBlockEntry[0]),
  );
  const brandBlockSupported =
    /when\s+['"]brand_information['"]/.test(footer) && /['"]type['"]\s*:\s*['"]brand_information['"]/.test(footer);
  if (!brandBlockConfigured || !brandBlockSupported) {
    fail('footer identity', 'sections/footer-group.json', 'footer must support and configure an ordered brand_information block');
  }

  const gitIgnore = sourceFor('.gitignore');
  const shopifyIgnore = sourceFor('.shopifyignore');
  const gitAttachmentIgnored = gitIgnore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === '/.codex-remote-attachments/' || line === '.codex-remote-attachments/');
  const shopifyAttachmentIgnored = shopifyIgnore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === '/^\\.codex-remote-attachments\\/.*/');
  if (!gitAttachmentIgnored) fail('reference isolation', '.gitignore', '.codex-remote-attachments must be ignored by Git');
  if (!shopifyAttachmentIgnored) {
    fail('reference isolation', '.shopifyignore', '.codex-remote-attachments must be excluded from Shopify uploads');
  }

  const referenceJpgNames = new Set(['1-Photo-1.jpg', '2-Photo-2.jpg', '3-Photo-3.jpg']);
  const misplacedReferenceJpgs = walk(root)
    .filter((file) => referenceJpgNames.has(path.basename(file)))
    .map((file) => normalise(file, root))
    .filter((file) => !file.startsWith('.codex-remote-attachments/'));
  for (const file of misplacedReferenceJpgs) {
    fail('reference isolation', file, 'user-supplied logo reference JPG must remain under .codex-remote-attachments');
  }

  try {
    const trackedFiles = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\0')
      .filter(Boolean)
      .map((file) => file.split(path.sep).join('/'));
    const trackedReferenceJpgs = trackedFiles.filter(
      (file) =>
        file.startsWith('.codex-remote-attachments/') ||
        referenceJpgNames.has(path.posix.basename(file)),
    );
    for (const file of trackedReferenceJpgs) {
      fail('reference isolation', file, 'reference JPGs and attachment files must not be tracked or shipped');
    }
  } catch (error) {
    fail('reference isolation', '.git', `unable to inspect tracked files: ${error.message}`);
  }

  const assetLicences = sourceFor('docs/ASSET_LICENCES.md');
  for (const { file } of identityExpectations) {
    if (!assetLicences.includes(`assets/${file}`)) {
      fail('asset provenance', 'docs/ASSET_LICENCES.md', `missing provenance entry for assets/${file}`);
    }
  }
  for (const [description, pattern] of [
    ['original vector geometry statement', /original vector geometry/i],
    ['path-only statement', /path-only/i],
    ['not-traced statement', /not traced/i],
  ]) {
    if (!pattern.test(assetLicences)) fail('asset provenance', 'docs/ASSET_LICENCES.md', `missing ${description}`);
  }

  report.stats.identitySvgFiles = identityExpectations.length;
  addCheck(
    report,
    failures.length === 0,
    'brand.identity-contract',
    'Five identity SVGs, their theme integrations and reference isolation satisfy the structural brand-safety contract',
    {
      identityFiles: identityExpectations.map(({ file }) => file),
      inlineIdentityAssets: [...inlineIdentityAssets].sort(),
      scope: 'Structural validation only; originality, ownership and public-use rights require separate evidence.',
      failures,
    },
  );
}

function validateRoutesAndComposition(root, report) {
  const missingRoutes = REQUIRED_ROUTES.filter((route) => !fs.existsSync(path.join(root, 'templates', route)));
  addCheck(
    report,
    missingRoutes.length === 0,
    'routes.required',
    `All ${REQUIRED_ROUTES.length} required storefront route templates exist`,
    missingRoutes,
  );

  const home = getJson(root, 'templates/index.json');
  const homeTypes = templateSectionTypes(home);
  const missingHomeSections = REQUIRED_HOME_SECTION_TYPES.filter((type) => !homeTypes.includes(type));
  addCheck(
    report,
    missingHomeSections.length === 0,
    'home.required-sections',
    'Homepage contains the required single-product preview, safety and FAQ sections',
    missingHomeSections,
  );
  const featuredCollections = homeTypes.filter((type) => type === 'featured-collection').length;
  const obsoleteRangeSections = ['docked-collection-grid', 'docked-powered-comparison', 'docked-float-finder']
    .filter((type) => homeTypes.includes(type));
  addCheck(
    report,
    featuredCollections === 1 && obsoleteRangeSections.length === 0,
    'home.single-product-layout',
    'Homepage presents one featured product range without multi-category finder or comparison surfaces',
    { featuredCollections, obsoleteRangeSections },
  );
  addCheck(
    report,
    /Adults only|Adults 18\+/i.test(JSON.stringify(home)) && /Pool use only/i.test(JSON.stringify(home)),
    'home.adult-positioning',
    'Homepage states the adults-only and pool-use-only position',
  );

  const product = getJson(root, 'templates/product.json');
  const productTypes = templateSectionTypes(product);
  addCheck(
    report,
    productTypes.includes('main-product') && productTypes.includes('docked-product-details'),
    'product.composition',
    'Product template includes the primary product and verified detail sections',
  );

  const mainProduct = Object.values(product.sections ?? {}).find((section) => section.type === 'main-product');
  const complementary = Object.values(mainProduct?.blocks ?? {}).find((block) => block.type === 'complementary');
  addCheck(
    report,
    !complementary && !productTypes.includes('related-products'),
    'product.single-product-no-cross-sell',
    'Product template contains no complementary-product or related-product cross-sell surface',
  );

  const faqSurface = Object.values(product.sections ?? {}).find((section) => /faq/i.test(section.type ?? ''));
  const faqBlocks = Object.values(faqSurface?.blocks ?? {});
  const completeFaqBlocks = faqBlocks.filter(
    (block) =>
      typeof block.settings?.question === 'string' &&
      block.settings.question.trim() &&
      typeof block.settings?.answer === 'string' &&
      block.settings.answer.trim(),
  );
  addCheck(
    report,
    faqSurface && completeFaqBlocks.length >= 3,
    'product.faq-surface',
    'Product template includes an accessible FAQ surface with at least three configured questions and answers',
    faqSurface ? { sectionType: faqSurface.type, completeQuestions: completeFaqBlocks.length } : { sectionType: null },
  );

  const safety = getJson(root, 'templates/page.safety-and-care.json');
  const safetyTypes = templateSectionTypes(safety);
  addCheck(
    report,
    safetyTypes.includes('docked-adult-safety-notice') && safetyTypes.includes('docked-safety-page'),
    'safety.composition',
    'Safety & Care route includes universal and powered-product safety content',
  );
  const universalWarningBlocks = Object.values(safety.sections ?? {}).find(
    (section) => section.type === 'docked-adult-safety-notice',
  )?.blocks;
  addCheck(
    report,
    universalWarningBlocks && Object.keys(universalWarningBlocks).length >= 14,
    'safety.universal-warnings',
    'Safety & Care route keeps at least 14 universal warnings visible in-page',
  );

  const contact = getJson(root, 'templates/page.contact.json');
  addCheck(
    report,
    templateSectionTypes(contact).includes('contact-form'),
    'contact.form',
    'Contact route includes the Shopify contact form section',
  );
}

function liquidConditionsAt(source, offset) {
  const stack = [];
  const tagPattern = /{%-?\s*(if|unless|elsif|else|endif|endunless)\b([^%]*?)-?%}/gi;
  for (const match of source.slice(0, offset).matchAll(tagPattern)) {
    const operation = match[1].toLowerCase();
    const condition = match[2].trim();
    if (operation === 'if' || operation === 'unless') {
      stack.push({ operation, condition });
    } else if (operation === 'elsif' && stack.length) {
      stack[stack.length - 1] = { operation: 'if', condition };
    } else if (operation === 'else' && stack.length) {
      stack[stack.length - 1] = { operation: 'else', condition: '' };
    } else if ((operation === 'endif' || operation === 'endunless') && stack.length) {
      stack.pop();
    }
  }
  return stack;
}

function occurrenceConditionFailures(source, pattern, predicate) {
  const failures = [];
  for (const match of source.matchAll(pattern)) {
    const conditions = liquidConditionsAt(source, match.index);
    if (!conditions.some(predicate)) {
      failures.push({ line: source.slice(0, match.index).split('\n').length, conditions });
    }
  }
  return failures;
}

function cssRuleBody(source, selector) {
  const bodies = [];
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((candidate) => candidate.trim());
    if (selectors.includes(selector)) bodies.push(match[2]);
  }
  return bodies.join('\n');
}

function validateMerchandisingSurfaces(root, report) {
  const mainProduct = read(root, 'sections/main-product.liquid');
  const buyButtons = read(root, 'snippets/buy-buttons.liquid');
  const mainBuyCase = mainProduct.match(/when\s+['"]buy_buttons['"]([\s\S]*?)(?={%-?\s*when\s+['"])/)?.[1] ?? '';
  const renderPattern = /render\s+['"]([^'"]+)['"]/gi;
  const referencedPaymentSnippets = [...mainBuyCase.matchAll(renderPattern), ...buyButtons.matchAll(renderPattern)]
    .map((match) => match[1])
    .filter((name) => fs.existsSync(path.join(root, 'snippets', `${name}.liquid`)))
    .filter((name) => read(root, `snippets/${name}.liquid`).includes('shop.enabled_payment_types'));
  const paymentCandidates = [
    {
      name: 'main-product',
      source: mainProduct,
      directlyNearControls:
        mainBuyCase.includes('shop.enabled_payment_types') && mainBuyCase.includes('payment_type_svg_tag'),
    },
    { name: 'buy-buttons', source: buyButtons, directlyNearControls: true },
    ...referencedPaymentSnippets
      .filter((name, index, names) => names.indexOf(name) === index)
      .filter((name) => fs.existsSync(path.join(root, 'snippets', `${name}.liquid`)))
      .map((name) => ({
        name,
        source: read(root, `snippets/${name}.liquid`),
        directlyNearControls: buyButtons.includes(`render '${name}'`) || buyButtons.includes(`render "${name}"`),
      })),
  ];
  for (const candidate of paymentCandidates) {
    if (
      candidate.name !== 'main-product' &&
      (mainBuyCase.includes(`render '${candidate.name}'`) || mainBuyCase.includes(`render "${candidate.name}"`))
    ) {
      candidate.directlyNearControls = true;
    }
  }
  const paymentSurface = paymentCandidates.find(
    ({ source, directlyNearControls }) =>
      directlyNearControls &&
      source.includes('shop.enabled_payment_types') &&
      source.includes('payment_type_svg_tag'),
  );
  const paymentServerGated =
    paymentSurface &&
    /settings\.prelaunch_mode\s*==\s*false/.test(paymentSurface.source) &&
    /shop\.enabled_payment_types(?:\.size\s*>\s*0)?/.test(paymentSurface.source);
  addCheck(
    report,
    Boolean(paymentServerGated),
    'product.enabled-payment-icons',
    'Product controls expose only enabled payment icons and suppress the surface server-side during prelaunch',
    paymentSurface ? { surface: paymentSurface.name, prelaunchGated: Boolean(paymentServerGated) } : { surface: null },
  );

  const card = read(root, 'snippets/card-product.liquid');
  const stockBranch = card.match(
    /{%-?\s*if\s+settings\.prelaunch_mode\s*-?%}([\s\S]*?){%-?\s*elsif\s+card_product\.available(?:\s*==\s*true)?\s*-?%}([\s\S]*?){%-?\s*else\s*-?%}([\s\S]*?){%-?\s*endif\s*-?%}/i,
  );
  const neutralAvailability =
    stockBranch &&
    /Preview[\s\S]*not available to order/i.test(stockBranch[1]) &&
    /\bAvailable\b/i.test(stockBranch[2]) &&
    !/\bIn stock\b/i.test(stockBranch[2]) &&
    /\bSold out\b/i.test(stockBranch[3]);
  addCheck(
    report,
    Boolean(neutralAvailability),
    'cards.verified-availability',
    'Product cards show a prelaunch preview state and use neutral “Available” copy only for live available products',
  );

  const themeLiquidFiles = [...walk(path.join(root, 'sections')), ...walk(path.join(root, 'snippets'))].filter(
    (file) => path.extname(file) === '.liquid',
  );
  const comparisonLinkFiles = [];
  for (const file of themeLiquidFiles) {
    const source = fs.readFileSync(file, 'utf8');
    if (/href\s*=\s*['"][^'"]*#compare-powered-floats/i.test(source)) {
      comparisonLinkFiles.push(normalise(file, root));
    }
  }
  const comparison = read(root, 'sections/docked-powered-comparison.liquid');
  const comparisonTargets = [...comparison.matchAll(/id="compare-powered-floats"/g)];
  const customerGuardedTarget = /{%-?\s*if\s+request\.design_mode\s+or\s+selected_count\s*>=\s*2\s+and\s+all_powered_floats\s+and\s+all_unique_products\s*-?%}\s*<section\s+id="compare-powered-floats"/i.test(
    comparison,
  );
  const verifiedTableGate = /{%-?\s*if\s+selected_count\s*>=\s*2\s+and\s+all_powered_floats\s+and\s+all_unique_products\s*-?%}[\s\S]*?<table\b/i.test(
    comparison,
  );
  const cardComparisonLinkIndex = card.search(/<a\b[^>]*href\s*=\s*['"][^'"]*#compare-powered-floats/i);
  const activeCardConditions = cardComparisonLinkIndex >= 0 ? liquidConditionsAt(card, cardComparisonLinkIndex) : [];
  const cardLinkReadinessGated = activeCardConditions.some(
    ({ operation, condition }) => operation === 'if' && /settings\.powered_comparison_ready\b/.test(condition),
  );
  const cardLinkPoweredGated = activeCardConditions.some(
    ({ operation, condition }) => operation === 'if' && /card_product\.metafields\.custom\.powered_float\.value/.test(condition),
  );
  addCheck(
    report,
    comparisonLinkFiles.length > 0 &&
      comparisonTargets.length === 1 &&
      customerGuardedTarget &&
      verifiedTableGate &&
      cardLinkReadinessGated &&
      cardLinkPoweredGated,
    'comparison.anchor-integrity',
    'Comparison is customer-hidden until two verified powered products exist, while its card link requires explicit readiness',
    {
      comparisonLinkFiles,
      comparisonTargets: comparisonTargets.length,
      customerGuardedTarget,
      verifiedTableGate,
      cardLinkReadinessGated,
      cardLinkPoweredGated,
    },
  );

  const distinctIdTracking =
    /assign\s+selected_product_ids\s*=\s*['"]\|['"]/i.test(comparison) &&
    /assign\s+product_token\s*=\s*block\.settings\.product\.id\s*\|\s*prepend:\s*['"]\|['"]\s*\|\s*append:\s*['"]\|['"]/i.test(
      comparison,
    ) &&
    /if\s+selected_product_ids\s+contains\s+product_token[\s\S]*?assign\s+all_unique_products\s*=\s*false[\s\S]*?else[\s\S]*?assign\s+selected_count\s*=\s*selected_count\s*\|\s*plus:\s*1/i.test(
      comparison,
    );
  addCheck(
    report,
    distinctIdTracking && customerGuardedTarget && verifiedTableGate,
    'comparison.distinct-products',
    'Powered comparison counts distinct product IDs and rejects duplicate selections in customer and table gates',
    { distinctIdTracking, customerGuardedTarget, verifiedTableGate },
  );

  const settingsSchema = getJson(root, 'config/settings_schema.json');
  const readinessSetting = findSetting(settingsSchema, 'powered_comparison_ready');
  const settingsData = getJson(root, 'config/settings_data.json');
  const configuredReadiness = findValuesForKey(settingsData, 'powered_comparison_ready');
  addCheck(
    report,
    readinessSetting?.type === 'checkbox' &&
      readinessSetting.default === false &&
      configuredReadiness.length > 0 &&
      configuredReadiness.every((value) => value === false),
    'comparison.readiness-default',
    'Powered comparison readiness is an explicit global checkbox that defaults and remains configured false',
    {
      schemaType: readinessSetting?.type ?? null,
      schemaDefault: readinessSetting?.default ?? null,
      configuredReadiness,
    },
  );

  const finder = read(root, 'sections/docked-float-finder.liquid');
  const fieldsetSemantics = /<fieldset\b/i.test(finder) && /<legend\b[^>]*>[\s\S]*?\S[\s\S]*?<\/legend>/i.test(finder);
  const labelledGroupMatch = finder.match(/<[^>]+role\s*=\s*['"]group['"][^>]+aria-labelledby\s*=\s*['"]([^'"]+)['"][^>]*>/i) ??
    finder.match(/<[^>]+aria-labelledby\s*=\s*['"]([^'"]+)['"][^>]+role\s*=\s*['"]group['"][^>]*>/i);
  const labelledGroupSemantics = Boolean(
    labelledGroupMatch &&
      (finder.includes(`id="${labelledGroupMatch[1]}"`) || finder.includes(`id='${labelledGroupMatch[1]}'`)),
  );
  const selectIds = [...finder.matchAll(/<select\b[^>]*\bid\s*=\s*['"]([^'"]+)['"]/gi)].map((match) => match[1]);
  const allSelectsLabelled =
    selectIds.length >= 2 && selectIds.every((id) => finder.includes(`for="${id}"`) || finder.includes(`for='${id}'`));
  addCheck(
    report,
    (fieldsetSemantics || labelledGroupSemantics) && allSelectsLabelled,
    'finder.group-semantics',
    'Float Finder controls form a labelled semantic group and every select has an associated label',
    { fieldsetSemantics, labelledGroupSemantics, labelledSelects: selectIds.length },
  );

  const sharedCss = read(root, 'assets/docked-theme.css');
  const themeLayout = read(root, 'layout/theme.liquid');
  const passwordLayout = read(root, 'layout/password.liquid');
  const requiredSharedSelectors = ['.docked-prelaunch-note', '.docked-safety-notice', '.docked-powered-warning'];
  const missingSharedSelectors = requiredSharedSelectors.filter((selector) => !sharedCss.includes(selector));
  addCheck(
    report,
    missingSharedSelectors.length === 0 &&
      themeLayout.includes("'docked-theme.css' | asset_url | stylesheet_tag") &&
      passwordLayout.includes("'docked-theme.css' | asset_url | stylesheet_tag"),
    'css.shared-safety-prelaunch',
    'Shared Docked CSS supplies prelaunch and safety primitives in both storefront layouts',
    { missingSharedSelectors },
  );

  const globalHeadingBlock = sharedCss.match(/body\.docked-theme h1\s*,[\s\S]*?\{([^}]*)\}/i)?.[1] ?? '';
  const headingColour = globalHeadingBlock.match(/\bcolor\s*:\s*([^;]+)/i)?.[1].trim() ?? '';
  const globalHeadingColourSafe =
    !headingColour || /^(?:inherit|currentcolor|rgb\(\s*var\(--color-foreground\)\s*\)|var\(--color-foreground\))$/i.test(headingColour);
  const darkSectionCss = `${sharedCss}\n${comparison}\n${read(root, 'sections/docked-safety-page.liquid')}`;
  const comparisonGstColour = cssRuleBody(darkSectionCss, '.docked-comparison .docked-gst-note').match(
    /\bcolor\s*:\s*([^;]+)/i,
  )?.[1].trim() ?? '';
  const safetyGstColour = cssRuleBody(darkSectionCss, '.docked-powered-safety .docked-gst-note').match(
    /\bcolor\s*:\s*([^;]+)/i,
  )?.[1].trim() ?? '';
  const isReadableLightColour = (value) =>
    /^(?:#fff(?:fff)?|white|var\(--docked-white\)|rgba?\(\s*255\s*,\s*255\s*,\s*255\b)/i.test(value);
  addCheck(
    report,
    globalHeadingColourSafe && isReadableLightColour(comparisonGstColour) && isReadableLightColour(safetyGstColour),
    'css.dark-surface-contrast',
    'Global heading styles preserve colour schemes and dark comparison/safety GST notes use explicit light text',
    { headingColour: headingColour || null, comparisonGstColour: comparisonGstColour || null, safetyGstColour: safetyGstColour || null },
  );
}

function validateFinalAuditGates(root, report) {
  const productSectionSources = {
    'sections/main-product.liquid': read(root, 'sections/main-product.liquid'),
    'sections/featured-product.liquid': read(root, 'sections/featured-product.liquid'),
  };
  const priceBadgeFailures = [];
  for (const [file, source] of Object.entries(productSectionSources)) {
    const priceRenders = [...source.matchAll(/{%-?\s*render\s+['"]price['"]\s*,([\s\S]*?)-?%}/g)].filter((match) =>
      /\bshow_badges\s*:/.test(match[1]),
    );
    if (priceRenders.length === 0) {
      priceBadgeFailures.push({ file, reason: 'price render with explicit show_badges missing' });
      continue;
    }
    for (const renderMatch of priceRenders) {
      const badgeValue = renderMatch[1].match(/\bshow_badges\s*:\s*([a-zA-Z_][\w.]*|false)/)?.[1];
      let prelaunchSafe = badgeValue === 'false';
      if (badgeValue && badgeValue !== 'false') {
        const escapedVariable = badgeValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        prelaunchSafe =
          new RegExp(`show_badges\\s*:\\s*settings\\.prelaunch_mode\\s*==\\s*false`).test(renderMatch[1]) ||
          new RegExp(
            `assign\\s+${escapedVariable}\\s*=\\s*true[\\s\\S]*?if\\s+settings\\.prelaunch_mode[\\s\\S]*?assign\\s+${escapedVariable}\\s*=\\s*false[\\s\\S]*?endif`,
          ).test(source);
      }
      if (!prelaunchSafe) {
        priceBadgeFailures.push({
          file,
          line: source.slice(0, renderMatch.index).split('\n').length,
          badgeValue: badgeValue ?? null,
        });
      }
    }
  }
  addCheck(
    report,
    priceBadgeFailures.length === 0,
    'prelaunch.price-badges-hidden',
    'Main and featured product price badges are disabled while prelaunch mode is active',
    priceBadgeFailures,
  );

  const mainProduct = productSectionSources['sections/main-product.liquid'];
  const inventoryCase = mainProduct.match(
    /{%-?\s*when\s+['"]inventory['"]\s*-?%}([\s\S]*?)(?={%-?\s*when\s+['"]description['"])/,
  )?.[1] ?? '';
  const inventoryPrelaunchSplit = inventoryCase.match(
    /{%-?\s*if\s+settings\.prelaunch_mode\s*-?%}([\s\S]*?){%-?\s*else\s*-?%}([\s\S]*?){%-?\s*endif\s*-?%}\s*$/,
  );
  const previewInventoryBranch = inventoryPrelaunchSplit?.[1] ?? '';
  const liveInventoryBranch = inventoryPrelaunchSplit?.[2] ?? '';
  const neutralPreviewInventory =
    /\bPreview\b/i.test(previewInventoryBranch) &&
    /not available to order|availability[^.]*confirm/i.test(previewInventoryBranch) &&
    !/inventory_(?:quantity|policy|management)|products\.product\.inventory_/i.test(previewInventoryBranch);
  const liveInventoryIsolated =
    /inventory_(?:quantity|policy|management)|products\.product\.inventory_/i.test(liveInventoryBranch);
  addCheck(
    report,
    Boolean(inventoryCase && inventoryPrelaunchSplit && neutralPreviewInventory && liveInventoryIsolated),
    'prelaunch.inventory-neutral',
    'Main product inventory emits only a neutral preview message during prelaunch and isolates live stock state to the live branch',
    {
      inventoryCase: Boolean(inventoryCase),
      prelaunchSplit: Boolean(inventoryPrelaunchSplit),
      neutralPreviewInventory,
      liveInventoryIsolated,
    },
  );

  const structuredDataFailures = [];
  for (const [file, source] of Object.entries(productSectionSources)) {
    const structuredDataMatches = [...source.matchAll(/product\s*\|\s*structured_data/g)];
    if (structuredDataMatches.length === 0) {
      structuredDataFailures.push({ file, reason: 'Product structured_data surface missing' });
      continue;
    }
    for (const match of structuredDataMatches) {
      const conditions = liquidConditionsAt(source, match.index);
      const prelaunchGated = conditions.some(
        ({ operation, condition }) =>
          (operation === 'unless' && /^settings\.prelaunch_mode$/.test(condition)) ||
          (operation === 'if' && /settings\.prelaunch_mode\s*==\s*false/.test(condition)),
      );
      if (!prelaunchGated) {
        structuredDataFailures.push({
          file,
          line: source.slice(0, match.index).split('\n').length,
          conditions,
        });
      }
    }
  }
  addCheck(
    report,
    structuredDataFailures.length === 0,
    'prelaunch.product-schema-hidden',
    'Product/Offer structured data in main and featured product sections is server-gated out during prelaunch',
    structuredDataFailures,
  );

  const cardProduct = read(root, 'snippets/card-product.liquid');
  const cardBadgeIndexes = [...cardProduct.matchAll(/<div\s+class=['"]card__badge\b/g)];
  const unguardedCardBadges = cardBadgeIndexes
    .filter((match) =>
      !liquidConditionsAt(cardProduct, match.index).some(
        ({ operation, condition }) => operation === 'unless' && /^settings\.prelaunch_mode$/.test(condition),
      ),
    )
    .map((match) => ({ line: cardProduct.slice(0, match.index).split('\n').length }));
  const ariaLabelledByAttributes = [...cardProduct.matchAll(/aria-labelledby=['"]([^'"]*Badge-[^'"]*)['"]/g)];
  const unguardedBadgeAria = ariaLabelledByAttributes
    .filter((match) =>
      !/{%\s*unless\s+settings\.prelaunch_mode\s*%}[\s\S]*?Badge-[\s\S]*?{%\s*endunless\s*%}/.test(match[1]),
    )
    .map((match) => ({ line: cardProduct.slice(0, match.index).split('\n').length, value: match[1] }));
  addCheck(
    report,
    cardBadgeIndexes.length === 2 &&
      ariaLabelledByAttributes.length === 2 &&
      unguardedCardBadges.length === 0 &&
      unguardedBadgeAria.length === 0,
    'prelaunch.card-badges-hidden',
    'Media and no-media card badge blocks and their ARIA badge suffixes are suppressed during prelaunch',
    {
      badgeBlocks: cardBadgeIndexes.length,
      badgeAriaAttributes: ariaLabelledByAttributes.length,
      unguardedCardBadges,
      unguardedBadgeAria,
    },
  );

  const priceSnippet = read(root, 'snippets/price.liquid');
  const centralPricePrelaunchBlock = priceSnippet.match(
    /if\s+settings\.prelaunch_mode([\s\S]*?)endif/i,
  )?.[1] ?? '';
  const centralPriceNeutral =
    /assign\s+compare_at_price\s*=\s*nil/.test(centralPricePrelaunchBlock) &&
    /assign\s+available\s*=\s*true/.test(centralPricePrelaunchBlock) &&
    /assign\s+show_badges\s*=\s*false/.test(centralPricePrelaunchBlock) &&
    /assign\s+show_compare_at_price\s*=\s*false/.test(centralPricePrelaunchBlock);
  addCheck(
    report,
    centralPriceNeutral,
    'prelaunch.central-price-neutral',
    'Central price rendering removes compare-at prices, neutralises availability and disables badges during prelaunch',
    { centralPriceNeutral },
  );

  const variantOptions = read(root, 'snippets/product-variant-options.liquid');
  const neutralOptionAssignment =
    /if\s+settings\.prelaunch_mode[\s\S]*?assign\s+option_disabled\s*=\s*false[\s\S]*?endif/.test(variantOptions);
  const unavailableLabelGuard =
    /capture\s+label_unavailable[\s\S]*?unless\s+settings\.prelaunch_mode[\s\S]*?label-unavailable[\s\S]*?endunless[\s\S]*?endcapture/.test(
      variantOptions,
    );
  const disabledClassUsesNeutralFlag = /if\s+option_disabled[\s\S]*?class=['"]disabled['"]/.test(variantOptions);
  const dropdownUnavailableUsesNeutralFlag =
    /<option\b[\s\S]*?>[\s\S]*?if\s+option_disabled[\s\S]*?products\.product\.value_unavailable/.test(variantOptions);
  addCheck(
    report,
    neutralOptionAssignment && unavailableLabelGuard && disabledClassUsesNeutralFlag && dropdownUnavailableUsesNeutralFlag,
    'prelaunch.variant-options-neutral',
    'Variant options stay neutrally selectable and suppress unavailable labels during prelaunch',
    { neutralOptionAssignment, unavailableLabelGuard, disabledClassUsesNeutralFlag, dropdownUnavailableUsesNeutralFlag },
  );

  const themeLayout = read(root, 'layout/theme.liquid');
  const productInfo = read(root, 'assets/product-info.js');
  const variantStringsBlock = themeLayout.match(/window\.variantStrings\s*=\s*\{([\s\S]*?)\};/)?.[1] ?? '';
  const validVariantUpdate = productInfo.match(
    /handleUpdateProductInfo\(productUrl\)\s*\{([\s\S]*?)\n\s*updateVariantInputs\(variantId\)/,
  )?.[1] ?? '';
  const setUnavailableUpdate = productInfo.match(
    /setUnavailable\(\)\s*\{([\s\S]*?)\n\s*updateMedia\(/,
  )?.[1] ?? '';
  const prelaunchVariantStringDefined =
    /\bprelaunch\s*:\s*`[^`]*(?:Coming soon|Preview|not available to order)[^`]*`/i.test(variantStringsBlock);
  const validVariantKeepsServerDisabledState =
    /toggleSubmitButton\(\s*html\.getElementById\(`ProductSubmitButton-\$\{this\.sectionId\}`\)\?\.hasAttribute\(['"]disabled['"]\)\s*\?\?\s*true\s*,[\s\S]*?document\.body\.classList\.contains\(['"]docked-prelaunch['"]\)\s*\?\s*window\.variantStrings\.prelaunch\s*:\s*window\.variantStrings\.soldOut\s*\)/.test(
      validVariantUpdate,
    );
  const unavailableAlwaysDisabledWithPrelaunchCopy =
    /toggleSubmitButton\(\s*true\s*,[\s\S]*?document\.body\.classList\.contains\(['"]docked-prelaunch['"]\)\s*\?\s*window\.variantStrings\.prelaunch\s*:\s*window\.variantStrings\.unavailable\s*\)/.test(
      setUnavailableUpdate,
    );
  addCheck(
    report,
    prelaunchVariantStringDefined && validVariantKeepsServerDisabledState && unavailableAlwaysDisabledWithPrelaunchCopy,
    'prelaunch.variant-submit-state',
    'Variant refreshes retain disabled submit state and neutral prelaunch copy for valid and unavailable variants',
    {
      prelaunchVariantStringDefined,
      validVariantKeepsServerDisabledState,
      unavailableAlwaysDisabledWithPrelaunchCopy,
    },
  );

  const blankBuyButtons = read(root, 'snippets/buy-buttons.liquid');
  const blankProductFallback = blankBuyButtons.match(
    /{%-?\s*else\s*-?%}\s*(<div\s+class=['"]product-form['"][\s\S]*?){%-?\s*endif\s*-?%}\s*{%-?\s*if\s+show_pickup_availability\b/,
  )?.[1] ?? '';
  const blankFallbackCopyBranches = blankProductFallback.match(
    /{%-?\s*if\s+settings\.prelaunch_mode\s*-?%}([\s\S]*?){%-?\s*else\s*-?%}([\s\S]*?){%-?\s*endif\s*-?%}/,
  );
  const blankFallbackPrelaunchCopy = blankFallbackCopyBranches?.[1] ?? '';
  const blankFallbackLiveCopy = blankFallbackCopyBranches?.[2] ?? '';
  const blankFallbackNeutral =
    /<button\b[\s\S]*?\bdisabled\b/i.test(blankProductFallback) &&
    /Coming soon|Preview|not available to order/i.test(blankFallbackPrelaunchCopy) &&
    !/sold_out|Sold out/i.test(blankFallbackPrelaunchCopy) &&
    /sold_out|Sold out/i.test(blankFallbackLiveCopy);
  addCheck(
    report,
    blankFallbackNeutral,
    'prelaunch.blank-product-fallback',
    'Blank-product buy-button fallback remains disabled and uses neutral prelaunch copy instead of sold-out copy',
    {
      fallbackFound: Boolean(blankProductFallback),
      copyBranchesFound: Boolean(blankFallbackCopyBranches),
      blankFallbackNeutral,
    },
  );

  const volumePricingSources = {
    'sections/main-product.liquid': productSectionSources['sections/main-product.liquid'],
    'sections/featured-product.liquid': productSectionSources['sections/featured-product.liquid'],
    'snippets/card-product.liquid': read(root, 'snippets/card-product.liquid'),
  };
  const volumePricingFailures = [];
  let volumePricingConditions = 0;
  let volumePricingSurfaces = 0;
  const hasPrelaunchFalseGate = ({ operation, condition }) =>
    operation === 'if' && /settings\.prelaunch_mode\s*==\s*false/.test(condition);
  for (const [file, source] of Object.entries(volumePricingSources)) {
    for (const match of source.matchAll(/{%-?\s*if\s+([^%]*quantity_price_breaks[^%]*?)-?%}/gi)) {
      volumePricingConditions += 1;
      const directCondition = match[1].trim();
      const ancestorConditions = liquidConditionsAt(source, match.index);
      if (
        !/settings\.prelaunch_mode\s*==\s*false/.test(directCondition) &&
        !ancestorConditions.some(hasPrelaunchFalseGate)
      ) {
        volumePricingFailures.push({
          file,
          line: source.slice(0, match.index).split('\n').length,
          surface: 'condition',
          condition: directCondition,
          ancestorConditions,
        });
      }
    }
    for (const match of source.matchAll(/<(?:volume-pricing|price-per-item)\b|class=['"][^'"]*volume-pricing-note/gi)) {
      volumePricingSurfaces += 1;
      const conditions = liquidConditionsAt(source, match.index);
      if (!conditions.some(hasPrelaunchFalseGate)) {
        volumePricingFailures.push({
          file,
          line: source.slice(0, match.index).split('\n').length,
          surface: match[0],
          conditions,
        });
      }
    }
  }
  addCheck(
    report,
    volumePricingConditions > 0 && volumePricingSurfaces > 0 && volumePricingFailures.length === 0,
    'prelaunch.volume-pricing-hidden',
    'Quantity and volume price-break conditions and UI surfaces are gated out while prelaunch mode is active',
    { volumePricingConditions, volumePricingSurfaces, failures: volumePricingFailures },
  );

  const taxTargets = [
    {
      file: 'snippets/card-product.liquid',
      pattern: /\bGST included\b/g,
    },
    {
      file: 'sections/main-product.liquid',
      pattern: /settings\.gst_message/g,
    },
    {
      file: 'sections/docked-powered-comparison.liquid',
      pattern: /settings\.gst_message/g,
    },
    {
      file: 'snippets/docked-sticky-add-to-cart.liquid',
      pattern: /\bGST included\b/g,
    },
  ];
  const gstGateFailures = [];
  for (const { file, pattern } of taxTargets) {
    const source = read(root, file);
    const matches = [...source.matchAll(pattern)];
    if (matches.length === 0) {
      gstGateFailures.push({ file, reason: 'required GST surface missing' });
      continue;
    }
    for (const match of matches) {
      const conditions = liquidConditionsAt(source, match.index);
      const taxGated = conditions.some(
        ({ operation, condition }) => operation === 'if' && /\bcart\.taxes_included\b/.test(condition),
      );
      if (!taxGated) {
        gstGateFailures.push({
          file,
          line: source.slice(0, match.index).split('\n').length,
          reason: 'GST copy is not inside cart.taxes_included',
          conditions,
        });
      }
    }
  }
  addCheck(
    report,
    gstGateFailures.length === 0,
    'tax.gst-copy-gates',
    'Card, product, comparison and sticky GST copy renders only when Shopify reports taxes included',
    gstGateFailures,
  );

  const buyButtons = read(root, 'snippets/buy-buttons.liquid');
  const pickupPatterns = [
    /<pickup-availability(?:\s|>)/g,
    /['"]pickup-availability\.js['"]\s*\|\s*asset_url/g,
  ];
  const pickupFailures = pickupPatterns.flatMap((pattern) =>
    occurrenceConditionFailures(buyButtons, pattern, ({ operation, condition }) =>
      operation === 'if' &&
      /\bshow_pickup_availability\b/.test(condition) &&
      /settings\.prelaunch_mode\s*==\s*false/.test(condition),
    ),
  );
  const pickupSection = read(root, 'sections/pickup-availability.liquid');
  const pickupSectionPayloadIndexes = [
    ...pickupSection.matchAll(/product_variant\.store_availabilities|<pickup-availability-preview\b|<pickup-availability-drawer\b/g),
  ];
  const pickupEndpointFailures = pickupSectionPayloadIndexes
    .filter((match) => {
      const conditions = liquidConditionsAt(pickupSection, match.index);
      return !conditions.some(
        ({ operation, condition }) =>
          (operation === 'unless' && /^settings\.prelaunch_mode$/.test(condition)) ||
          (operation === 'if' && /settings\.prelaunch_mode\s*==\s*false/.test(condition)),
      );
    })
    .map((match) => ({
      file: 'sections/pickup-availability.liquid',
      line: pickupSection.slice(0, match.index).split('\n').length,
      reason: 'standalone section payload is not prelaunch-gated',
    }));
  addCheck(
    report,
    pickupFailures.length === 0 &&
      pickupEndpointFailures.length === 0 &&
      pickupSectionPayloadIndexes.length >= 3 &&
      /show_pickup_availability\s+and\s+settings\.prelaunch_mode\s*==\s*false/.test(buyButtons),
    'prelaunch.pickup-hidden',
    'Pickup availability caller and standalone section payload are server-gated out during prelaunch',
    { callerFailures: pickupFailures, endpointFailures: pickupEndpointFailures },
  );

  const faq = read(root, 'sections/docked-faq.liquid');
  const completeFaqCondition =
    /block\.settings\.question\s*!=\s*blank\s+and\s+block\.settings\.answer\s*!=\s*blank/;
  const visibleDetailsIndex = faq.search(/<details\b[^>]*class=['"][^'"]*docked-faq__item/i);
  const visibleConditions = visibleDetailsIndex >= 0 ? liquidConditionsAt(faq, visibleDetailsIndex) : [];
  const visibleBlockGate = visibleConditions.some(
    ({ operation, condition }) => operation === 'if' && completeFaqCondition.test(condition),
  );
  const repeatedCompleteGateCount = [...faq.matchAll(new RegExp(`if\\s+${completeFaqCondition.source}`, 'g'))].length;
  const faqJsonLd =
    /<script\s+type=['"]application\/ld\+json['"]>[\s\S]*?"@type"\s*:\s*"FAQPage"[\s\S]*?"mainEntity"/i.test(faq) &&
    /"@type"\s*:\s*"Question"[\s\S]*?"acceptedAnswer"[\s\S]*?"@type"\s*:\s*"Answer"/i.test(faq) &&
    /block\.settings\.question\s*\|\s*strip_html\s*\|\s*json/.test(faq) &&
    /block\.settings\.answer\s*\|\s*strip_html\s*\|\s*strip_newlines\s*\|\s*json/.test(faq);
  addCheck(
    report,
    visibleBlockGate && repeatedCompleteGateCount >= 3 && faqJsonLd,
    'structured-data.faq-visible-derived',
    'FAQPage JSON-LD is derived from the same complete question-and-answer blocks rendered visibly',
    { visibleBlockGate, repeatedCompleteGateCount, faqJsonLd },
  );

  const header = read(root, 'sections/header.liquid');
  const organizationBlock = header.match(
    /<script\s+type=['"]application\/ld\+json['"]>[\s\S]*?"@type"\s*:\s*"Organization"[\s\S]*?<\/script>/i,
  )?.[0] ?? '';
  const organizationRootUrl =
    /assign\s+storefront_url\s*=\s*request\.origin\s*\|\s*append:\s*routes\.root_url/.test(header) &&
    /"url"\s*:\s*{{\s*storefront_url\s*\|\s*json\s*}}/.test(organizationBlock) &&
    !/shop\.url/.test(organizationBlock);
  const socialSettingIds = [
    'twitter',
    'facebook',
    'pinterest',
    'instagram',
    'tiktok',
    'tumblr',
    'snapchat',
    'youtube',
    'vimeo',
  ];
  const blankSameAsFiltered =
    /if\s+social_links/.test(organizationBlock) &&
    /"sameAs"\s*:\s*\[/.test(organizationBlock) &&
    socialSettingIds.every((network) => {
      const setting = `settings\\.social_${network}_link`;
      return new RegExp(`if\\s+${setting}\\s*!=\\s*blank`).test(organizationBlock) &&
        new RegExp(`${setting}\\s*\\|\\s*json`).test(organizationBlock);
    }) &&
    !/reject:\s*['"]blank['"]/.test(organizationBlock);
  addCheck(
    report,
    Boolean(organizationBlock && organizationRootUrl && blankSameAsFiltered),
    'structured-data.organization',
    'Organization schema uses the storefront root URL and omits blank sameAs entries',
    { organizationBlock: Boolean(organizationBlock), organizationRootUrl, blankSameAsFiltered },
  );

  const browserSpec = read(root, 'tests/storefront.spec.mjs');
  const viewportWidths = [...browserSpec.matchAll(/viewport:\s*{\s*width:\s*(\d+)/g)].map((match) => Number(match[1]));
  const requiredViewportWidths = [320, 360, 375, 390, 768, 1024, 1440];
  const missingViewportWidths = requiredViewportWidths.filter((width) => !viewportWidths.includes(width));
  addCheck(
    report,
    missingViewportWidths.length === 0,
    'browser.viewport-matrix',
    'Optional storefront browser smoke tests cover 320, 360, 375, 390, 768, 1024 and 1440 pixel widths',
    { viewportWidths, missingViewportWidths },
  );

  const sticky = read(root, 'snippets/docked-sticky-add-to-cart.liquid');
  const stickyJs = read(root, 'assets/docked-theme.js');
  const stickyCss = read(root, 'assets/docked-theme.css');
  const fixedLabelIndex = sticky.indexOf('data-fixed-label');
  const fixedLabelConditions = fixedLabelIndex >= 0 ? liquidConditionsAt(sticky, fixedLabelIndex) : [];
  const fixedLabelPrelaunchGated = fixedLabelConditions.some(
    ({ operation, condition }) => operation === 'if' && /^settings\.prelaunch_mode$/.test(condition),
  );
  const stickyPrelaunchBranch = sticky.match(
    /<button\b[\s\S]*?{%-?\s*if\s+settings\.prelaunch_mode\s*-?%}([\s\S]*?){%-?\s*elsif\b/i,
  )?.[1] ?? '';
  const stickyPrelaunchLabel = stickyPrelaunchBranch.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
  const conciseFixedLabel = stickyPrelaunchLabel.length > 0 && stickyPrelaunchLabel.length <= 24;
  const jsPreservesFixedLabel =
    /if\s*\(\s*!this\.hasAttribute\(['"]data-fixed-label['"]\)\s*\)\s*{[\s\S]*?this\.button\.textContent\s*=\s*sourceText[\s\S]*?}/.test(
      stickyJs,
    );
  const narrowCssStart = stickyCss.search(/@media\s+screen\s+and\s*\(max-width:\s*360px\s*\)/i);
  const narrowCss = narrowCssStart >= 0 ? stickyCss.slice(narrowCssStart, stickyCss.indexOf('@media', narrowCssStart + 6) || undefined) : '';
  const narrowStickyGuard =
    narrowCss.includes('.docked-sticky-atc') &&
    narrowCss.includes('.docked-sticky-atc__details') &&
    narrowCss.includes('.docked-sticky-atc__button');
  addCheck(
    report,
    fixedLabelPrelaunchGated && conciseFixedLabel && jsPreservesFixedLabel && narrowStickyGuard,
    'prelaunch.sticky-fixed-label',
    'Mobile sticky add-to-cart keeps a concise fixed prelaunch label, preserves it in JS and has a <=360px layout guard',
    {
      fixedLabelPrelaunchGated,
      stickyPrelaunchLabel,
      jsPreservesFixedLabel,
      narrowStickyGuard,
    },
  );

  const contact = read(root, 'sections/contact-form.liquid');
  const addressEscapesBeforeBreaks =
    /settings\.correspondence_address\s*\|\s*escape\s*\|\s*newline_to_br/.test(contact) &&
    !/settings\.correspondence_address\s*\|\s*newline_to_br\s*\|\s*escape/.test(contact);
  addCheck(
    report,
    addressEscapesBeforeBreaks,
    'contact.address-escaping',
    'Contact correspondence address is escaped before newline conversion',
  );

  const newsletterSources = [
    'sections/newsletter.liquid',
    'sections/footer.liquid',
    'sections/email-signup-banner.liquid',
  ];
  const newsletterIdFailures = [];
  for (const file of newsletterSources) {
    const source = read(root, file);
    const scopedIds = [...source.matchAll(/id\s*=\s*['"]Subscribe--{{\s*section\.id\s*}}['"]/g)];
    if (scopedIds.length === 0) newsletterIdFailures.push({ file, reason: 'section-scoped subscribe ID missing' });
    if (/id\s*=\s*['"]Subscribe['"]/.test(source)) newsletterIdFailures.push({ file, reason: 'hardcoded Subscribe ID remains' });
  }
  addCheck(
    report,
    newsletterIdFailures.length === 0,
    'newsletter.section-scoped-ids',
    'Newsletter submit controls use section-scoped IDs across homepage, footer and signup banner',
    newsletterIdFailures,
  );
}

function validateMetafieldGates(root, report) {
  const details = read(root, 'sections/docked-product-details.liquid');
  const gatedDetailFields = [
    'motor_count',
    'battery_type',
    'battery_capacity_mah',
    'battery_voltage_v',
    'battery_watt_hours',
    'verified_runtime_minutes',
    'verified_charge_time_hours',
    'maximum_user_weight_kg',
    'inflated_length_cm',
    'inflated_width_cm',
    'packed_dimensions',
    'product_weight_kg',
    'material',
    'pvc_grade_or_thickness',
    'verified_water_ingress_rating',
    'minimum_user_age',
    'approved_use_environment',
    'warranty_period',
    'manual_url',
    'compliance_reports',
  ];
  const ungatedDetailFields = gatedDetailFields.filter(
    (field) => !details.includes(`if product.metafields.custom.${field}.value != blank`),
  );
  addCheck(
    report,
    ungatedDetailFields.length === 0,
    'metafields.product-gates',
    `${gatedDetailFields.length} safety-sensitive product fields are blank-gated`,
    ungatedDetailFields,
  );

  const comparison = read(root, 'sections/docked-powered-comparison.liquid');
  const comparisonFields = [
    'motor_count',
    'seating_style',
    'verified_occupancy',
    'maximum_user_weight_kg',
    'verified_runtime_minutes',
    'verified_charge_time_hours',
    'canopy',
    'product_weight_kg',
    'packed_dimensions',
    'included_pump',
    'warranty_period',
  ];
  const missingComparisonFields = comparisonFields.filter(
    (field) => !comparison.includes(`metafields.custom.${field}`),
  );
  const comparisonHasAllProductGate = comparisonFields.every((field) => {
    const fieldIndex = comparison.indexOf(`metafields.custom.${field}`);
    const following = comparison.slice(fieldIndex, fieldIndex + 180);
    return fieldIndex >= 0 && /assign\s+all_[a-z_]+\s*=\s*false/.test(following);
  });
  addCheck(
    report,
    missingComparisonFields.length === 0 && comparisonHasAllProductGate && comparison.includes('selected_count >= 2'),
    'metafields.comparison-gates',
    'Comparison rows require a value for every selected product and at least two selected products',
    missingComparisonFields,
  );

  const safety = read(root, 'snippets/docked-adult-safety-notice.liquid');
  const badges = read(root, 'snippets/docked-product-badges.liquid');
  addCheck(
    report,
    safety.includes('product_warnings != blank') &&
      safety.includes('product.metafields.custom.safety_warnings.value') &&
      safety.includes('product.metafields.custom.adult_only.value') &&
      safety.includes('product.metafields.custom.powered_float.value'),
    'metafields.safety-gates',
    'Product-specific warnings and powered/adult safety notices are metafield-gated',
  );
  addCheck(
    report,
    badges.includes('if occupancy != blank') && badges.includes('custom.verified_occupancy.value'),
    'metafields.badge-gates',
    'Occupancy badges render only from a non-blank verified occupancy value',
  );
}

function copyAuditFiles(root) {
  const explicit = [
    ...walk(path.join(root, 'templates')).filter((file) => path.extname(file) === '.json'),
    ...walk(path.join(root, 'layout')).filter((file) => path.extname(file) === '.liquid'),
    ...walk(path.join(root, 'sections')).filter((file) => path.basename(file).startsWith('docked-')),
    ...walk(path.join(root, 'snippets')).filter((file) => path.basename(file).startsWith('docked-')),
  ];
  const integrated = [
    'config/settings_data.json',
    'sections/contact-form.liquid',
    'sections/footer.liquid',
    'sections/header-group.json',
    'sections/header.liquid',
    'sections/main-404.liquid',
    'sections/main-cart-footer.liquid',
    'sections/main-password-footer.liquid',
    'sections/main-password-header.liquid',
    'sections/main-product.liquid',
    'snippets/buy-buttons.liquid',
    'snippets/card-product.liquid',
    'snippets/cart-drawer.liquid',
    'snippets/cart-notification.liquid',
  ].map((file) => path.join(root, file));
  return [...new Set([...explicit, ...integrated])].filter((file) => fs.existsSync(file));
}

export function auditCopy(root = THEME_ROOT) {
  const findings = [];
  const legacyPatterns = [
    /\bknow before you apply\b/i,
    /\bborrowing power\b/i,
    /\brepayment calculator\b/i,
    /\brefinanc(?:e|ing)\b/i,
    /\bbank statements?\b/i,
    /\bloan applications?\b/i,
    /\bmortgage brokers?\b/i,
    /\blender referrals?\b/i,
    /\bfinance calculator\b/i,
    /\bfinance\b/i,
    /\bloans?\b/i,
    /\bbrokers?\b/i,
    /\blenders?\b/i,
    /\bborrow(?:er|ers|ing)?\b/i,
    /\brepayments?\b/i,
    /\baffordability\b/i,
  ];
  const urgencyPatterns = [
    /\blimited time\b/i,
    /\bhurry\b/i,
    /\bact now\b/i,
    /\bselling fast\b/i,
    /\bonly\s+\d+\s+(?:left|remaining)\b/i,
    /\bends? (?:today|soon|tonight)\b/i,
  ];
  const unsupportedClaimPatterns = [
    /\bbest[- ]selling\b/i,
    /\bmarket[- ]leading\b/i,
    /\b(?:the )?safest\b/i,
    /\b100% (?:safe|waterproof|guaranteed)\b/i,
    /\bguaranteed results?\b/i,
    /\b(?:4\.[0-9]|5(?:\.0)?)\s*(?:\/\s*5|stars?)\b/i,
    /\b\d{2,}\+?\s+(?:verified\s+)?reviews?\b/i,
    /\b160\s*kg\b/i,
    /\b(?:30|90)[- ]?minutes?\b/i,
    /\b(?:46|66)\s*w\b/i,
    /\b1\.6\s*m\/s\b/i,
    /\b5(?:\.0)?\s*kph\b/i,
  ];

  for (const file of copyAuditFiles(root)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [category, patterns] of [
      ['legacy finance copy', legacyPatterns],
      ['fake urgency', urgencyPatterns],
      ['unsupported claim or social proof', unsupportedClaimPatterns],
    ]) {
      for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match) {
          const line = source.slice(0, match.index).split('\n').length;
          findings.push({ category, file: normalise(file, root), line, match: match[0] });
        }
      }
    }

    for (const [index, line] of source.split('\n').entries()) {
      const ingressClaim = line.match(/\b(?:waterproof|water[- ]resistant|IPX\d)\b/i);
      const cautionaryContext = /\b(?:do not claim|never (?:claim|describe)|unless evidence|until .*evidence|confirm exactly which)\b/i.test(line);
      if (ingressClaim && !cautionaryContext) {
        findings.push({
          category: 'ungated water-ingress claim',
          file: normalise(file, root),
          line: index + 1,
          match: ingressClaim[0],
        });
      }
    }
  }

  const configuredTemplates = walk(path.join(root, 'templates')).filter((file) => path.extname(file) === '.json');
  for (const file of configuredTemplates) {
    const source = fs.readFileSync(file, 'utf8');
    if (/"show_rating"\s*:\s*true/i.test(source)) {
      findings.push({
        category: 'unapproved reviews',
        file: normalise(file, root),
        line: source.slice(0, source.search(/"show_rating"\s*:\s*true/i)).split('\n').length,
        match: '"show_rating": true',
      });
    }
  }
  return findings;
}

function validateCopy(root, report) {
  const findings = auditCopy(root);
  addCheck(
    report,
    findings.length === 0,
    'copy.clean',
    'Configured storefront copy contains no legacy finance language, fake urgency, fabricated reviews or unresolved supplier performance claims',
    findings,
  );
  report.stats.copyFiles = copyAuditFiles(root).length;
}

function validateCatalogue(root, report) {
  const cataloguePath = path.join(root, 'data', 'draft-product-catalogue.csv');
  addCheck(report, fs.existsSync(cataloguePath), 'catalogue.exists', 'Draft product catalogue CSV exists');
  if (!fs.existsSync(cataloguePath)) return;

  let products;
  try {
    products = parseCsv(fs.readFileSync(cataloguePath, 'utf8'));
  } catch (error) {
    addCheck(report, false, 'catalogue.parse', 'Draft product catalogue CSV parses', error.message);
    return;
  }
  addCheck(report, true, 'catalogue.parse', 'Draft product catalogue CSV parses');
  const statuses = products.map((product) => product['Product status']);
  const activeCount = statuses.filter((status) => status.trim().toLowerCase() === 'active').length;
  const draftCount = statuses.filter((status) => status.trim().toLowerCase() === 'draft').length;
  addCheck(
    report,
    products.length === 1 && draftCount === 1 && activeCount === 0,
    'catalogue.draft-only',
    'Catalogue contains one Draft product and 0 Active products',
    { rows: products.length, draft: draftCount, active: activeCount },
  );

  const actualNames = products.map((product) => product['Product title']);
  const missingProducts = EXPECTED_PRODUCTS.filter((product) => !actualNames.includes(product));
  const duplicateHandles = products
    .map((product) => product.Handle)
    .filter((handle, index, handles) => handle && handles.indexOf(handle) !== index);
  addCheck(
    report,
    missingProducts.length === 0 && new Set(actualNames).size === 1 && duplicateHandles.length === 0,
    'catalogue.range',
    'Catalogue contains only the selected Docked Cruise D2 concept with a unique handle',
    { missingProducts, duplicateHandles: [...new Set(duplicateHandles)] },
  );

  const selectedProduct = products.find((product) => product['Product title'] === 'Docked Cruise D2');
  addCheck(
    report,
    selectedProduct &&
      selectedProduct.SKU === '' &&
      selectedProduct.Supplier === '' &&
      selectedProduct.Stock === '' &&
      /30 versus 90 minute runtime/i.test(selectedProduct.Notes) &&
      /46 versus 66 W/i.test(selectedProduct.Notes) &&
      /No 160 kg load test was received/i.test(selectedProduct.Notes) &&
      /blocked|under review/i.test(selectedProduct['Compliance status']),
    'catalogue.single-product-evidence-gate',
    'Selected lounger remains Draft with commercial identifiers blank and conflicting claims explicitly blocked',
  );
  report.stats.catalogueRows = products.length;
  report.stats.draftProducts = draftCount;
  report.stats.activeProducts = activeCount;
}

function validatePricingCalculator(root, report) {
  const calculatorPath = path.join(root, 'data', 'pricing-calculator.csv');
  addCheck(report, fs.existsSync(calculatorPath), 'pricing.exists', 'Single-product pricing calculator CSV exists');
  if (!fs.existsSync(calculatorPath)) return;

  let rows;
  try {
    rows = parseCsv(fs.readFileSync(calculatorPath, 'utf8'));
  } catch (error) {
    addCheck(report, false, 'pricing.parse', 'Pricing calculator CSV parses', error.message);
    return;
  }
  addCheck(report, true, 'pricing.parse', 'Pricing calculator CSV parses');

  const row = rows[0];
  const formulaValues = row ? Object.values(row).filter((value) => value.startsWith('=')) : [];
  const nonLocalReferences = formulaValues.flatMap((formula) => formula.match(/\b[A-Q](?:[3-9]|[1-9][0-9]+)\b/g) ?? []);
  addCheck(
    report,
    rows.length === 1 &&
      row?.named_sku === 'Docked Cruise D2' &&
      row?.draft_retail_price_inc_gst_aud === '649' &&
      row?.landed_product_cost_ex_gst_aud === '' &&
      row?.owner_approval === 'Pending' &&
      formulaValues.length === 8 &&
      nonLocalReferences.length === 0,
    'pricing.single-product-guarded',
    'Pricing calculator contains one pending D2 row with blank landed cost and row-2-local guarded formulas',
    { rows: rows.length, formulaCount: formulaValues.length, nonLocalReferences },
  );
  report.stats.pricingRows = rows.length;
}

function validateShopifyDraftImport(root, report) {
  const importPath = path.join(root, 'data', 'shopify-draft-products-import.csv');
  addCheck(report, fs.existsSync(importPath), 'shopify-import.exists', 'Shopify Draft product import CSV exists');
  if (!fs.existsSync(importPath)) return;

  const audit = auditShopifyDraftProductImport(fs.readFileSync(importPath, 'utf8'));
  addCheck(
    report,
    audit.parseError === null,
    'shopify-import.parse',
    'Shopify Draft product import CSV parses',
    audit.parseError ?? undefined,
  );
  if (audit.parseError !== null) return;

  addCheck(
    report,
    audit.safeSchema,
    'shopify-import.safe-schema',
    'Shopify import uses only the exact eight non-commercial Draft-shell columns',
    {
      expectedHeaders: SHOPIFY_DRAFT_IMPORT_HEADERS,
      actualHeaders: audit.headers,
      invalidRowWidths: audit.invalidRowWidths,
    },
  );
  addCheck(
    report,
    audit.plannedConcepts,
    'shopify-import.planned-concepts',
    'Shopify import contains only the selected Docked Cruise D2 Draft-shell tuple',
    {
      rows: audit.rows,
      missingConcepts: audit.missingConcepts,
      unexpectedConcepts: audit.unexpectedConcepts,
      duplicateConcepts: audit.duplicateConcepts,
    },
  );
  addCheck(
    report,
    audit.lockFailures.length === 0,
    'shopify-import.draft-locks',
    'Every Shopify import row is unpublished Draft status with an unverified vendor and Default Title option only',
    { lockFailures: audit.lockFailures },
  );
  report.stats.shopifyImportRows = audit.rows;
  report.stats.shopifyImportDraftProducts = audit.rows - audit.lockFailures.filter(({ fields }) => fields.includes('Status')).length;
}

function findSetting(value, id) {
  if (!value || typeof value !== 'object') return undefined;
  if (value.id === id) return value;
  for (const child of Object.values(value)) {
    const found = findSetting(child, id);
    if (found) return found;
  }
  return undefined;
}

function findValuesForKey(value, key, result = []) {
  if (!value || typeof value !== 'object') return result;
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === key) result.push(child);
    findValuesForKey(child, key, result);
  }
  return result;
}

function validatePrelaunchLocks(root, report) {
  const schema = getJson(root, 'config/settings_schema.json');
  const schemaSetting = findSetting(schema, 'prelaunch_mode');
  const settingsData = getJson(root, 'config/settings_data.json');
  const configuredPrelaunch = findValuesForKey(settingsData, 'prelaunch_mode');
  addCheck(
    report,
    schemaSetting?.type === 'checkbox' && schemaSetting.default === true && configuredPrelaunch.includes(true),
    'prelaunch.enabled',
    'Prelaunch mode defaults to true and is enabled in the supplied theme settings',
  );

  const templates = walk(path.join(root, 'templates'))
    .filter((file) => path.extname(file) === '.json')
    .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  const quickAddValues = templates.flatMap((template) => findValuesForKey(template, 'quick_add'));
  const ratingValues = templates.flatMap((template) => findValuesForKey(template, 'show_rating'));
  const inventoryThresholds = templates.flatMap((template) => findValuesForKey(template, 'inventory_threshold'));
  const inventoryQuantities = templates.flatMap((template) => findValuesForKey(template, 'show_inventory_quantity'));
  addCheck(
    report,
    quickAddValues.every((value) => value === 'none') &&
      ratingValues.every((value) => value === false) &&
      inventoryThresholds.every((value) => value === 0) &&
      inventoryQuantities.every((value) => value === false),
    'prelaunch.safe-template-settings',
    'Configured templates disable quick add, ratings, low-stock thresholds and exact inventory quantities',
    { quickAddValues, ratingValues, inventoryThresholds, inventoryQuantities },
  );

  const sources = {
    buyButtons: read(root, 'snippets/buy-buttons.liquid'),
    sticky: read(root, 'snippets/docked-sticky-add-to-cart.liquid'),
    card: read(root, 'snippets/card-product.liquid'),
    cartDrawer: read(root, 'snippets/cart-drawer.liquid'),
    cartNotification: read(root, 'snippets/cart-notification.liquid'),
    cartPage: read(root, 'sections/main-cart-footer.liquid'),
    mainProduct: read(root, 'sections/main-product.liquid'),
    featuredProduct: read(root, 'sections/featured-product.liquid'),
    theme: read(root, 'layout/theme.liquid'),
  };
  const installmentFailures = Object.entries({
    'sections/main-product.liquid': sources.mainProduct,
    'sections/featured-product.liquid': sources.featuredProduct,
  }).flatMap(([file, source]) =>
    occurrenceConditionFailures(source, /form\s*\|\s*payment_terms/g, ({ operation, condition }) =>
      (operation === 'if' && /settings\.prelaunch_mode\s*==\s*false/.test(condition)) ||
      (operation === 'unless' && /^settings\.prelaunch_mode$/.test(condition)),
    ).map((failure) => ({ file, ...failure })),
  );
  const sourceLocks = [
    ['buy button disables', sources.buyButtons.includes('if settings.prelaunch_mode') && sources.buyButtons.includes('disabled')],
    ['dynamic checkout suppresses', sources.buyButtons.includes('settings.prelaunch_mode == false') && sources.buyButtons.includes('form | payment_button')],
    ['sticky add button disables', sources.sticky.includes('if settings.prelaunch_mode') && sources.sticky.includes('disabled')],
    ['card direct add disables', sources.card.includes('if settings.prelaunch_mode or card_product.selected_or_first_available_variant.available == false')],
    ['cart drawer checkout disables', /settings\.prelaunch_mode\s+or\s+cart\s*==\s*empty/.test(sources.cartDrawer)],
    ['cart notification checkout disables', sources.cartNotification.includes('name="checkout"') && sources.cartNotification.includes('if settings.prelaunch_mode')],
    ['cart page checkout disables', /settings\.prelaunch_mode\s+or\s+cart\s*==\s*empty/.test(sources.cartPage)],
    ['installment payment terms suppress', installmentFailures.length === 0],
    [
      'cart accelerated checkout suppresses',
      /if\s+additional_checkout_buttons\s+and\s+settings\.prelaunch_mode\s*==\s*false/.test(sources.cartPage) ||
        /if\s+settings\.prelaunch_mode\s*==\s*false\s+and\s+additional_checkout_buttons/.test(sources.cartPage),
    ],
    ['prelaunch status is prominent', sources.theme.includes('docked-prelaunch-banner') && sources.theme.includes('settings.prelaunch_mode')],
  ];
  const missingLocks = sourceLocks.filter(([, safe]) => !safe).map(([name]) => name);
  addCheck(
    report,
    missingLocks.length === 0,
    'prelaunch.purchase-locks',
    'Product, cart and accelerated-checkout purchase paths are locked during prelaunch',
    { missingLocks, installmentFailures },
  );
}

export function validateTheme(root = THEME_ROOT, options = {}) {
  const resolvedRoot = path.resolve(root);
  const report = {
    root: resolvedRoot,
    mode: options.copyOnly ? 'copy-only' : 'full',
    passed: [],
    errors: [],
    warnings: [],
    stats: {},
  };

  if (options.copyOnly) {
    validateCopy(resolvedRoot, report);
  } else {
    validateJsonAndSchemas(resolvedRoot, report);
    validateReferences(resolvedRoot, report);
    validateBrandIdentity(resolvedRoot, report);
    validateRoutesAndComposition(resolvedRoot, report);
    validateMerchandisingSurfaces(resolvedRoot, report);
    validateFinalAuditGates(resolvedRoot, report);
    validateMetafieldGates(resolvedRoot, report);
    validateCopy(resolvedRoot, report);
    validateCatalogue(resolvedRoot, report);
    validatePricingCalculator(resolvedRoot, report);
    validateShopifyDraftImport(resolvedRoot, report);
    validatePrelaunchLocks(resolvedRoot, report);
  }

  if (!fs.existsSync(path.join(resolvedRoot, '.shopifyignore'))) {
    addWarning(report, 'shopifyignore.missing', '.shopifyignore is missing; non-theme artefacts may be uploaded.');
  }
  report.ok = report.errors.length === 0;
  return report;
}

export function formatReport(report) {
  const lines = [`Docked theme validation (${report.mode})`, `Root: ${report.root}`];
  for (const item of report.passed) lines.push(`PASS ${item.code} - ${item.message}`);
  for (const item of report.errors) {
    lines.push(`FAIL ${item.code} - ${item.message}`);
    if (item.details !== undefined) lines.push(`  ${JSON.stringify(item.details)}`);
  }
  for (const item of report.warnings) {
    lines.push(`WARN ${item.code} - ${item.message}`);
    if (item.details !== undefined) lines.push(`  ${JSON.stringify(item.details)}`);
  }
  lines.push(`Result: ${report.ok ? 'PASS' : 'FAIL'} (${report.passed.length} passed, ${report.errors.length} failed, ${report.warnings.length} warnings)`);
  return lines.join('\n');
}

const invokedAsCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  const report = validateTheme(THEME_ROOT, { copyOnly: process.argv.includes('--copy-only') });
  console.log(formatReport(report));
  if (!report.ok) process.exitCode = 1;
}
