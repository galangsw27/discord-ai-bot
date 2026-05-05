# Event Schedule Channel Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mili fetch the newest event schedule update from a Discord channel when users ask event-related questions.

**Architecture:** Keep event lookup inside `src/index.js` since mention-triggered AI routing already happens there. Add lightweight event-question detection, channel message lookup, timestamp-based newest-match selection, and context injection before the existing `generateAiResponse` call.

**Tech Stack:** Node.js ESM, discord.js v14, Discord channel message fetch, existing AI context injection flow.

---

## File Structure

- Modify `src/index.js`
  - Detect event-related prompts.
  - Fetch and parse latest event schedule message.
  - Inject event knowledge into AI context.
  - Add lookup logs.

---

### Task 1: Add event lookup helpers and AI context injection

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add constants near top of file**

Add below `const commands = await loadCommands();`:

```js
const EVENT_SOURCE_CHANNEL_ID = '1460235193062395966';
const EVENT_SCHEDULE_MARKER = 'INFO JADWAL EVENT TERUPDATE';
const EVENT_KEYWORDS = [
  'event',
  'jadwal event',
  'event hari ini',
  'acara hari ini',
  'kapan event',
  'info event'
];
```

- [ ] **Step 2: Inject event context before AI call**

Inside the `MessageCreate` handler, after:

```js
  const roleCountText = await getMentionedRoleCountsText(message);
```

Replace:

```js
  const context = `${buildDiscordContext(message, originalContent)}\n[Role Counts]\n${roleCountText}`;
```

With:

```js
  const eventContext = await getEventScheduleContext(message.guild, routedPrompt, message.author.id);
  const context = `${buildDiscordContext(message, originalContent)}\n[Role Counts]\n${roleCountText}${eventContext ? `\n${eventContext}` : ''}`;
```

- [ ] **Step 3: Add helper functions before `client.on('error', ...)`**

Insert these exact functions after `getRecentMessages`:

```js
function shouldLookupEventSchedule(prompt) {
  const normalizedPrompt = prompt.toLowerCase();
  return EVENT_KEYWORDS.some(keyword => normalizedPrompt.includes(keyword));
}

async function getEventScheduleContext(guild, prompt, requestUserId) {
  if (!shouldLookupEventSchedule(prompt)) {
    return '';
  }

  try {
    const sourceChannel = guild.channels.cache.get(EVENT_SOURCE_CHANNEL_ID);
    if (!sourceChannel?.isTextBased()) {
      console.warn('[EVENT_LOOKUP_ERROR]', {
        requestUserId,
        sourceChannelId: EVENT_SOURCE_CHANNEL_ID,
        error: 'Source channel not found or not text-based'
      });
      return `[Event Schedule Source Channel]: <#${EVENT_SOURCE_CHANNEL_ID}>\n[Latest Event Update]: LOOKUP_ERROR`;
    }

    const fetched = await sourceChannel.messages.fetch({ limit: 100 });
    const matchedMessages = [...fetched.values()]
      .filter(message => message.content.toLowerCase().includes(EVENT_SCHEDULE_MARKER.toLowerCase()))
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    const latestMessage = matchedMessages[0];
    if (!latestMessage) {
      console.log('[EVENT_LOOKUP_MISS]', {
        requestUserId,
        sourceChannelId: EVENT_SOURCE_CHANNEL_ID
      });
      return `[Event Schedule Source Channel]: <#${EVENT_SOURCE_CHANNEL_ID}>\n[Latest Event Update]: NOT_FOUND`;
    }

    console.log('[EVENT_LOOKUP_HIT]', {
      requestUserId,
      sourceChannelId: EVENT_SOURCE_CHANNEL_ID,
      messageId: latestMessage.id,
      createdTimestamp: latestMessage.createdTimestamp
    });

    return [
      `[Event Schedule Source Channel]: <#${EVENT_SOURCE_CHANNEL_ID}>`,
      `[Latest Event Update Message Timestamp]: ${new Date(latestMessage.createdTimestamp).toISOString()}`,
      `[Latest Event Update Content]: ${latestMessage.content}`,
      `[Latest Parsed Event Date]: ${parseEventDate(latestMessage.content)}`
    ].join('\n');
  } catch (error) {
    console.warn('[EVENT_LOOKUP_ERROR]', {
      requestUserId,
      sourceChannelId: EVENT_SOURCE_CHANNEL_ID,
      error: error instanceof Error ? error.message : String(error)
    });
    return `[Event Schedule Source Channel]: <#${EVENT_SOURCE_CHANNEL_ID}>\n[Latest Event Update]: LOOKUP_ERROR`;
  }
}

function parseEventDate(content) {
  const patterns = [
    /\b(\d{2}\/\d{2}\/\d{4})\b/,
    /\b(\d{2}-\d{2}-\d{4})\b/,
    /\b(\d{4}-\d{2}-\d{2})\b/
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return '-';
}
```

- [ ] **Step 4: Verify syntax**

Run:

```powershell
node --check src/index.js
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 5: Commit**

```powershell
git add src/index.js
git commit -m @'
feat: add event schedule channel lookup

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 2: Final verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run syntax checks**

Run:

```powershell
node --check src/index.js; if ($?) { node --check src/utils/ai.js }; if ($?) { node --check src/config.js }
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 2: Manual behavior checks**

In Discord:

1. Mention Mili with non-event prompt.
   - Expected: normal AI response, no event lookup log.
2. Mention Mili with `event hari ini ada apa`.
   - Expected: event lookup runs, latest matching source message is injected into context.
3. If source channel has no match.
   - Expected: AI still responds, MISS log emitted.
4. If source channel inaccessible.
   - Expected: AI still responds, ERROR log emitted.

- [ ] **Step 3: Commit docs only if needed**

If docs changed during execution, run:

```powershell
git add docs/superpowers/specs/2026-05-05-event-schedule-channel-lookup-design.md docs/superpowers/plans/2026-05-05-event-schedule-channel-lookup.md
git commit -m @'
docs: update event schedule lookup plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

## Self-Review

- Spec coverage: event keyword detection, channel lookup, newest timestamp selection, context injection, logging, and graceful fallback are all covered.
- Placeholder scan: no TBD/TODO or vague instructions remain.
- Type consistency: helper names and context markers are defined consistently and used in one flow.
