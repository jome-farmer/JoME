import { useNavigate } from "react-router-dom";
import { Play, Plug } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";
import styles from "./HomeScreen.module.css";

// Status hero, quick actions and today's timeline arrive in #18.
export function HomeScreen() {
  const { state, info, connectDemo } = useDevice();
  const navigate = useNavigate();

  if (state === "ready" && info) {
    return (
      <Screen eyebrow="Connected" title={info.name}>
        <EmptyState title="Home screen is on its way">
          Try the Device tab for controller details. Zones and the live watering
          view arrive next.
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen title="Home">
      <EmptyState
        title="No controller connected"
        action={
          <div className={styles.actions}>
            <Button icon={Plug} onClick={() => navigate("/connect")}>
              Connect a controller
            </Button>
            <Button
              variant="ghost"
              icon={Play}
              onClick={connectDemo}
              loading={state === "connecting"}
            >
              Try the demo
            </Button>
          </div>
        }
      >
        Pair your JoME over Bluetooth or a USB cable, or explore with the
        simulated demo controller.
      </EmptyState>
    </Screen>
  );
}
