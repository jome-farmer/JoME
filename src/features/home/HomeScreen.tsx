import { Screen } from "../../ui/Screen";
import { EmptyState } from "../../ui/EmptyState";

// Placeholder until the screen's issue lands (see the Phase 3 milestone).
export function HomeScreen() {
  return (
    <Screen title="Home">
      <EmptyState title="No controller connected yet">
        Soon you'll pair your JoME here and see what's watering and what runs
        next.
      </EmptyState>
    </Screen>
  );
}
