import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:3001",
    changeOrigin: true,
  },
} as const;

/**
 * Vite’s `open` uses the OS handler (Safari/Chrome), not Cursor/VS Code’s integrated browser.
 * In an editor-integrated terminal, skip that so you can use Run → “Cai: dev + integrated browser”
 * or ⌘-click the localhost link (with `workbench.browser.openLocalhostLinks` in `.vscode/settings.json`).
 */
function viteShouldOpenExternalBrowser(): boolean {
  if (process.env.CAI_DEV_OPEN === "1") return true;
  if (process.env.CAI_DEV_OPEN === "0") return false;
  const inEditorTerminal =
    process.env.TERM_PROGRAM === "vscode" ||
    Boolean(process.env.CURSOR_TRACE_ID) ||
    Boolean(process.env.VSCODE_IPC_HOOK);
  return !inEditorTerminal;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /** Listen on all interfaces; helps some in-editor previews resolve the dev server. */
    host: true,
    open: viteShouldOpenExternalBrowser(),
    proxy: { ...apiProxy },
  },
  preview: {
    port: 5173,
    proxy: { ...apiProxy },
  },
});
