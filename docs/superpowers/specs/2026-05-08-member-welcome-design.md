# Member Welcome Design

## Goal
When new member joins Discord server, Mili should automatically send welcome message in channel `1459954382257918199`.

Message should:
- mention new member
- remind member to verify in channel `1467894995355963562`
- remind member to take roles in channel `1460235649947926530`
- use one of several welcome variations so wording feels flexible, not identical every time

## Context From Existing Server Channels
Relevant channel content already points new members toward rules, verification, and role selection:
- `1460235430644682760` contains server rules and community framing
- `1460235976952778907` explains faction onboarding and points users to role selection
- `1460235649947926530` is role selection channel

Welcome automation should reinforce this existing onboarding path, not replace it.

## Scope
- Add member-join event handler.
- Send welcome message to channel `1459954382257918199`.
- Choose random message from small hardcoded template list.
- Inject joined member mention into selected template.
- Mention verification channel `1467894995355963562` and role channel `1460235649947926530` in every template.
- Log success/failure path.

## Out of Scope
- DM welcome flow.
- Anti-raid or captcha verification.
- Persistent config or database-backed templates.
- Admin command to edit welcome templates.
- Localization or per-guild customization.

## Recommended Approach
Use hardcoded array of 3-6 welcome message templates in `src/index.js` near other Discord event constants.

Why this approach:
- smallest change
- no new storage/config surface
- stable behavior
- easy to verify

Trade-off:
- changing wording later requires code edit

## Event Flow
1. Discord emits `GuildMemberAdd`.
2. Handler fetches target welcome channel `1459954382257918199` from joined guild.
3. If channel missing or not text-based, log warning and stop.
4. Build member mention as `<@member.id>`.
5. Pick random template from predefined array.
6. Replace placeholder token with member mention.
7. Send message to target channel.
8. If send fails, log warning/error and continue without crashing bot.

## Message Template Rules
Every template must include:
- `Welcome Pasupan <@USER_ID>!` or equivalent greeting tone
- verification reminder pointing to `<#1467894995355963562>`
- role reminder pointing to `<#1460235649947926530>`

Templates should stay short and direct.

Example template shapes:
- `Welcome Pasupan <@USER_ID>! Jangan lupa verif di <#1467894995355963562> dan ambil role di <#1460235649947926530>.`
- `Halo Pasupan <@USER_ID>! Verif dulu di <#1467894995355963562>, terus ambil role di <#1460235649947926530> ya.`
- `Selamat datang <@USER_ID>! Jangan lupa verifikasi di <#1467894995355963562> lalu pilih role di <#1460235649947926530>.`

Implementation can keep exact final wording close to these examples.

## Placement In Current Code
Primary file change:
- `src/index.js`

Additions expected:
- welcome channel ID constant
- verification channel ID constant
- role channel ID constant
- welcome template array
- small helper for random template selection or inline selection if kept tiny
- `GuildMemberAdd` event handler

No other files required for first version.

## Error Handling
If any of these fail, bot should log and stop gracefully for that join event:
- target channel not found
- target channel not text-based
- Discord send error

Failure should not affect slash commands, mention AI flow, or bot process health.

## Logging
Add runtime logs for visibility:
- `[WELCOME_MEMBER_SEND]` with guild ID, channel ID, member ID
- `[WELCOME_MEMBER_SKIP]` when channel missing/not text-based
- `[WELCOME_MEMBER_ERROR]` with guild ID, channel ID, member ID, error

## Testing
Manual checks:
1. Simulate or wait for new member join.
2. Confirm message appears in `1459954382257918199`.
3. Confirm joined member is mentioned.
4. Confirm message includes `<#1467894995355963562>`.
5. Confirm message includes `<#1460235649947926530>`.
6. Confirm repeated joins can produce different template variants.
7. If channel ID is wrong or inaccessible, confirm bot logs failure without crashing.

## Risks
Main practical risk is duplicate welcomes if multiple bot instances run simultaneously. Nothing in current request suggests multi-instance deployment guard is needed now, so skip dedup logic for first version.

## Files Expected To Change
- `src/index.js`
- `docs/superpowers/specs/2026-05-08-member-welcome-design.md`
