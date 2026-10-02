import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CloudCheck } from "lucide-react";
import { useAppSelector } from "../../store";
import { selectAuthState } from "../../store/authSlice";
import { selectDevice } from "../../store/deviceSlice";
import { useDeviceClient, supports } from "../../device/hooks";
import { errorText } from "../../services/device/errors";
import { serverStateText } from "../../services/device/serverLink";
import type { ServerState } from "../../services/device/types";
import { isLabelSerial } from "./pairingCode";
import { RegistrationFailed, registerBoard } from "./registration";
import { latinDigits } from "../../lib/format";
import { claimDevice } from "../../services/devices";
import { Button } from "../../ui/Button";
import { StatusPill } from "../../ui/StatusPill";
import { TextField } from "../../ui/TextField";
import { StepDots } from "./StepDots";
import styles from "./Onboarding.module.css";

/** Route state from Connect, through Wi‑Fi: the label passkey when the QR label was scanned. */
export type SetupState = { code?: string } | null;

const CODE = /^\d{6}$/;

/**
 * Design screen 3b: add the board to the signed-in account, with the 6-digit
 * code on its label (POST /v1/devices/claim, docs/cloud.md). Uses the phone's
 * internet, so it works even when the board's Wi‑Fi was skipped.
 */
export function ClaimScreen() {
  const navigate = useNavigate();
  const { state, info, linkKind } = useAppSelector(selectDevice);
  const authState = useAppSelector(selectAuthState);
  const scanned = (useLocation().state as SetupState)?.code;
  const [code, setCode] = useState(scanned ?? "");
  const [error, setError] = useState<string>();
  const [claiming, setClaiming] = useState(!!scanned);
  const tried = useRef(false);
  const client = useDeviceClient();
  // After the claim the board registers itself with the server (one-time token over the local link).
  const [phase, setPhase] = useState<"claim" | "register">("claim");
  const [server, setServer] = useState<ServerState>();
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string>();

  const serial = info?.serial;
  // The demo board has no account to join, and a signed-out phone has no account to add it to.
  const skip = linkKind === "mock" || authState === "signedOut";

  // Only over a local link (BLE or USB), and only firmware that has `server.set`.
  const canRegister =
    !!client &&
    linkKind !== "cloud" &&
    linkKind !== "mock" &&
    supports(info, "server.set");

  const register = async () => {
    if (!client) return;
    setPhase("register");
    setRegistering(true);
    setRegisterError(undefined);
    setServer(undefined);
    try {
      await registerBoard(client, { onState: setServer });
      navigate("/setup/name", { replace: true });
    } catch (err) {
      setRegisterError(
        err instanceof RegistrationFailed
          ? serverStateText({ state: "failed", reason: err.reason })
          : errorText(err),
      );
      setRegistering(false);
    }
  };

  const claim = async (label: string) => {
    if (!serial) return;
    setClaiming(true);
    setError(undefined);
    try {
      await claimDevice(serial, label);
    } catch (err) {
      setError(errorText(err));
      setClaiming(false);
      return;
    }
    if (canRegister) void register();
    else navigate("/setup/name", { replace: true });
  };

  // Scanned the label: no need to ask, add it straight away (once).
  useEffect(() => {
    if (tried.current || skip || !scanned || authState !== "signedIn") return;
    tried.current = true;
    void claim(scanned);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [skip, scanned, authState]);

  if (state !== "ready" || !info) return <Navigate to="/connect" replace />;
  if (skip) return <Navigate to="/setup/name" replace />;

  // A board that was never provisioned has no label code, so it can't join an account.
  if (!isLabelSerial(info.serial))
    return (
      <main className={styles.page}>
        <StepDots step={3} />
        <div className={styles.hero}>
          <img src="/logo/symbol.svg" alt="" className={styles.mascotSmall} />
          <div>
            <h1 className={styles.title}>{info.name} is a development board</h1>
            <p className={styles.sub}>
              It has no factory label code, so it can't be added to an account.
              It still works from this phone.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          block
          onClick={() => navigate("/setup/name", { replace: true })}
        >
          Continue
        </Button>
      </main>
    );

  // The claim is done; now the board registers with the server.
  if (phase === "register")
    return (
      <main className={styles.page}>
        <StepDots step={3} />
        <div className={styles.hero}>
          <img src="/logo/symbol.svg" alt="" className={styles.mascotSmall} />
          <div>
            <h1 className={styles.title}>Connecting {info.name}</h1>
            <p className={styles.sub}>
              JoME is signing up with the server, so you can reach it from
              anywhere. This takes a few seconds.
            </p>
          </div>
        </div>
        {registering ? (
          <div className={styles.notice} role="status">
            <StatusPill tone="warn" live>
              {server ? serverStateText(server) : "Asking JoME to register…"}
            </StatusPill>
          </div>
        ) : (
          <div className={styles.section}>
            <div className={styles.notice} role="alert">
              <p>{registerError}</p>
            </div>
            <Button size="lg" block onClick={() => void register()}>
              Try again
            </Button>
            <Button
              variant="ghost"
              block
              onClick={() => navigate("/setup/name", { replace: true })}
            >
              Skip for now
            </Button>
          </div>
        )}
      </main>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!CODE.test(code)) {
      setError("The code is the 6 digits printed on the label.");
      return;
    }
    void claim(code);
  };

  // While the scanned code is on its way, show progress instead of the form.
  const automatic = claiming && !!scanned && code === scanned && !error;

  return (
    <main className={styles.page}>
      <StepDots step={3} />
      <div className={styles.hero}>
        <img src="/logo/symbol.svg" alt="" className={styles.mascotSmall} />
        <div>
          <h1 className={styles.title}>Add {info.name} to your account</h1>
          <p className={styles.sub}>
            So you can check on your garden from anywhere.
          </p>
        </div>
      </div>
      {automatic ? (
        <div className={styles.notice} role="status">
          <StatusPill tone="warn" live>
            Adding {info.name} to your account…
          </StatusPill>
        </div>
      ) : (
        <form className={styles.section} onSubmit={submit} noValidate>
          <TextField
            id="label-code"
            label="Code on the label"
            value={code}
            onChange={(e) =>
              setCode(
                latinDigits(e.target.value).replace(/\D/g, "").slice(0, 6),
              )
            }
            inputMode="numeric"
            autoComplete="off"
            placeholder="6 digits"
            enterKeyHint="done"
            hint="The 6 digits printed on the controller's label."
            error={error}
            autoFocus
          />
          <Button
            type="submit"
            size="lg"
            block
            icon={CloudCheck}
            loading={claiming}
          >
            Add to my account
          </Button>
          <Button
            variant="ghost"
            block
            onClick={() => navigate("/setup/name", { replace: true })}
          >
            Skip for now
          </Button>
        </form>
      )}
    </main>
  );
}
