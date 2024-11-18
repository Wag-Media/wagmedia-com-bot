import { command } from "@/utils/dfp.js";
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { handleOddJob } from "@/utils/handle-odd-job";
import { OddJob } from "@prisma/client";

export default command.slash({
  description: "Start the odd job creation process",
  execute: async ({ event }) => {
    const user = event.user;
    const channel = event.channel;

    const oddJobData: Partial<OddJob> = {};

    const roleOptions = [
      { label: "Developer", value: "developer" },
      { label: "Designer", value: "designer" },
      { label: "Manager", value: "manager" },
    ];

    const paymentUnitOptions = [
      { label: "USD", value: "usd" },
      { label: "EUR", value: "eur" },
      { label: "BTC", value: "btc" },
    ];

    const roleSelectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-role")
      .setPlaceholder("Select a role")
      .addOptions(roleOptions);

    const paymentUnitSelectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-payment-unit")
      .setPlaceholder("Select a payment unit")
      .addOptions(paymentUnitOptions);

    const roleRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        roleSelectMenu,
      );
    const paymentUnitRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        paymentUnitSelectMenu,
      );

    await channel.send({
      content: `${user}, please select the role for the Odd-Job.`,
      components: [roleRow],
    });

    const collector = channel.createMessageComponentCollector({
      filter: (interaction) => interaction.user.id === user.id,
      componentType: "SELECT_MENU",
      time: 60000, // 1 minute to make a selection
    });

    collector.on(
      "collect",
      async (interaction: StringSelectMenuInteraction) => {
        if (interaction.customId === "select-role") {
          oddJobData.role = interaction.values[0];
          await interaction.update({
            content: "Role selected. Now, please select the payment unit.",
            components: [paymentUnitRow],
          });
        } else if (interaction.customId === "select-payment-unit") {
          oddJobData.paymentUnit = interaction.values[0];
          await interaction.update({
            content: "Payment unit selected. Thank you!",
            components: [],
          });
          collector.stop();
          processOddJob();
        }
      },
    );

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        channel.send("Time expired. Please start the process again.");
      }
    });

    const processOddJob = async () => {
      // Validate and process the collected data
      const messageLink = `https://discord.com/channels/${channel.guild.id}/${channel.id}/${event.id}`;
      const message = await channel.messages.fetch(event.id);

      const oddJob = await handleOddJob(message, messageLink);
      if (oddJob) {
        channel.send("Odd job created successfully!");
      } else {
        channel.send(
          "There was an error creating the odd job. Please try again.",
        );
      }
    };
  },
});
