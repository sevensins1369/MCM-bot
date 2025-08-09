// utils/commandAdapter.js
/**
 * Creates a prefix command that calls a slash command
 * @param {Object} slashCommand - The slash command object with data and execute properties
 * @returns {Object} A prefix command object with a run method
 */
function createPrefixFromSlash(slashCommand) {
  if (!slashCommand || !slashCommand.data || !slashCommand.execute) {
    throw new Error("Invalid slash command provided to adapter");
  }

  return {
    name: slashCommand.data.name,
    description: slashCommand.data.description,

    /**
     * Executes the prefix command by simulating a slash command interaction
     * @param {import('discord.js').Message} message - The message that triggered the command
     * @param {string[]} args - Command arguments
     */
    run: async (message, args) => {
      try {
        // Create a simulated interaction object
        const interaction = {
          commandName: slashCommand.data.name,
          options: {
            getString: (name) => {
              const optionIndex =
                slashCommand.data.options?.findIndex(
                  (opt) => opt.name === name
                ) ?? -1;
              return optionIndex >= 0 && args[optionIndex]
                ? args[optionIndex]
                : null;
            },
            getInteger: (name) => {
              const optionIndex =
                slashCommand.data.options?.findIndex(
                  (opt) => opt.name === name
                ) ?? -1;
              const value =
                optionIndex >= 0 && args[optionIndex]
                  ? parseInt(args[optionIndex])
                  : null;
              return isNaN(value) ? null : value;
            },
            getNumber: (name) => {
              const optionIndex =
                slashCommand.data.options?.findIndex(
                  (opt) => opt.name === name
                ) ?? -1;
              const value =
                optionIndex >= 0 && args[optionIndex]
                  ? parseFloat(args[optionIndex])
                  : null;
              return isNaN(value) ? null : value;
            },
            getBoolean: (name) => {
              const optionIndex =
                slashCommand.data.options?.findIndex(
                  (opt) => opt.name === name
                ) ?? -1;
              const value =
                optionIndex >= 0 && args[optionIndex]
                  ? args[optionIndex].toLowerCase()
                  : null;
              return value === "true" || value === "yes" || value === "1";
            },
            getUser: (name) => {
              const optionIndex =
                slashCommand.data.options?.findIndex(
                  (opt) => opt.name === name
                ) ?? -1;
              if (optionIndex >= 0 && args[optionIndex]) {
                const userMention = args[optionIndex].match(/<@!?(\d+)>/);
                if (userMention) {
                  return message.client.users.cache.get(userMention[1]);
                }
                return (
                  message.client.users.cache.get(args[optionIndex]) ||
                  message.client.users.cache.find(
                    (u) => u.username === args[optionIndex]
                  )
                );
              }
              return null;
            },
            getMember: (name) => {
              const user = interaction.options.getUser(name);
              return user ? message.guild.members.cache.get(user.id) : null;
            },
            getChannel: (name) => {
              const optionIndex =
                slashCommand.data.options?.findIndex(
                  (opt) => opt.name === name
                ) ?? -1;
              if (optionIndex >= 0 && args[optionIndex]) {
                const channelMention = args[optionIndex].match(/<#(\d+)>/);
                if (channelMention) {
                  return message.client.channels.cache.get(channelMention[1]);
                }
                return (
                  message.client.channels.cache.get(args[optionIndex]) ||
                  message.client.channels.cache.find(
                    (c) => c.name === args[optionIndex]
                  )
                );
              }
              return null;
            },
            getRole: (name) => {
              const optionIndex =
                slashCommand.data.options?.findIndex(
                  (opt) => opt.name === name
                ) ?? -1;
              if (optionIndex >= 0 && args[optionIndex]) {
                const roleMention = args[optionIndex].match(/<@&(\d+)>/);
                if (roleMention) {
                  return message.guild.roles.cache.get(roleMention[1]);
                }
                return (
                  message.guild.roles.cache.get(args[optionIndex]) ||
                  message.guild.roles.cache.find(
                    (r) => r.name === args[optionIndex]
                  )
                );
              }
              return null;
            },
            getMentionable: (name) => {
              return (
                interaction.options.getUser(name) ||
                interaction.options.getRole(name) ||
                null
              );
            },
            // Add more option getters as needed
          },
          user: message.author,
          member: message.member,
          guild: message.guild,
          channel: message.channel,
          client: message.client,

          // Reply methods
          reply: async (content) => {
            if (typeof content === "string") {
              return await message.reply(content);
            } else {
              return await message.reply(content);
            }
          },
          editReply: async (content) => {
            // This would need to store the original reply message
            // For simplicity, we'll just send a follow-up
            return await message.channel.send(
              `[Edit] ${
                typeof content === "string"
                  ? content
                  : content.content || "Updated response"
              }`
            );
          },
          followUp: async (content) => {
            return await message.channel.send(
              typeof content === "string" ? content : content
            );
          },
          deferReply: async () => {
            // For prefix commands, we can just acknowledge receipt
            await message.react("⏳");
            return { deferred: true };
          },

          // State tracking
          deferred: false,
          replied: false,
          ephemeral: false,

          // Make sure we implement all methods used by your slash commands
        };

        // Execute the slash command with our simulated interaction
        await slashCommand.execute(interaction);
      } catch (error) {
        console.error(
          `Error executing prefix command ${slashCommand.data.name}:`,
          error
        );
        await message.reply(`Error: ${error.message}`);
      }
    },
  };
}

module.exports = { createPrefixFromSlash };
