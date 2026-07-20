export function buildPortalLink(token: string): string {
  const baseUrl = process.env.WEBAPP_URL ?? 'https://brellohrms.netlify.app';
  return `${baseUrl}/offer/portal/${token}`;
}
