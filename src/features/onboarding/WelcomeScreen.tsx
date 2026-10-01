import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectAuthState } from "../../store/authSlice";
import { connectDemo, selectDevice } from "../../store/deviceSlice";
import { Button } from "../../ui/Button";
import { StepDots } from "./StepDots";
import styles from "./Onboarding.module.css";

/** First launch, or signed out (FirstRunRedirect sends people here). Get started signs in first. */
export function WelcomeScreen() {
  const navigate = useNavigate();
  const { state } = useAppSelector(selectDevice);
  const dispatch = useAppDispatch();
  const authState = useAppSelector(selectAuthState);

  const tryDemo = async () => {
    await dispatch(connectDemo());
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
            navigate(authState === "signedIn" ? "/connect" : "/signin")
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
