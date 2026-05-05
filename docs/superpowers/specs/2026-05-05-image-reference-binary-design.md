# /image Reference Image And Binary Output Design

## Goal
Update Mili image generation so `/image` can use an optional Discord attachment as a reference image, call 9router with binary output, and allow image usage in an additional Discord channel.

## Scope
- Add allowed channel ID `1460230180114141271` alongside existing `1500092065730531392`.
- Keep `/image prompt:<text>`.
- Add optional `/image image:<attachment>` reference image input.
- Send 9router image request with `?response_format=binary`.
- Read binary response into a Discord attachment buffer.
- Keep cooldown: 1 user / 5 minutes.
- Keep existing user-facing success/cooldown/failure messages.
- Extend logs with reference-image metadata.

## Out of Scope
- Text trigger commands like `mili!image`.
- Multiple reference images.
- Persistent cooldowns.
- Image moderation beyond Discord/9router behavior.

## Channel Allowlist
Replace single allowed channel constant with an allowlist:
- `1500092065730531392`
- `1460230180114141271`

Mention-AI channel restriction should accept both channels.
Slash `/image` should also use the same allowlist.

## Slash Command Shape
`/image` options:
- `prompt` string, required
- `image` attachment, optional

If `image` exists:
- use attachment URL as reference image input.
- log `hasReferenceImage: true`.

If `image` does not exist:
- generate from text prompt only.

## 9router Request
Use endpoint:
`POST ${config.apiBaseUrl}/images/generations?response_format=binary`

Headers:
- `Authorization: Bearer ${config.apiKey}`
- `Content-Type: application/json`
- Optional `x-connection-id: ${config.ninerouterConnectionId}` when configured

Body fields:
- `model`: `config.imageModel`
- `prompt`: user prompt
- `n`: `config.imageN`
- `size`: `config.imageSize`
- `quality`: `config.imageQuality`
- `background`: `config.imageBackground`
- `image_detail`: `config.imageDetail`
- `output_format`: `config.imageOutputFormat`
- `image`: Discord attachment URL when provided

## Config
Add fields to `src/config.js`:
- `ninerouterConnectionId`: `process.env.NINEROUTER_CONNECTION_ID || ''`
- `imageQuality`: `process.env.IMAGE_QUALITY || 'auto'`
- `imageBackground`: `process.env.IMAGE_BACKGROUND || 'auto'`
- `imageDetail`: `process.env.IMAGE_DETAIL || 'high'`
- `imageOutputFormat`: `process.env.IMAGE_OUTPUT_FORMAT || 'png'`
- `imageN`: `Number(process.env.IMAGE_N || '1')`

Keep existing:
- `imageModel`
- `imageSize`

## Image Helper
Update `generateImage(prompt, referenceImageUrl)`:
- call binary endpoint.
- on non-OK, read text body and throw error.
- on OK, read `arrayBuffer`.
- return:
  - `buffer`
  - `mimeType` from `content-type` header or `image/png`

No JSON parsing is needed for success responses.

## Discord Attachment Handling
In `src/commands/image.js`:
- add attachment option type `11`.
- read with `interaction.options.getAttachment('image')`.
- pass `attachment?.url` to `generateImage`.
- choose output filename by MIME type as current code does.

## Logging
Extend existing image logs:
- `[IMAGE_REQUEST]` includes:
  - `hasReferenceImage`
  - `referenceImageUrlPreview` when present, sliced to 120 chars
- `[IMAGE_SUCCESS]` includes:
  - `hasReferenceImage`
- `[IMAGE_ERROR]` includes:
  - `hasReferenceImage`

Do not log secrets.
Do not log full prompt beyond existing 80-char preview.

## Error Handling
Keep current user-facing failure message:
`DUH ... mili udah coba gambarinnya tapi gagal 😠`

Server logs should include actual error message.

## Test Checklist
1. `node --check src/index.js` passes.
2. `node --check src/config.js` passes.
3. `node --check src/utils/ai.js` passes.
4. `node --check src/commands/image.js` passes.
5. `/image` without attachment returns image file.
6. `/image` with image attachment returns image file using reference.
7. Second `/image` within 5 minutes returns cooldown message.
8. Mention-AI works in channel `1500092065730531392`.
9. Mention-AI works in channel `1460230180114141271`.
10. Mention-AI rejects other channels with allowed-channel message updated to list both channels.

## Files Expected To Change
- `src/index.js`
- `src/config.js`
- `src/utils/ai.js`
- `src/commands/image.js`
- `.env.example`
- `docs/superpowers/specs/2026-05-05-image-reference-binary-design.md`
