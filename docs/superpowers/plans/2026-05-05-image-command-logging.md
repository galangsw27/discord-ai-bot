# /image Command Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured runtime logs to `/image` so usage, cooldowns, success/failure, and latency are visible in console output.

**Architecture:** Keep logging local to `src/commands/image.js` with a tiny helper for consistent event tags and payloads. Preserve all existing Discord replies and image generation behavior; only add observability around current flow.

**Tech Stack:** Node.js ESM, discord.js v14, built-in `console.log` and `console.error`.

---

## File Structure

- Modify `src/commands/image.js`
  - Add structured logging helper.
  - Log request, cooldown, success, and error events.
  - Track duration with `Date.now()`.

---

### Task 1: Add structured /image logs

**Files:**
- Modify: `src/commands/image.js`

- [ ] **Step 1: Update `src/commands/image.js` to add logging helper and event logs**

Apply these exact changes:

```js
import { AttachmentBuilder } from 'discord.js';
import { generateImage } from '../utils/ai.js';

const COOLDOWN_MS = 5 * 60 * 1000;
const imageCooldowns = new Map();
const PROMPT_PREVIEW_LIMIT = 80;

export const data = {
  name: 'image',
  description: 'Buat gambar dari prompt',
  options: [
    {
      name: 'prompt',
      description: 'Deskripsi gambar yang mau Mili buat',
      type: 3,
      required: true
    }
  ]
};

export async function execute(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const prompt = interaction.options.getString('prompt', true);
  const startedAt = Date.now();
  const now = startedAt;
  const lastRequestAt = imageCooldowns.get(userId) || 0;
  const remainingMs = COOLDOWN_MS - (now - lastRequestAt);

  logImageEvent('log', '[IMAGE_REQUEST]', {
    userId,
    guildId,
    channelId,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, PROMPT_PREVIEW_LIMIT)
  });

  if (remainingMs > 0) {
    logImageEvent('log', '[IMAGE_COOLDOWN]', {
      userId,
      guildId,
      channelId,
      remainingMs
    });

    return interaction.reply({
      content: `Duh... mili gabisa ngirim gambar lagi tunggu ${formatRemainingTime(remainingMs)}`,
      ephemeral: false
    });
  }

  imageCooldowns.set(userId, now);

  await interaction.deferReply({ ephemeral: false });

  try {
    const image = await generateImage(prompt);
    const attachment = new AttachmentBuilder(image.buffer, { name: `mili-image.${getExtension(image.mimeType)}` });
    const durationMs = Date.now() - startedAt;

    logImageEvent('log', '[IMAGE_SUCCESS]', {
      userId,
      guildId,
      channelId,
      mimeType: image.mimeType,
      bytes: image.buffer.length,
      durationMs
    });

    await interaction.editReply({
      content: `Ini gambarnya pasupan <@${userId}> ❤️`,
      files: [attachment]
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logImageEvent('error', '[IMAGE_ERROR]', {
      userId,
      guildId,
      channelId,
      durationMs,
      error: error instanceof Error ? error.message : String(error)
    });

    await interaction.editReply('DUH ... mili udah coba gambarinnya tapi gagal 😠');
  }
}

function formatRemainingTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function getExtension(mimeType) {
  if (mimeType?.includes('jpeg')) return 'jpg';
  if (mimeType?.includes('webp')) return 'webp';
  return 'png';
}

function logImageEvent(level, tag, payload) {
  console[level](tag, payload);
}
```

- [ ] **Step 2: Run syntax check**

Run:

```powershell
node --check src/commands/image.js
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 3: Commit**

```powershell
git add src/commands/image.js
git commit -m @'
feat: add image command logging

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

## Self-Review

- Spec coverage: request, cooldown, success, error, duration, prompt preview, and single-file scope are all covered.
- Placeholder scan: no TBD/TODO or vague steps remain.
- Type consistency: `logImageEvent(level, tag, payload)` is defined and used consistently; payload fields match spec names.
