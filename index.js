// index.js
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const { logger, logError, logInfo } = require("./enhanced-logger");
const { connectToDatabase, ensureDataDirectory } = require("./utils/database");
const { loadWallets } = require("./utils/WalletManager");
const { loadActiveDiceGames } = require("./utils/DiceManager");
const { loadActiveFlowerGames } = require("./utils/FlowerGameManager");
const { loadActiveDiceDuels } = require("./utils/DiceDuelManager"); // Added for dice duels
const { initializeJackpotManager } = require("./utils/JackpotManager"); // Added for jackpot games
const { registerAllPrefixCommands } = require("./prefixCommands");
const { handlePrefixCommand } = require("./utils/PrefixCommandHandler");
const mongoose = require("mongoose");
const { EMOJIS } = require("./utils/embedcreator");

// --- STARTUP GUARD ---
// This check prevents the bot from starting more than once.
if (global.botStarted) {
  console.warn("[WARN] Attempted to start the bot a second time. Aborting.");
  return; // Stop execution if bot is already running
}
global.botStarted = true;
// --- END OF STARTUP GUARD ---

const { DISCORD_TOKEN: token } = process.env;

if (!token) {
  console.error("❌ ERROR: No Discord token found in .env file");
  console.log("Please create a .env file with your Discord token:");
  console.log("DISCORD_TOKEN=your_token_here");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages, // Added for DM support
  ],
});

// Make client globally available for utilities
global.client = client;

client.commands = new Collection();
client.triggers = new Collection();

async function startBot() {
  try {
    logger.info("Bot", "Starting Bot");

    // Ensure data directory exists
    ensureDataDirectory();

    // Connect to database
    await connectToDatabase();

    // Load commands
    const commandsPath = path.join(__dirname, "commands");
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if ("data" in command && "execute" in command) {
          client.commands.set(command.data.name, command);
        } else {
          logger.warn(
            "CommandLoader",
            `The command at ${filePath} is missing a required "data" or "execute" property.`
          );
        }
      } catch (error) {
        logger.error(
          "CommandLoader",
          `Failed to load command from ${file}`,
          error
        );
      }
    }

    logger.info("CommandLoader", `Loaded ${client.commands.size} commands`);

    // Load triggers from database
    try {
      const Trigger = require("./models/trigger");
      if (Trigger) {
        const triggers = await Trigger.find();

        triggers.forEach((trigger) => {
          client.triggers.set(trigger.name, {
            name: trigger.name,
            response: trigger.response,
            createdBy: trigger.createdBy,
          });
        });

        logger.info(
          "TriggerLoader",
          `Loaded ${client.triggers.size} triggers from database`
        );
      } else {
        logger.info(
          "TriggerLoader",
          "Trigger model not available. Skipping trigger loading."
        );
      }
    } catch (error) {
      logger.error("TriggerLoader", "Error loading triggers", error);
    }

    // Register event handlers
    const eventsPath = path.join(__dirname, "events");
    if (fs.existsSync(eventsPath)) {
      const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith(".js"));

      for (const file of eventFiles) {
        try {
          const filePath = path.join(eventsPath, file);
          const event = require(filePath);

          if (event.once) {
            client.once(event.name, (...args) =>
              event.execute(...args, client)
            );
          } else {
            client.on(event.name, (...args) => event.execute(...args, client));
          }
        } catch (error) {
          logger.error(
            "EventLoader",
            `Failed to load event from ${file}`,
            error
          );
        }
      }

      logger.info("EventLoader", `Loaded ${eventFiles.length} event handlers`);
    } else {
      // Fallback to direct event registration if events directory doesn't exist
      logger.warn(
        "EventLoader",
        "Events directory not found. Using fallback event registration."
      );

      client.once(Events.ClientReady, (readyClient) => {
        logger.info("Bot", `Ready! Logged in as ${readyClient.user.tag}`);
      });

      client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(
          interaction.commandName
        );

        if (!command) {
          logger.error(
            "CommandHandler",
            `No command matching ${interaction.commandName} was found.`
          );
          return;
        }

        try {
          await command.execute(interaction);
        } catch (error) {
          logger.error(
            "CommandHandler",
            `Error executing command ${interaction.commandName}`,
            error
          );
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "There was an error while executing this command!",
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: "There was an error while executing this command!",
              ephemeral: true,
            });
          }
        }
      });

      // Handle message events for prefix commands
      client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;

        // Handle prefix commands
        await handlePrefixCommand(message);
      });
    }

    // Load game state
    try {
      logger.info("GameState", "Loading game state...");

      // Load wallets first
      await loadWallets();
      logger.info("GameState", "Wallets loaded successfully");

      // Then load game states
      try {
        if (typeof loadActiveDiceGames === "function") {
          await loadActiveDiceGames();
          logger.info("GameState", "Dice games loaded successfully");
        }
      } catch (error) {
        logger.error("GameState", "Error loading dice games", { error });
      }

      try {
        if (typeof loadActiveFlowerGames === "function") {
          await loadActiveFlowerGames();
          logger.info("GameState", "Flower games loaded successfully");
        }
      } catch (error) {
        logger.error("GameState", "Error loading flower games", { error });
      }

      try {
        if (typeof loadActiveDiceDuels === "function") {
          await loadActiveDiceDuels();
          logger.info("GameState", "Dice duels loaded successfully");
        }
      } catch (error) {
        logger.error("GameState", "Error loading dice duels", { error });
      }

      // Initialize Jackpot Manager
      try {
        await initializeJackpotManager();
        logger.info("GameState", "Jackpot manager initialized successfully");
      } catch (error) {
        logger.error("GameState", "Error initializing jackpot manager", {
          error,
        });
      }

      // Register prefix commands
      registerAllPrefixCommands();

      logger.info("GameState", "Game state loaded successfully");
    } catch (error) {
      logger.error("GameState", "Error loading game state", { error });
    }

    // Login to Discord
    await client.login(token);
    logger.info("Bot", "Bot logged in successfully");
  } catch (error) {
    logger.error("Bot", "Fatal error during startup", { error });
    process.exit(1);
  }
}

// Start the bot
startBot();

// Handle process termination
process.on("SIGINT", async () => {
  logger.info("Bot", "Received SIGINT. Gracefully shutting down...");

  // Close database connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    logger.info("Bot", "Database connection closed.");
  }

  // Destroy the client
  client.destroy();
  logger.info("Bot", "Discord client destroyed.");

  process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("UnhandledRejection", "Unhandled Promise Rejection", {
    error:
      reason instanceof Error
        ? reason
        : new Error(reason?.message || "Unknown reason"),
    promise,
  });
});

process.on("uncaughtException", (error) => {
  logger.error("UncaughtException", "Uncaught Exception", { error });

  // For uncaught exceptions, it's often safer to exit and let a process manager restart
  // But we'll try to keep running unless it's a critical error
  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    logger.error("UncaughtException", "Critical connection error. Exiting...");
    process.exit(1);
  }
});
