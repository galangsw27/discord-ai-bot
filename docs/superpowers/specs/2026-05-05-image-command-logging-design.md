# /image Command Logging Design

## Goal
Add runtime logs for `/image` so operators can trace usage, cooldown hits, generation success/failure, and latency.

## Scope
- Add structured console logs inside `src/commands/image.js` only.
- Cover 4 event types:
  - request received
  - cooldown blocked
  - generation success
  - generation failure
- Include elapsed time (`durationMs`) for success and failure.

## Out of Scope
- New logging library.
- External log shipping.
- Changes to response text shown to Discord users.

## Logging Format
Use `console.log` / `console.error` with event tags and object payload.

Event tags:
- `[IMAGE_REQUEST]`
- `[IMAGE_COOLDOWN]`
- `[IMAGE_SUCCESS]`
- `[IMAGE_ERROR]`

## Fields

### IMAGE_REQUEST
- `userId`
- `guildId`
- `channelId`
- `promptLength`
- `promptPreview` (max 80 chars)

### IMAGE_COOLDOWN
- `userId`
- `guildId`
- `channelId`
- `remainingMs`

### IMAGE_SUCCESS
- `userId`
- `guildId`
- `channelId`
- `mimeType`
- `bytes`
- `durationMs`

### IMAGE_ERROR
- `userId`
- `guildId`
- `channelId`
- `durationMs`
- `error`

## Data Handling
- Do not log full prompt blindly.
- Log `promptPreview` sliced to first 80 chars.
- Keep user-facing behavior unchanged.

## Flow
1. On command start: collect ids, prompt metadata, start timestamp, log `[IMAGE_REQUEST]`.
2. If cooldown active: log `[IMAGE_COOLDOWN]`, then return existing cooldown reply.
3. On image success: log `[IMAGE_SUCCESS]` before/after reply.
4. On error: log `[IMAGE_ERROR]`, keep existing error reply text.

## Test Checklist
- Run `/image` once: request + success logs appear with duration.
- Run `/image` twice quickly: second call prints cooldown log.
- Force generation failure (invalid model): error log appears with duration.

## File To Modify
- `src/commands/image.js`
