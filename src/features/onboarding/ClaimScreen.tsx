import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CloudCheck } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDevice } from "../../device/DeviceContext";
import { errorText } from "../../services/device/errors";
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
  const { state, info, linkKind } = useDevice();
  const auth = useAuth();
  const scanned = (useLocation().state as SetupState)?.code;
  const [code, setCode] = useState(scanned ?? "");
  const [error, setError] = useState<string>();
  const [claiming, setClaiming] = useState(!!scanned);
  const tried = useRef(false);

  const serial = info?.serial;
  // The demo board has no account to join, and a signed-out phone has no account to add it to.
  const skip = linkKind === "mock" || auth.state === "signedOut";

  const claim = async (label: string) => {
    if (!serial) return;
    setClaiming(true);
    setError(undefined);
    try {
      // ponytail: the reply's broker credentials are dropped until the board can take them (server.set, #96).
      await claimDevice(serial, label);
      navigate("/setup/name", { replace: true });
    } catch (err) {
      setError(errorText(err));
      setClaiming(false);
    }
  };

  // Scanned the label: no need to ask, add it straight away (once).
  useEffect(() => {
    if (tried.current || skip || !scanned || auth.state !== "signedIn") return;
    tried.current = true;
    void claim(scanned);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [skip, scanned, auth.state]);

  if (state !== "ready" || !info) return <Navigate to="/connect" replace />;
  if (skip) return <Navigate to="/setup/name" replace />;

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
