const { spawn } = require("child_process");

const COLORS = {
  reset: "\x1b[0m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function logSection(title) {
  console.log(
    `\n${COLORS.cyan}\n==== ${title.toUpperCase()} ====${COLORS.reset}\n`,
  );
}

function logStep(step) {
  console.log(`\n${COLORS.yellow}→ ${step}...${COLORS.reset}`);
}

function logSuccess(msg) {
  console.log(`\n${COLORS.green}✓ ${msg}${COLORS.reset}`);
}

function logError(msg) {
  console.error(`\n${COLORS.red}✗ ${msg}${COLORS.reset}`);
}

function run(command, args = []) {
  return new Promise((resolve, reject) => {
    logStep(`${command} ${args.join(" ")}`);
    const proc = spawn(command, args, { stdio: "inherit", shell: true });

    proc.on("close", (code) => {
      if (code === 0) {
        logSuccess(`${command} finalizado com sucesso`);
        resolve();
      } else {
        logError(`${command} retornou código ${code}`);
        reject(new Error(`Erro ao executar: ${command} ${args.join(" ")}`));
      }
    });
  });
}

let hasStopped = false;

async function stopServicesAndExit(code = 0) {
  if (hasStopped) return;
  hasStopped = true;

  logSection("Encerrando Serviços");
  await run("npm", ["run", "services:stop"]).catch((err) =>
    logError(err.message),
  );
  process.exit(code);
}

async function main() {
  try {
    logSection("Inicializando Serviços");
    await run("npm", ["run", "services:up"]);
    await run("npm", ["run", "services:wait:database"]);
    await run("npm", ["run", "migrations:up"]);

    logSection("Iniciando Aplicação");
    const nextDev = spawn("npx", ["next", "dev"], {
      stdio: "inherit",
      shell: true,
    });

    process.on("SIGINT", () => stopServicesAndExit());
    process.on("SIGTERM", () => stopServicesAndExit());

    nextDev.on("exit", (code) => {
      console.log(
        `\n${COLORS.bold}[dev] next dev encerrado (código ${code})${COLORS.reset}`,
      );
      stopServicesAndExit(code);
    });
  } catch (err) {
    logError(`[dev] Falha: ${err.message}`);
    await stopServicesAndExit(1);
  }
}

main();
