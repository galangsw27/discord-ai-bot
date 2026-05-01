import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { generateAiResponse } from './utils/ai.js';
import { getGuildSettings } from './utils/storage.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const GREETING_REGEX = /^(halo\s*mili|hai\s*mili|hi\s*mili|hey\s*mili|mili)\b[!?.\s]*$/i;
const GREETING_PREFIX_REGEX = /^(halo\s*mili|hai\s*mili|hi\s*mili|hey\s*mili|mili)\b[!?.\s]*/i;
const MIN_MEANINGFUL_LEN = 4;

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot ready! Logged in as ${readyClient.user.tag}`);
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
  console.log('[MENTION_CHECK]', { botId, isMentioned, mentionIds: [...message.mentions.users.keys()] });
  if (!isMentioned) return;

  const settings = await getGuildSettings(message.guild.id);
  if (settings.aiEnabled === false) return;

  const rawPrompt = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!rawPrompt) {
    await message.reply(`Hi pasupan <@${message.author.id}> ❤️`);
    return;
  }

  const normalized = normalizeText(rawPrompt);

  // 1) Sapaan murni -> hardcoded exact reply
  if (isPureGreeting(normalized)) {
    await message.reply(`Hi pasupan <@${message.author.id}> ❤️`);
    return;
  }

  // 2) Jika diawali sapaan + ada pertanyaan lanjut, buang sapaan dulu
  const routedPrompt = stripGreetingPrefix(rawPrompt).trim() || rawPrompt;

  // 3) Pertanyaan terlalu pendek/ambigu -> fallback
  if (isTooAmbiguous(routedPrompt)) {
    await message.reply('DUH ... aku udah ga mood nanti lah jawabnya 😠');
    return;
  }

  // 4) Hard guard konteks MILICUTE -> jika di luar konteks, fallback
  if (!isMilicuteContext(routedPrompt, recentContextHint(message.channel.name, rawPrompt))) {
    await message.reply('DUH ... aku udah ga mood nanti lah jawabnya 😠');
    return;
  }

  await message.channel.sendTyping();

  const recentMessages = await getRecentMessages(message.channel, message.id, 8);
  const channel = { id: message.channel.id, name: message.channel.name };

  try {
    const response = await generateAiResponse(routedPrompt, message.author, channel, recentMessages);
    await message.reply(response);
  } catch (error) {
    console.error('Mention AI Error:', error);
    await message.reply('DUH ... aku udah ga mood nanti lah jawabnya 😠');
  }
});

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isPureGreeting(text) {
  return GREETING_REGEX.test(text);
}

function stripGreetingPrefix(text) {
  return text.replace(GREETING_PREFIX_REGEX, '');
}

function isTooAmbiguous(text) {
  const t = normalizeText(text);
  if (t.length < MIN_MEANINGFUL_LEN) return true;

  const ambiguousSet = new Set([
    'apa', 'gimana', 'kenapa', 'kok', 'lah', 'hah', 'hmm', 'h?', '?', 'ok', 'oke', 'sip'
  ]);

  return ambiguousSet.has(t);
}

function recentContextHint(channelName = '', rawPrompt = '') {
  return `${channelName} ${rawPrompt}`.toLowerCase();
}

function isMilicuteContext(text, hint = '') {
  const t = `${normalizeText(text)} ${hint}`;
  const milicuteKeywords = [
    'mili', 'milicute', 'pasupan', 'komunitas', 'squad', 'cute tactical',
    'dark-cute', 'dark cute', 'hitam merah', 'dark red', 'tactical',
    'event', 'roleplay', 'fashion', 'street fashion', 'chibi', 'premium',
    'galak tapi imut', 'cute but dangerous', 'pasukan kecil', 'imut boleh lemah jangan'
  ];

  return milicuteKeywords.some(keyword => t.includes(keyword));
}

async function getRecentMessages(channel, beforeMessageId, limit = 8) {
  try {
    const fetched = await channel.messages.fetch({ limit: limit + 1 });
    const filtered = fetched
      .filter(m => m.id !== beforeMessageId && !m.author.bot)
      .first(limit);

    return filtered
      .reverse()
      .map(m => `<@${m.author.id}>: ${m.content}`)
      .join('\n');
  } catch {
    return '';
  }
}

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

client.login(config.discordToken);
