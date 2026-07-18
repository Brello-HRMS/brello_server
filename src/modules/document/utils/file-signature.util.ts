/**
 * Minimal magic-byte check for the mime types we can cheaply verify without
 * pulling in a file-sniffing dependency. Anything not in this table is
 * passed through unchecked (many legitimate document types — docx, xlsx,
 * csv — aren't covered here).
 */
const SIGNATURES: Record<string, Buffer[]> = {
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/gif': [Buffer.from('GIF87a', 'ascii'), Buffer.from('GIF89a', 'ascii')],
  'image/webp': [Buffer.from('RIFF', 'ascii')], // followed by size + 'WEBP', checked separately below
  'application/pdf': [Buffer.from('%PDF-', 'ascii')],
};

function matchesSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  const candidates = SIGNATURES[mimeType];
  return candidates.some(
    (sig) => buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig),
  );
}

/**
 * Returns true if `mimeType` isn't one we check, or the buffer's leading
 * bytes match the claimed mimeType. Returns false on a mismatch (e.g. an
 * SVG/HTML payload declared as image/png).
 */
export function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  if (!(normalized in SIGNATURES)) return true;
  return matchesSignature(buffer, normalized);
}
