# PersonalStat — NBA 2K Team Up Stat Tracker

A Discord bot for the NBA 2K All-Star Team Up server. Post a **GAME STATS**
box score screenshot in a channel (or DM the bot) and it reads every stat
with Claude, asks you to confirm, then tracks it — season stats, career
stats, leaderboards, wins/losses.

## Stack

- **Bot**: Node.js + TypeScript + [discord.js](https://discord.js.org)
- **Vision parsing**: Claude (`@anthropic-ai/sdk`) reads the screenshot and returns structured stats
- **Database**: Postgres via [Prisma](https://www.prisma.io) — meant to run on Railway's Postgres plugin
- **Hosting**: Railway

## How it works

1. Someone posts a box score screenshot (see the format below) in the configured channel, or DMs it to the bot.
2. The bot sends the image to Claude and gets back every player's line for both teams.
3. It replies with a preview embed and **Save** / **Discard** buttons so you can catch a misread before it's stored.
4. On **Save**, each gamertag is matched to an existing player (exact match → known alias → fuzzy match on close misspellings → otherwise a new player is created). Fuzzy matches are remembered as aliases so the same OCR quirk resolves instantly next time.
5. Stats are commands away: `/stats`, `/careerstats`, `/leaderboard`.

If the bot ever creates a duplicate profile (e.g. two spellings that were too different to auto-fuzzy-match), run `/merge keep:<name> duplicate:<name>` to fold them into one — it moves every game stat line and remembers the duplicate name as an alias.

## Commands

| Command | Description |
|---|---|
| `/stats gamertag` | Current season stats (GP, W-L, PPG, RPG, APG, shooting splits, etc.) |
| `/careerstats gamertag` | All-time career stats, same format |
| `/leaderboard stat [scope] [limit]` | Top players by a stat, current season or career |
| `/season new name` | End the current season, start a new one (admin) |
| `/season list` / `/season current` | List seasons / show the active one |
| `/merge keep duplicate` | Fold a duplicate profile into another (admin) |
| `/help` | Quick command reference |

Admin commands require the **Manage Server** permission, or a specific role set via `ADMIN_ROLE_ID`.

## Setup

### 1. Discord bot

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **Bot**, create a bot user, copy the token → `DISCORD_TOKEN`.
3. Still under **Bot**, enable the **Message Content Intent** (required to read screenshot attachments).
4. Copy the **Application ID** → `DISCORD_CLIENT_ID`.
5. Under **OAuth2 → URL Generator**, select scopes `bot` and `applications.commands`, and bot permissions `Send Messages`, `Read Message History`, `Attach Files`, `Use Slash Commands`, `Embed Links`. Use the generated URL to invite the bot to your server.

### 2. Anthropic API key

Grab an API key from the [Anthropic Console](https://console.anthropic.com) → `ANTHROPIC_API_KEY`.

### 3. Database

Add the **Postgres** plugin in your Railway project. Railway will expose a `DATABASE_URL` reference variable you can wire into the bot service.

### 4. Environment variables

Copy `.env.example` to `.env` and fill it in. `SCREENSHOT_CHANNEL_ID` is optional — leave it blank to let the bot watch every channel it can read, or set it to restrict auto-parsing to one channel.

### 5. Install, migrate, run

```bash
npm install
npm run prisma:migrate      # creates the database tables (local/dev)
npm run deploy-commands     # registers the slash commands
npm run dev                 # run locally
```

### 6. Deploy to Railway

Push this repo to GitHub, create a Railway project from it, attach the Postgres plugin, and set the environment variables above (`DATABASE_URL` comes from the Postgres plugin reference). Railway runs `npm run build` then `npm run start`, which applies pending migrations (`prisma migrate deploy`) before starting the bot. Run `npm run deploy-commands` once (locally, pointed at the same `DISCORD_TOKEN`/`DISCORD_CLIENT_ID`) any time you add or change a command.

## Box score format

The bot expects the in-game **GAME STATS** screen (`Y Quit / B Close / A More`), with both teams' rosters and a `TOTAL` row each, columns: `GRD PTS REB AST STL BLK FOULS TO FGM/FGA 3PM/3PA FTM/FTA`.

## Notes / current limitations

- Player identity is matched by gamertag text only (no Discord account linking) — use `/merge` to clean up duplicates.
- A screenshot pending confirmation lives in memory for 10 minutes; if the bot restarts before you click Save, repost the screenshot.
- Seasons are manual (`/season new`) — there's no automatic rollover.
