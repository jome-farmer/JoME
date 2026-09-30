import { Screen } from "../../ui/Screen";
import { EmptyState } from "../../ui/EmptyState";

// Placeholder until the screen's issue lands (see the Phase 3 milestone).
export function ZonesScreen() {
  return (
    <Screen title="Zones">
      <EmptyState title="Your zones will appear here">
        Run, stop and name up to 16 zones once your JoME is connected.
      </EmptyState>
    </Screen>
  );
}
