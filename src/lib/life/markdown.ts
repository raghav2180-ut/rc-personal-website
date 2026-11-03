/**
 * A small, safe Markdown renderer for card descriptions and comments.
 * Covers what Trello cards use: links ([text](url "title") and bare URLs),
 * **bold**, _italic_, "- " bullet lists, paragraphs and line breaks.
 * Everything is HTML-escaped first, and only http(s) and mailto links are kept.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return /^(https?|mailto):$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function inline(raw: string): string {
  const links: string[] = [];
  const hold = (html: string) => `\u0000${links.push(html) - 1}\u0000`;
  // [text](url "optional title")
  let s = raw.replace(/\[([^\]]+)\]\((\S+?)(?:\s+"[^"]*")?\)/g, (m, text: string, url: string) => {
    const href = safeUrl(url);
    return href ? hold(`<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`) : m;
  });
  // bare URLs
  s = s.replace(/\bhttps?:\/\/[^\s<>()"]+[^\s<>()".,;:!?'’]/g, (url) => {
    const href = safeUrl(url);
    return href ? hold(`<a href="${esc(href)}" target="_blank" rel="noopener">${esc(url)}</a>`) : url;
  });
  s = esc(s)
    .replace(/\\([#*_\[\]()\\-])/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_\n]+?)_(?=$|[\s).,:;!?])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

export function renderMarkdown(text: string): string {
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

/** Plain-text link label for a URL: host + short path. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 24 ? `${u.pathname.slice(0, 22)}…` : u.pathname;
    return `${u.hostname.replace(/^www\./, '')}${path === '/' ? '' : path}`;
  } catch {
    return url;
  }
}
