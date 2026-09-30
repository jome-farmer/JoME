import { Play } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";

// Status hero, quick actions and today's timeline arrive in #18.
export function HomeScreen() {
  const { state, info, connectDemo } = useDevice();

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
        title="No controller connected yet"
        action={
          <Button
            icon={Play}
            onClick={connectDemo}
            loading={state === "connecting"}
          >
            Try the demo
          </Button>
        }
      >
        Pairing with a real JoME is coming soon. Meanwhile, the demo runs a
        simulated controller with six zones.
      </EmptyState>
    </Screen>
  );
}
