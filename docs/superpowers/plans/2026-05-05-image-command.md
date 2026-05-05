# /image Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/image` Discord slash command that generates one image file per prompt through 9router and rate-limits each user to one image every 5 minutes.

**Architecture:** Keep image generation behind `src/utils/ai.js` so slash command code only handles Discord interaction and cooldown flow. Use an in-memory `Map` in `src/commands/image.js` keyed by Discord user ID for simple per-process cooldown tracking.

**Tech Stack:** Node.js ESM, discord.js v14, built-in `fetch`, 9router OpenAI-compatible image generation endpoint.

---

## File Structure

- Create `src/commands/image.js`
  - Defines `/image` slash command data.
  - Handles prompt input, per-user cooldown, Discord replies, and attachment upload.
- Modify `src/utils/ai.js`
  - Adds `generateImage(prompt)` using 9router image endpoint.
  - Keeps existing chat generation behavior unchanged.
- Modify `src/config.js`
  - Adds `imageModel` and `imageSize` config fields.
- Modify `.env.example`
  - Documents `IMAGE_MODEL` and `IMAGE_SIZE`.
- Modify `src/commands/help.js`
  - Adds `/image <prompt>` to command list.

---

### Task 1: Add image config

**Files:**
- Modify: `src/config.js`
- Modify: `.env.example`

- [ ] **Step 1: Update `src/config.js`**

Replace current `config` export with:

```js
export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  apiBaseUrl: process.env.API_BASE_URL || 'https://rwvg2am.9router.com/v1',
  apiKey: process.env.API_KEY || '',
  aiModel: process.env.AI_MODEL || 'ComboCodexMili',
  imageModel: process.env.IMAGE_MODEL || 'gemini/gemini-3-pro-image-preview',
  imageSize: process.env.IMAGE_SIZE || '1024x1024'
};
```

Expected result:
- Existing chat config still works.
- Image config has safe defaults.

- [ ] **Step 2: Update `.env.example`**

Replace file contents with:

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_client_id
API_BASE_URL=https://rwvg2am.9router.com/v1
API_KEY=your_9router_api_key
AI_MODEL=ComboCodexMili
IMAGE_MODEL=gemini/gemini-3-pro-image-preview
IMAGE_SIZE=1024x1024
```

- [ ] **Step 3: Verify syntax**

Run:

```powershell
node --check src/config.js
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 4: Commit**

```powershell
git add src/config.js .env.example
git commit -m @'
feat: add image generation config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 2: Add 9router image generation utility

**Files:**
- Modify: `src/utils/ai.js`

- [ ] **Step 1: Add `generateImage` after `generateAiResponse`**

Append this code to `src/utils/ai.js` after the existing `generateAiResponse` function:

```js
export async function generateImage(prompt) {
  const response = await fetch(`${config.apiBaseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.imageModel,
      prompt,
      response_format: 'b64_json',
      size: config.imageSize
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const image = data.data?.[0];

  if (!image) {
    throw new Error('Image response missing data[0]');
  }

  if (image.b64_json) {
    return {
      buffer: Buffer.from(image.b64_json, 'base64'),
      mimeType: 'image/png'
    };
  }

  if (image.url) {
    const imageResponse = await fetch(image.url);

    if (!imageResponse.ok) {
      const errorBody = await imageResponse.text();
      throw new Error(`Image URL fetch failed: ${imageResponse.status} ${errorBody}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: imageResponse.headers.get('content-type') || 'image/png'
    };
  }

  throw new Error('Image response missing b64_json or url');
}
```

- [ ] **Step 2: Verify syntax**

Run:

```powershell
node --check src/utils/ai.js
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 3: Commit**

```powershell
git add src/utils/ai.js
git commit -m @'
feat: add 9router image generation helper

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 3: Add `/image` slash command

**Files:**
- Create: `src/commands/image.js`

- [ ] **Step 1: Create command file**

Create `src/commands/image.js` with:

```js
import { AttachmentBuilder } from 'discord.js';
import { generateImage } from '../utils/ai.js';

const COOLDOWN_MS = 5 * 60 * 1000;
const imageCooldowns = new Map();

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
  const now = Date.now();
  const lastRequestAt = imageCooldowns.get(userId) || 0;
  const remainingMs = COOLDOWN_MS - (now - lastRequestAt);

  if (remainingMs > 0) {
    return interaction.reply({
      content: `Duh... mili gabisa ngirim gambar lagi tunggu ${formatRemainingTime(remainingMs)}`,
      ephemeral: false
    });
  }

  const prompt = interaction.options.getString('prompt', true);
  imageCooldowns.set(userId, now);

  await interaction.deferReply({ ephemeral: false });

  try {
    const image = await generateImage(prompt);
    const attachment = new AttachmentBuilder(image.buffer, { name: `mili-image.${getExtension(image.mimeType)}` });

    await interaction.editReply({
      content: `Ini gambarnya pasupan <@${userId}> ❤️`,
      files: [attachment]
    });
  } catch (error) {
    console.error('Image generation error:', error);
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
```

- [ ] **Step 2: Verify syntax**

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
feat: add image slash command

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 4: Update help command

**Files:**
- Modify: `src/commands/help.js`

- [ ] **Step 1: Add `/image` line**

Replace `helpMessage` template in `src/commands/help.js` with:

```js
  const helpMessage = `
**📚 Daftar Perintah Bot AI**

\`/ai <pertanyaan>\` - Tanya sesuatu ke AI
\`/image <prompt>\` - Buat gambar dari prompt
\`/ping\` - Cek latency bot
\`/help\` - Tampilkan pesan bantuan ini

**⚙️ Admin Commands:**
\`/toggle-ai\` - Aktif/nonaktif AI (admin only)

**💡 Tips:** Mention bot untuk auto-response (jika diaktifkan)

Dibuat dengan ❤️ menggunakan Discord.js & 9Router
  `.trim();
```

- [ ] **Step 2: Verify syntax**

Run:

```powershell
node --check src/commands/help.js
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 3: Commit**

```powershell
git add src/commands/help.js
git commit -m @'
feat: document image command in help

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 5: Verify slash command deployment and runtime syntax

**Files:**
- No code changes expected.

- [ ] **Step 1: Check all changed JavaScript files**

Run:

```powershell
node --check src/config.js; if ($?) { node --check src/utils/ai.js }; if ($?) { node --check src/commands/image.js }; if ($?) { node --check src/commands/help.js }; if ($?) { node --check src/deploy-commands.js }
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 2: Dry-load commands through deployment script if env exists**

Run:

```powershell
npm run deploy-commands
```

Expected success shape:

```text
Started refreshing 4 application (/) commands.
Successfully reloaded 4 application (/) commands.
```

If Discord env vars or token are missing/invalid, expected failure shape includes Discord auth/config error. Do not bypass it; record exact error and continue to Step 3.

- [ ] **Step 3: Start bot locally for smoke test**

Run:

```powershell
npm start
```

Expected startup shape:

```text
✅ Bot ready! Logged in as <bot tag>
```

Keep process running during manual Discord checks.

- [ ] **Step 4: Manual Discord checks**

In Discord:

1. Run `/help`.
   - Expected: output includes `/image <prompt> - Buat gambar dari prompt`.
2. Run `/image prompt:chibi tactical mascot merah hitam cute dangerous`.
   - Expected: bot replies with text `Ini gambarnya pasupan <@USER_ID> ❤️` and image file attachment.
3. Run `/image prompt:test cooldown` again with same Discord user within 5 minutes.
   - Expected: bot replies normal chat message matching `Duh... mili gabisa ngirim gambar lagi tunggu {sisa_waktu}`.
4. Run `/image prompt:test from second account` from another Discord user.
   - Expected: second user is not blocked by first user's cooldown.

- [ ] **Step 5: Stop local bot**

Press `Ctrl+C` in terminal running `npm start`.

- [ ] **Step 6: Commit verification-only docs if plan/spec changed during execution**

If no files changed during verification, skip commit.

If only plan/spec checkboxes changed, run:

```powershell
git add docs/superpowers/plans/2026-05-05-image-command.md docs/superpowers/specs/2026-05-05-image-command-design.md
git commit -m @'
docs: update image command implementation plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

## Self-Review

- Spec coverage: command creation, cooldown, 9router image call, file upload, config/env help update, error messages, and manual tests are covered.
- Placeholder scan: no TBD/TODO/fill-later language remains.
- Type consistency: `generateImage(prompt)` returns `{ buffer, mimeType }`; command consumes same shape. Config names are `imageModel` and `imageSize` everywhere.
