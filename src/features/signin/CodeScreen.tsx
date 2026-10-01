import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { errorText } from "../../device/errors";
import { ApiError } from "../../lib/api";
import { displayPhone } from "../../lib/format";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import {
  CODE_LENGTH,
  MAX_TRIES,
  RESEND_MS,
  codeDigits,
  startCode,
  verifyCode,
  type CodeTarget,
} from "./signin";
import styles from "./SignIn.module.css";

/** Design screen 1c: six digits, checked as soon as the sixth is typed. */
export function CodeScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const target = useLocation().state as CodeTarget | null;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_MS);
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const spent = wrong >= MAX_TRIES;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // The field is disabled while checking; put the cursor back for the next try.
  useEffect(() => {
    if (!checking && !spent) input.current?.focus();
  }, [checking, spent]);

  // Opened directly (reload, deep link): there's no code on its way.
  if (!target) return <Navigate to="/signin" replace />;

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const sentTo =
    target.channel === "phone" ? displayPhone(target.to) : target.to;

  const verify = async (value: string) => {
    // Real codes are 6 digits; Enter also sends a shorter one (the dev server's mock code is 1234).
    if (checking || spent || value.length < 4) return;
    setChecking(true);
    setError(undefined);
    try {
      const session = await verifyCode(target, value);
      await signIn(session);
      // A new account sets up its first board; a returning one goes home.
      navigate(session.created ? "/connect" : "/", { replace: true });
    } catch (err) {
      setChecking(false);
      setCode("");
      if (err instanceof ApiError && err.code === "CODE_INVALID") {
        const tries = wrong + 1;
        setWrong(tries);
        setError(tries >= MAX_TRIES ? "Ask for a new code." : errorText(err));
      } else {
        setError(errorText(err));
      }
    }
  };

  const type = (text: string) => {
    const digits = codeDigits(text);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void verify(digits);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void verify(code);
  };

  const resend = async () => {
    setError(undefined);
    try {
      await startCode(target);
      setResendAt(Date.now() + RESEND_MS);
      setWrong(0);
      setCode("");
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <main className={styles.page}>
      <IconButton
        icon={ArrowLeft}
        label="Back"
        className={styles.back}
        onClick={() => navigate(-1)}
      />
      <div>
        <h1 className={styles.title}>Enter the code</h1>
        <p className={styles.sub}>We sent it to {sentTo}.</p>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.code} aria-disabled={checking || spent}>
          <input
            ref={input}
            value={code}
            onChange={(e) => type(e.target.value)}
            aria-label={`${CODE_LENGTH}-digit code`}
            aria-invalid={error ? true : undefined}
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="done"
            disabled={checking || spent}
          />
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <i
              key={i}
              aria-hidden
              className={i === code.length ? styles.next : undefined}
            >
              {code[i]}
            </i>
          ))}
        </label>
        {checking && (
          <p className={styles.center} role="status">
            Checking…
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
      {wait > 0 ? (
        <p className={styles.center}>
          Resend code in 0:{String(wait).padStart(2, "0")}
        </p>
      ) : (
        <Button variant="secondary" block onClick={resend}>
          Resend code
        </Button>
      )}
      <Button variant="ghost" block onClick={() => navigate(-1)}>
        {target.channel === "phone" ? "Change number" : "Change email"}
      </Button>
    </main>
  );
}
