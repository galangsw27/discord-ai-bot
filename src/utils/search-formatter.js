function stripHtml(text) {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ensureProtocol(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export function parseSearchPrefix(content) {
  const trimmed = content.trim();
  if (!trimmed.toLowerCase().startsWith('!search')) return null;
  const rest = trimmed.slice(7).trim();
  if (!rest) return { query: null, empty: true };
  return { query: rest, empty: false };
}

export function formatSearchResultLinks(results, maxLinks = 5) {
  const sliced = results.slice(0, maxLinks);
  if (!sliced.length) return '';

  const lines = sliced.map((r, i) => {
    const rawUrl = r.url || r.displayUrl || '';
    const clickableUrl = ensureProtocol(rawUrl);
    const cleanSnippet = stripHtml(r.snippet);
    const cleanTitle = stripHtml(r.title) || 'Tanpa judul';
    const linkText = `[${cleanTitle}](${clickableUrl})`;
    return `${i + 1}. **${linkText}**\n   ${cleanSnippet.slice(0, 200)}${cleanSnippet.length > 200 ? '…' : ''}`;
  });

  return lines.join('\n\n');
}

export function buildSearchSummaryPrompt(query, searchResults, providerAnswer = '') {
  const resultTexts = searchResults
    .map((r, i) => `[${i + 1}] ${stripHtml(r.title)}\nURL: ${r.url}\nIsi: ${stripHtml(r.snippet)}`)
    .join('\n\n');

  return [
    'Berikut hasil pencarian web untuk pertanyaan user.',
    `Pertanyaan: "${query}"`,
    providerAnswer ? `Ringkasan dari search engine: ${providerAnswer}` : '',
    'Hasil pencarian:',
    resultTexts || '(tidak ada hasil)',
    '',
    'Instruksi: Rangkum informasi paling relevan dalam 2-4 kalimat. Jangan tambahkan fakta yang tidak ada di hasil pencarian di atas. Sebutkan sumber dengan angka [1], [2], dst jika perlu. Gaya: santai, cute, tactical, persona Mili. Bahasa Indonesia.'
  ].join('\n');
}

export function buildSearchReply(query, linksBlock, summary, provider) {
  const parts = [
    `**Hasil pencarian:** "${query}"${provider ? ` (via ${provider})` : ''}`,
    '',
    '**🔗 Link teratas:**',
    linksBlock || '_Tidak ada link yang ditemukan._',
    '',
    '**💡 Rangkuman Mili:**',
    summary || '_Aku belum bisa ngerangkum ini._'
  ];

  return parts.join('\n').slice(0, 1900);
}
