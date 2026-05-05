export const data = {
  name: 'help',
  description: 'Tampilkan semua perintah yang tersedia'
};

export async function execute(interaction) {
  const helpMessage = `
**📚 Daftar Perintah Bot AI**

\`/ai <pertanyaan>\` - Tanya sesuatu ke AI
\`/image <prompt>\` - Buat gambar dari prompt
\`/ping\` - Cek latency bot
\`/help\` - Tampilkan pesan bantuan ini

**⚙️ Admin Commands:**
\`/toggle-ai\` - Aktif/nonaktif AI (admin only)

**💡 Tips:** Mention bot untuk auto-response (jika diaktifkan)

Dibuat dengan ❤️ menggunakan Discord.js & 9Router
  `.trim();

  await interaction.reply({ content: helpMessage, ephemeral: false });
}