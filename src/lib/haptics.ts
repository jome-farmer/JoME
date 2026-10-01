import { Haptics, ImpactStyle } from "@capacitor/haptics";

// Feedback only: a phone without haptics (or a desktop browser) just stays still.
const impact = (style: ImpactStyle) => () =>
  void Haptics.impact({ style }).catch(() => undefined);

/** A switch flipped. */
export const tick = impact(ImpactStyle.Light);

/** Water started or stopped, or a change confirmed. */
export const thump = impact(ImpactStyle.Medium);
