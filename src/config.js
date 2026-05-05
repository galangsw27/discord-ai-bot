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
  imageSize: process.env.IMAGE_SIZE || '1024x1024',
  ninerouterConnectionId: process.env.NINEROUTER_CONNECTION_ID || '',
  imageQuality: process.env.IMAGE_QUALITY || 'auto',
  imageBackground: process.env.IMAGE_BACKGROUND || 'auto',
  imageDetail: process.env.IMAGE_DETAIL || 'high',
  imageOutputFormat: process.env.IMAGE_OUTPUT_FORMAT || 'png',
  imageN: Number(process.env.IMAGE_N || '1'),
  imageCommandEnabled: process.env.IMAGE_COMMAND_ENABLED === 'true'
};