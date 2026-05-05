# /image Command Design

## Goal
Add a new Discord slash command `/image` so Mili can generate an image from a user prompt and send the resulting image file directly into chat.

## Scope
- Add `/image` slash command with required `prompt` string option.
- Enforce per-user cooldown: one image request every 5 minutes.
- When a user is still on cooldown, reply in the channel with this exact message pattern:
  `Duh... mili gabisa ngirim gambar lagi tunggu {sisa_waktu}`
- Generate image through 9router text-to-image endpoint.
- Upload generated image as a Discord attachment.
- Update help output to include `/image`.

## Out of Scope
- Persistent cooldowns across bot restarts.
- Multi-image generation.
- Admin bypasses.
- Per-guild or per-channel image quotas.

## Recommended Approach
Use an in-memory cooldown map keyed by Discord user ID.

Why this approach:
- Smallest change set.
- Fits current single-process bot architecture.
- Avoids unnecessary storage complexity for an initial version.

Tradeoff:
- Cooldowns reset when the bot process restarts.

## Architecture

### 1. Slash command module
Create `src/commands/image.js`.

Responsibilities:
- Register `/image` with one required string option: `prompt`.
- Check cooldown before contacting 9router.
- Reply with cooldown message if blocked.
- Call image generation utility if allowed.
- Reply with generated file attachment on success.
- Reply with failure message on image generation errors.

### 2. Image generation utility
Add image-specific helper in `src/utils/ai.js`.

Responsibilities:
- Send `POST ${config.apiBaseUrl}/images/generations`.
- Use existing bearer token pattern from current API integration.
- Send JSON body with:
  - `model`: from config
  - `prompt`: slash command input
  - `response_format`: `b64_json`
  - `size`: from config
- Parse response.
- Decode returned base64 image into a Node `Buffer`.
- Return file payload to command layer.

Compatibility fallback:
- If provider returns `data[0].url` instead of `b64_json`, fetch URL and convert response into `Buffer`.
- This keeps command resilient to provider-side response variation without changing command flow.

### 3. Config surface
Extend `src/config.js` and `.env.example` with:
- `IMAGE_MODEL`
- `IMAGE_SIZE`

Defaults:
- `IMAGE_MODEL=gemini/gemini-3-pro-image-preview`
- `IMAGE_SIZE=1024x1024`

## Request/Response Flow
1. User runs `/image prompt:<text>`.
2. Command reads user ID.
3. Command checks in-memory cooldown map.
4. If request is too early:
   - compute remaining time in minutes/seconds
   - reply with normal channel message:
     `Duh... mili gabisa ngirim gambar lagi tunggu {sisa_waktu}`
5. If allowed:
   - store current timestamp for user
   - call image generation utility
6. Utility sends request to 9router.
7. Utility returns image `Buffer` plus MIME type/extension hint.
8. Command replies to interaction with:
   - content: `Ini gambarnya pasupan <@USER_ID> ❤️`
   - file attachment built from returned buffer

## Cooldown Rules
- Scope: per Discord user ID.
- Limit: 1 image per 5 minutes.
- Cooldown starts when request is accepted for generation.
- If generation later fails, cooldown remains consumed.

Reason for consuming cooldown on accepted request:
- Prevent spam retries against image API.
- Keep rate-limit behavior simple and predictable.

## User-Facing Messages

### Success
`Ini gambarnya pasupan <@USER_ID> ❤️`

### Cooldown
`Duh... mili gabisa ngirim gambar lagi tunggu {sisa_waktu}`

`sisa_waktu` format:
- `4m 12s`
- `59s`

### Failure
`DUH ... mili udah coba gambarinnya tapi gagal 😠`

## Discord Integration Details
- Use `AttachmentBuilder` from `discord.js`.
- Prefer filename extension from MIME type when available.
- Default filename can be `mili-image.png`.
- Reply should be non-ephemeral so message is visible in chat.

## Error Handling
Handle these as one user-facing failure message plus server-side logging:
- 9router HTTP error
- malformed JSON response
- missing `data[0]`
- invalid `b64_json`
- image URL fetch failure
- Discord attachment send failure

Log details to console, but keep user-facing error stable.

## Testing
Manual verification required:
1. `/image` with valid prompt sends image file to chat.
2. Second `/image` from same user within 5 minutes returns cooldown message in chat.
3. Cooldown message shows correct remaining time shape.
4. Different user can still use `/image` immediately.
5. `/help` includes `/image` command.
6. Slash command deployment includes new command.

## Files Expected To Change
- `src/commands/image.js` (new)
- `src/commands/help.js`
- `src/utils/ai.js`
- `src/config.js`
- `.env.example`

## Non-Goals And Constraints
- Do not refactor unrelated AI chat flow.
- Do not add persistent storage for cooldown yet.
- Do not add moderation or prompt filtering unless separate requirement appears.
