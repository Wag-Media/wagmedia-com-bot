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

_Complete_ posts get inserted to the db (does not mean published)

- a post is correct if it has a title + description + content link
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

- editing an incomplete post to make it correct adds it to the db
- editing an complete post to make it incomplete unpublishes it, if it is
  published
- editing an complete post and it stays complete update it in the db

Odd Jobs

- editing an incorrect odd-job to make it correct saves the oddjob
- editing an correct odd-job to make it incorrect ???

## delete messages

## add reactions

Posts

- regular users can only add regular emojis (no WM, no flags)
- directors can add all emojis to correct posts (see below)
- directors' emojis to incorrect posts will be removed
- directors that add emojis to incorrect posts will be informed that the post is
  incorrect
- director adds any payment emoji to a post will publish a post if the post is
  correct. a post is **not correct** if

  1. it has no category
  2. it is non-anglo and has no flag
  3. it is a translation and has no non-anglo category

OddJobs

- regular users cannot add any emojis to odd jobs
- directors cannot add emojis to incomplete oddjobs
- only the director (manager) that is added as manager can add emojis to oddjobs
- directors who are not the manager will get a message when trying to add
  emojis, emoji removed
- manager will get a message when trying to add emojis to incomplete oddjobs,
  emoji removed
- manager cannot add from two set of payment emojis
- manager will get a message when trying to add from two set of payment emojis
- correct oddjobs with payment emojis from manager will be added to the db

## remove reactions

## old messages
