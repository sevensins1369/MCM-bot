// deploy-commands.js
require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "❌ Missing required environment variables. Please check your .env file."
  );
  console.error("Required variables: DISCORD_TOKEN, CLIENT_ID, GUILD_ID");
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, "commands");

// Check if commands directory exists
if (!fs.existsSync(commandsPath)) {
  console.error(`❌ Commands directory not found at ${commandsPath}`);
  console.error("Please create the commands directory and add command files.");
  process.exit(1);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

// --- THIS IS THE NEW DUPLICATE CHECKER ---
const commandNames = new Map();

console.log("🔍 Checking for duplicate command names...");

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      const commandName = command.data.name;

      // Check if this command name has already been seen
      if (commandNames.has(commandName)) {
        console.error(`❌ DUPLICATE COMMAND NAME FOUND: "${commandName}"`);
        console.error(
          `   - First defined in: ${commandNames.get(commandName)}`
        );
        console.error(`   - Also defined in:  ${filePath}`);
        console.error(
          "Please rename or delete one of the conflicting commands and try again."
        );
        process.exit(1); // Stop the script immediately
      }

      // If it's a new command, add it to our map
      commandNames.set(commandName, filePath);
      commands.push(command.data.toJSON());
      console.log(`✅ Loaded command: ${commandName}`);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  } catch (error) {
    console.error(`[ERROR] Failed to load command from ${filePath}:`, error);
  }
}
// --- END OF DUPLICATE CHECKER ---

// --- ADDED DEBUGGING CODE ---
console.log("\n🔍 Command details for debugging:");
commands.forEach((cmd, index) => {
  console.log(
    `${index}: ${cmd.name} (${cmd.description.length} chars in description)`
  );

  // Check for common issues
  if (cmd.options) {
    console.log(`  Has ${cmd.options.length} options:`);
    cmd.options.forEach((opt, optIndex) => {
      console.log(`  Option ${optIndex}: ${opt.name} (type: ${opt.type})`);

      // Check for choices in string or integer options
      if (opt.choices) {
        console.log(`    Has ${opt.choices.length} choices:`);
        opt.choices.forEach((choice, choiceIndex) => {
          console.log(
            `      Choice ${choiceIndex}: name="${choice.name}", value="${choice.value}"`
          );
        });
      }

      // Check for options with min/max values
      if (opt.min_value !== undefined || opt.max_value !== undefined) {
        console.log(
          `    Min value: ${opt.min_value}, Max value: ${opt.max_value}`
        );
      }
    });
  }

  // Log the full command JSON for the problematic commands (around index 22)
  if (index >= 20 && index <= 24) {
    console.log("  FULL COMMAND DATA:");
    console.log(JSON.stringify(cmd, null, 2));
  }
});
// --- END OF DEBUGGING CODE ---

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`\n🔄 Refreshing ${commands.length} guild (dev) commands...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log(
      `✅ Successfully reloaded ${data.length} guild (dev) commands.`
    );
  } catch (error) {
    console.error("❌ Failed to reload commands:", error);

    // Enhanced error logging
    if (error.code === 50035) {
      console.error("This is a validation error. Check the following details:");

      if (error.rawError && error.rawError.errors) {
        console.error(
          "Error details:",
          JSON.stringify(error.rawError.errors, null, 2)
        );
      }
    }
  }
})();

// This script deploys commands to a specific guild for testing purposes.
// It checks for duplicate command names and ensures that each command is properly defined before deployment.
