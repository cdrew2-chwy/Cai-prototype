/**
 * Frees dev ports before `npm run dev` so stale listeners don't cause EADDRINUSE
 * and concurrently doesn't tear down Vite when the API fails.
 */
import { execFileSync } from "node:child_process";

const PORTS = [3001, 5173];

function killListeners(port) {
  try {
    const out = execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    for (const s of out) {
      const pid = Number(s);
      if (Number.isFinite(pid) && pid > 0) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* no listener */
  }
}

for (const p of PORTS) killListeners(p);
