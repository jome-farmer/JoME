import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useDevice } from "../../device/DeviceContext";
import { Button } from "../../ui/Button";
import { StepDots } from "./StepDots";
import styles from "./Onboarding.module.css";

/** First launch, or signed out (FirstRunRedirect sends people here). Get started signs in first. */
export function WelcomeScreen() {
  const navigate = useNavigate();
  const { connectDemo, state } = useDevice();
  const auth = useAuth();

  const tryDemo = async () => {
    await connectDemo();
    navigate("/", { replace: true });
  };

  return (
    <main className={`${styles.page} ${styles.welcome}`}>
      <StepDots step={0} />
      <div className={styles.hero}>
        <img src="/logo/symbol.svg" alt="" className={styles.mascot} />
        <div>
          <h1 className={styles.hello}>Hi, I'm JoME</h1>
          <p className={styles.tagline}>your gardener</p>
        </div>
        <p className={styles.lead}>
          I keep every zone watered on schedule, even when you're away.
        </p>
      </div>
      <div className={styles.actions}>
        <Button
          size="lg"
          block
          onClick={() =>
            navigate(auth.state === "signedIn" ? "/connect" : "/signin")
          }
        >
          Get started
        </Button>
        <Button
          variant="ghost"
          block
          onClick={tryDemo}
          loading={state === "connecting"}
        >
          Try the demo
        </Button>
      </div>
    </main>
  );
}
