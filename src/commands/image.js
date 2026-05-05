import { AttachmentBuilder } from 'discord.js';
import { generateImage } from '../utils/ai.js';

const COOLDOWN_MS = 5 * 60 * 1000;
const imageCooldowns = new Map();
const PROMPT_PREVIEW_LIMIT = 80;
const ALLOWED_CHANNEL_IDS = new Set([
  '1500092065730531392',
  '1460230180114141271'
]);

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

export async function execute(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;

  if (!ALLOWED_CHANNEL_IDS.has(channelId)) {
    return interaction.reply({
      content: `Maaf pasupan <@${userId}> ❤️ aku cuma aktif di <#1500092065730531392> atau <#1460230180114141271> ya.`,
      ephemeral: false
    });
  }

  const prompt = interaction.options.getString('prompt', true);
  const referenceImage = interaction.options.getAttachment('image');
  const referenceImageUrl = referenceImage?.url || '';
  const startedAt = Date.now();
  const now = startedAt;
  const lastRequestAt = imageCooldowns.get(userId) || 0;
  const remainingMs = COOLDOWN_MS - (now - lastRequestAt);

  logImageEvent('log', '[IMAGE_REQUEST]', {
    userId,
    guildId,
    channelId,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, PROMPT_PREVIEW_LIMIT),
    hasReferenceImage: Boolean(referenceImageUrl),
    referenceImageUrlPreview: referenceImageUrl ? referenceImageUrl.slice(0, 120) : ''
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
    const image = await generateImage(prompt, referenceImageUrl);
    const attachment = new AttachmentBuilder(image.buffer, { name: `mili-image.${getExtension(image.mimeType)}` });
    const durationMs = Date.now() - startedAt;

    logImageEvent('log', '[IMAGE_SUCCESS]', {
      userId,
      guildId,
      channelId,
      hasReferenceImage: Boolean(referenceImageUrl),
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
      hasReferenceImage: Boolean(referenceImageUrl),
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
