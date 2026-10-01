import type { Args, Command } from "../../services/device/types";

export type TerminalCommand = {
  [C in Command]: { cmd: C; args: Args<C> };
}[Command];

export type ParsedTerminalCommand =
  | { type: "command"; command: TerminalCommand }
  | { type: "local"; text: string }
  | { type: "error"; text: string };

const HELP = `Commands:
  hello                 Show controller details
  status                Show watering, schedule, and Wi-Fi status
  zones | programs      List zones or programs
  run <zone> <time>     Water a zone, e.g. run 2 10m
  stop [zone]           Stop one zone, or all watering
  rain <hours>          Pause schedules, e.g. rain 24
  name <garden name>    Rename the controller
  reboot                Restart the controller
  log <level>           Set error, warn, info, debug, or trace logging

Protocol messages remain visible with the Protocol chip. Commands run directly on the connected controller.`;
const LOG_LEVELS = ["error", "warn", "info", "debug", "trace"] as const;

const error = (usage: string) => ({
  type: "error" as const,
  text: `Usage: ${usage}`,
});

function positiveInteger(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function seconds(value: string | undefined): number | undefined {
  const match = value?.match(/^(\d+)(s|m|h)?$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "s";
  const factor = unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  return Number.isSafeInteger(amount) && amount > 0
    ? amount * factor
    : undefined;
}

function logLevel(
  value: string | undefined,
): (typeof LOG_LEVELS)[number] | undefined {
  return LOG_LEVELS.find((level) => level === value);
}

/** Convert the small terminal shell vocabulary to the shared board protocol. */
export function parseTerminalCommand(input: string): ParsedTerminalCommand {
  const [verb = "", ...words] = input.trim().split(/\s+/);
  const command = verb.toLowerCase();
  if (!command) return { type: "error", text: "Enter a command. Try help." };
  if (command === "help") return { type: "local", text: HELP };
  if (["hello", "status"].includes(command) && words.length === 0)
    return {
      type: "command",
      command: { cmd: command as "hello" | "status", args: {} },
    };
  if (command === "zones" && words.length === 0)
    return { type: "command", command: { cmd: "zones.list", args: {} } };
  if (command === "programs" && words.length === 0)
    return { type: "command", command: { cmd: "programs.list", args: {} } };
  if (command === "run") {
    const zone = positiveInteger(words[0]);
    const duration = seconds(words[1]);
    return zone && duration && words.length === 2
      ? {
          type: "command",
          command: { cmd: "zone.run", args: { zone, seconds: duration } },
        }
      : error("run <zone> <time> (for example, run 2 10m)");
  }
  if (command === "stop") {
    const zone = positiveInteger(words[0]);
    return words.length === 0
      ? { type: "command", command: { cmd: "stop.all", args: {} } }
      : zone && words.length === 1
        ? { type: "command", command: { cmd: "zone.stop", args: { zone } } }
        : error("stop [zone]");
  }
  if (command === "rain") {
    const hours = positiveInteger(words[0]);
    return hours && words.length === 1
      ? { type: "command", command: { cmd: "rain.delay", args: { hours } } }
      : error("rain <hours>");
  }
  if (command === "name") {
    const name = words.join(" ");
    return name && name.length <= 32
      ? { type: "command", command: { cmd: "device.rename", args: { name } } }
      : error("name <garden name> (up to 32 characters)");
  }
  if (command === "reboot" && words.length === 0)
    return { type: "command", command: { cmd: "device.reboot", args: {} } };
  const level = logLevel(words[0]);
  if (command === "log" && words.length === 1 && level)
    return {
      type: "command",
      command: { cmd: "log.level", args: { level } },
    };
  if (command === "log") return error("log <error|warn|info|debug|trace>");
  return { type: "error", text: `Unknown command: ${verb}. Try help.` };
}
