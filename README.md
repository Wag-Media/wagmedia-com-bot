# Wagmedia Com Bot

## Installation

1. copy .env.sample to .env and set the variables
2. do more config in `config.ts`

(optional)

3. Setup a discord log channel for the bot to log its reactions. Allow the bot
   roles to join and disable embeds for the bot roles to increase readability

## Features

- Typescript with **esbulid/tsx**
- Database with **Prisma**
- Application Commands with
  [**Discord-FP**](https://github.com/SonMooSans/discord-fp)

## Local Development

### Clone this repository

`git clone git@github.com:Wag-Media/wagmedia-com-bot.git`

### Init

We are using **npm** by default

`npm install`

### Run the Project

### Watch Mode

`npm run dev`

### Changing the db schema

After you made changes to the schema in `prisma/schema.prisma`

`npx prisma migrate dev` to update the database

### Look in the database

`npx prisma studio` will serve a local database client on
[https://localhost:5555](https://localhost:5555)

### Run without watch

`npm run start`

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
