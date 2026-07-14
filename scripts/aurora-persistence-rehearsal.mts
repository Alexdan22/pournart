import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, cpSync, mkdtempSync, mkdirSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "pna-aurora-rehearsal-"));
const databasePath = join(directory, "source.db");
const backupDirectory = join(directory, "backups");
const restoredPath = join(directory, "restored.db");
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const python = process.platform === "win32" ? "python" : "python3";

try {
  process.env.DATABASE_URL = databaseUrl;
  closeSync(openSync(databasePath, "wx"));
  execFileSync(process.execPath, [join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  const [{ PrismaClient }, adapter, database, applicationDatabase, persistence, identity, bindings] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/aurora/adapter"),
    import("../src/lib/aurora/database"),
    import("../src/lib/db"),
    import("../src/lib/aurora/persistence"),
    import("../src/lib/aurora/identity"),
    import("../src/lib/aurora/bindings"),
  ]);
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const legacyUpgrade = await rehearseLegacyUpgrade(PrismaClient, directory, python);
  const adminId = "admin.rehearsal";
  const productId = "product.rehearsal";
  await client.user.create({
    data: {
      id: adminId,
      name: "Rehearsal Admin",
      email: "rehearsal-admin@example.invalid",
      passwordHash: "not-a-real-password-hash",
      role: "ADMIN",
    },
  });
  await client.category.create({
    data: {
      id: "category.rehearsal",
      name: "Rehearsal",
      slug: "rehearsal",
      description: "Structured migration fixture",
    },
  });
  await client.product.create({
    data: {
      id: productId,
      categoryId: "category.rehearsal",
      name: "Migration fixture product",
      slug: "ocean-bloom-coaster-set",
      description: "Present",
      story: "Present",
      price: 100,
      imageUrl: "/fixture.png",
      inventory: 2,
      adminStatus: "PUBLISHED",
      isActive: true,
      handmadeDaysMin: 4,
      handmadeDaysMax: 7,
      customizationFields: "[]",
    },
  });
  await client.product.create({
    data: {
      id: "product.rehearsal.two",
      categoryId: "category.rehearsal",
      name: "Second migration fixture product",
      slug: "floral-ocean-name-plate",
      description: "Present",
      story: "Present",
      price: 100,
      imageUrl: "/fixture-two.png",
      inventory: 2,
      adminStatus: "PUBLISHED",
      isActive: true,
      handmadeDaysMin: 4,
      handmadeDaysMax: 7,
      customizationFields: "[]",
    },
  });

  const requestKey = randomUUID();
  const first = await adapter.evaluateProductIntelligence(productId, {
    requestedById: adminId,
    requestKey,
    requestMode: "REEVALUATE",
  });
  assert(first.state === "success" && first.evaluationId, "First evaluation did not persist.");
  const duplicate = await adapter.evaluateProductIntelligence(productId, {
    requestedById: adminId,
    requestKey,
    requestMode: "REEVALUATE",
  });
  assert(
    duplicate.state === "success" && duplicate.evaluationId === first.evaluationId,
    "Same-key retry did not return the same attempt.",
  );
  const modeConflict = await adapter.evaluateProductIntelligence(productId, {
    requestedById: adminId,
    requestKey,
    requestMode: "RETRY",
  });
  assert(modeConflict.state === "idempotency-conflict", "Different mode did not conflict.");
  const conflict = await adapter.evaluateProductIntelligence(productId, {
    requestedById: "admin.other",
    requestKey,
    requestMode: "REEVALUATE",
  });
  assert(conflict.state === "idempotency-conflict", "Different request identity did not conflict.");
  const productConflict = await adapter.evaluateProductIntelligence("product.rehearsal.two", {
    requestedById: adminId,
    requestKey,
    requestMode: "REEVALUATE",
  });
  assert(productConflict.state === "idempotency-conflict", "Different product did not conflict.");
  await client.product.update({ where: { id: productId }, data: { inventory: 0 } });
  const contextConflict = await adapter.evaluateProductIntelligence(productId, {
    requestedById: adminId,
    requestKey,
    requestMode: "REEVALUATE",
  });
  assert(contextConflict.state === "idempotency-conflict", "Different context did not conflict.");
  await client.product.update({ where: { id: productId }, data: { inventory: 2 } });

  const concurrentKey = randomUUID();
  const [concurrentFirst, concurrentSecond] = await Promise.all([
    adapter.evaluateProductIntelligence(productId, {
      requestedById: adminId,
      requestKey: concurrentKey,
      requestMode: "REEVALUATE",
    }),
    adapter.evaluateProductIntelligence(productId, {
      requestedById: adminId,
      requestKey: concurrentKey,
      requestMode: "REEVALUATE",
    }),
  ]);
  assert(
    concurrentFirst.state === "success" &&
      concurrentSecond.state === "success" &&
      concurrentFirst.evaluationId === concurrentSecond.evaluationId,
    "Concurrent duplicate requests did not join one execution.",
  );

  const lockProduct = await client.product.findUniqueOrThrow({ where: { id: productId } });
  const lockBinding = bindings.resolveAuroraBinding(lockProduct);
  assert(lockBinding.ok, "Lock fixture binding did not resolve.");
  const lockContext = identity.buildEvaluationContextIdentity(lockProduct, lockBinding.binding);
  const persistedResponse = concurrentFirst.state === "success" ? concurrentFirst.response : undefined;
  assert(persistedResponse?.ok, "Lock fixture requires a successful Aurora result.");
  const buildPersistenceInput = (key: string) => ({
    product: lockProduct,
    binding: lockBinding.binding,
    context: lockContext,
    requestKey: key,
    requestIdentity: {
      operationType: "PRODUCT_EVALUATION" as const,
      requestMode: "REEVALUATE" as const,
      productId,
      productSlug: lockProduct.slug,
      bindingId: lockBinding.binding.bindingId,
      bindingFingerprint: lockContext.bindingFingerprint,
      applicationContextFingerprint: lockContext.applicationContextFingerprint,
      requestedById: adminId,
    },
    trigger: "lock-rehearsal",
    response: persistedResponse,
    durationMs: 1,
  });

  const shortLock = holdExclusiveLock(databasePath, 200);
  await shortLock.ready;
  const recovered = await persistence.persistEvaluation(buildPersistenceInput(randomUUID()));
  await shortLock.done;
  assert(recovered.status === "SUCCEEDED", "A short SQLite lock did not recover.");

  const longLock = holdExclusiveLock(databasePath, 5_000);
  await longLock.ready;
  const busyStartedAt = performance.now();
  let busyCode = "";
  try {
    await persistence.persistEvaluation(buildPersistenceInput(randomUUID()));
  } catch (error) {
    busyCode =
      error instanceof database.AuroraPersistenceBusyError
        ? error.code
        : typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "UNEXPECTED";
  }
  const busyDurationMs = performance.now() - busyStartedAt;
  await longLock.done;
  assert(
    busyCode === "AURORA_PERSISTENCE_BUSY",
    `A long SQLite lock was not isolated (received ${busyCode} after ${Math.round(busyDurationMs)} ms).`,
  );
  assert(
    busyDurationMs < 4_000,
    `Aurora persistence wait was not bounded (${Math.round(busyDurationMs)} ms).`,
  );
  await client.product.update({ where: { id: productId }, data: { inventory: 3 } });
  await client.product.update({ where: { id: productId }, data: { inventory: 2 } });
  const refreshed = await adapter.evaluateProductIntelligence(productId, {
    requestedById: adminId,
    requestKey: randomUUID(),
    requestMode: "REEVALUATE",
  });
  assert(
    refreshed.state === "success" && refreshed.evaluationId !== first.evaluationId,
    "Explicit re-evaluation did not append a new attempt.",
  );
  const failedProduct = await client.product.findUniqueOrThrow({ where: { id: productId } });
  const resolved = bindings.resolveAuroraBinding(failedProduct);
  assert(resolved.ok, "Fixture binding did not resolve.");
  const failedContext = identity.buildEvaluationContextIdentity(failedProduct, resolved.binding);
  const failedKey = randomUUID();
  await persistence.persistEvaluation({
    product: failedProduct,
    binding: resolved.binding,
    context: failedContext,
    requestKey: failedKey,
    requestIdentity: {
      operationType: "PRODUCT_EVALUATION",
      requestMode: "RETRY",
      productId,
      productSlug: failedProduct.slug,
      bindingId: resolved.binding.bindingId,
      bindingFingerprint: failedContext.bindingFingerprint,
      applicationContextFingerprint: failedContext.applicationContextFingerprint,
      requestedById: adminId,
    },
    trigger: "rehearsal-failure",
    response: {
      ok: false,
      stage: "reasoning",
      issues: [{ code: "REHEARSAL_SAFE_FAILURE" }],
      trace: { projectId: resolved.binding.projectId, inputFingerprint: null },
    },
    durationMs: 1,
  });
  adapter.clearLatestProductIntelligence();
  const afterRestart = await adapter.getLatestProductIntelligence(productId);
  assert(afterRestart?.state === "success", "Database-backed latest result did not survive cache reset.");
  assert((await client.auroraEvaluation.count()) === 5, "Unexpected evaluation row count.");
  const latestFailure = await client.auroraEvaluation.findUniqueOrThrow({ where: { requestKey: failedKey } });
  assert(latestFailure.status === "FAILED" && latestFailure.resultJson === null, "Failure attempt was not safely stored.");

  await client.product.delete({ where: { id: productId } });
  const historical = await client.auroraEvaluation.findMany({ where: { productIdAtExecution: productId } });
  assert(historical.length === 5 && historical.every((item) => item.productId === null), "Deletion history was not retained.");

  await client.$disconnect();
  await database.auroraWriteClient.$disconnect();
  await applicationDatabase.prisma.$disconnect();

  execFileSync(
    python,
    [
      "scripts/sqlite-backup.py",
      "backup",
      "--database",
      databasePath,
      "--output-dir",
      backupDirectory,
      "--label",
      "manual",
    ],
    { cwd: process.cwd(), stdio: "pipe" },
  );
  const backupPath = join(
    backupDirectory,
    (await import("node:fs")).readdirSync(backupDirectory).find((name) => name.endsWith(".db"))!,
  );
  execFileSync(
    python,
    ["scripts/sqlite-backup.py", "restore", "--backup", backupPath, "--destination", restoredPath],
    { cwd: process.cwd(), stdio: "pipe" },
  );
  execFileSync(python, ["scripts/sqlite-backup.py", "verify", "--database", restoredPath], {
    cwd: process.cwd(),
    stdio: "pipe",
  });

  console.log(
    JSON.stringify({
      ok: true,
      migrations: 7,
      evaluations: historical.length,
      idempotencyConflict: true,
      concurrentDuplicate: true,
      failureAttempt: true,
      sqliteShortLockRecovery: true,
      sqliteBusyCode: busyCode,
      sqliteBusyDurationMs: Math.round(busyDurationMs),
      cacheResetPersistence: true,
      productDeletionHistory: true,
      backupRestore: true,
      legacySixMigrationUpgrade: legacyUpgrade,
    }),
  );
} finally {
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // A failed rehearsal may leave a Prisma handle open; the OS temp directory remains disposable.
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function holdExclusiveLock(databasePath: string, milliseconds: number) {
  const source = [
    "import sqlite3,sys,time",
    "connection=sqlite3.connect(sys.argv[1], timeout=0)",
    "connection.execute('BEGIN EXCLUSIVE')",
    "print('LOCKED', flush=True)",
    "time.sleep(int(sys.argv[2])/1000)",
    "connection.rollback()",
    "connection.close()",
  ].join(";");
  const child = spawn(python, ["-c", source, databasePath, String(milliseconds)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let markReady!: () => void;
  let failReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    failReady = reject;
  });
  let locked = false;
  let errorText = "";
  child.stdout.on("data", (chunk) => {
    if (!locked && String(chunk).includes("LOCKED")) {
      locked = true;
      markReady();
    }
  });
  child.stderr.on("data", (chunk) => {
    errorText += String(chunk);
  });
  const done = new Promise<void>((resolve, reject) => {
    child.once("error", (error) => {
      failReady(error);
      reject(error);
    });
    child.once("close", (code) => {
      if (code === 0 && locked) resolve();
      else {
        const error = new Error(`SQLite lock helper failed (${code}): ${errorText}`);
        failReady(error);
        reject(error);
      }
    });
  });
  return { ready, done };
}

async function rehearseLegacyUpgrade(
  PrismaClient: typeof import("@prisma/client").PrismaClient,
  root: string,
  python: string,
) {
  const legacyRoot = join(root, "legacy-six");
  const legacyPrisma = join(legacyRoot, "prisma");
  const legacyMigrations = join(legacyPrisma, "migrations");
  const legacyDatabase = join(legacyRoot, "legacy.db");
  mkdirSync(legacyMigrations, { recursive: true });
  cpSync(join(process.cwd(), "prisma", "schema.prisma"), join(legacyPrisma, "schema.prisma"));
  cpSync(
    join(process.cwd(), "prisma", "migrations", "migration_lock.toml"),
    join(legacyMigrations, "migration_lock.toml"),
  );
  const legacyNames = [
    "0001_init",
    "0002_add_wishlist",
    "0003_add_email_queue",
    "0004_admin_dashboard_v2",
    "0005_account_address_defaults",
    "0006_shiprocket_shipping",
  ];
  for (const name of legacyNames)
    cpSync(join(process.cwd(), "prisma", "migrations", name), join(legacyMigrations, name), {
      recursive: true,
    });
  closeSync(openSync(legacyDatabase, "wx"));
  const legacyUrl = `file:${legacyDatabase.replaceAll("\\", "/")}`;
  const deploy = () =>
    execFileSync(
      process.execPath,
      [
        join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
        "migrate",
        "deploy",
        "--schema",
        join(legacyPrisma, "schema.prisma"),
      ],
      { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: legacyUrl }, stdio: "pipe" },
    );
  deploy();

  const legacyClient = new PrismaClient({ datasources: { db: { url: legacyUrl } } });
  await legacyClient.user.create({
    data: {
      id: "legacy.admin",
      name: "Legacy Admin",
      email: "legacy-admin@example.invalid",
      passwordHash: "not-a-real-password-hash",
      role: "ADMIN",
    },
  });
  await legacyClient.category.create({
    data: { id: "legacy.category", name: "Legacy", slug: "legacy", description: "Fixture" },
  });
  await legacyClient.product.create({
    data: {
      id: "legacy.product",
      categoryId: "legacy.category",
      name: "Legacy product",
      slug: "legacy-product",
      description: "Present",
      story: "Present",
      price: 100,
      imageUrl: "/legacy.png",
      inventory: 1,
    },
  });
  await legacyClient.order.create({
    data: {
      id: "legacy.order",
      orderNumber: "LEGACY-ORDER",
      userId: "legacy.admin",
      subtotal: 100,
      shippingFee: 0,
      total: 100,
      deliveryName: "Fixture",
      deliveryPhone: "0000000000",
      deliveryLine1: "Fixture",
      deliveryCity: "Fixture",
      deliveryState: "Fixture",
      deliveryPincode: "000000",
    },
  });
  await legacyClient.$disconnect();

  const auroraMigration = "20260713150000_add_aurora_evaluations";
  cpSync(
    join(process.cwd(), "prisma", "migrations", auroraMigration),
    join(legacyMigrations, auroraMigration),
    { recursive: true },
  );
  deploy();
  const upgradedClient = new PrismaClient({ datasources: { db: { url: legacyUrl } } });
  const [users, products, orders, evaluations] = await Promise.all([
    upgradedClient.user.count(),
    upgradedClient.product.count(),
    upgradedClient.order.count(),
    upgradedClient.auroraEvaluation.count(),
  ]);
  await upgradedClient.$disconnect();
  execFileSync(python, ["scripts/sqlite-backup.py", "verify", "--database", legacyDatabase], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  assert(users === 1 && products === 1 && orders === 1 && evaluations === 0, "Legacy fixture upgrade changed representative rows.");
  return { appliedBefore: 6, appliedAfter: 7, users, products, orders, evaluations };
}
