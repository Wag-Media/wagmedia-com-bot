# Functionality

This document lists all functional requirements for the Wagmedia Communications
Bot. It also lists the completion of manual tests by the developer and the
WagMedia team.

## Legend

- ⭕️ wagmedia team please verify
- 1️⃣ tested manually by niftesty
- 2️⃣ tested manually by wagmedia team
- 🚥 not implemented yet

## General Functionality

- all messages from bots are ignored
- all dms are ignored
- all messages / reactions / updates / deletes from channels that are not
  monitored are ignored
- the user can configure relevant parts of the bot (e.g. monitored channels,
  logging behavior). For a full list of settings see [`config.ts`](config.ts)
  and the [`env.sample`](.env.sample) for secret settings
- There are two levels of rights the bot differentiates between: regular users🤷‍♂️
  and superusers🦹 (configured to have the "Director" role)

_Complete_ posts get inserted to the db (does not mean published)

- a post is complete if it has a title + description + content link
- a post can additionally have a list of hashtags

_Complete_ Odd Jobs get inserted to the db. Oddjobs are incomplete if one of the
following fields is missing:

1. timeline
2. role
3. description
4. requestedAmount
5. requestedUnit
6. manager (@username)

## General Tests

- ⭕️ the set of emojis to seed the db is complete for the functioning of the
  bot, `./config.ts`-> `paymentEmojiMap`, `categoryEmojiMap`
- 1️⃣ all emojis that are defined `./config.ts`-> `paymentEmojiMap`,
  `categoryEmojiMap` are used to seed the db
- 1️⃣ all emojis that are defined in `categoryEmojiMap` have a `CategoryRule` in
  the db
- 1️⃣ all emojis that are defined in `paymentEmojiMap` have a `PaymentRule` in
  the db
- 1️⃣ the bot leaves guilds(servers) that is not configured in `config.GUILD_ID`

## Create Messages

### Posts

- 1️⃣⭕️ complete posts are added to the db but not published to the website
- 1️⃣⭕️ complete post added to the db should be logged to discord
- 1️⃣ all relevant fields (title, description, tags, embedUrl, discordLink, user,
  contentUrl) get inserted into the db correctly
- 1️⃣⭕️ tags are recognized in the format: `Hashtags: #tag1, #tag2, ...` or
  `Tags: #tag1, tag2, ...`
- 1️⃣ incomplete posts (missing title) should not be added to db
- 1️⃣ incomplete posts (missing description) should not be added to db
- 1️⃣ incomplete posts (missing content link) should not be added to db
- 1️⃣ create messages with title + description + link but without hashtags should
  be added to the db
- 1️⃣⭕️ correct posts added in channels / categories that are not monitored
  should be ignored

### Odd Jobs

- 1️⃣⭕️ [incomplete](#general) odd-jobs should notify poster
- 1️⃣ [complete](#general) odd-jobs should add odd-job to the db

## Edit Messages

### Posts

- 1️⃣ editing an incomplete post to make it complete adds it to the db
- 1️⃣⭕️ editing an complete post to make it incomplete unpublishes it, if it is
  published
- 1️⃣⭕️ editing an complete post and it stays complete update it in the db
- 1️⃣⭕️ editing an incomplete post and it stays incomplete is ignored

### Odd Jobs

- 1️⃣ editing an incomplete odd-job to make it complete saves the oddjob
- 1️⃣⭕️ editing an complete odd-job to make it incomplete will warn the creator
  but leave the odd job in the db

## Delete Messages

- 1️⃣⭕️ if a post message that is not published yet or has no categories gets
  deleted, it will be removed from the database.
- 1️⃣⭕️ if a post message that is already published (=payed) or has any custom
  emojis by directors gets deleted, it stays in the db and gets flagged as
  deleted
- 1️⃣⭕️ if an oddjob message that is not paid yet gets deleted it will be
  removed from the database
- 1️⃣⭕️ if an oddjob message that is paid gets deleted, it stays in the db and
  gets flagged as deleted

## add reactions

### Posts

- 1️⃣⭕️ regular users🤷‍♂️ can only add regular emojis (no WM, no flags)
- 1️⃣⭕️ regular users🤷‍♂️ (allowed) reactions are stored to the db
- 1️⃣⭕️ superusers🦹 can add all emojis to completed posts (see below)
- 1️⃣⭕️ superusers🦹' emojis to incomplete posts will be removed
- 1️⃣⭕️ superusers🦹 that add emojis to incomplete posts will be informed that
  the post is incomplete
- 1️⃣⭕️ superusers🦹 cannot add payment emojis from two different sets or units
- 1️⃣⭕️ superuser🦹 adds any payment emoji to a post will publish a post if the
  post is complete. a post is **not complete** if

  1. it has no category
  2. it is non-anglo and has no flag
  3. it is a translation and has no non-anglo category

- 1️⃣ payment emojis by superusers🦹 will update the total amount of payments a
  post received and save it to the db

### Post Threads

- 1️⃣ the bot monitors payment reactions to valid posts in the corresponding
  thread and inserts a payment to the db
- 1️⃣⭕️ superusers🦹 cannot add payment emojis from two different sets or units

### Odd Jobs

- 1️⃣⭕️ regular users🤷‍♂️ cannot add any emojis to odd jobs
- 1️⃣⭕️ super user cannot add emojis to incomplete oddjobs
- 1️⃣⭕️ only the 🦹superuser (manager) that is added as manager can add payment
  emojis to oddjobs
- 1️⃣⭕️ superusers🦹 who are not the manager will get a message when trying to
  add emojis, emoji removed
- 1️⃣⭕️ manager will get a message when trying to add emojis to incomplete
  oddjobs, emoji removed
- 1️⃣⭕️ manager cannot add payment emojis from two different sets or units
- 1️⃣⭕️ manager will get a message when trying to add from two set of payment
  emojis (neither different unit nor different funding source)
- 1️⃣ complete odd-jobs with payment emojis from manager will be added to the db
  with a payment
- 1️⃣ payment emojis by superusers🦹 will update the total amount of payments an
  odd job received and save it to the db

## Remove Reactions

### Posts

- 1️⃣⭕️ if a regular user🤷‍♂️ removes a reaction it should also be removed from
  the db and website
- 1️⃣⭕️ if a superuser🦹 removes a reaction it should also be removed from the
  db and website
- 1️⃣⭕️ if a superuser🦹 removes a category reaction also remove it from the db
  and website
- 1️⃣⭕️ if a superuser🦹 removes **the last** category from a post that is
  published, unpublish the post
- 1️⃣⭕️ if a superuser🦹 removes **the last** category from a post that is
  published, inform the user
- 1️⃣ if a superuser🦹 removes a payment reaction recalculate the total payment
  amount of the post and store to the db
- 1️⃣⭕️ if a superuser🦹 removes **the last** payment reaction from a post, also
  unpublish the post

### Odd Jobs

- ?

## Old Messages

- 1️⃣ if the bot (re-)joins a server, all reactions to old posts that happen to
  posts that were posted before bot joined should still be handled
- 🚥 if the bot (re-)joins a server, it should look in all monitored channels
  for missed messages and process them to the rules above

## Integration Tests

- ⭕️ the bot stays online
- ⭕️ the bot does not negatively influence wagmi bot
- ⭕️ the bot is not negatively influenced by wagmi bot

## Website

- ⭕️ correct posts that have a category and paymentEmoji are added to the
  website
- ⭕️ published posts have all the correct categories from discord
- ⭕️ correct posts that have the payment emoji removed get removed from the
  website
- ⭕️ if a category is removed from discord, it is also removed on the website
