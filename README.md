# WagMedia Com Bot

WagMedia Com Bot is a discord bot created for WagMedia. It listens to configured
discord channels' messages and reactions. Valid posts and oddjobs are inserted
into a db where they are the basis of creating the content for
[WagMedia Com Web](https://github.com/Wag-Media/wagmedia-com-web).

First [setup the Bot](#general-bot-setup) and then follow the instructions for
[local development](#local-development) or
[production setup](#production-setup-only-for-information)

## Features

- Typescript with **esbulid/tsx**
- Monitor discord with [discord.js](https://discord.js.org/)
- Database with [Prisma](https://www.prisma.io/)
- Application Commands with
  [**Discord-FP**](https://github.com/SonMooSans/discord-fp)

## General Bot Setup

### Enable Developer Mode in Discord

Go to your User Settings » Advanced and enable Developer Mode.

### Server Creation

If you don't have a discord yet, create a new one and save the guildId as
**DISCORD_GUILD_ID**. You can copy the guildId by right-clicking your server and
clicking on "Copy ID".

### Application and Bot Creation

Go to [https://discord.com/developers](https://discord.com/developers/)/ and set
up your developer account. After setting up your account click on "New
Application". Give your application a name and save. Upload an app icon in
"General Information"

Click on save changes when a prompt does show up.

- Navigate to "Bot" and click on "Add a bot". You can now upload a profile
  picture and give the bot a username that will displayed in the server. Copy
  the token and save it in the **DISCORD_BOT_TOKEN** env variable.
- Set "Public Bot" to "No", if you only want to add it to one server and be the
  only person who can do so.
- Set "Message Content Intent" to "Yes" (needed for reading past messages before
  the bot joined).

### Invite Bot to Server

In the Discord Developer Portal go to your created application and navigate to
the OAuth2 » URL Generator. Check mark "bot" in Scopes and checkmark the
following in Bot Permissions.

[bot permissions](doc/bot-permissions.png)

The permissions should match 414464683072

Copy and navigate to the generated url. You will get a prompt to select the
server which the bot should join and grant his permissions.

### Role Configuration

After setting up the permissions for your channels for the bot go to Server
Settings » Roles. The bot will send messages to the channel configured in the
`CHANNEL_LOG` env variable, so it should have the rights to send messages there,
as well as add and remove emojis in all monitored channels.

## Local Development

### Clone this repository

`git clone git@github.com:Wag-Media/wagmedia-com-bot.git`

### Init

**npm** is used by default

1. `npm install`
1. copy .env.sample to .env and set the variables (db connection, api keys,
   discord settings)
1. do more config in `config.ts` (enable logging, seeding the db, )
1. Invite the bot to your guild via this link (or the one you created above):
   [https://discord.com/api/oauth2/authorize?client_id=1195395899489275988&permissions=414464683072&scope=bot](https://discord.com/api/oauth2/authorize?client_id=1195395899489275988&permissions=414464683072&scope=bot)
1. these are the permissions the bot needs 414464683072

(optional)

1. Setup a discord log channel for the bot to log its reactions. Allow the bot
   roles to join and write and disable embeds for the bot roles to increase
   readability

### Watch Mode

`npm run dev`

### Changing the db schema

After you made changes to the schema in `prisma/schema.prisma`

`npx prisma migrate dev` to update the database

### Connecting to the database

1. get the postgres database connection string (e.g. from heroku env or the
   local db)
2. `npx prisma studio` will serve a local database client on
   [https://localhost:5555](https://localhost:5555)

### Run without watch

`npm run start`

### Seeding the database

To seed the db or when you changed something in the config (i.e. added new
payment emojis to monitor), you can rerun the seed command:

1. make sure you have the correct db connection string in your `.env` (e.g. if
   you want to update the staging db, make sure that connection string is in
   `DATABASE_URL` in your `.env`)
2. run `npx prisma db seed` which will execute `prisma/seed.ts` to upsert
   emojis, category rules and payment rules

Example:

You want to add a new monitoring of a payment emoji because the dot value 10x
ed. You want to add a new emoji which represents 0.01 DOT.

1. look into `config.ts` and see how emojis are setup there in `paymentEmojiMap`
   object
2. add a new line to the `paymentEmojiMap` object making sure the key is set to
   the name the emoji has in discord :

```
"001WMDOT": { amount: 0.005, currency: "DOT", fundingSource: "OpenGov-365" },
```

3. make sure the db connection string is correct
4. `npx prisma db seed` to upsert the new emoji

## Production Setup (only for information)

- The bot can run on any server you want but the first installation will run on
  heroku.
- heroku is automatically building and deploying from the `master` branch of the
  bot's [github](https://github.com/Wag-Media/wagmedia-com-bot).
- All environment variables must thus be set on heroku for the production
- development should take place on the `staging` branch and verified with a
  local bot instance (see [Local Development](#local-development))
- heroku is setup to rebuild when env variable change
- the postgres db the bot uses is also setup in heroku

More information about heroku setup can be found in [doc/heroku](doc/heroku.md).

## Configuration

Since it's using `prisma` by default, you can use PostgreSQL, MySQL or any
databases supported by prisma

Edit your `.env` file for configure bot token & Database url

## Folder structure

| Path       | Description                    |
| ---------- | ------------------------------ |
| index.ts   | Where to start the application |
| ./commands | All application commands       |
| .env       | Environment Variables          |
| ./prisma   | Prisma folder                  |

## FAQ

- I am getting `DiscordAPIError[50001]: Missing Access`

Probably the bot is setup to log but cannot access the log channel, give bot
rights and restart bot.

- mirror db from prod => staging see below

```bash
heroku pg:copy wagmedia-com-bot::DATABASE_URL DATABASE_URL --app wagmedia-com-bot-staging
```

might need to run migrations again on staging afterwards

````bash
npx prisma migrate dev #development
npx prisma migrate deploy
```
````
