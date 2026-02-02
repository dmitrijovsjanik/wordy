import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function findCloudflared() {
  try {
    return execSync("which cloudflared", { encoding: "utf-8" }).trim();
  } catch {
    const local = join(homedir(), ".local", "bin", "cloudflared");
    if (existsSync(local)) return local;
    console.error("cloudflared не найден. Установи: brew install cloudflare/cloudflare/cloudflared");
    process.exit(1);
  }
}

const cloudflared = findCloudflared();

const vite = spawn("npx", ["vite"], {
  stdio: "inherit",
  shell: true,
});

const tunnel = spawn(
  cloudflared,
  ["tunnel", "--url", "http://localhost:5173"],
  { stdio: ["ignore", "pipe", "pipe"] }
);

let urlCopied = false;

function handleOutput(data) {
  const text = data.toString();
  process.stderr.write(text);

  if (urlCopied) return;

  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    urlCopied = true;
    const url = match[0];
    try {
      execSync(`echo ${JSON.stringify(url)} | pbcopy`);
      console.log(`\n🔗 Tunnel URL (скопирован в буфер): ${url}\n`);
    } catch {
      console.log(`\n🔗 Tunnel URL: ${url}\n`);
    }
  }
}

tunnel.stdout.on("data", handleOutput);
tunnel.stderr.on("data", handleOutput);

function cleanup() {
  vite.kill();
  tunnel.kill();
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

vite.on("exit", cleanup);
tunnel.on("exit", cleanup);
