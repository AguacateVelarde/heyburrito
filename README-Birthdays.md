# Birthdays module 🎂

Manages the team's birthdays and posts a greeting to a group channel that
@-mentions whoever is celebrating.

## How it works

1. Birthdays are stored in MongoDB (`birthdays` collection), one document per
   Slack user.
2. A cron job runs once a day, looks up who is celebrating and posts a single
   message to the birthday channel mentioning them (`<@U123>`), together with a
   birthday GIF from Giphy.
3. Each greeting is stamped with the year it was sent, so restarts, redeploys or
   a manual announcement never produce a duplicate message.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `ENABLE_BIRTHDAYS` | `true` | Turns the whole module off when set to `false`. |
| `BIRTHDAY_CHANNEL` | falls back to `SLACK_DEFAULT_CHANNEL` | Channel the daily greeting is posted to. Accepts a channel id (`C0123456789`) or name. |
| `BIRTHDAY_CRON` | `0 9 * * *` | Cron expression for the daily check. |
| `BIRTHDAY_TIMEZONE` | `UTC` | Timezone the cron expression is evaluated in. |

The bot must be a member of the birthday channel (`/invite @HeyBurrito`).
If no channel is configured the daily job is not scheduled and a warning is
logged on boot.

## Slash command

Registered as `/cumpleanos` and `/birthday` (both hit the same handler, and the
subcommands accept Spanish aliases such as `agregar`, `eliminar`, `lista`,
`proximos`, `hoy`, `anunciar`).

| Subcommand | Example | What it does |
| --- | --- | --- |
| `set DD/MM[/YYYY]` | `/cumpleanos set 05/03` | Registers your own birthday. |
| `add @user DD/MM[/YYYY]` | `/cumpleanos add @leo 05/03/1990` | Registers someone else's. |
| `remove [@user]` | `/cumpleanos remove @leo` | Deletes a birthday (yours when no mention is given). |
| `list` | `/cumpleanos list` | Every registered birthday, ordered by date. |
| `next [n]` | `/cumpleanos next 10` | The upcoming birthdays with how many days are left. |
| `today` | `/cumpleanos today` | Who is celebrating today. |
| `announce` | `/cumpleanos announce` | Posts today's greeting right away, even if it was already sent. |
| `help` | `/cumpleanos` | Shows the usage help. |

Accepted date formats: `DD/MM`, `DD-MM`, `DD.MM`, `DD/MM/YYYY` and `YYYY-MM-DD`.
The year is optional — when present the greeting includes the age.

## Admin API

All endpoints require the admin JWT (`Authorization: Bearer <token>`).

| Method | Path | Body / query | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/birthdays` | — | Every registered birthday. |
| `GET` | `/admin/birthdays/upcoming` | `?limit=5` | Upcoming birthdays with `daysUntil`. |
| `POST` | `/admin/birthdays` | `{ slackId, day, month, year?, name?, channelId? }` | Creates or updates a birthday. |
| `DELETE` | `/admin/birthdays/:slackId` | — | Deletes a birthday (404 when unknown). |
| `POST` | `/admin/birthdays/announce` | `{ channel?, force? }` | Triggers the greeting manually. Returns 422 with the Slack reason when the channel rejects the post. |

These endpoints also back the **Cumpleaños** section of the
[admin dashboard](./README-Dashboard.md).

## Details worth knowing

- **Feb 29th**: celebrated on Feb 28th during non-leap years.
- **Per-user channel**: setting `channelId` on a birthday sends that person's
  greeting to a different channel; everyone else uses `BIRTHDAY_CHANNEL`.
- **Several people on the same day**: they are grouped into a single message
  that mentions all of them.
- **Language**: all copy lives in `src/i18n/translations/{en,es}.ts` under the
  `birthday` key and follows `DEFAULT_LANGUAGE`.
