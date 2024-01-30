# Tests

## create messages

- create messages in correct format adds it to the db
- create messages in wrong format (missing title) should not be added to db
- create messages in wrong format (missing description) should not be added to
  db
- create messages in wrong format (missing conent link) should not be added to
  db
- create messages with title + description + link ( no hashtags ) should be
  added to the db (not obligatory)

- create messages in odd-job with wrong format should notify poster
- create messages in odd-job with correct format should add a payment to the db

## edit messages

- editing an incorrectly formatted messages to make it correct adds it to the db
  / publishes it
- editing an correctly formatted message to make it incorrect unpublishes a post
- editing an correctly formatted post and stay correct updates the post

- editing an incorrect odd-job to make it correct saves the oddjob
- editing an correct odd-job to make it incorrect ???

## delete messages

## add reactions

- regular users can only add regular emojis (no WM, no flags)
- directors can add all emojis

### publishing posts

- director adds any payment emoji to a post will publish a post if the post is
  correct
- a post is not correct if

1. it has no category
2. it is non-anglo and has no flag
3. it is a translation and has no non-anglo category

## remove reactions
