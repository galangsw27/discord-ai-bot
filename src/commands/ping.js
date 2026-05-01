export const data = {
  name: 'ping',
  description: 'Cek latency bot'
};

export async function execute(interaction) {
  const sent = await interaction.reply({ content: '🏓 Ping!', fetchReply: true });
  const ping = sent.createdTimestamp - interaction.createdTimestamp;
  await interaction.editReply(`🏓 Pong!\nLatency: **${ping}ms**\nAPI Latency: **${Math.round(interaction.client.ws.ping)}ms**`);
}