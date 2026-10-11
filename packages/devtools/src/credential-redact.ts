/**
 * Credentials that ride inside text rather than under a secret key: the
 * password in a URL's userinfo (`https://user:pass@host`) and the credential of
 * an `Authorization` value (`Basic …`, `Digest …`, `Token …`). Bearer tokens
 * and JWTs have their own patterns next to the callers.
 */

/** `scheme://user:password@`; the user is kept, the password is hidden. */
const USERINFO = /\b([a-z][a-z\d+.-]*:\/\/)([^\s/?#@:"'<>\\]*):([^\s/?#@"'<>\\]+)@/gi;

/** The credential after a known scheme in an `Authorization:` or `authorization=` value. */
const AUTH_HEADER =
  /\b((?:proxy-)?authorization)(["']?\s*[:=]\s*["']?)(Basic|Bearer|Digest|Token|Negotiate|NTLM|ApiKey|Key|DPoP|Hawk|HOBA|Mutual|AWS4-HMAC-SHA256|SCRAM-SHA-(?:1|256)|vapid)([ \t]+)([^\s"'\\][^"'\\\r\n]*)/gi;

/** `Basic <base64 of user:password>`. */
const BASIC = /\b(Basic)([ \t]+)([A-Za-z\d+/]{4,}={0,2})(?![\w+/=])/gi;

/** `Digest name="value", …`: the parameter list carries the response hash. */
const DIGEST =
  /\b(Digest)([ \t]+)\w+=(?:"[^"\r\n]*"|[^\s,"]+)(?:\s*,\s*\w+=(?:"[^"\r\n]*"|[^\s,"]+))*/gi;

/** `Token <opaque>` as used by Django REST Framework and GitHub. */
const TOKEN = /\b(Token)([ \t]+)([\w.~+/-]{8,}=*)/g;

function decodesToPair(text: string): boolean {
  try {
    return typeof atob === 'function' && atob(text).includes(':');
  } catch {
    return false;
  }
}

function looksOpaque(text: string): boolean {
  return /\d/.test(text) && /[A-Za-z]/.test(text);
}

export function redactCredentials(text: string, mask: string): string {
  if (!text) return text;
  return text
    .replace(USERINFO, (_, scheme: string, user: string) => `${scheme}${user}:${mask}@`)
    .replace(
      AUTH_HEADER,
      (whole, name: string, sep: string, scheme: string, gap: string, credential: string) =>
        credential.startsWith(mask) ? whole : `${name}${sep}${scheme}${gap}${mask}`,
    )
    .replace(BASIC, (whole, scheme: string, gap: string, credential: string) =>
      decodesToPair(credential) ? `${scheme}${gap}${mask}` : whole,
    )
    .replace(DIGEST, (_, scheme: string, gap: string) => `${scheme}${gap}${mask}`)
    .replace(TOKEN, (whole, scheme: string, gap: string, credential: string) =>
      looksOpaque(credential) ? `${scheme}${gap}${mask}` : whole,
    );
}
