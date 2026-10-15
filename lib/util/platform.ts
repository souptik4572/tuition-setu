import "server-only";

// Commands are shown for the laptop TuitionSetu runs on (D-19), whichever device reads them.

export type Platform = {
  /** Where to type commands, and how to open it: "Open {app}{how}." */
  terminal: { app: string; how: string };
  /** Moves the terminal into the install folder before `npm run …`. */
  cdCommand: string;
  /** What to try when the terminal says `ollama` isn't found. */
  restartAi: string;
};

export function hostPlatform(): Platform {
  const dir = process.cwd();
  if (process.platform === "win32") {
    return {
      terminal: { app: "Command Prompt", how: " from the Start menu" },
      cdCommand: `cd /d "${dir}"`,
      restartAi: "If Command Prompt says the command isn't found, the AI engine may need restarting. Close it from the taskbar and open it again.",
    };
  }
  if (process.platform === "darwin") {
    return {
      terminal: { app: "Terminal", how: " (press ⌘ Space and type Terminal)" },
      cdCommand: `cd "${dir}"`,
      restartAi: "If Terminal says the command isn't found, the AI engine may need restarting. Quit Ollama from the menu bar and open it again.",
    };
  }
  return {
    terminal: { app: "a terminal", how: "" },
    cdCommand: `cd "${dir}"`,
    restartAi: "If the terminal says the command isn't found, the AI engine may need restarting. Run ollama serve, then try again.",
  };
}
