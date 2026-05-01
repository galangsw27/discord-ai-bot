import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';

const commands = [];
const commandsPath = join(process.cwd(), 'src', 'commands');
const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);
  if (command.data) {
    commands.push(command.data);
  }
}

const rest = new REST().setToken(config.discordToken);

try {
  console.log(`Started refreshing ${commands.length} application (/) commands.`);

  await rest.put(Routes.applicationCommands(config.discordClientId), { body: commands });

  console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
} catch (error) {
  console.error(error);
}
