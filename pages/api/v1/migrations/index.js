import migrationRunner from "node-pg-migrate";
import { resolve } from "node:path";
import database from "infra/database.js";
import { createRouter } from "next-connect";
import controller from "infra/controller.js";

let dbClient;
let defaultMigrationOptions;
const router = createRouter();

router.use(connectToDatabase);
router.get(getHandler);
router.post(postHandler);

export default router.handler(controller.errorHandlers);

async function connectToDatabase(request, response, next) {
  dbClient = await database.getNewClient();
  defaultMigrationOptions = {
    dbClient,
    dryRun: request.method === "GET",
    dir: resolve("infra", "migrations"),
    direction: "up",
    verbose: true,
    migrationsTable: "pgmigrations",
  };
  await next();
  await dbClient.end();
}

async function getHandler(request, response) {
  try {
    const pendingMigrations = await migrationRunner(defaultMigrationOptions);
    response.status(200).json(pendingMigrations);
  } finally {
    await dbClient.end();
  }
}

async function postHandler(request, response) {
  try {
    const migratedMigrations = await migrationRunner(defaultMigrationOptions);

    if (migratedMigrations.length) {
      return response.status(201).json(migratedMigrations);
    }

    response.status(200).json(migratedMigrations);
  } finally {
    await dbClient.end();
  }
}
