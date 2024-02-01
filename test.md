# Functionality

This document lists all functional requirements for the Wagmedia Communications
Bot

## general

- all messages from bots are ignored
- all dms are ignored
- all messages / reactions / updates / deletes from channels that are not
  monitored are ignored
- the user can configure relevant parts of the bot (e.g. monitored channels,
  logging behavior). For a full list of settings see [`config.ts`](config.ts)
  and the [`env.sample`](.env.sample) for secret settings
- There are two levels of rights the bot differentiates between: 🤷‍♂️regular users
  and 🦹superusers (configured to have the "Director" role)

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

## create messages

Posts

- complete posts are added to the db
- complete post added to the db should be logged to discord
- incomplete posts (missing title) should not be added to db
- incomplete posts (missing description) should not be added to db
- incomplete posts (missing content link) should not be added to db
- create messages with title + description + link but without hashtags should be
  added to the db

Odd Jobs

- [incomplete](#general) odd-jobs should notify poster
- [complete](#general) odd-jobs should add odd-job to the db

## edit messages

Posts

- editing an incomplete post to make it complete adds it to the db
- editing an complete post to make it incomplete unpublishes it, if it is
  published
- editing an complete post and it stays complete update it in the db

Odd Jobs

- editing an incomplete odd-job to make it complete saves the oddjob
- editing an complete odd-job to make it incomplete ??? TODO ???

## delete messages

- if a post that is not published yet or has no categories gets deleted, it will
  be removed from the database.
- if a post that is already published (=payed) or has any custom emojis by
  directors gets deleted, it stays in the db and gets flagged as deleted

## add reactions

Posts

- 🤷‍♂️regular users can only add regular emojis (no WM, no flags)
- 🤷‍♂️regular users (allowed) reactions are stored to the db
- 🦹superusers can add all emojis to complete posts (see below)
- 🦹superusers' emojis to incomplete posts will be removed
- 🦹superusers that add emojis to incomplete posts will be informed that the
  post is incomplete
- 🦹superuser adds any payment emoji to a post will publish a post if the post
  is complete. a post is **not complete** if

  1. it has no category
  2. it is non-anglo and has no flag
  3. it is a translation and has no non-anglo category

- payment emojis by 🦹superusers will update the total amount of payments a post
  received and save it to the db

Post Threads

- the bot monitors payment reactions to valid posts in the corresponding thread
  and inserts a payment to the db

OddJobs

- 🤷‍♂️regular users cannot add any emojis to odd jobs
- super user cannot add emojis to incomplete oddjobs
- only the 🦹superuser (manager) that is added as manager can add emojis to
  oddjobs
- 🦹superusers who are not the manager will get a message when trying to add
  emojis, emoji removed
- manager will get a message when trying to add emojis to incomplete oddjobs,
  emoji removed
- manager cannot add from two set of payment emojis
- manager will get a message when trying to add from two set of payment emojis
- complete oddjobs with payment emojis from manager will be added to the db

## remove reactions

- if a regular user removes a reaction it should also be removed from the db
- if a superuser removes a reaction it should also be removed from the db
- if a superuser removes a category reaction also remove it from the db
- if a superuser removes **the last** category from a post that is published,
  unpublish the post
- if a superuser removes a payment reaction recalculate the total payment amount
  of the post and store to the db
- if a superuser removes **the last** payment reaction from a post, also
  unpublish the post

## old messages

- if the bot (re-)joins a server, it should look in all monitored channels for
  missed messages and process them to the rules above, limited by:
- for discord reasons it cannot look at all past messages but at the last 10
  (config variable) in each monitored channel
