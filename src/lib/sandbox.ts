const PREVIEW_POLICY =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; connect-src 'none'; form-action 'none'; base-uri 'none'";

export function makePreviewDocument(html: string): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_POLICY}">`;
  const head = /<head(?:\s[^>]*)?>/i;
  if (head.test(html)) return html.replace(head, (opening) => `${opening}${policy}`);

  const root = /<html(?:\s[^>]*)?>/i;
  if (root.test(html)) {
    return html.replace(root, (opening) => `${opening}<head>${policy}</head>`);
  }

  return `${policy}${html}`;
}
