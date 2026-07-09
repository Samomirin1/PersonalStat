import { randomUUID } from "node:crypto";
import type { ParsedBoxScore } from "../types";

export interface PendingGame {
  parsed: ParsedBoxScore;
  seasonId: string;
  submittedBy: string;
  screenshotUrl?: string;
}

interface StoredPendingGame extends PendingGame {
  timeout: NodeJS.Timeout;
}

const PENDING_TTL_MS = 10 * 60 * 1000;
const store = new Map<string, StoredPendingGame>();

export function createPendingGame(data: PendingGame): string {
  const token = randomUUID();
  const timeout = setTimeout(() => store.delete(token), PENDING_TTL_MS);
  store.set(token, { ...data, timeout });
  return token;
}

export function getPendingGame(token: string): PendingGame | undefined {
  return store.get(token);
}

export function clearPendingGame(token: string): void {
  const pending = store.get(token);
  if (pending) clearTimeout(pending.timeout);
  store.delete(token);
}
