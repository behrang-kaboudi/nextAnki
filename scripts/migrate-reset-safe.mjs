import { spawn } from "node:child_process";

if (process.env.I_UNDERSTAND_DATA_LOSS !== "1") {
  process.stderr.write(
    "Refusing to run prisma migrate reset.\n" +
      "This command DROPS the database and deletes all data.\n" +
      "If you really want this, re-run with: I_UNDERSTAND_DATA_LOSS=1\n"
  );
  process.exit(1);
}

const child = spawn("npx", ["prisma", "migrate", "reset"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

