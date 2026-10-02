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
  'assets/images/product/cruise-d2-lifestyle-man-1200.webp',
  'assets/images/product/cruise-d2-lifestyle-man-600.webp',
  'assets/images/product/cruise-d2-lifestyle-woman-1200.webp',
  'assets/images/product/cruise-d2-lifestyle-woman-600.webp',
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
  const customerFacingTextFiles = [
    ...requiredPages,
    'site.webmanifest',
    'assets/js/product-config.js',
    'assets/js/site.js',
  ];
  const customerFacingTextByFile = new Map(customerFacingTextFiles.map((file) => [file, read(file)]));

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

  const australianDollarPrefix = /A(?:\s|&nbsp;)*(?:\$|&#0*36;|&#x0*24;|&dollar;)/i;
  const stalePrice = /(?:\$\s*649\b|\b649\s*AUD\b|\bprice\s*:\s*649\b)/i;
  const obsoleteOfferLanguage = [];
  for (const [file, source] of customerFacingTextByFile) {
    if (australianDollarPrefix.test(source)) obsoleteOfferLanguage.push(`${file}: A$ prefix`);
    if (/\bworldwide\b/i.test(source)) obsoleteOfferLanguage.push(`${file}: worldwide`);
    if (stalePrice.test(source)) obsoleteOfferLanguage.push(`${file}: stale 649 price`);
  }
  assert(
    'content.current-price-shipping-language',
    obsoleteOfferLanguage.length === 0,
    obsoleteOfferLanguage.length
      ? `Remove obsolete customer-facing wording: ${obsoleteOfferLanguage.join('; ')}`
      : 'Public HTML, product configuration, runtime JavaScript, and manifest contain neither A$, worldwide, nor the stale 649 price',
  );

  const productImageHashes = new Map([
    ['assets/images/product/cruise-d2-pool-1200.webp', '20DF5BEB0C943D520B8046C0AECB17D91327C8B40D32E70B6CC86A3E53D62345'],
    ['assets/images/product/cruise-d2-pool-600.webp', 'CDE094AB9E31F36DFC94C97FF23C8B7BDAC0B0004C0592E5159BA636894E5ACA'],
    ['assets/images/product/cruise-d2-overview-1200.webp', '997C319C86592B570726D22B3B5B5AFFACD2EB4F0EBBB898FE2B13C21A914214'],
    ['assets/images/product/cruise-d2-overview-600.webp', '2657B7F06D570D7C2F60D8B345D095ECA10E728562CC563F3082F76F5EDF8BB2'],
    ['assets/images/product/cruise-d2-controls-1200.webp', '70A780E4E1F8BF0A13FB98F5B14B6D56EB8883125F6D241373B34C15D76F5340'],
    ['assets/images/product/cruise-d2-controls-600.webp', 'E5E6DA93DA8256346D8B5A86AF56490DA5472827BD2B33E0DC9EF92CB8986DD8'],
    ['assets/images/product/cruise-d2-lifestyle-man-1200.webp', 'F4000655664C9C191FA490741D69ED626B5DEA58AFCA31E6153A37FE5BAE5532'],
    ['assets/images/product/cruise-d2-lifestyle-man-600.webp', '3F6DCFE50254F91A1C17172DB90969C92C26DFC6E136DC2893E9D395687B0221'],
    ['assets/images/product/cruise-d2-lifestyle-woman-1200.webp', 'FFC9A0077793CE2AEE2FA310FCCC175581089695900B5F6EC4B111381F76E89B'],
    ['assets/images/product/cruise-d2-lifestyle-woman-600.webp', '1BD22C4389CE63B689AE22F6F1D7D579714D8669D9D32ED7BB30F50E921FF0FC'],
    ['assets/images/product/cruise-d2-social-1200.jpg', '852B87ACA39C0599C23EA7414892FE1B38362AADF262957A885CFF4AF601FAFF'],
  ]);
  const productImageDrift = [...productImageHashes].filter(([file, hash]) => sha256(file) !== hash).map(([file]) => file);
  assert('assets.product-media', productImageDrift.length === 0, productImageDrift.length ? `Unexpected product-media bytes: ${productImageDrift.join(', ')}` : 'Eleven approved supplier-image derivatives match their locked bytes');

  const featureImagePath = 'assets/images/product/cruise-d2-features.jpg';
  const featureImage = fs.readFileSync(path.join(root, featureImagePath));
  const isJfifJpeg = featureImage.length > 10_000 &&
    featureImage[0] === 0xff && featureImage[1] === 0xd8 &&
    featureImage.subarray(0, 64).includes(Buffer.from('JFIF\0', 'ascii')) &&
    featureImage.at(-2) === 0xff && featureImage.at(-1) === 0xd9;
  assert('assets.feature-image-format', isJfifJpeg, `${featureImagePath} uses a .jpg extension and valid JPEG/JFIF bytes`);
  const approvedFeatureHash = 'CBF4A3F9508F01A17732FC24853ECEDD1B99CFE3CD3A5BEB104023DDE8FE01A7';
  assert(
    'assets.feature-image-approved-derivative',
    sha256(featureImagePath) === approvedFeatureHash,
    'Feature image matches the registered text-redacted supplier derivative',
  );

  const assetRegister = read('docs/STATIC_SITE_ASSET_REGISTER.md');
  function hasNearbyProvenance(anchorPattern) {
    const matches = [...assetRegister.matchAll(new RegExp(anchorPattern.source, 'gi'))];
    return matches.some((match) => {
      const excerpt = assetRegister.slice(Math.max(0, match.index - 2500), match.index + match[0].length + 2500);
      return /gpt-image\s+v2\.0/i.test(excerpt) && /trainedAlgorithmicMedia/i.test(excerpt) && /C2PA/i.test(excerpt);
    });
  }
  const falseProvenanceStatements = [
    /Actual source encoding[^\n]*no embedded image metadata/i,
    /Neither PNG contains embedded image metadata/i,
  ].filter((pattern) => pattern.test(assetRegister)).map(String);
  const provenanceAnchors = [
    /cruise-d2-features\.jpg/i,
    /Man on Float\.png/i,
    /Girl on Float\.png/i,
  ];
  const missingProvenance = provenanceAnchors.filter((pattern) => !hasNearbyProvenance(pattern)).map(String);
  assert(
    'assets.ai-provenance-register',
    missingProvenance.length === 0 && falseProvenanceStatements.length === 0 &&
      /supplier(?:[- ]provided)?(?:\s+(?:product|lifestyle))?\s+illustrations?/i.test(assetRegister),
    missingProvenance.length || falseProvenanceStatements.length
      ? `Missing/contradictory C2PA provenance: missing=${missingProvenance.join(', ') || 'none'}; false statements=${falseProvenanceStatements.join(', ') || 'none'}`
      : 'Feature board and both lifestyle sources are explicitly registered as supplier-provided illustrations with C2PA gpt-image v2.0 / trainedAlgorithmicMedia provenance',
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
  const approvedPaypalClientFingerprint = '2679020198760B81224A5A742EA2574BCFEEDA85A11CBC84B3C638D2F2FB207F';
  const approvedPaypalButtonFingerprint = 'A83A02BEAA6ADD3FB65A29CBD09F0DAF7714AC8982161D804205147242274C1C';
  const paypalConfigurationUnchanged =
    createHash('sha256').update(publicClientId).digest('hex').toUpperCase() === approvedPaypalClientFingerprint &&
    createHash('sha256').update(hostedButtonId).digest('hex').toUpperCase() === approvedPaypalButtonFingerprint &&
    productConfig?.paypal?.components === 'hosted-buttons' && productConfig?.paypal?.disableFunding === 'venmo' &&
    productConfig?.currency === 'AUD';
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
  assert(
    'checkout.paypal-configuration-unchanged',
    checkoutEnabled && paypalConfigurationUnchanged,
    checkoutEnabled && paypalConfigurationUnchanged
      ? 'The approved PayPal client, hosted button, component, currency, and funding configuration is unchanged'
      : 'The approved PayPal hosted-button configuration has drifted',
  );

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

  assert('product.config', productConfig?.name === 'Docked Cruise D2' && Number(productConfig?.price) === 299 && productConfig?.currency === 'AUD', 'Config identifies Docked Cruise D2 at 299 AUD');
  assert('product.checkout-mode', checkoutEnabled ? publicClientId.length >= 40 && hostedButtonId.length >= 8 : productConfig?.checkoutEnabled === false, checkoutEnabled ? 'Exactly one checkout mode is configured: PayPal hosted button' : 'Checkout is explicitly disabled');

  assert(
    'product.checkout-copy',
    checkoutEnabled
      ? /handled securely by PayPal/i.test(index) && /does not collect card details/i.test(index)
      : index.includes('Online ordering is not yet available.'),
    checkoutEnabled ? 'Hosted-checkout and card-data disclosures are visible' : 'Ordering-unavailable notice is visible',
  );
  const priceTargets = [...index.matchAll(/<([a-z][a-z0-9]*)\b(?=[^>]*\bdata-product-price\b)[^>]*>([\s\S]*?)<\/\1>/gi)];
  const priceTargetValues = priceTargets.map((match) => visibleText(match[2]));
  const heroOffer = index.match(/<div\b[^>]*class=["'][^"']*\bhero-offer\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const primaryBuyCopy = purchaseCtas.filter((text) => /^Buy Cruise D2\b/i.test(text));
  assert(
    'product.price-presentation',
    priceTargets.length >= 3 && priceTargetValues.every((value) => value === '$299') &&
      visibleText(heroOffer) === '$299 AUD · Free shipping' && primaryBuyCopy.includes('Buy Cruise D2 — $299') &&
      /setText\(\s*["']\[data-product-price\]["']\s*,\s*["']\$["']\s*\+\s*audAmount\s*\)/.test(siteScript),
    `Price targets=${priceTargetValues.join(' | ') || '(none)'}; hero offer="${visibleText(heroOffer) || '(missing)'}"; primary CTA=${primaryBuyCopy.join(' | ') || '(missing)'}`,
  );
  assert(
    'shipping.owner-approved-offer',
    /\bFree shipping\b/i.test(index) && /\$299\s+AUD\b/i.test(read('shipping-returns.html')) && /\$299\s+AUD\b/i.test(read('terms.html')),
    'Homepage, shipping policy, and terms use the approved $299 AUD offer and “Free shipping” language',
  );
  const checkoutSection = index.slice(index.search(/<section\b[^>]*\bid=["']checkout["']/i), index.indexOf('</section>', index.search(/<section\b[^>]*\bid=["']checkout["']/i)) + 10);
  const conciseAdultWarning = /18\+/i.test(checkoutSection) && /competent swimmers/i.test(checkoutSection) && /calm, controlled swimming pools/i.test(checkoutSection) && /not a life-saving device/i.test(checkoutSection);
  assert('product.adult-warning', conciseAdultWarning && (index.match(/18\+/g) ?? []).length === 1, 'One concise adult-use safety notice is visible near checkout');
  assert('product.price-target', /data-product-price/.test(index), 'Homepage exposes the single configured price target');
  const headerEnd = index.search(/<\/header\s*>/i);
  const afterHeader = headerEnd >= 0 ? index.slice(headerEnd + index.slice(headerEnd).match(/^<\/header\s*>/i)?.[0].length) : '';
  const firstPostHeaderImage = afterHeader.match(/<img\b[^>]*>/i)?.[0] ?? '';
  const featureImagePosition = afterHeader.search(/<img\b(?=[^>]*\bdata-cruise-d2-feature-image\b)[^>]*>/i);
  const heroCopyPosition = afterHeader.search(/<div\b[^>]*class=["'][^"']*\bhero-copy\b/i);
  const heroTitlePosition = afterHeader.search(/<h1\b[^>]*\bid=["']hero-title["']/i);
  const firstSectionEnd = afterHeader.search(/<\/section\s*>/i);
  const approvedHeroSequence = [
    featureImagePosition,
    heroTitlePosition,
    afterHeader.search(/A motorised inflatable water lounger with dual joystick control\./i),
    afterHeader.search(/<div\b[^>]*class=["'][^"']*\bhero-offer\b/i),
    afterHeader.search(/Buy Cruise D2\s*—\s*\$299/i),
    afterHeader.search(/Explore the features/i),
    afterHeader.search(/Electric propulsion[\s\S]{0,260}Up to 5\s*km\/h[\s\S]{0,260}160\s*kg capacity[\s\S]{0,260}Dual joystick steering/i),
  ];
  const sequenceIsOrdered = approvedHeroSequence.every((position, indexInSequence) =>
    position >= 0 && (indexInSequence === 0 || position > approvedHeroSequence[indexInSequence - 1]));
  assert(
    'content.mobile-first-hero-order',
    headerEnd >= 0 && /\bdata-cruise-d2-feature-image\b/i.test(firstPostHeaderImage) &&
      featureImagePosition >= 0 && firstSectionEnd > featureImagePosition &&
      heroCopyPosition > featureImagePosition && heroTitlePosition > featureImagePosition && sequenceIsOrdered,
    `Hero sequence positions: ${approvedHeroSequence.join(', ')}; first post-header image=${/\bdata-cruise-d2-feature-image\b/i.test(firstPostHeaderImage) ? 'approved feature image' : firstPostHeaderImage || '(missing)'}`,
  );

  const heroSection = firstSectionEnd >= 0 ? afterHeader.slice(0, firstSectionEnd + 10) : '';
  const valueSectionStart = index.search(/<section\b[^>]*class=["'][^"']*\bvalue-section\b/i);
  const valueSectionEnd = valueSectionStart >= 0 ? index.indexOf('</section>', valueSectionStart) : -1;
  const valueSection = valueSectionStart >= 0 && valueSectionEnd > valueSectionStart
    ? index.slice(valueSectionStart, valueSectionEnd + 10)
    : '';
  const specsSectionStart = index.search(/<section\b[^>]*\bid=["']specifications["']/i);
  const specsSectionEnd = specsSectionStart >= 0 ? index.indexOf('</section>', specsSectionStart) : -1;
  const specsSection = specsSectionStart >= 0 && specsSectionEnd > specsSectionStart
    ? index.slice(specsSectionStart, specsSectionEnd + 10)
    : '';
  assert(
    'content.approved-copy-simplification',
    heroSection.length > 0 && !/\beyebrow\b/i.test(heroSection) &&
      valueSection.length > 0 && !/Full-length lounging profile/i.test(index) &&
      specsSection.length > 0 && /<h2\b[^>]*\bid=["']specifications-title["'][^>]*>\s*Cruise D2 specifications\.\s*<\/h2>/i.test(specsSection) &&
      !/\beyebrow\b/i.test(specsSection) && !/class=["'][^"']*\blede\b/i.test(specsSection),
    'Hero eyebrow, obsolete overview caption, and specifications eyebrow/lede are removed while the concise specifications heading remains',
  );

  const brandLink = index.match(/<a\b(?=[^>]*class=["'][^"']*\bbrand\b)[^>]*>[\s\S]*?<\/a>/i)?.[0] ?? '';
  assert(
    'brand.current-name-and-logo',
    productConfig?.brand === 'Docked' && productConfig?.name === 'Docked Cruise D2' &&
      /href=["']\/["']/i.test(brandLink) && /src=["']\/assets\/images\/brand-mark\.svg["']/i.test(brandLink) &&
      /alt=["']Docked["']/i.test(brandLink),
    'The Docked name, Cruise D2 product name, and current Docked brand-mark.svg header logo remain unchanged',
  );

  const footerStart = index.search(/<footer\b/i);
  const footerEnd = footerStart >= 0 ? index.search(/<\/footer\s*>/i) : -1;
  const homepageBeforeFooter = footerStart >= 0 ? index.slice(0, footerStart) : index;
  const homepageFooter = footerStart >= 0 && footerEnd > footerStart ? index.slice(footerStart, footerEnd + 9) : '';
  const legalIdentityPatterns = [
    /Ginty United Investments Pty Ltd/i,
    /ABN\s*78\s*606\s*187\s*106/i,
    /support@docked\.com\.au/i,
  ];
  const legalIdentityOutsideFooter = legalIdentityPatterns.filter((pattern) => pattern.test(homepageBeforeFooter)).map(String);
  const footerHasLegalBlock = /Sold by Ginty United Investments Pty Ltd[\s\S]*ABN\s*78\s*606\s*187\s*106[\s\S]*support@docked\.com\.au/i.test(homepageFooter);
  assert(
    'content.homepage-legal-details-footer-only',
    footerStart >= 0 && footerEnd > footerStart && legalIdentityOutsideFooter.length === 0 && footerHasLegalBlock,
    legalIdentityOutsideFooter.length
      ? `Homepage legal/support details found above footer: ${legalIdentityOutsideFooter.join(', ')}`
      : `Footer legal block=${footerHasLegalBlock ? 'present' : 'missing or out of order'}`,
  );
  const controlSectionStart = index.search(/<section\b[^>]*aria-labelledby=["']control-title["']/i);
  const controlSectionEnd = controlSectionStart >= 0 ? index.indexOf('</section>', controlSectionStart) : -1;
  const controlSection = controlSectionStart >= 0 && controlSectionEnd > controlSectionStart
    ? index.slice(controlSectionStart, controlSectionEnd + 10)
    : '';
  const publicFigures = [...index.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)].map((match) => match[0]);
  const illustrationMedia = [
    { label: 'feature board', path: 'cruise-d2-features.jpg' },
    { label: 'man lifestyle', path: 'cruise-d2-lifestyle-man-1200.webp' },
    { label: 'woman lifestyle', path: 'cruise-d2-lifestyle-woman-1200.webp' },
  ];
  const illustrationDisclosureIssues = [];
  for (const media of illustrationMedia) {
    const figure = publicFigures.find((candidate) => candidate.includes(media.path)) ?? '';
    const image = figure.match(new RegExp(`<img\\b(?=[^>]*${media.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})[^>]*>`, 'i'))?.[0] ?? '';
    const disclosure = figure.match(/<([a-z][a-z0-9]*)\b(?=[^>]*class=["'][^"']*\bmedia-disclosure\b)[^>]*>([\s\S]*?)<\/\1>/i);
    const disclosureAttrs = disclosure?.[0]?.slice(0, disclosure[0].indexOf('>') + 1) ?? '';
    if (!figure) illustrationDisclosureIssues.push(`${media.label}: missing associated figure`);
    if (!/\balt=["'][^"']*\billustration\b[^"']*["']/i.test(image)) illustrationDisclosureIssues.push(`${media.label}: alt text must say illustration`);
    if (!disclosure || !/supplier\s+(?:product|lifestyle)\s+illustration/i.test(visibleText(disclosure[2]))) illustrationDisclosureIssues.push(`${media.label}: visible supplier illustration disclosure missing`);
    if (/\bhidden\b|aria-hidden=["']true["']/i.test(disclosureAttrs)) illustrationDisclosureIssues.push(`${media.label}: disclosure is hidden`);
  }
  assert(
    'assets.visible-illustration-disclosures',
    illustrationDisclosureIssues.length === 0,
    illustrationDisclosureIssues.length
      ? illustrationDisclosureIssues.join('; ')
      : 'Feature board, man lifestyle and woman lifestyle figures each have illustration alt text and an associated visible supplier illustration disclosure',
  );
  assert(
    'content.product-first',
    /cruise-d2-lifestyle-man-1200\.webp/.test(valueSection) && /cruise-d2-lifestyle-woman-1200\.webp/.test(controlSection) &&
      !/cruise-d2-overview-(?:600|1200)\.webp/.test(valueSection) && !/cruise-d2-controls-(?:600|1200)\.webp/.test(controlSection) &&
      /cruise-d2-features\.jpg/.test(index) && /\bdata-cruise-d2-feature-image\b/.test(index) &&
      !/unverified performance|original brand illustrations|the Docked approach|confirmed before dispatch/i.test(publicText),
    'Homepage uses the approved lead feature graphic, man and woman lifestyle derivatives, and no internal compliance-preview copy',
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
    /\bstrong\s+and\s+stable\s+design\b/i,
    /\b90[- ]minute\s+runtime\b/i,
    /\b66\s*w\s+dual\s+motors?\b/i,
    /\blong[- ]lasting\s+battery\b/i,
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
  assert('claims.no-unsafe-marketing', unsafeMarketingHits.length === 0, unsafeMarketingHits.length ? `Unsafe or unsupported marketing: ${unsafeMarketingHits.join(', ')}` : 'No safety, unverified runtime/power, marine, open-water, durability, range, stability, urgency, or stock claims');

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

  const css = read('assets/css/styles.css');
  const productPhotoImageRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].split(',').some((selector) => selector.trim() === '.product-photo-card img'))
    .map((match) => match[2]);
  const productPhotoDeclarations = productPhotoImageRules.flatMap((body) => body.split(';'))
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colon = declaration.indexOf(':');
      return colon >= 0
        ? { property: declaration.slice(0, colon).trim().toLowerCase(), value: declaration.slice(colon + 1).trim().toLowerCase() }
        : { property: '', value: '' };
    });
  const cropForcingDeclarations = productPhotoDeclarations.filter(({ property, value }) =>
    (property === 'min-height' && !/^0(?:[a-z%]+)?(?:\s*!important)?$/i.test(value)) ||
    (property === 'height' && !/^auto(?:\s*!important)?$/i.test(value)) ||
    (property === 'max-height' && !/^none(?:\s*!important)?$/i.test(value)) ||
    (property === 'clip-path' && !/^none(?:\s*!important)?$/i.test(value)) ||
    (property === 'transform' && /scale/i.test(value)));
  const manImageTag = valueSection.match(/<img\b(?=[^>]*cruise-d2-lifestyle-man-1200\.webp)[^>]*>/i)?.[0] ?? '';
  assert(
    'assets.lifestyle-man-no-css-crop',
    productPhotoImageRules.length > 0 &&
      productPhotoImageRules.some((body) => /\baspect-ratio\s*:\s*3\s*\/\s*2\b/i.test(body)) &&
      productPhotoImageRules.some((body) => /\bmin-height\s*:\s*0(?:[a-z%]+)?\b/i.test(body)) &&
      cropForcingDeclarations.length === 0 &&
      /\bwidth=["']1200["']/i.test(manImageTag) && /\bheight=["']800["']/i.test(manImageTag),
    cropForcingDeclarations.length
      ? `Crop-forcing .product-photo-card img declarations: ${cropForcingDeclarations.map(({ property, value }) => `${property}: ${value}`).join('; ')}`
      : 'The 1200 × 800 man illustration retains a 3:2 CSS frame with min-height 0 and no fixed-height, clipping, or scaling crop rule',
  );
  const mediaDisclosureRules = [...css.matchAll(/[^{}]*\.media-disclosure[^{]*\{([^}]*)\}/gi)].map((match) => match[1]).join('\n');
  const disclosureCssHidden = /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)|clip(?:-path)?\s*:/i.test(mediaDisclosureRules);
  assert(
    'assets.illustration-disclosure-visible-css',
    mediaDisclosureRules.length > 0 && !disclosureCssHidden,
    mediaDisclosureRules.length > 0 && !disclosureCssHidden
      ? 'Supplier illustration disclosures have visible screen styling'
      : 'Supplier illustration disclosure CSS is missing or hides the disclosure',
  );
  const sunshineUses = (css.match(/var\(--sunshine\)/g) ?? []).length;
  const sunshineDeepUses = (css.match(/var\(--sunshine-deep\)/g) ?? []).length;
  assert(
    'design.summer-palette',
    /--sunshine\s*:\s*#ffd43b\b/i.test(css) && /--sunshine-deep\s*:\s*#edae00\b/i.test(css) &&
      /--pool-bright\s*:\s*#13bfe6\b/i.test(css) && /--coral\s*:\s*#e95032\b/i.test(css) &&
      sunshineUses >= 4 && sunshineDeepUses >= 1,
    `Summer palette tokens are defined and applied (sunshine uses=${sunshineUses}, sunshine-deep uses=${sunshineDeepUses})`,
  );

  const galleryRoot = index.match(/<([a-z][a-z0-9]*)\b(?=[^>]*\bdata-gallery\b)(?=[^>]*\bdata-product-gallery\b)[^>]*>/i)?.[0] ?? '';
  const galleryStage = index.match(/<([a-z][a-z0-9]*)\b(?=[^>]*\bdata-gallery-stage\b)[^>]*>/i)?.[0] ?? '';
  const galleryPanels = [...index.matchAll(/<figure\b(?=[^>]*\bdata-gallery-panel\b)([^>]*)>/gi)].map((match) => match[1]);
  const galleryTabs = [...index.matchAll(/<button\b(?=[^>]*\bdata-gallery-target\b)([^>]*)>/gi)].map((match) => match[1]);
  const panelIds = new Set(galleryPanels.map((attrs) => attrs.match(/\bid=["']([^"']+)["']/i)?.[1]).filter(Boolean));
  const tabIds = new Set(galleryTabs.map((attrs) => attrs.match(/\bid=["']([^"']+)["']/i)?.[1]).filter(Boolean));
  const tabsMapToPanels = galleryTabs.every((attrs) => {
    const target = attrs.match(/\baria-controls=["']([^"']+)["']/i)?.[1];
    return /\btype=["']button["']/i.test(attrs) && /\brole=["']tab["']/i.test(attrs) && target && panelIds.has(target);
  });
  const panelsMapToTabs = galleryPanels.every((attrs) => {
    const label = attrs.match(/\baria-labelledby=["']([^"']+)["']/i)?.[1];
    return /\brole=["']tabpanel["']/i.test(attrs) && label && tabIds.has(label);
  });
  const selectedTabs = galleryTabs.filter((attrs) => /\baria-selected=["']true["']/i.test(attrs)).length;
  const unselectedTabsAreUntabbable = galleryTabs.every((attrs) =>
    /\baria-selected=["']true["']/i.test(attrs) || /\btabindex=["']-1["']/i.test(attrs));
  const galleryKeyboardContract =
    /addEventListener\(["']click["']/.test(siteScript) && /addEventListener\(["']keydown["']/.test(siteScript) &&
    /ArrowRight/.test(siteScript) && /ArrowDown/.test(siteScript) && /ArrowLeft/.test(siteScript) &&
    /ArrowUp/.test(siteScript) && /event\.key\s*===\s*["']Home["']/.test(siteScript) &&
    /event\.key\s*===\s*["']End["']/.test(siteScript) && /thumb\.tabIndex\s*=/.test(siteScript) &&
    /panel\.hidden\s*=/.test(siteScript) && /panel\.setAttribute\(["']aria-hidden["']/.test(siteScript);
  assert(
    'product.accessible-slideshow',
    galleryRoot.length > 0 && /\baria-live=["']polite["']/i.test(galleryStage) && /\baria-describedby=["'][^"']+["']/i.test(galleryStage) &&
      galleryPanels.length === 3 && galleryTabs.length === 3 && panelIds.size === 3 && tabIds.size === 3 &&
      tabsMapToPanels && panelsMapToTabs && selectedTabs === 1 && unselectedTabsAreUntabbable && galleryKeyboardContract,
    `Gallery root=${Boolean(galleryRoot)}, panels=${galleryPanels.length}, tabs=${galleryTabs.length}, selected tabs=${selectedTabs}, mapped=${tabsMapToPanels && panelsMapToTabs}, keyboard=${galleryKeyboardContract}`,
  );

  const persistentBuyBar = index.match(/<aside\b(?=[^>]*\bdata-persistent-buy-bar\b)[^>]*>[\s\S]*?<\/aside>/i)?.[0] ?? '';
  const persistentBaseRule = css.match(/\.mobile-buy-bar\s*\{([^}]*)\}/i)?.[1] ?? '';
  const printMediaPosition = css.search(/@media\s+print\b/i);
  const screenCss = css.slice(0, printMediaPosition >= 0 ? printMediaPosition : css.length);
  const persistentRules = [...screenCss.matchAll(/[^{}]*\.(?:mobile-buy-bar|persistent-buy-bar)[^{]*\{([^}]*)\}/gi)].map((match) => match[1]).join('\n');
  const persistentRuntimeContract =
    /querySelector\(["']\[data-mobile-buy-bar\]["']\)/.test(siteScript) &&
    /querySelectorAll\(\s*["']\.hero-actions \[data-buy-cta\], #checkout, \.final-cta \[data-buy-cta\]["']\s*\)/.test(siteScript) &&
    /visiblePurchaseSurfaces\s*=\s*new Set\(\)/.test(siteScript) &&
    /purchaseVisibilityReady\s*=/.test(siteScript) && /new IntersectionObserver\(/.test(siteScript) &&
    /entry\.isIntersecting[\s\S]{0,120}visiblePurchaseSurfaces\.add\(entry\.target\)[\s\S]{0,120}visiblePurchaseSurfaces\.delete\(entry\.target\)/.test(siteScript) &&
    /purchaseObserver\.observe\(surface\)/.test(siteScript) &&
    /var\s+show\s*=\s*checkoutAvailable\s*&&\s*purchaseVisibilityReady\s*&&\s*visiblePurchaseSurfaces\.size\s*===\s*0\s*;/.test(siteScript) &&
    /dataset\.hidden\s*=\s*String\(!show\)/.test(siteScript);
  assert(
    'checkout.persistent-buy-bar',
    /class=["'][^"']*\bmobile-buy-bar\b[^"']*\bpersistent-buy-bar\b[^"']*["']/i.test(persistentBuyBar) &&
      /\baria-label=["'][^"']+["']/i.test(persistentBuyBar) && /\bdata-hidden=["']true["']/i.test(persistentBuyBar) &&
      /<a\b(?=[^>]*\bdata-buy-cta\b)(?=[^>]*href=["']#checkout["'])[^>]*>/i.test(persistentBuyBar) &&
      /position\s*:\s*fixed/i.test(persistentBaseRule) && /display\s*:\s*(?:flex|grid)/i.test(persistentBaseRule) &&
      !/display\s*:\s*none/i.test(persistentRules) && persistentRuntimeContract,
    `Persistent CTA markup=${Boolean(persistentBuyBar)}, fixed/display base=${/position\s*:\s*fixed/i.test(persistentBaseRule) && /display\s*:\s*(?:flex|grid)/i.test(persistentBaseRule)}, runtime=${persistentRuntimeContract}`,
  );

  const featureImageTag = index.match(/<img\b(?=[^>]*\bdata-cruise-d2-feature-image\b)[^>]*>/i)?.[0] ?? '';
  const featureImageRules = [...css.matchAll(/[^{}]*\[data-cruise-d2-feature-image\][^{]*\{([^}]*)\}/gi)].map((match) => match[1]).join('\n');
  const featureImageResponsive = /src=["']\/assets\/images\/product\/cruise-d2-features\.jpg["']/i.test(featureImageTag) &&
    /\bwidth=["']\d+["']/i.test(featureImageTag) && /\bheight=["']\d+["']/i.test(featureImageTag) && /\balt=["'][^"']+["']/i.test(featureImageTag) &&
    /object-fit\s*:\s*contain/i.test(featureImageRules) && /width\s*:\s*100%/i.test(featureImageRules) &&
    /max-width\s*:\s*100%/i.test(featureImageRules) && /height\s*:\s*auto/i.test(featureImageRules) &&
    !/object-fit\s*:\s*cover|object-position\s*:|clip-path\s*:/i.test(featureImageRules);
  const horizontalMasking = /\bwidth\s*:\s*100vw\b|overflow-x\s*:\s*(?:hidden|clip)\b/i.test(css);
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
