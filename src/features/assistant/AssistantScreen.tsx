import { Screen } from "../../ui/Screen";
import { EmptyState } from "../../ui/EmptyState";

// Placeholder until the screen's issue lands (see the Phase 3 milestone).
export function AssistantScreen() {
  return (
    <Screen title="Ask JoME">
      <EmptyState title="Your garden assistant is on its way">
        Ask about watering, plants and weather. JoME suggests changes, and you
        confirm them.
      </EmptyState>
    </Screen>
  );
}
