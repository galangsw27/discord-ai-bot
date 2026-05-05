import dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  apiBaseUrl: process.env.API_BASE_URL || 'https://rwvg2am.9router.com/v1',
  apiKey: process.env.API_KEY || '',
  aiModel: process.env.AI_MODEL || 'ComboCodexMili',
  imageModel: process.env.IMAGE_MODEL || 'gemini/gemini-3-pro-image-preview',
  imageSize: process.env.IMAGE_SIZE || '1024x1024'
};