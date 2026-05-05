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
