import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = process.cwd();
const requiredPages = [
  'index.html',
  'safety.html',
  'shipping-returns.html',
  'privacy.html',
  'terms.html',
  'contact.html',
  'warranty.html',
  'thank-you.html',
  '404.html',
];
const requiredFiles = [
  ...requiredPages,
  'CNAME',
  '.nojekyll',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'assets/css/styles.css',
  'assets/js/product-config.js',
  'assets/js/site.js',
  'assets/images/product/cruise-d2-pool-1200.webp',
  'assets/images/product/cruise-d2-pool-600.webp',
  'assets/images/product/cruise-d2-overview-1200.webp',
  'assets/images/product/cruise-d2-overview-600.webp',
  'assets/images/product/cruise-d2-controls-1200.webp',
  'assets/images/product/cruise-d2-controls-600.webp',
  'assets/images/product/cruise-d2-features.jpg',
  'assets/images/product/cruise-d2-social-1200.jpg',
  'docs/STATIC_SITE_ASSET_REGISTER.md',
  'docs/STATIC_PAYPAL_DEPLOYMENT.md',
  'docs/STATIC_PAYPAL_ROLLBACK.md',
];

const failures = [];
const checks = [];

function pass(name, detail) {
  checks.push({ name, detail });
}

function fail(name, detail) {
  failures.push({ name, detail });
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function sha256(relativePath) {
  return createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex').toUpperCase();
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|#39);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function evaluateProductConfig(source) {
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'assets/js/product-config.js' });
  return context.window.DOCKED_PRODUCT;
}

function assert(name, condition, detail) {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

const missing = requiredFiles.filter((file) => !exists(file));
assert('structure.required-files', missing.length === 0, missing.length ? `Missing: ${missing.join(', ')}` : `${requiredFiles.length} required files present`);

if (missing.length === 0) {
  assert('domain.cname', read('CNAME').trim() === 'docked.com.au', 'CNAME is docked.com.au');
  assert('pages.nojekyll', fs.statSync(path.join(root, '.nojekyll')).isFile(), '.nojekyll exists');

  const htmlByFile = new Map(requiredPages.map((file) => [file, read(file)]));
  const publicTextFiles = [
    ...requiredPages,
    'robots.txt',
    'sitemap.xml',
    'site.webmanifest',
    'assets/css/styles.css',
    'assets/js/product-config.js',
    'assets/js/site.js',
  ];
  const publicText = publicTextFiles.map((file) => `${file}\n${read(file)}`).join('\n').toLowerCase();

  const financeTerms = [
    'mortgage', 'loan', 'broker', 'borrowing', 'affordability', 'refinance',
    'lender', 'repayment', 'credit assistance', 'bank statement',
  ];
  const financeHits = financeTerms.filter((term) => publicText.includes(term));
  assert('content.no-finance-copy', financeHits.length === 0, financeHits.length ? `Found: ${financeHits.join(', ')}` : 'No legacy finance terms in public output');

  const shopifyHits = ['shopify', 'myshopify', 'shopifycdn', 'cdn.shopify'].filter((term) => publicText.includes(term));
  assert('content.no-shopify', shopifyHits.length === 0, shopifyHits.length ? `Found: ${shopifyHits.join(', ')}` : 'No Shopify references in public output');

  const placeholders = [
    'paste_the_real_paypal_payment_link_here',
    'paste_paypal_buy_button_embed_code_here',
    'real_paypal_payment_link',
    'todo', 'tbd', 'lorem ipsum',
  ];
  const placeholderHits = placeholders.filter((term) => publicText.includes(term));
  assert('checkout.no-placeholders', placeholderHits.length === 0, placeholderHits.length ? `Found: ${placeholderHits.join(', ')}` : 'No placeholder checkout or draft copy');

  const productImageHashes = new Map([
    ['assets/images/product/cruise-d2-pool-1200.webp', '20DF5BEB0C943D520B8046C0AECB17D91327C8B40D32E70B6CC86A3E53D62345'],
    ['assets/images/product/cruise-d2-pool-600.webp', 'CDE094AB9E31F36DFC94C97FF23C8B7BDAC0B0004C0592E5159BA636894E5ACA'],
    ['assets/images/product/cruise-d2-overview-1200.webp', '997C319C86592B570726D22B3B5B5AFFACD2EB4F0EBBB898FE2B13C21A914214'],
    ['assets/images/product/cruise-d2-overview-600.webp', '2657B7F06D570D7C2F60D8B345D095ECA10E728562CC563F3082F76F5EDF8BB2'],
    ['assets/images/product/cruise-d2-controls-1200.webp', '70A780E4E1F8BF0A13FB98F5B14B6D56EB8883125F6D241373B34C15D76F5340'],
    ['assets/images/product/cruise-d2-controls-600.webp', 'E5E6DA93DA8256346D8B5A86AF56490DA5472827BD2B33E0DC9EF92CB8986DD8'],
    ['assets/images/product/cruise-d2-social-1200.jpg', '852B87ACA39C0599C23EA7414892FE1B38362AADF262957A885CFF4AF601FAFF'],
  ]);
  const productImageDrift = [...productImageHashes].filter(([file, hash]) => sha256(file) !== hash).map(([file]) => file);
  assert('assets.product-media', productImageDrift.length === 0, productImageDrift.length ? `Unexpected product-media bytes: ${productImageDrift.join(', ')}` : 'Seven approved supplier-image derivatives match the asset register');

  const featureImagePath = 'assets/images/product/cruise-d2-features.jpg';
  const featureImage = fs.readFileSync(path.join(root, featureImagePath));
  const isJfifJpeg = featureImage.length > 10_000 &&
    featureImage[0] === 0xff && featureImage[1] === 0xd8 &&
    featureImage.subarray(0, 64).includes(Buffer.from('JFIF\0', 'ascii')) &&
    featureImage.at(-2) === 0xff && featureImage.at(-1) === 0xd9;
  assert('assets.feature-image-format', isJfifJpeg, `${featureImagePath} uses a .jpg extension and valid JPEG/JFIF bytes`);
  const approvedFeatureHash = '3BA244A638F4B9A0A612A6A01AD98D9B940BFCF8B2881593F3F76D272835A523';
  assert(
    'assets.feature-image-approved-derivative',
    sha256(featureImagePath) === approvedFeatureHash,
    'Feature image matches the registered text-redacted supplier derivative',
  );

  const index = htmlByFile.get('index.html');
  const config = read('assets/js/product-config.js');
  const siteScript = read('assets/js/site.js');
  let productConfig;
  try {
    productConfig = evaluateProductConfig(config);
    pass('product.config-parses', 'Product configuration evaluates without browser-only side effects');
  } catch (error) {
    fail('product.config-parses', error.message);
    productConfig = {};
  }
  const checkoutEnabled = productConfig?.checkoutEnabled === true;
  const publicClientId = productConfig?.paypal?.clientId ?? '';
  const hostedButtonId = productConfig?.paypal?.hostedButtonId ?? '';
  const runtimeFilesWithoutConfig = [...requiredPages, 'assets/js/site.js'].map((file) => read(file)).join('\n');
  const paypalSdkInHtml = (requiredPages.map((file) => read(file)).join('\n').match(/https:\/\/www\.paypal\.com\/sdk\/js/gi) ?? []).length;
  const neutralCheckoutRoots = (index.match(/id=["']paypal-checkout-root["']/g) ?? []).length;
  const neutralCheckoutMarkers = (index.match(/\bdata-paypal-checkout-root\b/g) ?? []).length;
  const literalClientIdOutsideConfig = publicClientId ? runtimeFilesWithoutConfig.includes(publicClientId) : false;
  const literalHostedIdOutsideConfig = hostedButtonId ? runtimeFilesWithoutConfig.includes(hostedButtonId) : false;
  if (checkoutEnabled) {
    assert(
      'checkout.hosted-button',
      publicClientId.length >= 40 && hostedButtonId.length >= 8 &&
        paypalSdkInHtml === 0 && neutralCheckoutRoots === 1 && neutralCheckoutMarkers === 1 &&
        !literalClientIdOutsideConfig && !literalHostedIdOutsideConfig &&
        /https:\/\/www\.paypal\.com\/sdk\/js/.test(siteScript) &&
        /\.clientId\b/.test(siteScript) && /\.hostedButtonId\b/.test(siteScript) &&
        /hosted-buttons/.test(siteScript) && /paypal\.HostedButtons/.test(siteScript),
      `Config-owned PayPal hosted-button mode: client=${publicClientId ? 'set' : 'missing'}, button=${hostedButtonId ? 'set' : 'missing'}, neutral root=${neutralCheckoutRoots}, SDK tags in HTML=${paypalSdkInHtml}`,
    );
  } else {
    const paypalSource = publicTextFiles.map(read).join('\n');
    assert(
      'checkout.fail-closed',
      paypalSdkInHtml === 0 && !/paypal\.HostedButtons|paypal-container-|paypalobjects\.com/i.test(paypalSource) &&
        publicClientId === '' && hostedButtonId === '',
      'Checkout disabled: no PayPal URL, SDK, hosted-button ID, container, form, iframe, or credentials',
    );
  }

  const purchaseControlIssues = [];
  const purchaseCtas = [];
  for (const match of index.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = match[1];
    const text = visibleText(match[2]);
    const href = attrs.match(/\bhref=["']([^"']*)["']/i)?.[1] ?? '';
    const marked = /\bdata-buy-cta\b/i.test(attrs);
    const soundsLikePurchase = /\b(?:buy|order|get)\b/i.test(text) && /\b(?:cruise d2|now|checkout)\b/i.test(text);
    if (marked) {
      purchaseCtas.push(text);
      if (href !== '#checkout') purchaseControlIssues.push(`data-buy-cta "${text}" targets ${href || '(missing href)'}`);
    }
    if (soundsLikePurchase && (!marked || href !== '#checkout')) purchaseControlIssues.push(`purchase CTA "${text}" must be a[data-buy-cta][href="#checkout"]`);
    if (/href=["'](?:#|javascript:|\s*)["']/i.test(match[0]) && /\b(?:buy|order|pay)\b/i.test(text)) purchaseControlIssues.push(`fake purchase control "${text}"`);
  }
  assert(
    'checkout.purchase-ctas',
    purchaseCtas.length >= 4 && purchaseControlIssues.length === 0 && /\bid=["']checkout["']/.test(index),
    purchaseControlIssues.length ? purchaseControlIssues.join('; ') : `${purchaseCtas.length} purchase CTAs share #checkout and the checkout target exists`,
  );

  assert('product.config', productConfig?.name === 'Docked Cruise D2' && Number(productConfig?.price) === 649 && productConfig?.currency === 'AUD', 'Config identifies Docked Cruise D2 at A$649 AUD');
  assert('product.checkout-mode', checkoutEnabled ? publicClientId.length >= 40 && hostedButtonId.length >= 8 : productConfig?.checkoutEnabled === false, checkoutEnabled ? 'Exactly one checkout mode is configured: PayPal hosted button' : 'Checkout is explicitly disabled');

  assert(
    'product.checkout-copy',
    checkoutEnabled
      ? /handled securely by PayPal/i.test(index) && /does not collect card details/i.test(index)
      : index.includes('Online ordering is not yet available.'),
    checkoutEnabled ? 'Hosted-checkout and card-data disclosures are visible' : 'Ordering-unavailable notice is visible',
  );
  assert(
    'shipping.owner-approved-offer',
    /market\s*:\s*['"]Worldwide['"]/.test(config) &&
      index.includes('Free worldwide shipping') &&
      read('shipping-returns.html').includes('Free standard shipping is included worldwide'),
    'Worldwide market and free-shipping wording match the owner-approved offer',
  );
  const checkoutSection = index.slice(index.search(/<section\b[^>]*\bid=["']checkout["']/i), index.indexOf('</section>', index.search(/<section\b[^>]*\bid=["']checkout["']/i)) + 10);
  const conciseAdultWarning = /18\+/i.test(checkoutSection) && /competent swimmers/i.test(checkoutSection) && /calm, controlled swimming pools/i.test(checkoutSection) && /not a life-saving device/i.test(checkoutSection);
  assert('product.adult-warning', conciseAdultWarning && (index.match(/18\+/g) ?? []).length === 1, 'One concise adult-use safety notice is visible near checkout');
  assert('product.price-target', /data-product-price/.test(index), 'Homepage exposes the single configured price target');
  assert(
    'content.product-first',
    /cruise-d2-pool-1200\.webp/.test(index) && /cruise-d2-overview-1200\.webp/.test(index) && /cruise-d2-controls-1200\.webp/.test(index) &&
      /cruise-d2-features\.jpg/.test(index) && /\bdata-cruise-d2-feature-image\b/.test(index) &&
      !/unverified performance|original brand illustrations|the Docked approach|confirmed before dispatch/i.test(publicText),
    'Homepage uses the registered product media and feature image with no internal compliance-preview copy',
  );

  const configurationText = JSON.stringify(productConfig ?? {});
  const marketingText = `${visibleText(index)} ${configurationText} ${read('site.webmanifest')}`;
  const confirmedClaimPatterns = [
    /\bmotorised\s+(?:inflatable\s+)?(?:water|pool)\s+lounger\b/i,
    /\bup to 5\s*km\/h\b/i,
    /\b160\s*kg\b/i,
    /\belectric\s+propulsion\b/i,
    /\bdual[- ]joystick\b/i,
    /\bcup holders?\b/i,
    /\bsupportive\s+headrest\b/i,
  ];
  const missingConfirmedClaims = confirmedClaimPatterns.filter((pattern) => !pattern.test(marketingText)).map(String);
  assert('claims.confirmed-product', missingConfirmedClaims.length === 0, missingConfirmedClaims.length ? `Missing confirmed Cruise D2 facts: ${missingConfirmedClaims.join(', ')}` : 'Motorised lounger identity and six confirmed product facts are present');

  const wrongProductPatterns = [
    /\b(?:inflatable\s+)?floating\s+(?:dock|platform)\b/i,
    /\bprivate\s+deck\b/i,
    /\b(?:beside|attach(?:ed|es|ing)?\s+to)\s+(?:a|the)\s+boat\b/i,
    /\b(?:boat|boating|beach|ocean|surf)\s+(?:use|ready|days?|setup|accessory)\b/i,
    /\b(?:swim|dive|board)\s+from\s+(?:it|the\s+(?:dock|platform|deck))\b/i,
  ];
  const wrongProductHits = wrongProductPatterns.filter((pattern) => pattern.test(marketingText)).map(String);
  assert('claims.not-a-floating-dock', wrongProductHits.length === 0, wrongProductHits.length ? `Wrong-product positioning: ${wrongProductHits.join(', ')}` : 'Cruise D2 is not marketed as a dock, deck, boat accessory, beach product, or floating platform');

  const unsafeMarketingPatterns = [
    /\bsafe\b/i,
    /\bunsinkable\b/i,
    /\b(?:ocean|surf|boating)\b/i,
    /\bwaterproof\s+(?:electronics?|electrical|motor|battery|controller?|controls?)\b/i,
    /\bmarine[- ]certified\b/i,
    /\bcoast\s+guard\b/i,
    /\baustralian\s+standards?\b/i,
    /\bpuncture[- ]proof\b/i,
    /\bcommercial[- ]grade\b/i,
    /\ball[- ]day\b/i,
    /\blong[- ]range\b/i,
    /\bcompletely\s+stable\b/i,
    /\b(?:in stock|low stock|only \d+ left|compare-at|was a\$|save \d+%)\b/i,
  ];
  const unsafeMarketingHits = unsafeMarketingPatterns.filter((pattern) => pattern.test(marketingText)).map(String);
  assert('claims.no-unsafe-marketing', unsafeMarketingHits.length === 0, unsafeMarketingHits.length ? `Unsafe or unsupported marketing: ${unsafeMarketingHits.join(', ')}` : 'No safety, marine, open-water, durability, range, stability, urgency, or stock claims');

  const capacitySafetyPatterns = [
    /160\s*kg.{0,100}\b(?:safe|safety|stable|stability|strength|certified|approved|tested)\b/is,
    /\b(?:safe|safety|stable|stability|strength|certified|approved|tested)\b.{0,100}160\s*kg/is,
  ];
  const capacitySafetyHits = capacitySafetyPatterns.filter((pattern) => pattern.test(marketingText)).map(String);
  assert('claims.capacity-not-safety-proof', capacitySafetyHits.length === 0, capacitySafetyHits.length ? 'The 160 kg capacity is presented as evidence of safety, stability, strength, testing, certification, or approval' : 'The 160 kg capacity is stated without turning it into a safety claim');

  const specifications = Array.isArray(productConfig?.specifications) ? productConfig.specifications : [];
  const hasNullSpecification = specifications.some((specification) => specification?.value === null);
  const nullFilterContract = /specifications(?:\s*\?\?\s*\[\])?\.filter\([\s\S]{0,320}?(?:\.value\s*!={1,2}\s*null|nonEmptyString\([^)]*\.value\))/i.test(siteScript);
  assert(
    'product.null-specifications-hidden',
    specifications.length >= 2 && hasNullSpecification && nullFilterContract && /\bdata-product-specifications\b/.test(index) && !/>\s*(?:null|undefined|tbd)\s*</i.test(index),
    'Product configuration retains null placeholders while site.js filters them from the specifications UI',
  );

  const featureImageTag = index.match(/<img\b(?=[^>]*\bdata-cruise-d2-feature-image\b)[^>]*>/i)?.[0] ?? '';
  const featureImageRules = [...read('assets/css/styles.css').matchAll(/[^{}]*\[data-cruise-d2-feature-image\][^{]*\{([^}]*)\}/gi)].map((match) => match[1]).join('\n');
  const featureImageResponsive = /src=["']\/assets\/images\/product\/cruise-d2-features\.jpg["']/i.test(featureImageTag) &&
    /\bwidth=["']\d+["']/i.test(featureImageTag) && /\bheight=["']\d+["']/i.test(featureImageTag) && /\balt=["'][^"']+["']/i.test(featureImageTag) &&
    /object-fit\s*:\s*contain/i.test(featureImageRules) && /width\s*:\s*100%/i.test(featureImageRules) &&
    /max-width\s*:\s*100%/i.test(featureImageRules) && /height\s*:\s*auto/i.test(featureImageRules) &&
    !/object-fit\s*:\s*cover|object-position\s*:|clip-path\s*:/i.test(featureImageRules);
  const horizontalMasking = /\bwidth\s*:\s*100vw\b|overflow-x\s*:\s*(?:hidden|clip)\b/i.test(read('assets/css/styles.css'));
  assert('assets.feature-image-no-crop', featureImageResponsive, 'Feature image uses its canonical JPEG, intrinsic dimensions, useful alt text, contain sizing, and responsive width without cropping');
  assert('css.no-horizontal-scroll-masking', !horizontalMasking, 'CSS avoids 100vw overflow and does not hide or clip horizontal overflow');

  const hasTruthfulProductSchema = /["']@type["']\s*:\s*["']Product["']/i.test(siteScript) &&
    /["']@type["']\s*:\s*["']Offer["']/i.test(siteScript) &&
    /priceCurrency\s*:\s*product\.currency/i.test(siteScript) && /price\s*:\s*String\(price\)/i.test(siteScript);
  const unsupportedSchemaFields = [
    'availability', 'inventoryLevel', 'aggregateRating', 'review', 'shippingDetails',
    'hasMerchantReturnPolicy', 'warranty', 'priceValidUntil',
  ].filter((field) => new RegExp(`\\b${field}\\s*:`, 'i').test(siteScript));
  assert(
    'seo.truthful-product-schema',
    hasTruthfulProductSchema && unsupportedSchemaFields.length === 0,
    unsupportedSchemaFields.length ? `Unsupported schema fields: ${unsupportedSchemaFields.join(', ')}` : 'Product/Offer schema is limited to configured identity, images, URL, price, and currency',
  );

  const linkProblems = [];
  const fragmentProblems = [];
  for (const [file, html] of htmlByFile) {
    const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]));
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      const target = match[1].trim();
      if (!target || /^(?:https?:|mailto:|tel:|data:)/i.test(target)) continue;
      if (target.startsWith('#')) {
        if (!ids.has(target.slice(1))) fragmentProblems.push(`${file} -> ${target}`);
        continue;
      }
      const [relativeTarget, fragment] = target.split('#');
      const cleanTarget = relativeTarget.split('?')[0];
      const rootRelative = cleanTarget.startsWith('/');
      const localTarget = rootRelative ? cleanTarget.replace(/^\/+/, '') || 'index.html' : cleanTarget;
      const resolved = rootRelative
        ? path.resolve(root, localTarget)
        : path.resolve(root, path.dirname(file), localTarget);
      const relativeResolved = path.relative(root, resolved);
      if (relativeResolved.startsWith('..') || path.isAbsolute(relativeResolved) || !fs.existsSync(resolved)) {
        linkProblems.push(`${file} -> ${target}`);
        continue;
      }
      if (fragment && (path.extname(localTarget).toLowerCase() === '.html' || localTarget === 'index.html')) {
        const linkedHtml = fs.readFileSync(resolved, 'utf8');
        if (!new RegExp(`\\bid=["']${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(linkedHtml)) fragmentProblems.push(`${file} -> ${target}`);
      }
    }
  }
  assert('links.resolved', linkProblems.length === 0, linkProblems.length ? linkProblems.join('; ') : 'All local href/src references resolve');
  assert('links.fragments', fragmentProblems.length === 0, fragmentProblems.length ? fragmentProblems.join('; ') : 'All local fragments resolve');

  const pageIssues = [];
  const canonicalUrls = new Set();
  for (const [file, html] of htmlByFile) {
    if (!/<html\b[^>]*lang=["']en-AU["']/i.test(html)) pageIssues.push(`${file}: missing lang=en-AU`);
    if (!/<meta\b[^>]*name=["']viewport["']/i.test(html)) pageIssues.push(`${file}: missing viewport`);
    if ((html.match(/<h1\b/gi) ?? []).length !== 1) pageIssues.push(`${file}: expected exactly one h1`);
    if (!/<main\b/i.test(html)) pageIssues.push(`${file}: missing main landmark`);
    if (!/<a\b[^>]*class=["'][^"']*skip-link/i.test(html)) pageIssues.push(`${file}: missing skip link`);
    if (!/\bdata-menu-toggle\b/i.test(html) || !/\bdata-site-nav\b/i.test(html)) pageIssues.push(`${file}: mobile navigation contract incomplete`);
    if (!/href=["']\/?contact\.html["']/i.test(html)) pageIssues.push(`${file}: missing Contact route link`);
    if (!/href=["']\/?warranty\.html["']/i.test(html)) pageIssues.push(`${file}: missing Warranty route link`);
    const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
    if (!canonical?.startsWith('https://docked.com.au')) pageIssues.push(`${file}: invalid/missing canonical`);
    else canonicalUrls.add(canonical);
    if (/<form\b/i.test(html)) pageIssues.push(`${file}: form found on static no-backend site`);
    for (const image of html.matchAll(/<img\b([^>]*)>/gi)) {
      const attrs = image[1];
      if (!/\bwidth=["']\d+["']/i.test(attrs) || !/\bheight=["']\d+["']/i.test(attrs)) pageIssues.push(`${file}: image lacks intrinsic dimensions`);
      if (!/\balt=["'][^"']*["']/i.test(attrs)) pageIssues.push(`${file}: image lacks alt`);
    }
  }
  assert('html.semantic-baseline', pageIssues.length === 0, pageIssues.length ? pageIssues.join('; ') : `${requiredPages.length} pages meet the semantic baseline`);
  assert('seo.unique-canonicals', canonicalUrls.size === requiredPages.length, `${canonicalUrls.size}/${requiredPages.length} unique canonical URLs`);
  assert('seo.thank-you-noindex', /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(htmlByFile.get('thank-you.html')), 'Thank-you page is noindex');

  const manifest = JSON.parse(read('site.webmanifest'));
  assert('pwa.manifest', manifest.name === 'Docked' && manifest.start_url === '/', 'Manifest parses with Docked root start URL');
  const sitemap = read('sitemap.xml');
  const sitemapMissing = requiredPages.filter((file) => !['thank-you.html', '404.html'].includes(file) && !sitemap.includes(`https://docked.com.au/${file === 'index.html' ? '' : file}`));
  assert('seo.sitemap', sitemapMissing.length === 0, sitemapMissing.length ? `Missing sitemap URLs: ${sitemapMissing.join(', ')}` : 'Public pages are represented in sitemap');

  const scripts = ['assets/js/product-config.js', 'assets/js/site.js'];
  for (const script of scripts) {
    try {
      new Function(read(script));
      pass(`javascript.syntax.${path.basename(script)}`, 'JavaScript parses');
    } catch (error) {
      fail(`javascript.syntax.${path.basename(script)}`, error.message);
    }
  }

  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /(?:client_secret|api[_-]?key|access[_-]?token|password)\s*[:=]\s*["'][^"']{8,}["']/i,
    /https?:\/\/[^\s/@:]+:[^\s/@]+@/,
  ];
  const candidatePaths = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', '.codex-remote-attachments'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else candidatePaths.push(absolute);
    }
  }
  walk(root);
  const secretHits = [];
  for (const absolute of candidatePaths) {
    const buffer = fs.readFileSync(absolute);
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    if (secretPatterns.some((pattern) => pattern.test(text))) secretHits.push(path.relative(root, absolute));
  }
  assert('security.secret-scan', secretHits.length === 0, secretHits.length ? `Potential secrets: ${secretHits.join(', ')}` : `${candidatePaths.length} text-file candidates scanned; no high-confidence secret pattern found`);
}

for (const check of checks) console.log(`PASS ${check.name}: ${check.detail}`);
for (const failure of failures) console.error(`FAIL ${failure.name}: ${failure.detail}`);
console.log(`\nStatic site validation: ${checks.length} passed, ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
