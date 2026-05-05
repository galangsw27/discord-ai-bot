import { Client, Events, GatewayIntentBits } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { generateAiResponse } from './utils/ai.js';
import { getGuildSettings } from './utils/storage.js';

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

client.on(Events.MessageCreate, async (message) => {
  console.log('[MSG]', {
    guildId: message.guild?.id,
    channelId: message.channel?.id,
    authorId: message.author?.id,
    authorBot: message.author?.bot,
    content: message.content
  });

  if (message.author.bot || !message.guild) return;

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
    await message.reply(response);
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

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

client.login(config.discordToken);
