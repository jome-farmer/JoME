import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bluetooth,
  Cable,
  Check,
  Cloud,
  CloudRain,
  FlaskConical,
  LogOut,
  Play,
  Plug,
  RotateCcw,
  SquareTerminal,
  SunMoon,
  Trash2,
  UserRound,
  Wifi,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store";
import {
  accountLabel,
  selectAuthState,
  selectUser,
  signOut,
} from "../../store/authSlice";
import {
  supports,
  useDeviceClient,
  useOfflineReason,
} from "../../device/hooks";
import {
  connectDemo,
  disconnect,
  restart,
  selectDevice,
} from "../../store/deviceSlice";
import type { LinkKind } from "../../services/device/links/link";
import { useGarden } from "../../device/useGarden";
import { refreshGarden } from "../../store/gardenSlice";
import { whenLabel } from "../../lib/format";
import { applyTheme, loadTheme, saveTheme, type Theme } from "../../lib/theme";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { List, ListRow } from "../../ui/ListRow";
import { RainDelaySheet } from "../../ui/RainDelaySheet";
import { Screen } from "../../ui/Screen";
import { Sheet } from "../../ui/Sheet";
import styles from "./DeviceScreen.module.css";
import { errorText } from "../../services/device/errors";

const LINK: Record<LinkKind, { label: string; icon: typeof Bluetooth }> = {
  ble: { label: "Bluetooth", icon: Bluetooth },
  usb: { label: "USB cable", icon: Cable },
  mock: { label: "Demo (simulated)", icon: FlaskConical },
  cloud: { label: "Through the internet", icon: Cloud },
};
const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Match phone" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Design screen 10: the controller card, then the occasional settings. */
export function DeviceScreen() {
  const { state, info, linkKind } = useAppSelector(selectDevice);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  if (state !== "ready" || !info || !linkKind) {
    return (
      <Screen title="Device">
        <EmptyState
          title="No controller connected"
          action={
            <div className={styles.actions}>
              <Button icon={Plug} onClick={() => navigate("/connect")}>
                Connect a controller
              </Button>
              <Button
                variant="ghost"
                icon={Play}
                onClick={() => void dispatch(connectDemo())}
                loading={state === "connecting" && linkKind === "mock"}
              >
                Try the demo
              </Button>
            </div>
          }
        >
          Controller settings, Wi‑Fi and the serial terminal live here.
        </EmptyState>
        <Account />
      </Screen>
    );
  }
  return <Connected />;
}

function Connected() {
  const { info, linkKind } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const garden = useGarden();
  const [theme, setTheme] = useState<Theme>("system");
  const [sheet, setSheet] = useState<"rain" | "theme">();
  const [confirmForget, setConfirmForget] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [actionError, setActionError] = useState<string>();
  // Offline, changes look disabled and a tap says why instead of opening anything.
  const offlineReason = useOfflineReason();
  const change = (go: () => void) => () =>
    offlineReason ? setActionError(offlineReason) : go();

  useEffect(() => {
    void loadTheme().then(setTheme);
  }, []);

  if (!info || !linkKind || !client) return null;
  const demo = linkKind === "mock";
  const cloud = linkKind === "cloud";
  // Wi‑Fi and the board's logs need the phone nearby; Connect comes back here afterwards.
  const nearby = () => navigate("/connect", { state: { back: "/device" } });
  const now = new Date(garden.now);
  const wifi = garden.status?.wifi;
  const until = garden.status?.rainDelayUntil;
  const rainUntil = until && until * 1000 > garden.now ? until : null;

  const chooseTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    void saveTheme(t);
    setSheet(undefined);
  };

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
            <dd>
              {garden.zones.length}
              {info.valveCount ? ` of ${info.valveCount} valves` : ""}
            </dd>
          </div>
        </dl>
      </Card>

      <Account />

      <List>
        {supports(info, "wifi.set") && (
          <ListRow
            icon={Wifi}
            title="Wi‑Fi"
            trailing={
              wifi?.state === "connected"
                ? wifi.ssid
                : wifi
                  ? "Not connected"
                  : "…"
            }
            subtitle={cloud ? "Connect nearby to change it" : undefined}
            onClick={() => (cloud ? nearby() : navigate("/device/wifi"))}
          />
        )}
        {supports(info, "rain.delay") && (
          <ListRow
            icon={CloudRain}
            title="Rain delay"
            trailing={rainUntil ? `Until ${whenLabel(rainUntil, now)}` : "Off"}
            aria-disabled={!!offlineReason}
            onClick={change(() => setSheet("rain"))}
          />
        )}
        <ListRow
          icon={SunMoon}
          title="Appearance"
          trailing={THEMES.find((t) => t.value === theme)?.label}
          onClick={() => setSheet("theme")}
        />
        <ListRow
          icon={SquareTerminal}
          title="Serial terminal"
          onClick={() => navigate("/device/terminal")}
        />
      </List>

      <List>
        <ListRow
          icon={LINK[linkKind].icon}
          title="Connection"
          trailing={LINK[linkKind].label}
        />
        {cloud && (
          <ListRow
            icon={Bluetooth}
            title="Connect nearby"
            subtitle="To change Wi‑Fi or watch the board's logs"
            onClick={nearby}
          />
        )}
        {supports(info, "device.reboot") && (
          <ListRow
            icon={RotateCcw}
            title="Restart controller"
            trailing={restarting ? "Restarting…" : undefined}
            aria-disabled={!!offlineReason}
            onClick={change(() => setConfirmRestart(true))}
          />
        )}
        <ListRow
          icon={LogOut}
          title={demo ? "Exit demo" : "Disconnect"}
          onClick={() => void dispatch(disconnect({ forget: demo }))}
        />
        {!demo && (
          <ListRow
            icon={Trash2}
            title="Forget this device"
            tone="danger"
            onClick={() => setConfirmForget(true)}
          />
        )}
      </List>

      {confirmRestart && (
        <div
          className={styles.confirm}
          role="alertdialog"
          aria-label="Restart controller"
        >
          <p>
            <b>Restart {info.name}?</b> Any watering stops. The app reconnects
            on its own in a few seconds, and your zones and programs stay as
            they are.
          </p>
          <div className={styles.confirmActions}>
            <Button
              variant="secondary"
              data-cancel
              onClick={() => setConfirmRestart(false)}
            >
              Cancel
            </Button>
            <Button
              icon={RotateCcw}
              loading={restarting}
              haptic
              onClick={async () => {
                setRestarting(true);
                setActionError(undefined);
                try {
                  await dispatch(restart());
                } catch (e) {
                  setActionError(`Couldn't restart JoME. ${errorText(e)}`);
                } finally {
                  setRestarting(false);
                  setConfirmRestart(false);
                }
              }}
            >
              Restart
            </Button>
          </div>
        </div>
      )}
      {actionError && (
        <p className={styles.confirm} role="alert">
          {actionError}
        </p>
      )}

      {confirmForget && (
        <div
          className={styles.confirm}
          role="alertdialog"
          aria-label="Forget device"
        >
          <p>
            <b>Forget {info.name}?</b> The app stops reconnecting to it. Its
            zones and programs stay on the controller, and you can pair it again
            later.
          </p>
          <div className={styles.confirmActions}>
            <Button
              variant="secondary"
              data-cancel
              onClick={() => setConfirmForget(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              haptic
              onClick={async () => {
                await dispatch(disconnect({ forget: true }));
                navigate("/welcome", { replace: true });
              }}
            >
              Forget
            </Button>
          </div>
        </div>
      )}

      <RainDelaySheet
        open={sheet === "rain"}
        onClose={() => setSheet(undefined)}
        until={rainUntil}
        onSet={async (hours) => {
          // The sheet lives in ui/ and can't see device errors, so hand it plain words.
          await client.request("rain.delay", { hours }).catch((e: unknown) => {
            throw new Error(errorText(e));
          });
          await dispatch(refreshGarden());
        }}
      />
      <Sheet
        open={sheet === "theme"}
        onClose={() => setSheet(undefined)}
        title="Appearance"
      >
        <List>
          {THEMES.map((t) => (
            <ListRow
              key={t.value}
              icon={SunMoon}
              title={t.label}
              trailing={
                t.value === theme ? (
                  <Check size={20} aria-label="Selected" />
                ) : undefined
              }
              onClick={() => chooseTheme(t.value)}
            />
          ))}
        </List>
      </Sheet>
    </Screen>
  );
}

/** Design screen 10, Account: who is signed in on this phone, and Sign out. */
function Account() {
  const state = useAppSelector(selectAuthState);
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  if (state === "loading") return null;
  return (
    <List>
      {user ? (
        <>
          <ListRow
            icon={UserRound}
            title="Account"
            trailing={accountLabel(user)}
          />
          {/* FirstRunRedirect goes to Welcome once the session is gone. */}
          <ListRow
            icon={LogOut}
            title="Sign out"
            onClick={() => void dispatch(signOut())}
          />
        </>
      ) : (
        <ListRow
          icon={UserRound}
          title="Sign in"
          subtitle="Check on your garden from anywhere"
          onClick={() => navigate("/signin")}
        />
      )}
    </List>
  );
}
