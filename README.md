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

1. Someone posts a box score screenshot (see the format below) in the configured channel, DMs it to the bot, or runs `/upload`.
2. The bot sends the image to Claude and gets back every player's line for both teams.
3. It replies with a preview embed showing all the parsed stats, flagging anything that looks off before you commit: 🆕 next to a gamertag that would create a brand-new player, ⚠️ next to one that closely matches an existing player (likely the same person, possibly an OCR misread). **Save** / **Discard** buttons let you catch a bad parse before it's stored.
4. On **Save**, each gamertag is matched to an existing player (exact match → known alias → fuzzy match on close misspellings → otherwise a new player is created). Fuzzy matches are remembered as aliases so the same OCR quirk resolves instantly next time. The reply tells you the game number it was saved as.
5. Stats are commands away: `/stats`, `/careerstats`, `/leaderboard`, `/games`.

If the bot ever creates a duplicate profile (e.g. two spellings that were too different to auto-fuzzy-match), run `/merge keep:<name> duplicate:<name>` to fold them into one — it moves every game stat line and remembers the duplicate name as an alias. If a game was uploaded by mistake or duplicated, look up its number with `/games` and remove it with `/deletegame`. If someone leaves and shouldn't be tracked anymore, `/removeplayer` deletes their profile and stat lines entirely.

## Commands

| Command | Who | Description |
|---|---|---|
| `/upload screenshot [screenshot2]` | Anyone | Upload a box score screenshot directly (an alternative to just posting the image) |
| `/stats gamertag` | Anyone | Current season stats (GP, W-L, PPG, RPG, APG, shooting splits, etc.) |
| `/careerstats gamertag` | Anyone | All-time career stats, same format |
| `/leaderboard stat [scope] [limit]` | Anyone | Top players by a stat, current season or career |
| `/games [limit]` | Anyone | List recent games and their `game_number` |
| `/season new name` | Admin | End the current season, start a new one |
| `/season list` / `/season current` | Anyone | List seasons / show the active one |
| `/merge keep duplicate` | Admin | Fold a duplicate profile into another |
| `/removeplayer gamertag` | Admin | Permanently remove a player and their game stats (e.g. someone left) |
| `/deletegame game_number` | Admin | Delete a game and every stat line in it (e.g. wrong/duplicate upload) |
| `/help` | Anyone | Quick command reference |

Admin commands require the **Manage Server** permission, or a specific role set via `ADMIN_ROLE_ID`. Destructive commands (`/removeplayer`, `/deletegame`) show a confirmation with Confirm/Cancel buttons before doing anything.

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
npm run dev                 # run locally — this also registers the slash commands
```

### 6. Deploy to Railway

Push this repo to GitHub, create a Railway project from it, attach the Postgres plugin, and set the environment variables above (`DATABASE_URL` comes from the Postgres plugin reference). Railway runs `npm run build` then `npm run start`, which applies pending migrations (`prisma migrate deploy`) and re-registers the slash commands with Discord every time the bot boots — so there's no separate manual command-registration step, on Railway or anywhere else. If you ever want to run registration by hand (e.g. to force it without a redeploy), `npm run deploy-commands` still works locally.

## Box score format

The bot expects the in-game **GAME STATS** screen (`Y Quit / B Close / A More`), with both teams' rosters and a `TOTAL` row each, columns: `GRD PTS REB AST STL BLK FOULS TO FGM/FGA 3PM/3PA FTM/FTA`.

## Notes / current limitations

- Player identity is matched by gamertag text only (no Discord account linking) — use `/merge` to clean up duplicates.
- A screenshot pending confirmation lives in memory for 10 minutes; if the bot restarts before you click Save, repost the screenshot.
- Seasons are manual (`/season new`) — there's no automatic rollover.
