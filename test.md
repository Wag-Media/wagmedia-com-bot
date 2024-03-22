# Functionality

This document lists all functional requirements for the Wagmedia Communications
Bot. It also lists the completion of manual tests by the developer and the
WagMedia team.

## Legend

- ✅ tested manually by niftesty
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

- ✅ the set of emojis to seed the db is complete for the functioning of the
  bot, `./config.ts`-> `paymentEmojiMap`, `categoryEmojiMap`
- ✅ all emojis that are defined `./config.ts`-> `paymentEmojiMap`,
  `categoryEmojiMap` are used to seed the db
- ✅ all emojis that are defined in `categoryEmojiMap` have a `CategoryRule` in
  the db
- ✅ all emojis that are defined in `paymentEmojiMap` have a `PaymentRule` in
  the db
- ✅ the bot leaves guilds(servers) that is not configured in `config.GUILD_ID`

## Create Messages

### Posts

- ✅ complete posts are added to the db but not published to the website
- ✅ complete post added to the db should be logged to discord
- ✅ all relevant fields (title, description, tags, embedUrl, discordLink, user,
  contentUrl) get inserted into the db correctly
- ✅ tags are recognized in the format: `Hashtags: #tag1, #tag2, ...` or
  `Tags: #tag1, tag2, ...`
- ✅ incomplete posts (missing title) should not be added to db
- ✅ incomplete posts (missing description) should not be added to db
- create messages with title + description but without embed should be added to
  the db
- ✅ create messages with title + description + link but without hashtags should
  be added to the db
- ✅ correct posts added in channels / categories that are not monitored should
  be ignored

### Odd Jobs

- ✅ incomplete odd-jobs should notify poster
- ✅ complete odd-jobs should add odd-job to the db
- ✅ oddjobs attachments are saved to the db
- ✅ if more than 5 attachments user is informed
- ✅ if attachment is larger than config value `MAX_FILE_SIZE` it is not saved
  and user is informed

## Edit Messages

### Posts

- ✅ editing an incomplete post to make it complete adds it to the db
- ✅ editing an complete post to make it incomplete unpublishes it, if it is
  published (isDeleted = true)
- ✅ correcting an isDeleted = true post removes sets isDeleted = false
- ✅ editing an complete post and it stays complete update it in the db
- ✅ editing an incomplete post and it stays incomplete is ignored
- ✅ editing paid posts is not possible, user gets informed to unpublish first

### Odd Jobs

- ✅ editing an incomplete odd-job to make it complete saves the oddjob
- ✅ editing an complete odd-job to make it incomplete will warn the creator but
  leave the odd job in the db
- ✅ editing paid odd-jobs is not possible

## Delete Messages

- ✅ if a post message that is not published yet or has no categories gets
  deleted, it will be removed from the database.
- ✅⭕️ if a post message that is already published (=paid) gets deleted, it
  stays in the db and gets flagged as deleted
- ✅ if an oddjob message that is not paid yet gets deleted it will be removed
  from the database
- ✅ if an oddjob message that is paid gets deleted, it stays in the db and gets
  flagged as deleted

- ??? if a post message with threads gets deleted?

## add reactions

### Posts

- ✅ regular users🤷‍♂️ can only add regular emojis (no WM, no flags)
- ✅ regular users🤷‍♂️ (allowed) reactions are stored to the db
- ✅ superusers🦹 can add all emojis to completed posts (see below)
- ✅ superusers🦹 can add featured emojis to posts
- ✅ adding a feature emoji to a posts sets `isFeatured` in the db to true
- ✅ superusers🦹' emojis to incomplete posts will be removed
- ✅ superusers🦹 that add emojis to incomplete posts will be informed that the
  post is incomplete
- ✅ superusers🦹 cannot add payment emojis from two different sets or units
- ✅ superuser🦹 adds any payment emoji to a post will publish a post if the
  post is complete. a post is **not complete** if

  1. it has no category
  2. it is non-anglo and has no flag
  3. it is a translation and has no non-anglo category

- ✅ payment emojis by superusers🦹 will update the total amount of payments a
  post received and save it to the db

### Post Threads

- ✅ the bot monitors payment reactions to valid posts in the corresponding
  thread and inserts a payment to the db
- ✅ the parent post gets updated in the db to include thread payments
- ✅ superusers🦹 cannot add payment emojis from two different sets or units
- ✅⭕️ if the parent of the thread is not valid still monitor the payments

### Odd Jobs

- ✅ regular users🤷‍♂️ cannot add any WM emojis to odd jobs
- ✅ super user cannot add emojis to incomplete oddjobs
- ✅ only the 🦹superuser (manager) that is added as manager can add payment
  emojis to oddjobs
- ✅ superusers🦹 who are not the manager will get a message when trying to add
  emojis, emoji removed
- ✅ manager will get a message when trying to add emojis to incomplete oddjobs,
  emoji removed
- ✅ manager cannot add payment emojis from two different sets or units
- ✅ manager will get a message when trying to add from two set of payment
  emojis (neither different unit nor different funding source)
- ✅ complete odd-jobs will be added to the db
- ✅ payment emojis by manager will update the total amount of payments an odd
  job received and save it to the db

## Remove Reactions

### Posts

- ✅ if a regular user🤷‍♂️ removes a reaction it should also be removed from the
  db and website
- ✅ if a superuser🦹 removes a reaction it should also be removed from the db
  and website
- ✅ if a superuser🦹 removes a category reaction also remove it from the db and
  website
- ✅⭕️ if a superuser🦹 removes **the last** category from a post that is
  published, warn the user and keep the category in the db. When a new category
  is added, it should override the one from the db.
- ✅ if a superuser🦹 removes **the last** category from a post that is
  published, inform the user
- ✅ if a superuser🦹 removes a payment reaction recalculate the total payment
  amount of the post and store to the db
- ✅ if a superuser🦹 removes **the last** payment reaction from a post, also
  unpublish the post

### Odd Jobs

- ✅ same as in posts for payments

### Threads

- ✅ same as in posts
- ✅⭕️ if a post is not published or not rewarded, it should still be possible
  to reward threads

## Old Messages

- ✅ if a post was created before bot joined, bot goes online, then message is
  reacted to, the message and the reactions are inserted correctly to the db
- ✅ if a oddjob was created before bot joined, bot goes online, then message is
  reacted to, the message and the reactions are inserted correctly to the db
- ✅ if a post was created when bot was online, bot goes offline misses some
  reactions, bot goes online, then message is reacted to, the message and the
  reactions are inserted correctly to the db
- ✅ if a oddjob was created when bot was online, bot goes offline misses some
  reactions, bot goes online, then message isreacted to, the message and the
  reactions are inserted correctly to the db
- ✅⭕️ if a discrepancy is detected between a discord post/thread/oddjob and any
  reaction is **added** the bot parses all reactions again creating a valid db
  state that is in sync with discord
- ✅ if a regular user adds invalid emojis while the bot is offline and bot
  comes online, then any reaction triggers a revalidation and produces a valid
  db state

## Universal Publish Emoji (UPE)

- ✅⭕️ superusers🦹 can add universal payment emojis (UPE) to posts
- ✅⭕️ adding UPE emojis publishes a post
- ✅⭕️ UPE can only be added if there are no other payment emojis
- 🚥⭕️ after UPE is added to a post, no other payment emojis can be added
- ✅⭕️ reacting with the universal publish emoji will publish a (valid) post
  even if it has no payments

- ✅⭕️ when UPE is removed the post is unpublished
- ✅⭕️ all functionality is like it was never there (payment emojis can be
  added)

## Newsletter

- 🚥⭕️ superusers🦹 can add "WMNEWSLETTER" emoji to posts inside
  "wag-newsletter" channel
- 🚥⭕️ superusers🦹 can add only UPE emoji to the original newsletter post
  inside "wag-newsletter" channel
- 🚥⭕️ after UPE is added to a post, no other payment emojis can be added
- 🚥⭕️ adding UPE emoji publishes the newsletter posts
- 🚥⭕️ additionally the original post can receive other category emojis also but
  no payment emoji to the original post
- 🚥⭕️ original post thread comments can receive rewards (payment emojis)
- 🚥⭕️ reacting with the universal publish emoji will publish a (valid) post
  even if it has no payments
- 🚥⭕️ when UPE is removed the post is unpublished
- 🚥⭕️ all functionality is like it was never there (payment emojis can be
  added)
- 🚥⭕️ For the website we need a separate tab for showing all our posts which
  are reacted with "WMNEWSLETTER"

## Events (Milestone X.XX)

- 🚥⭕️ superusers🦹 can add "WMEVENTS" emoji to posts inside "events-watch"
  channel
- 🚥⭕️ superusers🦹 can add UPE or Payment emoji to the original event post
  inside "events-watch" channel
- 🚥⭕️ if UPE is added to the post, no other payment emojis can be added, if
  payment emoji added it can receive extra payment emojis
- 🚥⭕️ adding UPE/Payment emoji publishes the event posts
- 🚥⭕️ The post can not receive any extra category emoji when event emoji is
  added
- 🚥⭕️ original post thread comments can receive rewards (payment emojis) if any
- 🚥⭕️ reacting with the UPE will publish a (valid) post even if it has no
  payments
- 🚥⭕️ when UPE/Payment Emoji is removed the post is unpublished
- 🚥⭕️ all functionality is like it was never there (payment emojis can be
  added)
- 🚥⭕️ For the website we need a separate tab for showing all our event posts
  which are reacted with "WMEVENTS", we plan to make a format for the event page
  any way so that we can make a great calendar. Like Start date and time and End
  date and time lots of other extra things.

## Integration Tests

- ✅ the bot stays online
- ✅ the bot does not negatively influence wagmi bot
- ✅ the bot is not negatively influenced by wagmi bot

## Website

- 🚥 correct posts that have a category and paymentEmoji are added to the
  website
- 🚥 published posts have all the correct categories from discord
- 🚥 correct posts that have the payment emoji removed get removed from the
  website
- 🚥 if a category is removed from discord, it is also removed on the website
- 🚥 Newsletter Subscription to Substack
