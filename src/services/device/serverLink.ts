import type { ServerState } from "./types";

/** Reasons after which only a new registration from the app helps (protocol §4). */
export const NEEDS_NEW_REGISTRATION = ["CERT_INVALID", "REVOKED"];

/**
 * What the app says for each `server.state`. `failed` words its `reason`;
 * an unknown reason stays generic (protocol §6).
 */
export function serverStateText(s: ServerState): string {
  switch (s.state) {
    case "registering":
      return "Registering with JoME's server…";
    case "registered":
      return "Registered. Connecting…";
    case "connecting":
      return "Connecting to JoME's server…";
    case "online":
      return "Connected to JoME's server.";
    case "failed":
      return failureText(s.reason);
  }
}

function failureText(reason?: string): string {
  switch (reason) {
    case "TOKEN_INVALID":
      return "The setup code expired or was already used. Try again to get a new one.";
    case "CLAIM_REJECTED":
      return "JoME's own code was refused. Check the label, or contact support.";
    case "ALREADY_CLAIMED":
      return "This JoME belongs to another account. Ask its owner to remove it first.";
    case "RATE_LIMITED":
      return "Too many tries. Wait a few minutes, then try again.";
    case "UNREACHABLE":
      return "JoME couldn't reach the server. Check its Wi‑Fi and your internet.";
    case "TLS":
      return "JoME doesn't trust the server's certificate. Its clock may be wrong; contact support if it stays like this.";
    case "INTERNAL":
      return "JoME couldn't save its keys. Try again, then contact support.";
    case "CERT_INVALID":
      return "The server no longer accepts JoME's certificate. Connect it again.";
    case "REVOKED":
      return "The server removed JoME from its account. Connect it again.";
    default:
      return `JoME couldn't connect to the server (${reason ?? "unknown"}).`;
  }
}
