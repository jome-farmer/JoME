import { Screen } from "../../ui/Screen";
import { EmptyState } from "../../ui/EmptyState";

// Placeholder until the screen's issue lands (see the Phase 3 milestone).
export function ScheduleScreen() {
  return (
    <Screen title="Schedule">
      <EmptyState title="No programs yet">
        Programs run on the controller, so your garden is watered even when your
        phone is off.
      </EmptyState>
    </Screen>
  );
}
