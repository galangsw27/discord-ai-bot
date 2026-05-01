import { JSONFilePreset } from 'lowdb/node';

const defaultData = {
  guilds: {}
};

const db = await JSONFilePreset('data/settings.json', defaultData);

export async function getGuildSettings(guildId) {
  return db.data.guilds[guildId] || { aiEnabled: true };
}

export async function setGuildSettings(guildId, settings) {
  db.data.guilds[guildId] = {
    ...(db.data.guilds[guildId] || {}),
    ...settings
  };

  await db.write();
  return db.data.guilds[guildId];
}
