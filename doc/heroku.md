# Heroku Setup

The initial heroku setup requires a postgres db and a worker dyno. NO WEB DYNO
IS needed as the app will not handle web requests.

## Setup a postgres db on heroku

In heroku app click `Resources >> Find more Resources` and select Heroku
Postgres. Choose the plan you want, pay attention to size and backups.

## Set env variables in heroku

`Settings >> Config Vars` then set each config var that is in `.env.sample`

## Setup a worker dyno + disable web dyno

In heroku app click `Resources`. Then click the edit icon to disable web dyno
and choose a fitting worker dyno.

## See Logs

First, make sure you have heroku cli installed and are logged in via
`heroku login`. Then

```
heroku logs --tail -a wagmedia-com-bot
```

will display the logs in your terminal. You might want to replace
`wagmedia-com-bot` with the name of the heroku app if it differs.
