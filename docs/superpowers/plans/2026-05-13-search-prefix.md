# !search Prefix Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `!search {query}` prefix command that performs web search via 9Router, then replies publicly with both search result links and an AI summary.

**Architecture:** Add two focused utilities (`web-search.js`, `search-formatter.js`) and wire a lightweight prefix branch into the existing `MessageCreate` handler in `src/index.js`. Search results are formatted and fed back into the existing `generateAiResponse` path for a grounded summary.

**Tech Stack:** Node.js 18+, native `fetch`, `discord.js`, `dotenv`. No new test framework added — uses manual runtime verification + Node built-in test runner for pure helpers if needed.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/config.js` | Modify | Add search-related env vars with existing-value fallbacks |
| `src/utils/web-search.js` | Create | Execute 9Router `POST /v1/search`, normalize response |
| `src/utils/search-formatter.js` | Create | Pure helpers: parse prefix, format search result blocks |
| `src/index.js` | Modify | Add `!search` branch in `MessageCreate` handler |

---

### Task 1: Extend config for search env vars

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Add search config fields**

```javascript
ninerouterUrl: process.env.NINEROUTER_URL || process.env.API_BASE_URL || 'https://rwvg2am.9router.com/v1',
ninerouterKey: process.env.NINEROUTER_KEY || process.env.API_KEY || '',
searchModel: process.env.NINEROUTER_SEARCH_MODEL || 'search-combo',
```

Add those three fields to the exported `config` object, right after the existing image settings.

- [ ] **Step 2: Verify config loads without error**

Run: `node -e "import('./src/config.js').then(m => console.log(m.config)).catch(e => console.error(e.message))"`
Expected: prints config object including `ninerouterUrl`, `ninerouterKey`, `searchModel`

---

### Task 2: Create web-search utility

**Files:**
- Create: `src/utils/web-search.js`

- [ ] **Step 1: Write the search utility**

```javascript
import { config } from '../config.js';

export async function searchWeb(query, options = {}) {
  const url = `${config.ninerouterUrl}/search`;
  const body = {
    model: options.model || config.searchModel,
    query,
    max_results: options.maxResults || 5,
    ...(options.searchType ? { search_type: options.searchType } : {}),
    ...(options.country ? { country: options.country } : {}),
    ...(options.language ? { language: options.language } : {}),
    ...(options.timeRange ? { time_range: options.timeRange } : {})
  };

  const headers = {
    'Content-Type': 'application/json',
    ...(config.ninerouterKey ? { Authorization: `Bearer ${config.ninerouterKey}` } : {})
  };

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Search API ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  return {
    provider: data.provider || '',
    query: data.query || query,
    answer: data.answer || '',
    results: Array.isArray(data.results)
      ? data.results.map(r => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.snippet || r.content || '',
          displayUrl: r.display_url || '',
          position: r.position || 0
        }))
      : [],
    usage: data.usage || {},
    metrics: data.metrics || {}
  };
}
```

- [ ] **Step 2: Verify module imports correctly**

Run: `node -e "import('./src/utils/web-search.js').then(m => console.log(typeof m.searchWeb)).catch(e => console.error(e.message))"`
Expected: prints `function`

---

### Task 3: Create search formatter utility

**Files:**
- Create: `src/utils/search-formatter.js`

- [ ] **Step 1: Write formatter helpers**

```javascript
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
    const display = r.displayUrl || r.url;
    return `${i + 1}. **${r.title || 'Tanpa judul'}**\n   ${display}\n   ${r.snippet.slice(0, 200)}${r.snippet.length > 200 ? '…' : ''}`;
  });

  return lines.join('\n\n');
}

export function buildSearchSummaryPrompt(query, searchResults, providerAnswer = '') {
  const resultTexts = searchResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nIsi: ${r.snippet}`)
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
```

- [ ] **Step 2: Verify formatter imports**

Run: `node -e "import('./src/utils/search-formatter.js').then(m => console.log(typeof m.parseSearchPrefix, typeof m.buildSearchReply)).catch(e => console.error(e.message))"`
Expected: prints `function function`

---

### Task 4: Wire `!search` into `src/index.js`

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add imports at top**

```javascript
import { searchWeb } from './utils/web-search.js';
import { parseSearchPrefix, formatSearchResultLinks, buildSearchSummaryPrompt, buildSearchReply } from './utils/search-formatter.js';
```

- [ ] **Step 2: Insert `!search` branch in `MessageCreate` handler**

Right after the `if (message.author.bot || !message.guild) return;` line, add this block (before the mention check logic):

```javascript
  const prefixMatch = parseSearchPrefix(message.content);
  if (prefixMatch && !prefixMatch.empty) {
    try {
      await message.channel.sendTyping();

      const query = prefixMatch.query;
      const searchData = await searchWeb(query, { maxResults: 5 });
      const linksBlock = formatSearchResultLinks(searchData.results, 5);

      const summaryPrompt = buildSearchSummaryPrompt(query, searchData.results, searchData.answer);
      const channel = { id: message.channel.id, name: message.channel.name };
      const summary = await generateAiResponse(summaryPrompt, message.author, channel, '', '');

      const replyText = buildSearchReply(query, linksBlock, summary, searchData.provider);
      await message.reply(replyText);
    } catch (error) {
      console.error('[SEARCH_ERROR]', {
        guildId: message.guild?.id,
        channelId: message.channel?.id,
        userId: message.author?.id,
        query: prefixMatch?.query,
        error: error instanceof Error ? error.message : String(error)
      });
      await message.reply('Duh, pencariannya lagi error nih pasupan 😅 Coba bentar lagi ya ❤️');
    }
    return;
  }

  if (prefixMatch && prefixMatch.empty) {
    await message.reply('Cara pakai: `!search <apa yang mau dicari>` pasupan ❤️');
    return;
  }
```

- [ ] **Step 3: Verify syntax**

Run: `node --check src/index.js`
Expected: no output (success)

---

### Task 5: Manual runtime verification

**Files:**
- None (runtime test)

- [ ] **Step 1: Start bot in dev mode**

Run: `npm run dev`

- [ ] **Step 2: Test `!search` without query**

Send: `!search`
Expected bot reply: `Cara pakai: !search <apa yang mau dicari> pasupan ❤️`

- [ ] **Step 3: Test `!search` with normal query**

Send: `!search cuaca jakarta hari ini`
Expected: public reply containing link section and summary section.

- [ ] **Step 4: Test existing mention behavior still works**

Mention bot in allowed channel with normal message.
Expected: normal AI response (not search path).

- [ ] **Step 5: Test `!search` with invalid config**

Temporarily break `NINEROUTER_URL` or `NINEROUTER_KEY`.
Expected: error logged, user gets fallback message.

---

## Spec Coverage Checklist

| Spec Requirement | Plan Task |
|-----------------|-----------|
| Trigger on `!search` prefix | Task 4 |
| Parse query payload | Task 3 |
| Reply usage if empty query | Task 4 |
| Call 9Router `/v1/search` | Task 2 |
| Normalize response shape | Task 2 |
| AI summary grounded in results | Task 4 (via `generateAiResponse`) |
| Public response with links + summary | Task 4 |
| Config: URL, key, model | Task 1 |
| Missing config handling | Task 1 (fallbacks) + Task 4 (catch block) |
| Error handling (network, empty, malformed) | Task 4 catch block |
| Existing mention flow unchanged | Task 4 (early return on prefix match, keep existing logic after) |

## Placeholder / Consistency Scan

- No TBD/TODO found.
- All function names consistent across tasks.
- Type shape in `searchWeb` normalized response matches what `formatSearchResultLinks` consumes.
- `config.ninerouterUrl` used in Task 2 matches field name in Task 1.
