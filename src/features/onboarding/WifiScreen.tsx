import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Lock, RefreshCw, Wifi } from "lucide-react";
import { useDeviceClient } from "../../device/hooks";
import { useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import type { WifiNetwork, WifiState } from "../../services/device/types";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { List, ListRow } from "../../ui/ListRow";
import { StatusPill } from "../../ui/StatusPill";
import { TextField } from "../../ui/TextField";
import { SignalBars } from "./SignalBars";
import type { SetupState } from "./ClaimScreen";
import { StepDots } from "./StepDots";
import { networkList, passwordProblem, wifiFailureText } from "./wifi";
import styles from "./Onboarding.module.css";
import { errorText } from "../../services/device/errors";

/** Setup step 3 (mockup 3): put the board on Wi‑Fi. Networks come from the board's own scan. */
/**
 * `setup`: onboarding step 3, continues to Name.
 * `settings`: from the Device tab (/device/wifi), goes back when done.
 */
export function WifiScreen({
  mode = "setup",
}: {
  mode?: "setup" | "settings";
}) {
  const setup = mode === "setup";
  const navigate = useNavigate();
  // Passed on to Claim untouched (the scanned label code, if any).
  const setupState = useLocation().state as SetupState;
  const { state } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const [networks, setNetworks] = useState<WifiNetwork[]>();
  const [scanning, setScanning] = useState(false);
  const [current, setCurrent] = useState<WifiState>();
  const [selected, setSelected] = useState<WifiNetwork>();
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [join, setJoin] = useState<WifiState>();
  // Firmware v1 sends "connecting" (and sometimes "failed") without an ssid, so remember what we asked for.
  const asked = useRef<string | undefined>(undefined);
  const [error, setError] = useState<string>();

  const scan = useCallback(async () => {
    if (!client) return;
    setScanning(true);
    setError(undefined);
    try {
      const { networks } = await client.request("wifi.scan", {});
      setNetworks(networkList(networks));
    } catch (e) {
      setError(`JoME couldn't scan for networks. ${errorText(e)}`);
    } finally {
      setScanning(false);
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    client.request("status", {}).then(
      (s) => setCurrent(s.wifi),
      () => {},
    );
    void scan();
    // The outcome of wifi.set arrives as events.
    return client.on("wifi.state", (e) => {
      const w = { ...e, ssid: e.ssid ?? asked.current };
      setJoin(w);
      if (w.state === "connected") setCurrent(w);
    });
  }, [client, scan]);

  if (state !== "ready" || !client) return <Navigate to="/connect" replace />;

  const problem = selected ? passwordProblem(selected, password) : undefined;
  const joining = join?.state === "connecting" && join.ssid === selected?.ssid;
  const joined = join?.state === "connected" && join.ssid === selected?.ssid;
  const alreadyOn = current?.state === "connected" && !selected;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!selected || problem) return;
    setError(undefined);
    asked.current = selected.ssid;
    setJoin({ state: "connecting", ssid: selected.ssid });
    try {
      await client.request("wifi.set", {
        ssid: selected.ssid,
        password: selected.secure ? password : "",
      });
    } catch (err) {
      setJoin(undefined);
      setError(`Couldn't send the network to JoME. ${errorText(err)}`);
    }
  };

  const pick = (n: WifiNetwork) => {
    setSelected(n);
    setPassword("");
    setTouched(false);
    setJoin(undefined);
  };

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        {setup ? (
          <span className={styles.spacer} />
        ) : (
          <IconButton
            icon={ArrowLeft}
            label="Back"
            onClick={() => navigate(-1)}
          />
        )}
        {setup ? <StepDots step={2} /> : <span />}
        <IconButton
          icon={RefreshCw}
          label="Scan again"
          onClick={scan}
          disabled={scanning}
        />
      </div>
      <div>
        <h1 className={styles.title}>
          {setup ? "Put JoME on Wi‑Fi" : "Wi‑Fi"}
        </h1>
        <p className={styles.sub}>
          JoME found these networks from where it's installed.
        </p>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!networks ? (
        <StatusPill tone="idle" live>
          JoME is looking for networks…
        </StatusPill>
      ) : networks.length === 0 ? (
        <p className={styles.sub}>
          JoME can't see any networks. Move the router or the controller closer,
          then scan again.
        </p>
      ) : (
        <List>
          {networks.map((n) => {
            const isSelected = selected?.ssid === n.ssid;
            const isCurrent =
              current?.state === "connected" && current.ssid === n.ssid;
            return (
              <ListRow
                key={n.ssid}
                icon={isSelected || (isCurrent && !selected) ? Check : Wifi}
                title={n.ssid}
                subtitle={isCurrent ? "Connected now" : undefined}
                trailing={
                  <span className={styles.netMeta}>
                    {n.secure && <Lock size={14} aria-label="Secured" />}
                    <SignalBars rssi={n.rssi} />
                  </span>
                }
                onClick={() => pick(n)}
              />
            );
          })}
        </List>
      )}

      <form className={styles.section} onSubmit={submit}>
        {selected?.secure && (
          <TextField
            id="wifi-password"
            label={`Password for ${selected.ssid}`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            autoComplete="off"
            autoCapitalize="off"
            error={touched ? problem : undefined}
            disabled={joining}
          />
        )}
        <p className={styles.sub}>
          <Wifi size={14} aria-hidden /> JoME joins 2.4 GHz networks only.
        </p>

        {join && join.ssid === selected?.ssid && (
          <StatusPill
            tone={joined ? "ok" : join.state === "failed" ? "danger" : "warn"}
            live={joining}
            icon={joined ? Check : undefined}
          >
            {joined
              ? `Connected · ${join.ip ?? join.ssid}`
              : join.state === "failed"
                ? wifiFailureText(join.reason)
                : `Connecting to ${join.ssid}…`}
          </StatusPill>
        )}

        <div className={styles.actions}>
          {joined || alreadyOn ? (
            <Button
              type="button"
              size="lg"
              block
              onClick={() =>
                setup
                  ? navigate("/setup/claim", { state: setupState })
                  : navigate(-1)
              }
            >
              {setup ? "Continue" : "Done"}
            </Button>
          ) : (
            <Button
              type="submit"
              size="lg"
              block
              disabled={!selected}
              loading={joining}
            >
              Join network
            </Button>
          )}
          {setup && !joined && !alreadyOn && (
            <Button
              type="button"
              variant="ghost"
              block
              onClick={() => navigate("/setup/claim", { state: setupState })}
            >
              Skip for now
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}
