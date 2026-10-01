import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store";
import { connectDemo, selectDevice } from "../../store/deviceSlice";
import { errorText } from "../../services/device/errors";
import { displayPhone } from "../../lib/format";
import {
  startCode,
  verifyGoogle,
  type Channel,
  type CodeTarget,
} from "../../services/auth";
import {
  googleAvailable,
  googleIdToken,
  prepareGoogle,
} from "../../services/google";
import { signIn } from "../../store/authSlice";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { TextField } from "../../ui/TextField";
import { GoogleMark } from "./GoogleMark";
import { toE164, toEmail } from "./signin";
import styles from "./SignIn.module.css";

const INVALID: Record<Channel, string> = {
  phone:
    "That number doesn't look right. Use an Iranian mobile, like 0912 345 6789.",
  email: "That email doesn't look right. Check it and try again.",
};

/** Design screen 1b: one screen for new and returning people. No passwords. */
export function SignInScreen() {
  const navigate = useNavigate();
  const { state } = useAppSelector(selectDevice);
  const dispatch = useAppDispatch();
  // Back from the code screen ("Change number") finds what was typed.
  const back = useLocation().state as CodeTarget | null;
  const [channel, setChannel] = useState<Channel>(back?.channel ?? "phone");
  const [value, setValue] = useState(
    back ? (back.channel === "phone" ? displayPhone(back.to) : back.to) : "",
  );
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string>();

  // On the web, Google's script has to be loaded before the tap opens its sheet.
  useEffect(() => {
    if (googleAvailable) void prepareGoogle().catch(() => undefined);
  }, []);

  const google = async () => {
    setGoogleBusy(true);
    setGoogleError(undefined);
    try {
      const { idToken, nonce } = await googleIdToken();
      const session = await verifyGoogle(idToken, nonce);
      await dispatch(signIn(session));
      // Same as a code: a new account sets up its first board; a returning one goes home.
      navigate(session.created ? "/connect" : "/", { replace: true });
    } catch (e) {
      // Closing Google's sheet is a choice, not an error.
      if (!/cancel/i.test(e instanceof Error ? e.message : String(e)))
        setGoogleError(errorText(e));
      setGoogleBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const to = channel === "phone" ? toE164(value) : toEmail(value);
    if (!to) {
      setError(INVALID[channel]);
      return;
    }
    setSending(true);
    setError(undefined);
    try {
      const target: CodeTarget = { channel, to };
      await startCode(target);
      // Keep it on this entry too, so going back from the code screen shows what was typed.
      navigate("/signin", { replace: true, state: target });
      navigate("/signin/code", { state: target });
    } catch (err) {
      setError(errorText(err));
      setSending(false);
    }
  };

  const switchChannel = () => {
    setChannel(channel === "phone" ? "email" : "phone");
    setValue("");
    setError(undefined);
  };

  const tryDemo = async () => {
    await dispatch(connectDemo());
    navigate("/", { replace: true });
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
        <h1 className={styles.title}>Sign in to JoME</h1>
        <p className={styles.sub}>
          Check on your garden from anywhere. New here? This creates your
          account.
        </p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        {channel === "phone" ? (
          <TextField
            key="phone"
            label="Phone number"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="0912 345 6789"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={error}
            enterKeyHint="send"
            autoFocus
          />
        ) : (
          <TextField
            key="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={error}
            enterKeyHint="send"
            autoFocus
          />
        )}
        <Button type="submit" size="lg" block loading={sending}>
          Send code
        </Button>
        {googleAvailable && (
          <Button
            variant="secondary"
            size="lg"
            block
            loading={googleBusy}
            onClick={() => void google()}
          >
            <GoogleMark />
            Continue with Google
          </Button>
        )}
        {googleError && (
          <p className={styles.error} role="alert">
            {googleError}
          </p>
        )}
        <Button variant="ghost" block onClick={switchChannel}>
          {channel === "phone" ? "Use email instead" : "Use phone instead"}
        </Button>
      </form>
      <span className={styles.spacer} />
      <Button
        variant="ghost"
        block
        onClick={tryDemo}
        loading={state === "connecting"}
      >
        Try the demo, no account needed
      </Button>
    </main>
  );
}
