import { useNavigate } from "react-router-dom";
import { useDevice } from "../../device/DeviceContext";
import { Button } from "../../ui/Button";
import { StepDots } from "./StepDots";
import styles from "./Onboarding.module.css";

/** First launch only (FirstRunRedirect sends people here when no controller is known). */
export function WelcomeScreen() {
  const navigate = useNavigate();
  const { connectDemo, state } = useDevice();

  const tryDemo = async () => {
    await connectDemo();
    navigate("/", { replace: true });
  };

  return (
    <main className={`${styles.page} ${styles.welcome}`}>
      <StepDots step={0} />
      <div className={styles.hero}>
        <div className={styles.mascotBg}>
          <img src="/logo/symbol.svg" alt="" className={styles.mascot} />
        </div>
        <div>
          <h1 className={styles.hello}>Hi, I'm JoME</h1>
          <p className={styles.tagline}>your gardener</p>
        </div>
        <p className={styles.lead}>
          I keep every zone watered on schedule, even when you're away.
        </p>
      </div>
      <div className={styles.actions}>
        <Button size="lg" block onClick={() => navigate("/connect")}>
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
