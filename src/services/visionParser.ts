import Anthropic from "@anthropic-ai/sdk";
import type { ParsedBoxScore } from "../types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const playerRowSchema = {
  type: "object",
  properties: {
    gamertag: {
      type: "string",
      description:
        "Exact gamertag/username text as shown, preserving capitalization, underscores, numbers, and symbols. Do not clean it up or guess.",
    },
    grade: { type: "string", description: "Letter grade from the GRD column, e.g. 'A-', 'B+', 'C'." },
    points: { type: "integer" },
    rebounds: { type: "integer" },
    assists: { type: "integer" },
    steals: { type: "integer" },
    blocks: { type: "integer" },
    fouls: { type: "integer" },
    turnovers: { type: "integer", description: "The TO column." },
    fgm: { type: "integer", description: "Made field goals: left number of FGM/FGA." },
    fga: { type: "integer", description: "Attempted field goals: right number of FGM/FGA." },
    tpm: { type: "integer", description: "Made three pointers: left number of 3PM/3PA." },
    tpa: { type: "integer", description: "Attempted three pointers: right number of 3PM/3PA." },
    ftm: { type: "integer", description: "Made free throws: left number of FTM/FTA." },
    fta: { type: "integer", description: "Attempted free throws: right number of FTM/FTA." },
  },
  required: [
    "gamertag",
    "grade",
    "points",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "fouls",
    "turnovers",
    "fgm",
    "fga",
    "tpm",
    "tpa",
    "ftm",
    "fta",
  ],
} as const;

const teamSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Team name shown above the roster, e.g. 'All-Time Cavaliers'. Do not include the word TOTAL.",
    },
    score: {
      type: "integer",
      description: "This team's final score, from the TOTAL row's PTS column or the large scoreboard number.",
    },
    players: { type: "array", items: playerRowSchema, minItems: 1 },
  },
  required: ["name", "score", "players"],
} as const;

const BOX_SCORE_TOOL: Anthropic.Tool = {
  name: "record_box_score",
  description:
    "Record both teams and every player's stat line from an NBA 2K Team Up 'GAME STATS' box score screenshot.",
  input_schema: {
    type: "object",
    properties: {
      teamA: teamSchema,
      teamB: teamSchema,
      quartersPlayed: {
        type: "integer",
        description:
          "How many quarters were actually completed, from the small per-quarter score breakdown box (columns labeled Q1 Q2 Q3 Q4, usually near the scoreboard/team logos). Count how many of those quarter columns show a numeric score rather than a dash '-' or blank -- that count is quartersPlayed (1-4). If that breakdown isn't visible in the screenshot, use 4.",
      },
    },
    required: ["teamA", "teamB", "quartersPlayed"],
  },
};

export interface ImageInput {
  base64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}

export async function fetchImageAsBase64(url: string): Promise<ImageInput> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image (${res.status}): ${url}`);
  }
  const contentType = res.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  const mediaType = (
    ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType) ? contentType : "image/png"
  ) as ImageInput["mediaType"];
  return { base64: buffer.toString("base64"), mediaType };
}

export async function parseBoxScore(images: ImageInput[]): Promise<ParsedBoxScore> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [BOX_SCORE_TOOL],
    tool_choice: { type: "tool", name: "record_box_score" },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
          })),
          {
            type: "text" as const,
            text: [
              "This is a screenshot of the GAME STATS box score from an NBA 2K 'Team Up' game.",
              "Extract every player row from BOTH teams using the record_box_score tool.",
              "Column meanings: GRD=letter grade, PTS=points, REB=rebounds, AST=assists, STL=steals,",
              "BLK=blocks, FOULS=personal fouls, TO=turnovers, FGM/FGA=made/attempted field goals,",
              "3PM/3PA=made/attempted three pointers, FTM/FTA=made/attempted free throws.",
              "Read gamertags character-by-character exactly as displayed -- do not guess or normalize them.",
              "Use each team's TOTAL row (or the large scoreboard number) for that team's score.",
              "If a stat column is cut off or unreadable, use 0 for that field rather than omitting it.",
              "Also report quartersPlayed: look for the small per-quarter score breakdown (Q1/Q2/Q3/Q4 columns) and",
              "count how many quarters show an actual number rather than a dash, so we can tell when a game ended early.",
            ].join(" "),
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Claude did not return structured box score data.");
  }
  return toolUse.input as ParsedBoxScore;
}
