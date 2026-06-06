# Member Welcome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically send randomized welcome message when new member joins, posting in channel `1459954382257918199` with verification and role reminders.

**Architecture:** Keep implementation inside `src/index.js` because current Discord event wiring already lives there. Add small constant block for welcome channel IDs and welcome templates, then add one `GuildMemberAdd` handler plus one helper that selects and formats random template.

**Tech Stack:** Node.js ESM, discord.js v14, existing Discord client event flow

---

## File Structure

- Modify: `src/index.js`
  - Add welcome-related constants near existing event constants.
  - Add helper to choose and format random welcome template.
  - Add `Events.GuildMemberAdd` handler that fetches welcome channel, validates text-based channel, sends message, and logs success/failure.
- Verify only: `docs/superpowers/specs/2026-05-08-member-welcome-design.md`
  - Confirm plan matches approved design.

No new runtime files needed.

### Task 1: Add failing join-handler test harness by extracting pure welcome formatter target

**Files:**
- Modify: `src/index.js`
- Test: manual runtime verification only in this repo

- [ ] **Step 1: Add constants for welcome flow without handler yet**

Insert below existing event constants in `src/index.js`:

```js
const WELCOME_CHANNEL_ID = '1459954382257918199';
const VERIFICATION_CHANNEL_ID = '1467894995355963562';
const ROLE_CHANNEL_ID = '1460235649947926530';
const WELCOME_TEMPLATES = [
  'Welcome Pasupan <@USER_ID>! Jangan lupa verif di <#1467894995355963562> dan ambil role di <#1460235649947926530>.',
  'Halo Pasupan <@USER_ID>! Verif dulu di <#1467894995355963562>, terus ambil role di <#1460235649947926530> ya.',
  'Selamat datang <@USER_ID>! Jangan lupa verifikasi di <#1467894995355963562> lalu pilih role di <#1460235649947926530>.',
  'Welcome <@USER_ID>! Jangan lupa verif di <#1467894995355963562> dan ambil role di <#1460235649947926530> biar langsung siap gabung.',
  'Hai <@USER_ID>! Singgah dulu ke <#1467894995355963562> buat verif, lalu ambil role di <#1460235649947926530> ya.'
];
```

- [ ] **Step 2: Add formatter helper before event-schedule helpers**

Insert above `function shouldLookupEventSchedule(prompt) {` in `src/index.js`:

```js
function buildWelcomeMessage(memberId) {
  const template = WELCOME_TEMPLATES[Math.floor(Math.random() * WELCOME_TEMPLATES.length)];
  return template.replace('<@USER_ID>', `<@${memberId}>`);
}
```

- [ ] **Step 3: Run syntax check before handler exists**

Run:

```bash
node --check src/index.js
```

Expected: command exits successfully with no output.

- [ ] **Step 4: Commit constants and helper**

```bash
git add src/index.js
git commit -m "feat: add welcome message templates"
```

### Task 2: Add member join event handler

**Files:**
- Modify: `src/index.js:34-124`

- [ ] **Step 1: Add welcome event handler after `ClientReady` handler**

Insert below:

```js
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot ready! Logged in as ${readyClient.user.tag}`);
});
```

Add:

```js
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const welcomeChannel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);

    if (!welcomeChannel?.isTextBased()) {
      console.warn('[WELCOME_MEMBER_SKIP]', {
        guildId: member.guild.id,
        channelId: WELCOME_CHANNEL_ID,
        memberId: member.id,
        reason: 'Welcome channel not found or not text-based'
      });
      return;
    }

    await welcomeChannel.send(buildWelcomeMessage(member.id));

    console.log('[WELCOME_MEMBER_SEND]', {
      guildId: member.guild.id,
      channelId: WELCOME_CHANNEL_ID,
      memberId: member.id
    });
  } catch (error) {
    console.error('[WELCOME_MEMBER_ERROR]', {
      guildId: member.guild.id,
      channelId: WELCOME_CHANNEL_ID,
      memberId: member.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
```

- [ ] **Step 2: Run syntax check after handler addition**

Run:

```bash
node --check src/index.js
```

Expected: command exits successfully with no output.

- [ ] **Step 3: Run app locally to verify startup still works**

Run:

```bash
npm start
```

Expected log includes:

```text
✅ Bot ready! Logged in as
```

Stop process after ready log appears.

- [ ] **Step 4: Commit join handler**

```bash
git add src/index.js
git commit -m "feat: welcome new guild members"
```

### Task 3: Verify behavior against approved spec

**Files:**
- Modify: none
- Verify: `src/index.js`, Discord server channel `1459954382257918199`

- [ ] **Step 1: Confirm formatter always includes required channel mentions**

Inspect `WELCOME_TEMPLATES` in `src/index.js` and confirm every entry contains both exact substrings:

```text
<#1467894995355963562>
<#1460235649947926530>
```

Expected: all templates include both substrings.

- [ ] **Step 2: Trigger manual join-path verification**

Use one of these methods:

1. Have a real test account join server.
2. Temporarily instrument code by calling `buildWelcomeMessage('308925639744946177')` in local REPL only.

If using REPL:

```bash
node -e "const WELCOME_TEMPLATES=['Welcome Pasupan <@USER_ID>! Jangan lupa verif di <#1467894995355963562> dan ambil role di <#1460235649947926530>.']; const buildWelcomeMessage=(memberId)=>WELCOME_TEMPLATES[Math.floor(Math.random()*WELCOME_TEMPLATES.length)].replace('<@USER_ID>', `<@${memberId}>`); console.log(buildWelcomeMessage('308925639744946177'));"
```

Expected output contains:

```text
<@308925639744946177>
<#1467894995355963562>
<#1460235649947926530>
```

- [ ] **Step 3: Verify live Discord send on real join**

Expected in channel `1459954382257918199`:
- joined member mention visible
- verification channel mention visible
- role channel mention visible
- one template variant chosen

Expected in app logs:

```text
[WELCOME_MEMBER_SEND]
```

- [ ] **Step 4: Verify failure path does not crash process**

Temporarily replace `WELCOME_CHANNEL_ID` with invalid ID, start app, trigger join, then restore valid ID.

Expected log:

```text
[WELCOME_MEMBER_SKIP]
```
or
```text
[WELCOME_MEMBER_ERROR]
```

Expected: bot process stays alive.

- [ ] **Step 5: Commit verified implementation**

```bash
git add src/index.js
git commit -m "test: verify member welcome flow"
```

## Self-Review

- Spec coverage: plan covers join trigger, target channel, random hardcoded templates, member mention injection, required verification/role mentions, logging, and graceful failure.
- Placeholder scan: no TBD/TODO markers; each code-changing step includes concrete code and commands.
- Type consistency: uses existing `Events` import, `member.guild.channels.fetch(...)`, `isTextBased()`, and single helper `buildWelcomeMessage(memberId)` consistently.
