import { getGuildSettings, setGuildSettings } from '../utils/storage.js';

export const data = {
  name: 'toggle-ai',
  description: 'Aktifkan atau nonaktifkan AI chatbot (Admin only)'
};

export async function execute(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Kamu tidak punya izin untuk menggunakan perintah ini.', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const settings = await getGuildSettings(guildId);
  const newState = !settings.aiEnabled;

  await setGuildSettings(guildId, { aiEnabled: newState });

  const statusText = newState ? '✅ Diaktifkan' : '❌ Dinonaktifkan';
  await interaction.reply({ content: `${statusText} AI chatbot untuk server ini!`, ephemeral: false });
}