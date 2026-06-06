import { Client, Events, GatewayIntentBits } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { generateAiResponse } from './utils/ai.js';
import { getGuildSettings } from './utils/storage.js';
import { searchWeb } from './utils/web-search.js';
import { parseSearchPrefix, formatSearchResultLinks, buildSearchSummaryPrompt, buildSearchReply } from './utils/search-formatter.js';

const ALLOWED_CHANNEL_IDS = new Set([
  '1500092065730531392',
  '1460230180114141271'
]);
const commands = await loadCommands();
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
const WELCOME_CHANNEL_ID = '1459954382257918199';
const VERIFICATION_CHANNEL_ID = '1467894995355963562';
const ROLE_CHANNEL_ID = '1460235649947926530';
const ROLE_INFO_CHANNEL_ID = '1460235976952778907';
const SPAM_TRAP_CHANNEL_ID = '1512635399426674778';
const ONE_HOUR_MS = 60 * 60 * 1000;
const VERIFICATION_CHANNEL_MENTION = `<#${VERIFICATION_CHANNEL_ID}>`;
const ROLE_CHANNEL_MENTION = `<#${ROLE_CHANNEL_ID}>`;
const ROLE_INFO_CHANNEL_MENTION = `<#${ROLE_INFO_CHANNEL_ID}>`;
const WELCOME_TEMPLATES = [
  'Welcome Pasupan <@USER_ID>! Jangan lupa verif di {verification}, ambil role di {role}, dan keterangan role ada di {roleInfo}.',
  'Halo Pasupan <@USER_ID>! Verif dulu di {verification}, terus ambil role di {role} ya. Keterangan role ada di {roleInfo}.',
  'Selamat datang <@USER_ID>! Jangan lupa verifikasi di {verification}, lalu pilih role di {role}. Keterangan role ada di {roleInfo}.',
  'Welcome <@USER_ID>! Jangan lupa verif di {verification}, ambil role di {role}, dan cek keterangan role di {roleInfo} biar langsung siap gabung.',
  'Hai <@USER_ID>! Singgah dulu ke {verification} buat verif, lalu ambil role di {role} ya. Keterangan role ada di {roleInfo}.'
];

function buildWelcomeMessage(memberId) {
  const template = WELCOME_TEMPLATES[Math.floor(Math.random() * WELCOME_TEMPLATES.length)];
  return template
    .replace('<@USER_ID>', `<@${memberId}>`)
    .replaceAll('{verification}', VERIFICATION_CHANNEL_MENTION)
    .replaceAll('{role}', ROLE_CHANNEL_MENTION)
    .replaceAll('{roleInfo}', ROLE_INFO_CHANNEL_MENTION);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});


client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);

    if (!channel || !channel.isTextBased()) {
      console.warn('[WELCOME_MEMBER_SKIP]', {
        guildId: member.guild.id,
        channelId: WELCOME_CHANNEL_ID,
        memberId: member.id,
        reason: 'Welcome channel not found or not text-based'
      });
      return;
    }

    await channel.send(buildWelcomeMessage(member.id));
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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command?.execute) {
    console.warn('[SLASH_UNKNOWN]', { commandName: interaction.commandName });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('[SLASH_ERROR]', {
      commandName: interaction.commandName,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user?.id,
      error: error instanceof Error ? error.message : String(error)
    });

    const message = 'DUH ... aku udah ga mood nanti lah jawabnya 😠';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => {});
      return;
    }

    await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
});

async function cleanKickAndPurge(member) {
  try {
    await member.kick('Automated: sent message in spam-trap channel');
    console.log('[SPAM_KICK]', {
      guildId: member.guild.id,
      memberId: member.id,
      tag: member.user.tag
    });
  } catch (kickErr) {
    console.error('[SPAM_KICK_ERROR]', {
      memberId: member.id,
      error: kickErr instanceof Error ? kickErr.message : String(kickErr)
    });
    return;
  }

  const since = Date.now() - ONE_HOUR_MS;

  for (const [, channel] of member.guild.channels.cache) {
    if (!channel.isTextBased()) continue;
    if (channel.id === SPAM_TRAP_CHANNEL_ID) continue;

    try {
      let deleted = 0;
      let lastId;

      while (true) {
        const fetchOptions = { limit: 100 };
        if (lastId) fetchOptions.before = lastId;

        const fetched = await channel.messages.fetch(fetchOptions);
        if (!fetched.size) break;

        const matching = fetched.filter(
          (m) => m.author.id === member.id && m.createdTimestamp >= since
        );

        if (matching.size >= 2) {
          try {
            const deletedMsgs = await channel.bulkDelete(matching, true);
            deleted += deletedMsgs.size;
          } catch (bulkErr) {
            for (const msg of matching.values()) {
              try { await msg.delete(); deleted += 1; } catch {}
            }
          }
        } else if (matching.size === 1) {
          const msg = matching.first();
          try { await msg.delete(); deleted += 1; } catch {}
        }

        lastId = fetched.last()?.id;
        if (!lastId) break;
        if (fetched.last().createdTimestamp < since) break;
      }

      if (deleted > 0) {
        console.log('[SPAM_PURGE]', {
          memberId: member.id,
          channelId: channel.id,
          deleted
        });
      }
    } catch (channelErr) {
      console.warn('[SPAM_PURGE_CHANNEL_SKIP]', {
        memberId: member.id,
        channelId: channel.id,
        error: channelErr instanceof Error ? channelErr.message : String(channelErr)
      });
    }
  }
}

client.on(Events.MessageCreate, async (message) => {
  console.log('[MSG]', {
    guildId: message.guild?.id,
    channelId: message.channel?.id,
    authorId: message.author?.id,
    authorBot: message.author?.bot,
    content: message.content
  });

  if (message.author.bot || !message.guild) return;

  if (message.channel?.id === SPAM_TRAP_CHANNEL_ID) {
    console.log('[SPAM_TRAP_HIT]', {
      guildId: message.guild.id,
      memberId: message.author.id,
      channelId: message.channel.id
    });
    cleanKickAndPurge(message.member).catch((err) => {
      console.error('[SPAM_TRAP_ERROR]', {
        memberId: message.author?.id,
        error: err instanceof Error ? err.message : String(err)
      });
    });
    return;
  }

  const prefixMatch = parseSearchPrefix(message.content);
  if (prefixMatch && !prefixMatch.empty) {
    try {
      await message.channel.sendTyping();

      const query = prefixMatch.query;
      const searchData = await searchWeb(query, { maxResults: 5 });
      const linksBlock = formatSearchResultLinks(searchData.results, 5);

      const summaryPrompt = buildSearchSummaryPrompt(query, searchData.results, searchData.answer);
      const channel = { id: message.channel.id, name: message.channel.name };
      const summary = await generateAiResponse(summaryPrompt, message.author, channel, '', '');

      const replyText = buildSearchReply(query, linksBlock, summary, searchData.provider);
      await message.reply(replyText);
    } catch (error) {
      console.error('[SEARCH_ERROR]', {
        guildId: message.guild?.id,
        channelId: message.channel?.id,
        userId: message.author?.id,
        query: prefixMatch?.query,
        error: error instanceof Error ? error.message : String(error)
      });
      await message.reply('Duh, pencariannya lagi error nih pasupan 😅 Coba bentar lagi ya ❤️');
    }
    return;
  }

  if (prefixMatch && prefixMatch.empty) {
    await message.reply('Cara pakai: `!search <apa yang mau dicari>` pasupan ❤️');
    return;
  }

  const botId = client.user?.id;
  const isMentioned = botId ? message.mentions.users.has(botId) : false;
  const isAllowedChannel = ALLOWED_CHANNEL_IDS.has(message.channel?.id);
  console.log('[MENTION_CHECK]', {
    botId,
    isMentioned,
    channelId: message.channel?.id,
    isAllowedChannel,
    allowedChannelIds: [...ALLOWED_CHANNEL_IDS],
    mentionIds: [...message.mentions.users.keys()]
  });
  if (!isMentioned) return;

  if (!isAllowedChannel) {
    try {
      await message.reply(`Maaf pasupan <@${message.author.id}> ❤️ aku cuma aktif di <#1500092065730531392>  ya.`);
    } catch (error) {
      console.error('Channel restriction reply error:', error);
    }
    return;
  }

  const settings = await getGuildSettings(message.guild.id);
  if (settings.aiEnabled === false) return;

  const originalContent = message.content.trim();
  const rawPrompt = message.content.replace(/<@!?\d+>/g, '').trim();
  const routedPrompt = rawPrompt || 'sapa aku sebagai Mili dengan gaya khas MILICUTE.';

  await message.channel.sendTyping();

  const recentMessages = await getRecentMessages(message.channel, message.id, 8);
  const channel = { id: message.channel.id, name: message.channel.name };
  const roleCountText = await getMentionedRoleCountsText(message);
  const eventContext = await getEventScheduleContext(message.guild, routedPrompt, message.author.id);
  const context = `${buildDiscordContext(message, originalContent)}\n[Role Counts]\n${roleCountText}${eventContext ? `\n${eventContext}` : ''}`;

  try {
    const response = await generateAiResponse(routedPrompt, message.author, channel, recentMessages, context);
    const truncated = response.length > 2000 ? response.slice(0, 1997) + '...' : response;
    await message.reply(truncated);
  } catch (error) {
    console.error('Mention AI Error:', error);
    await message.reply('DUH ... aku udah ga mood nanti lah jawabnya 😠');
  }
});

async function loadCommands() {
  const commandMap = new Map();
  const commandsPath = join(process.cwd(), 'src', 'commands');
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);

    if (command.data?.name && command.execute) {
      commandMap.set(command.data.name, command);
    }
  }

  return commandMap;
}

function buildDiscordContext(message, originalContent = '') {
  const guildName = message.guild?.name || '';
  const memberCount = message.guild?.memberCount || 0;
  const authorDisplayName = message.member?.displayName || message.author?.username || '';
  const botId = message.client.user?.id;

  const mentionedUsers = [...message.mentions.users.values()];
  const targetUsers = mentionedUsers.filter(u => u.id !== botId);

  const mentionUsers = mentionedUsers
    .map(u => `<@${u.id}> (${u.username}${u.globalName ? ` / ${u.globalName}` : ''})${u.id === botId ? ' [BOT_MILI]' : ''}`)
    .join(', ');

  const targetUserLines = targetUsers.map(u => {
    const member = message.guild?.members.cache.get(u.id);
    const displayName = member?.displayName || u.globalName || u.username;
    return `- <@${u.id}> displayName="${displayName}" username="${u.username}"`;
  });

  const mentionRoles = [...message.mentions.roles.values()]
    .map(r => `<@&${r.id}> (${r.name})`)
    .join(', ');

  const mentionChannels = [...message.mentions.channels.values()]
    .map(c => `<#${c.id}> (${c.name})`)
    .join(', ');

  return [
    `[Guild] Name: ${guildName}`,
    `[Guild] Member Count: ${memberCount}`,
    `[Author] Mention: <@${message.author.id}>`,
    `[Author] Display Name: ${authorDisplayName}`,
    `[Original Message With Mentions]: ${originalContent}`,
    `[Mentions] Users: ${mentionUsers || '-'}`,
    `[Target Users Mentioned By Author - respond about these users if user talks about them]:`,
    targetUserLines.length ? targetUserLines.join('\n') : '-',
    `[Mentions] Roles: ${mentionRoles || '-'}`,
    `[Mentions] Channels: ${mentionChannels || '-'}`
  ].join('\n');
}

async function getMentionedRoleCountsText(message) {
  try {
    const roles = [...message.mentions.roles.values()];
    if (!roles.length) return '-';

    await message.guild.members.fetch();

    return roles
      .map(role => `- <@&${role.id}> (${role.name}): ${role.members.size} member`)
      .join('\n');
  } catch (error) {
    console.warn('Role count fetch failed:', error.message);
    return '-';
  }
}

async function getRecentMessages(channel, beforeMessageId, limit = 8) {
  try {
    const fetched = await channel.messages.fetch({ limit: limit + 1 });
    const filtered = fetched
      .filter(m => m.id !== beforeMessageId && !m.author.bot)
      .first(limit);

    return filtered
      .reverse()
      .map(m => `<@${m.author.id}> (${m.member?.displayName || m.author.username}): ${m.content}`)
      .join('\n');
  } catch {
    return '';
  }
}

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

    const nearestEvent = findNearestEvent(latestMessage.content);

    return [
      `[Event Schedule Source Channel]: <#${EVENT_SOURCE_CHANNEL_ID}>`,
      `[Latest Event Update Message Timestamp]: ${new Date(latestMessage.createdTimestamp).toISOString()}`,
      `[Latest Event Update Content]: ${latestMessage.content}`,
      `[Latest Parsed Event Date]: ${parseEventDate(latestMessage.content)}`,
      nearestEvent ? `[Nearest Event]: ${nearestEvent.raw}` : '[Nearest Event]: NOT_FOUND',
      nearestEvent ? `[Nearest Event Date]: ${nearestEvent.dateLabel}` : '[Nearest Event Date]: -',
      nearestEvent ? `[Nearest Event Venue]: ${nearestEvent.venue}` : '[Nearest Event Venue]: -',
      nearestEvent ? `[Nearest Event Time]: ${nearestEvent.time}` : '[Nearest Event Time]: -',
      nearestEvent ? `[Days Until Nearest Event]: ${nearestEvent.daysUntil}` : '[Days Until Nearest Event]: -'
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
  const nearestEvent = findNearestEvent(content);
  if (nearestEvent) return nearestEvent.dateLabel;

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

function findNearestEvent(content) {
  const events = parseScheduleEvents(content);
  if (!events.length) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const upcoming = events
    .filter(event => event.date.getTime() >= todayStart)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (!upcoming.length) return null;

  const nearest = upcoming[0];
  const diffMs = nearest.date.getTime() - todayStart;
  const daysUntil = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  return {
    raw: nearest.raw,
    dateLabel: nearest.dateLabel,
    venue: nearest.venue,
    time: nearest.time,
    daysUntil
  };
}

function parseScheduleEvents(content) {
  const events = [];
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const compactMatch = line.match(/^(?<dateLabel>[^—]+?)\s+—\s+(?<venue>[^—]+?)\s+—\s+(?<time>.+)$/);
    if (compactMatch?.groups) {
      const date = parseIndonesianDateLabel(compactMatch.groups.dateLabel);
      if (date) {
        events.push({
          raw: line,
          dateLabel: compactMatch.groups.dateLabel.trim(),
          venue: compactMatch.groups.venue.trim(),
          time: compactMatch.groups.time.trim(),
          date
        });
      }
      continue;
    }

    if (!line.startsWith('📅')) continue;

    const dateLabel = line.replace(/^📅\s*/, '').trim();
    const date = parseIndonesianDateLabel(dateLabel);
    if (!date) continue;

    const venueLine = lines[i + 1] || '';
    const timeLine = lines[i + 2] || '';
    const venue = venueLine.startsWith('📍') ? venueLine.replace(/^📍\s*/, '').trim() : '-';
    const time = timeLine.startsWith('⏰') ? timeLine.replace(/^⏰\s*/, '').trim() : '-';

    events.push({
      raw: `${dateLabel} — ${venue} — ${time}`,
      dateLabel,
      venue,
      time,
      date
    });
  }

  return events;
}

function parseIndonesianDateLabel(label) {
  const normalized = label
    .toLowerCase()
    .replace(/jum['’]?at/g, 'jumat')
    .replace(/[^a-z0-9\s,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const monthMap = {
    januari: 0,
    februari: 1,
    maret: 2,
    april: 3,
    mei: 4,
    juni: 5,
    juli: 6,
    agustus: 7,
    september: 8,
    oktober: 9,
    november: 10,
    desember: 11
  };

  const match = normalized.match(/(?:senin|selasa|rabu|kamis|jumat|sabtu|minggu)?\s*,?\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!match) return null;

  const day = Number(match[1]);
  const monthName = match[2];
  const year = Number(match[3]);
  const month = monthMap[monthName];

  if (month === undefined) return null;
  return new Date(year, month, day);
}

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

client.login(config.discordToken);
