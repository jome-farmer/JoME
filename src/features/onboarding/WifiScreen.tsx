import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, Lock, RefreshCw, Wifi } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import type { WifiNetwork, WifiState } from "../../device/types";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { List, ListRow } from "../../ui/ListRow";
import { StatusPill } from "../../ui/StatusPill";
import { TextField } from "../../ui/TextField";
import { SignalBars } from "./SignalBars";
import { StepDots } from "./StepDots";
import { networkList, passwordProblem } from "./wifi";
import styles from "./Onboarding.module.css";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Setup step 3 (mockup 3): put the board on Wi‑Fi. Networks come from the board's own scan. */
export function WifiScreen() {
  const navigate = useNavigate();
  const { state, client } = useDevice();
  const [networks, setNetworks] = useState<WifiNetwork[]>();
  const [scanning, setScanning] = useState(false);
  const [current, setCurrent] = useState<WifiState>();
  const [selected, setSelected] = useState<WifiNetwork>();
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [join, setJoin] = useState<WifiState>();
  const [error, setError] = useState<string>();

  const scan = useCallback(async () => {
    if (!client) return;
    setScanning(true);
    setError(undefined);
    try {
      const { networks } = await client.request("wifi.scan", {});
      setNetworks(networkList(networks));
    } catch (e) {
      setError(`JoME couldn't scan for networks. ${message(e)}`);
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
    return client.on("wifi.state", (w) => {
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
    setJoin({ state: "connecting", ssid: selected.ssid });
    try {
      await client.request("wifi.set", {
        ssid: selected.ssid,
        password: selected.secure ? password : "",
      });
    } catch (err) {
      setJoin(undefined);
      setError(`Couldn't send the network to JoME. ${message(err)}`);
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
        <span className={styles.spacer} />
        <StepDots step={2} />
        <IconButton
          icon={RefreshCw}
          label="Scan again"
          onClick={scan}
          disabled={scanning}
        />
      </div>
      <div>
        <h1 className={styles.title}>Put JoME on Wi‑Fi</h1>
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
                ? `Couldn't join. ${join.reason ?? "Check the password and try again."}`
                : `Connecting to ${join.ssid}…`}
          </StatusPill>
        )}

        <div className={styles.actions}>
          {joined || alreadyOn ? (
            <Button
              type="button"
              size="lg"
              block
              onClick={() => navigate("/setup/name")}
            >
              Continue
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
          {!joined && !alreadyOn && (
            <Button
              type="button"
              variant="ghost"
              block
              onClick={() => navigate("/setup/name")}
            >
              Skip for now
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}
