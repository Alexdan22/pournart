import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { isAbsolute, resolve } from "node:path";

const BUSY_TIMEOUT_MS = 750;
const RETRY_DELAY_MS = 50;

type AuroraDatabaseGlobal = typeof globalThis & {
  __pnaAuroraWriteClient?: PrismaClient;
  __pnaAuroraWriteReady?: Promise<void>;
  __pnaAuroraWriteTail?: Promise<void>;
};

const state = globalThis as AuroraDatabaseGlobal;

export const auroraWriteClient =
  state.__pnaAuroraWriteClient ??
  new PrismaClient({
    adapter: new PrismaBetterSQLite3(
      { url: auroraDatabaseUrl(), timeout: BUSY_TIMEOUT_MS },
      { timestampFormat: "unixepoch-ms" },
    ),
    transactionOptions: {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 500,
      timeout: 1_500,
    },
  });
state.__pnaAuroraWriteClient = auroraWriteClient;

export async function runSerializedAuroraWrite<T>(
  operation: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  const previous = state.__pnaAuroraWriteTail ?? Promise.resolve();
  let release!: () => void;
  state.__pnaAuroraWriteTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  try {
    await ensureAuroraWriteClient();
    try {
      return await operation(auroraWriteClient);
    } catch (error) {
      if (!isTransientSqliteBusy(error)) throw error;
      await delay(RETRY_DELAY_MS);
      return await operation(auroraWriteClient);
    }
  } catch (error) {
    if (isTransientSqliteBusy(error)) throw new AuroraPersistenceBusyError();
    throw error;
  } finally {
    release();
  }
}

export function isTransientSqliteBusy(error: unknown) {
  if (!isRecord(error)) return false;
  const code = typeof error.code === "string" ? error.code : "";
  const meta = isRecord(error.meta) ? error.meta : {};
  const sqliteCode = String(meta.code ?? "");
  const message = `${String(error.message ?? "")} ${String(meta.message ?? "")}`.toLowerCase();
  return (
    code === "P1008" ||
    code === "P2010" ||
    code === "P2034" ||
    (code === "P2028" && (message.includes("database is locked") || message.includes("timeout"))) ||
    sqliteCode === "5" ||
    message.includes("database is locked")
  );
}

export class AuroraPersistenceBusyError extends Error {
  readonly code = "AURORA_PERSISTENCE_BUSY";
  constructor() {
    super("Aurora persistence is temporarily busy.");
    this.name = "AuroraPersistenceBusyError";
  }
}

async function ensureAuroraWriteClient() {
  if (!state.__pnaAuroraWriteReady) {
    state.__pnaAuroraWriteReady = (async () => {
      await auroraWriteClient.$executeRawUnsafe(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
      const rows = await auroraWriteClient.$queryRawUnsafe<Array<Record<string, unknown>>>("PRAGMA busy_timeout");
      const configured = Number(rows[0]?.timeout ?? rows[0]?.busy_timeout);
      if (configured !== BUSY_TIMEOUT_MS) throw new Error("AURORA_BUSY_TIMEOUT_CONFIGURATION_FAILED");
    })();
  }
  await state.__pnaAuroraWriteReady;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function auroraDatabaseUrl() {
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error("AURORA_DATABASE_URL_MISSING");
  if (!source.startsWith("file:")) throw new Error("AURORA_DATABASE_MUST_BE_SQLITE");
  const configuredPath = source.slice("file:".length);
  if (configuredPath.includes("?")) throw new Error("AURORA_DATABASE_URL_PARAMETERS_UNSUPPORTED");
  const databasePath = isAbsolute(configuredPath)
    ? configuredPath
    : resolve(process.cwd(), "prisma", configuredPath);
  return `file:${databasePath.replaceAll("\\", "/")}`;
}
