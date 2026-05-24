import * as crypto from 'crypto';

export interface SignedDocumentQuery {
  sig: string;
  exp: number;
}

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes

const buildPayload = (documentId: string, exp: number): string =>
  `${documentId}|${exp}`;

const hmacHex = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

export function signDocumentView(
  documentId: string,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): SignedDocumentQuery {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = hmacHex(buildPayload(documentId, exp), secret);
  return { sig, exp };
}

export function verifyDocumentView(
  documentId: string,
  sig: string,
  exp: number,
  secret: string,
): boolean {
  if (!sig || !Number.isFinite(exp)) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;

  const expected = hmacHex(buildPayload(documentId, exp), secret);
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function appendSignatureToPath(
  path: string,
  query: SignedDocumentQuery,
): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}sig=${query.sig}&exp=${query.exp}`;
}
