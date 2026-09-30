import { Screen } from "../../ui/Screen";
import { EmptyState } from "../../ui/EmptyState";

// Placeholder until the screen's issue lands (see the Phase 3 milestone).
export function DeviceScreen() {
  return (
    <Screen title="Device">
      <EmptyState title="No controller connected">
        Controller settings, Wi‑Fi and the serial terminal will live here.
      </EmptyState>
    </Screen>
  );
}
