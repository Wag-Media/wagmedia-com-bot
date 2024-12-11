import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ActionRowBuilder,
  AutocompleteInteraction,
  Interaction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { handleOddJob, parsePayment } from "@/utils/handle-odd-job";
import { OddJob } from "@prisma/client";
import { ODDJOB_ROLE_OPTIONS } from "@/config";

export const data = new SlashCommandBuilder()
  .setName("oddjob")
  .setDescription("Start the odd job creation process")
  .addStringOption((option) =>
    option
      .setName("description")
      .setDescription("The description of the odd job")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("role")
      .setDescription("The role of the odd job")
      .setRequired(true)
      .addChoices(ODDJOB_ROLE_OPTIONS),
  )
  .addUserOption((option) =>
    option
      .setName("manager")
      .setDescription("The manager of the odd job")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("requested-amount")
      .setDescription("The requested amount of the odd job (xx.yy USD / DOT)")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("timeline")
      .setDescription("The timeline of the odd job")
      .setRequired(true),
  )
  .addAttachmentOption((option) =>
    option.setName("invoice").setDescription("Any Invoices you want to attach"),
  );

export async function execute(interaction: any) {
  //   const user = event.user;
  //   const channel = event.channel;

  const oddJobData: Partial<OddJob> = {};

  await interaction.deferReply({ ephemeral: true });

  oddJobData.description = interaction.options.getString("description");
  oddJobData.role = interaction.options.getString("role");
  oddJobData.managerId = interaction.options.getUser("manager").id;
  oddJobData.requestedAmount =
    interaction.options.getString("requested-amount");
  oddJobData.timeline = interaction.options.getString("timeline");

  const payment = parsePayment(
    interaction.options.getString("requested-amount"),
  );

  console.log("received", oddJobData);

  //   const roleOptions = [
  //     { label: "Developer", value: "developer" },
  //     { label: "Designer", value: "designer" },
  //     { label: "Manager", value: "manager" },
  //   ];

  //   const paymentUnitOptions = [
  //     { label: "USD", value: "usd" },
  //     { label: "EUR", value: "eur" },
  //     { label: "BTC", value: "btc" },
  //   ];

  //   const roleSelectMenu = new StringSelectMenuBuilder()
  //     .setCustomId("select-role")
  //     .setPlaceholder("Select a role")
  //     .addOptions(roleOptions);

  //   const paymentUnitSelectMenu = new StringSelectMenuBuilder()
  //     .setCustomId("select-payment-unit")
  //     .setPlaceholder("Select a payment unit")
  //     .addOptions(paymentUnitOptions);

  //   const roleRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  //     roleSelectMenu
  //   );

  //   const paymentUnitRow =
  //     new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  //       paymentUnitSelectMenu
  //     );

  await interaction.editReply("yep");

  //   collector.on("collect", async (interaction: StringSelectMenuInteraction) => {
  //     if (interaction.customId === "select-role") {
  //       oddJobData.role = interaction.values[0];
  //       await interaction.update({
  //         content: "Role selected. Now, please select the payment unit.",
  //         components: [paymentUnitRow],
  //       });
  //     } else if (interaction.customId === "select-payment-unit") {
  //       oddJobData.paymentUnit = interaction.values[0];
  //       await interaction.update({
  //         content: "Payment unit selected. Thank you!",
  //         components: [],
  //       });
  //       collector.stop();
  //       processOddJob();
  //     }
  //   });

  //   collector.on("end", (collected, reason) => {
  //     if (reason === "time") {
  //       channel.send("Time expired. Please start the process again.");
  //     }
  //   });

  //   const processOddJob = async () => {
  //     // Validate and process the collected data
  //     const messageLink = `https://discord.com/channels/${channel.guild.id}/${channel.id}/${event.id}`;
  //     const message = await channel.messages.fetch(event.id);

  //     const oddJob = await handleOddJob(message, messageLink);
  //     if (oddJob) {
  //       channel.send("Odd job created successfully!");
  //     } else {
  //       channel.send(
  //         "There was an error creating the odd job. Please try again."
  //       );
  //     }
  //   };
}
