# /image Reference Image And Binary Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `/image` so it supports an optional Discord attachment as reference image, uses 9router binary image output, and allows operation in a second Discord channel.

**Architecture:** Keep Discord interaction handling in `src/index.js` and `src/commands/image.js`, with image transport details isolated in `src/utils/ai.js`. Reuse current cooldown and logging behavior, extending only the config surface, allowed-channel logic, and image request payload.

**Tech Stack:** Node.js ESM, discord.js v14, built-in fetch, 9router OpenAI-compatible image endpoint.

---

## File Structure

- Modify `src/index.js`
  - Replace single allowed channel constant with allowlist used by mention flow.
- Modify `src/config.js`
  - Add binary-request and connection-id config.
- Modify `.env.example`
  - Document new image-related env vars.
- Modify `src/utils/ai.js`
  - Update `generateImage(prompt, referenceImageUrl)` for binary output.
- Modify `src/commands/image.js`
  - Add optional attachment input, allowlist gate, reference-image logging metadata.

---

### Task 1: Add config for binary image requests

**Files:**
- Modify: `src/config.js`
- Modify: `.env.example`

- [ ] **Step 1: Update `src/config.js` config export**

Change the `config` export to include these additional fields:

```js
export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  apiBaseUrl: process.env.API_BASE_URL || 'https://rwvg2am.9router.com/v1',
  apiKey: process.env.API_KEY || '',
  aiModel: process.env.AI_MODEL || 'ComboCodexMili',
  imageModel: process.env.IMAGE_MODEL || 'gemini/gemini-3-pro-image-preview',
  imageSize: process.env.IMAGE_SIZE || '1024x1024',
  ninerouterConnectionId: process.env.NINEROUTER_CONNECTION_ID || '',
  imageQuality: process.env.IMAGE_QUALITY || 'auto',
  imageBackground: process.env.IMAGE_BACKGROUND || 'auto',
  imageDetail: process.env.IMAGE_DETAIL || 'high',
  imageOutputFormat: process.env.IMAGE_OUTPUT_FORMAT || 'png',
  imageN: Number(process.env.IMAGE_N || '1')
};
```

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
NINEROUTER_CONNECTION_ID=
IMAGE_QUALITY=auto
IMAGE_BACKGROUND=auto
IMAGE_DETAIL=high
IMAGE_OUTPUT_FORMAT=png
IMAGE_N=1
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
feat: add binary image request config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 2: Update image helper for binary responses

**Files:**
- Modify: `src/utils/ai.js`

- [ ] **Step 1: Change `generateImage` signature and request**

Replace the existing `generateImage` function with:

```js
export async function generateImage(prompt, referenceImageUrl = '') {
  const response = await fetch(`${config.apiBaseUrl}/images/generations?response_format=binary`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(config.ninerouterConnectionId ? { 'x-connection-id': config.ninerouterConnectionId } : {})
    },
    body: JSON.stringify({
      model: config.imageModel,
      prompt,
      n: config.imageN,
      size: config.imageSize,
      quality: config.imageQuality,
      background: config.imageBackground,
      image_detail: config.imageDetail,
      output_format: config.imageOutputFormat,
      ...(referenceImageUrl ? { image: referenceImageUrl } : {})
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${response.status} ${errorBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') || 'image/png'
  };
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
feat: switch image helper to binary output

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 3: Allow second image channel in mention flow

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Replace single allowed channel constant**

Replace:

```js
const ALLOWED_CHANNEL_ID = '1500092065730531392';
```

With:

```js
const ALLOWED_CHANNEL_IDS = new Set([
  '1500092065730531392',
  '1460230180114141271'
]);
```

- [ ] **Step 2: Update mention-channel check and reply**

Replace this block:

```js
  const isAllowedChannel = message.channel?.id === ALLOWED_CHANNEL_ID;
  console.log('[MENTION_CHECK]', {
    botId,
    isMentioned,
    channelId: message.channel?.id,
    isAllowedChannel,
    allowedChannelId: ALLOWED_CHANNEL_ID,
    mentionIds: [...message.mentions.users.keys()]
  });
```

With:

```js
  const isAllowedChannel = ALLOWED_CHANNEL_IDS.has(message.channel?.id);
  console.log('[MENTION_CHECK]', {
    botId,
    isMentioned,
    channelId: message.channel?.id,
    isAllowedChannel,
    allowedChannelIds: [...ALLOWED_CHANNEL_IDS],
    mentionIds: [...message.mentions.users.keys()]
  });
```

Replace this reply line:

```js
      await message.reply(`Maaf pasupan <@${message.author.id}> ❤️ aku cuma aktif di <#${ALLOWED_CHANNEL_ID}> ya.`);
```

With:

```js
      await message.reply(`Maaf pasupan <@${message.author.id}> ❤️ aku cuma aktif di <#1500092065730531392> atau <#1460230180114141271> ya.`);
```

- [ ] **Step 3: Verify syntax**

Run:

```powershell
node --check src/index.js
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 4: Commit**

```powershell
git add src/index.js
git commit -m @'
feat: allow second image channel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 4: Add attachment reference support to `/image`

**Files:**
- Modify: `src/commands/image.js`

- [ ] **Step 1: Update command option schema**

Replace `data` export with:

```js
export const data = {
  name: 'image',
  description: 'Buat gambar dari prompt',
  options: [
    {
      name: 'prompt',
      description: 'Deskripsi gambar yang mau Mili buat',
      type: 3,
      required: true
    },
    {
      name: 'image',
      description: 'Gambar referensi buat Mili pakai',
      type: 11,
      required: false
    }
  ]
};
```

- [ ] **Step 2: Update execution flow**

Inside `execute(interaction)`, make these exact changes:

```js
  const prompt = interaction.options.getString('prompt', true);
  const referenceImage = interaction.options.getAttachment('image');
  const referenceImageUrl = referenceImage?.url || '';
```

Update request log payload to:

```js
  logImageEvent('log', '[IMAGE_REQUEST]', {
    userId,
    guildId,
    channelId,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, PROMPT_PREVIEW_LIMIT),
    hasReferenceImage: Boolean(referenceImageUrl),
    referenceImageUrlPreview: referenceImageUrl ? referenceImageUrl.slice(0, 120) : ''
  });
```

Change image generation call to:

```js
    const image = await generateImage(prompt, referenceImageUrl);
```

Update success log payload to:

```js
    logImageEvent('log', '[IMAGE_SUCCESS]', {
      userId,
      guildId,
      channelId,
      hasReferenceImage: Boolean(referenceImageUrl),
      mimeType: image.mimeType,
      bytes: image.buffer.length,
      durationMs
    });
```

Update error log payload to:

```js
    logImageEvent('error', '[IMAGE_ERROR]', {
      userId,
      guildId,
      channelId,
      hasReferenceImage: Boolean(referenceImageUrl),
      durationMs,
      error: error instanceof Error ? error.message : String(error)
    });
```

- [ ] **Step 3: Gate `/image` by allowed channels**

Add near top of file:

```js
const ALLOWED_CHANNEL_IDS = new Set([
  '1500092065730531392',
  '1460230180114141271'
]);
```

Add at start of `execute(interaction)` after IDs are read:

```js
  if (!ALLOWED_CHANNEL_IDS.has(channelId)) {
    return interaction.reply({
      content: `Maaf pasupan <@${userId}> ❤️ aku cuma aktif di <#1500092065730531392> atau <#1460230180114141271> ya.`,
      ephemeral: false
    });
  }
```

- [ ] **Step 4: Verify syntax**

Run:

```powershell
node --check src/commands/image.js
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 5: Commit**

```powershell
git add src/commands/image.js
git commit -m @'
feat: add reference image support to image command

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

### Task 5: Final verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run syntax checks**

Run:

```powershell
node --check src/index.js; if ($?) { node --check src/config.js }; if ($?) { node --check src/utils/ai.js }; if ($?) { node --check src/commands/image.js }; if ($?) { node --check src/deploy-commands.js }
```

Expected:

```text
(no output, exit code 0)
```

- [ ] **Step 2: Redeploy slash commands**

Run:

```powershell
npm run deploy-commands
```

Expected success shape:

```text
Started refreshing 4 application (/) commands.
Successfully reloaded 4 application (/) commands.
```

- [ ] **Step 3: Manual Discord checks**

In Discord:

1. Run `/image prompt:a cute cat wearing a hat` in `<#1500092065730531392>`.
   - Expected: image file reply.
2. Run `/image prompt:a cute cat wearing a hat image:<attachment>` in `<#1500092065730531392>`.
   - Expected: image file reply using reference image.
3. Run `/image` again within 5 minutes.
   - Expected: cooldown reply.
4. Repeat test in `<#1460230180114141271>`.
   - Expected: allowed.
5. Run command in another channel.
   - Expected: allowed-channel denial reply.

- [ ] **Step 4: Commit verification docs only if needed**

If no files changed during verification, skip.

If docs changed, run:

```powershell
git add docs/superpowers/specs/2026-05-05-image-reference-binary-design.md docs/superpowers/plans/2026-05-05-image-reference-binary.md
git commit -m @'
docs: update image reference binary plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
'@
```

---

## Self-Review

- Spec coverage: second allowed channel, optional attachment input, binary endpoint, connection-id/config additions, and logging metadata are all covered.
- Placeholder scan: no TBD/TODO or vague implementation language remains.
- Type consistency: `generateImage(prompt, referenceImageUrl)` is defined consistently with command usage; config field names match across tasks.
