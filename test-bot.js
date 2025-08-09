// test-bot.js
// A simple script to test if the bot can connect to Discord

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const { DISCORD_TOKEN: token } = process.env;

if (!token) {
  console.error('❌ ERROR: No Discord token found in .env file');
  console.log('Please create a .env file with your Discord token:');
  console.log('DISCORD_TOKEN=your_token_here');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ Successfully connected to Discord as ${client.user.tag}`);
  console.log(`🔌 Connected to ${client.guilds.cache.size} servers`);
  console.log('Bot is working correctly!');
  
  // Exit after successful test
  setTimeout(() => {
    console.log('Test complete. Shutting down...');
    client.destroy();
    process.exit(0);
  }, 3000);
});

client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
  process.exit(1);
});

console.log('Attempting to connect to Discord...');
client.login(token).catch(error => {
  console.error('❌ Failed to connect to Discord:', error);
  process.exit(1);
});