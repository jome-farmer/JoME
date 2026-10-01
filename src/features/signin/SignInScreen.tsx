import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import { errorText } from "../../device/errors";
import { displayPhone } from "../../lib/format";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { TextField } from "../../ui/TextField";
import {
  startCode,
  toE164,
  toEmail,
  type Channel,
  type CodeTarget,
} from "./signin";
import styles from "./SignIn.module.css";

const INVALID: Record<Channel, string> = {
  phone:
    "That number doesn't look right. Use an Iranian mobile, like 0912 345 6789.",
  email: "That email doesn't look right. Check it and try again.",
};

/** Design screen 1b: one screen for new and returning people. No passwords. */
export function SignInScreen() {
  const navigate = useNavigate();
  const { connectDemo, state } = useDevice();
  // Back from the code screen ("Change number") finds what was typed.
  const back = useLocation().state as CodeTarget | null;
  const [channel, setChannel] = useState<Channel>(back?.channel ?? "phone");
  const [value, setValue] = useState(
    back ? (back.channel === "phone" ? displayPhone(back.to) : back.to) : "",
  );
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

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
    await connectDemo();
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
