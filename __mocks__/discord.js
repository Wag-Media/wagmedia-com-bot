const handleMessageCreate =
  require("@/handlers/handleMessageCreate").handleMessageCreate;

const MockClient = jest.fn().mockImplementation(() => ({
  ...Discord.Client,
  on: jest.fn(),
  emit: jest.fn((event, ...args) => {
    console.log("mocked client.emit(event, ...args)");
    if (event === "messageCreate") {
      console.log("mocked client.emit('messageCreate')");
      handleMessageCreate(...args);
    }
  }),
  // Mock other necessary properties and methods
}));

module.exports = {
  Client: MockClient,
  // Mock other classes and objects from discord.js as needed
};
