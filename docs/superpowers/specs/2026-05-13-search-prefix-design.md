# !search Prefix Command Design

## Goal
Add public prefix command `!search {context}` that performs web search through 9Router `/v1/search`, then returns both:
1. Search result links/snippets
2. AI summary grounded in those results

## Scope
- In scope:
  - Prefix trigger parsing in message flow
  - 9Router web search integration
  - Public channel response formatting
  - AI summarization pass over search outputs
  - Env/config additions for 9Router web search
- Out of scope:
  - New slash command `/search`
  - Generic prefix command framework
  - Multi-step conversational search sessions

## Current Architecture Context
- Main message handling is in `src/index.js` under `Events.MessageCreate`.
- Existing AI generation path uses `generateAiResponse` from `src/utils/ai.js`.
- Bot currently gates mention-based AI by allowed channels and guild settings.
- Slash commands are loaded from `src/commands`, but prefix commands are currently handled inline in message event logic.

## Proposed Design

### 1) Trigger and routing (`src/index.js`)
- Add early branch in `Events.MessageCreate`:
  - Parse message content for `!search` prefix.
  - If matched:
    - Extract query payload after `!search`.
    - If empty, reply usage guidance (`!search <topik>`).
    - Else execute search flow and return.
- Keep existing mention-based AI flow unchanged for non-`!search` messages.

### 2) Search integration utility (`src/utils/web-search.js`)
- Add dedicated function, e.g. `searchWeb(query, options)`.
- Execute:
  - `POST ${NINEROUTER_URL}/v1/search`
  - `Authorization: Bearer ${NINEROUTER_KEY}`
  - JSON body with:
    - `model` (default `search-combo`)
    - `query`
    - `max_results` (default 5)
- Normalize response into stable shape:
  - `provider`
  - `answer`
  - `results[]` (title, snippet, url)
  - `usage`
  - `metrics`

### 3) Summary generation
- Build grounded summary prompt from:
  - User query
  - Top search results (title/snippet/url)
  - Optional `answer` from 9Router response
- Reuse existing `generateAiResponse(...)` for summary tone consistency with bot persona.
- Ensure summary prompt includes instruction to avoid inventing facts and to rely on provided search snippets.

### 4) Public response format
- Single public message reply, structured:
  - Header: query + provider
  - Section A: top links (title + URL + short snippet)
  - Section B: AI summary
- If output risks Discord length limits, truncate snippets first before dropping links.

### 5) Config and environment
- Add config support for:
  - `NINEROUTER_URL` (required)
  - `NINEROUTER_KEY` (required except self-hosted no-auth deployments)
  - `NINEROUTER_SEARCH_MODEL` (optional, default `search-combo`)
- Missing required config path:
  - Log clear error
  - Return user-facing failure response in channel

### 6) Failure behavior
- Network/API error:
  - Log structured event with query and error message
  - Reply with temporary-failure message
- Empty results:
  - Reply with “hasil belum ketemu” style response
- Malformed response:
  - Treat as provider failure and use same fallback path

## Testing and Verification Plan
Repository currently has no first-party test harness.

Implementation-phase verification will include:
1. Unit-style checks for pure helpers introduced for:
   - `!search` parsing
   - Search result text formatting
2. Manual runtime validation in Discord flow:
   - `!search` without query
   - `!search` with normal query
   - API failure simulation (bad key)
   - Long-result formatting boundaries

## Security and Safety Notes
- Never log API key values.
- Trim/sanitize query before API call.
- Keep summarization grounded to returned source data to reduce hallucination risk.

## Acceptance Criteria
- `!search {context}` triggers web search path in guild message flow.
- Bot posts public response containing both result links and AI summary.
- Existing mention-based AI behavior remains intact.
- Missing/invalid config handled gracefully with user-facing error.
- Search utility isolated from message handler for maintainability.
