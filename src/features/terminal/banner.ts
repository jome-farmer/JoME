import type { LinkKind } from "../../device/link";
import type { Hello } from "../../device/types";

const LINK_LABEL: Record<LinkKind, string> = {
  ble: "Bluetooth",
  usb: "USB",
  mock: "Demo",
  cloud: "Internet",
};

export function terminalBanner(
  info: Hello | undefined,
  linkKind: LinkKind,
): string {
  const details = info
    ? `${info.name} · ${info.serial} · firmware ${info.fw}\n${info.zoneCount} zones${info.valveCount ? ` · ${info.valveCount} valves` : ""}`
    : "Controller details are unavailable.";
  return `JoME terminal · ${LINK_LABEL[linkKind]}\n${details}\nType help for commands.`;
}
