# Curation

## Curate Reaction

0. ensure the message is not partial = fetch the all whole entitities if it is
   (old reactions)
1. should the message be ignored? (bots / dms) => return if ignored
2. classify the message that the reaction was added to (post, oddjob, thread)
3. classify the type of reaction: regular, category, payment
4. check the user has the permissions to add emojisreturn if not

5. add the emoji to the db (in case we got here)
6. determine
