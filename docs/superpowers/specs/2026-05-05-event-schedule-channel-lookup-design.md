# Event Schedule Channel Lookup Design

## Goal
When users ask about events (event schedule, today's event, etc.), Mili should fetch the newest event update from channel `1460235193062395966` and use it as live knowledge in AI context.

## Scope
- Detect event-related user prompts in mention-based AI flow.
- Fetch event source channel `1460235193062395966`.
- Find newest message containing `INFO JADWAL EVENT TERUPDATE` using Discord message timestamp.
- Inject that message and parsed date into AI context.
- Keep non-event prompts unchanged.

## Out of Scope
- Slash command for events.
- Persistent storage/cache.
- Event parsing across multiple channels.
- Background schedulers.

## Trigger Detection
Event lookup should run only if prompt likely asks event info.

Keyword set example (case-insensitive):
- `event`
- `jadwal event`
- `event hari ini`
- `acara hari ini`
- `kapan event`
- `info event`

If no keyword match, skip lookup.

## Lookup Rules
1. Fetch messages from channel `1460235193062395966` (limit 100).
2. Filter messages whose content includes `INFO JADWAL EVENT TERUPDATE` (case-insensitive).
3. Sort by `createdTimestamp` descending.
4. Pick first (newest).

## Context Injection
If hit found, append this block into `discordContext` before AI call:

- `[Event Schedule Source Channel]: <#1460235193062395966>`
- `[Latest Event Update Message Timestamp]: <ISO datetime>`
- `[Latest Event Update Content]: <full content>`
- `[Latest Parsed Event Date]: <parsed date or ->`

If no hit:

- `[Event Schedule Source Channel]: <#1460235193062395966>`
- `[Latest Event Update]: NOT_FOUND`

## Date Parsing
Try simple parser from message content:
- Prefer explicit date patterns first (`dd/mm/yyyy`, `dd-mm-yyyy`, `yyyy-mm-dd`).
- If no explicit date, set parsed date to `-`.

No timezone conversion logic required beyond raw content + timestamp.

## Logging
Add runtime logs in `src/index.js`:
- `[EVENT_LOOKUP_HIT]` with:
  - `requestUserId`
  - `sourceChannelId`
  - `messageId`
  - `createdTimestamp`
- `[EVENT_LOOKUP_MISS]` with:
  - `requestUserId`
  - `sourceChannelId`
- `[EVENT_LOOKUP_ERROR]` with:
  - `requestUserId`
  - `sourceChannelId`
  - `error`

## Error Handling
- If lookup errors (permission/network), continue AI response normally.
- Add context marker:
  - `[Latest Event Update]: LOOKUP_ERROR`
- Do not block normal AI response.

## Files Expected To Change
- `src/index.js`
- `docs/superpowers/specs/2026-05-05-event-schedule-channel-lookup-design.md`

## Test Checklist
1. Mention Mili with non-event prompt: no event lookup log.
2. Mention Mili with event prompt: lookup runs.
3. If channel has matching post: HIT log + context injected.
4. If no matching post: MISS log + NOT_FOUND marker.
5. If lookup fails: ERROR log + LOOKUP_ERROR marker, response still returned.
