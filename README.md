# Wagmedia Com Bot

## Installation

1. copy .env.sample to .env and set the variables
2. do more config in `config.ts`

(optional)

1. Setup a discord log channel for the bot to log its reactions. Allow the bot
   roles to join and disable embeds for the bot roles to increase readability

## Features

- Typescript with **esbulid/tsx**
- Database with **Prisma**
- Application Commands with
  [**Discord-FP**](https://github.com/SonMooSans/discord-fp)

## Installation

### Clone this repository

`git clone https://github.com/SonMooSans/discord-bot-starter.git`

### Init

We are using **pnpm** by default

`pnpm install`

### Configuration

Since it's using `prisma` by default, you can use PostgreSQL, MySQL or any
databases supported by prisma

Edit your `.env` file for configure bot token & Database url

### File structure

| Path       | Description                    |
| ---------- | ------------------------------ |
| index.ts   | Where to start the application |
| ./commands | All application commands       |
| .env       | Environment Variables          |
| ./prisma   | Prisma folder                  |

## Run the Project

### Watch Mode

`pnpm run dev`

### Run without watch

`pnpm run start`
