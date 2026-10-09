import { boundedCommunityBody } from './community-social';

const project = 'https://pojoymtniryarxxunyvz.supabase.co';
const tokenPattern = /^[a-zA-Z0-9_-]{20,256}$/;
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'strict-origin',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  // Chromium also applies form-action to the provider redirect after POST.
  // Permit only this project's existing verification endpoint, never all HTTPS.
  'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${project}/auth/v1/verify; frame-ancestors 'none'; base-uri 'none'`,
};
type Dependencies = {
  enabled: boolean;
  siteUrl: string;
  canContinue: (token: string) => Promise<'ready' | 'missing-browser' | 'unavailable'>;
};
function page(message: string, status: number, token?: string) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked password recovery</title><style>body{font:18px system-ui;background:#0b1020;color:#f5f7fb;margin:0;padding:24px}main{max-width:580px;margin:10vh auto}button{font:inherit;padding:14px 20px;cursor:pointer}p{line-height:1.6}</style></head><body><main><h1>Reset your Docked password</h1><p>${message}</p>${token ? `<form method="post" action="/auth/recovery"><input type="hidden" name="type" value="recovery"><input type="hidden" name="token_hash" value="${token}"><button type="submit">Continue to password reset</button></form>` : ''}<p>Support: support@docked.com.au</p></main></body></html>`, {status, headers: {...headers,'Content-Type':'text/html; charset=utf-8'}});
}

/** Merely loading this page never visits Auth or consumes a recovery token.
 * POST retains Supabase's PKCE exchange; it does not create a session itself. */
export async function recoveryRequest(request: Request, deps: Dependencies) {
  if (!deps.enabled) return page('Password recovery is not available yet.',503);
  const url = new URL(request.url), origin = new URL(deps.siteUrl).origin;
  if (url.origin !== origin) return page('Open this link on the configured Docked site.',403);
  let fields: URLSearchParams;
  if (request.method === 'GET') fields = url.searchParams;
  else if (request.method === 'POST') {
    if (request.headers.get('origin') !== origin || request.headers.get('content-type')?.split(';',1)[0].trim() !== 'application/x-www-form-urlencoded')
      return page('This request was not accepted. Reopen your recovery email.',403);
    try { fields = new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(await boundedCommunityBody(request,2048))); }
    catch { return page('This recovery request is invalid.',400); }
  } else return page('Method not allowed.',405);
  const token = fields.get('token_hash');
  if (fields.getAll('token_hash').length !== 1 || fields.getAll('type').length !== 1 || fields.get('type') !== 'recovery' || !token || !tokenPattern.test(token))
    return page('This recovery link is invalid. Contact support for help.',400);
  if (request.method === 'GET') return page('Continue only if you requested a password reset. Use the same browser where you requested the email. Opening this page alone does not use your link.',200,token);
  let readiness;
  try { readiness = await deps.canContinue(token); } catch { readiness = 'unavailable'; }
  if (readiness === 'missing-browser') return page('The browser information for this reset is missing. Open the original email link in the same browser and device where you requested it. This attempt has not used your link.',409);
  if (readiness !== 'ready') return page('Recovery is temporarily unavailable. This attempt has not used your link. Contact support before requesting another email.',503);
  const verify = new URL(project+'/auth/v1/verify');
  verify.searchParams.set('token',token);
  verify.searchParams.set('type','recovery');
  verify.searchParams.set('redirect_to',origin+'/auth/callback?next=/app/reset-password');
  // Only the explicit same-origin POST continues to the original provider GET.
  return new Response(null,{status:303,headers:{...headers,Location:verify.href}});
}

export function hasRecoveryVerifier(cookies: {name:string;value:string}[]) {
  return cookies.some(cookie => /^sb-pojoymtniryarxxunyvz-auth-token-code-verifier(?:\.\d+)?$/.test(cookie.name) && cookie.value.length > 0);
}
