import { useNavigate } from "react-router-dom";
import {
  Bluetooth,
  Cable,
  FlaskConical,
  LogOut,
  Play,
  SquareTerminal,
} from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import type { LinkKind } from "../../device/link";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { List, ListRow } from "../../ui/ListRow";
import { Screen } from "../../ui/Screen";
import { BleConnect } from "./BleConnect";
import { UsbConnect } from "./UsbConnect";
import styles from "./DeviceScreen.module.css";

const LINK: Record<LinkKind, { label: string; icon: typeof Bluetooth }> = {
  ble: { label: "Bluetooth", icon: Bluetooth },
  usb: { label: "USB cable", icon: Cable },
  mock: { label: "Demo (simulated)", icon: FlaskConical },
};

// Wi‑Fi, rain delay, appearance and the terminal rows arrive in #21 and #14.
export function DeviceScreen() {
  const { state, info, linkKind, connectDemo, disconnect } = useDevice();
  const navigate = useNavigate();

  if (state !== "ready" || !info || !linkKind) {
    return (
      <Screen title="Device">
        <EmptyState
          title="No controller connected"
          action={
            <div className={styles.actions}>
              <BleConnect />
              <UsbConnect />
              <Button
                icon={Play}
                onClick={connectDemo}
                loading={state === "connecting" && linkKind === "mock"}
              >
                Try the demo
              </Button>
            </div>
          }
        >
          Controller settings, Wi‑Fi and the serial terminal live here.
        </EmptyState>
      </Screen>
    );
  }

  const demo = linkKind === "mock";
  return (
    <Screen title="Device">
      <Card className={styles.card}>
        <div className={styles.head}>
          <img src="/logo/symbol.svg" alt="" className={styles.mascot} />
          <div>
            <b className={styles.name}>{info.name}</b>
            <div className={styles.serial}>{info.serial}</div>
          </div>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Firmware</dt>
            <dd>{info.fw}</dd>
          </div>
          <div>
            <dt>Zones</dt>
            <dd>{info.zoneCount}</dd>
          </div>
        </dl>
      </Card>
      <List>
        <ListRow
          icon={LINK[linkKind].icon}
          title="Connection"
          trailing={LINK[linkKind].label}
        />
        <ListRow
          icon={SquareTerminal}
          title="Serial terminal"
          onClick={() => navigate("/device/terminal")}
        />
        <ListRow
          icon={LogOut}
          title={demo ? "Exit demo" : "Disconnect"}
          tone="danger"
          onClick={() => disconnect({ forget: demo })}
        />
      </List>
    </Screen>
  );
}
