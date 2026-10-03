import { useEffect, useState } from "react";
import { useAppSelector } from "../../store";
import { selectAuthState } from "../../store/authSlice";
import { selectDevice } from "../../store/deviceSlice";
import { getDevice } from "../../services/devices";

/**
 * What this account is on the connected board: `owner`, `member`, or undefined
 * while unknown or when the board isn't on the account (a demo, or a board that
 * was never claimed). Asked of the server once per board and sign-in.
 */
export function useBoardRole(): "owner" | "member" | undefined {
  const { info, linkKind } = useAppSelector(selectDevice);
  const signedIn = useAppSelector(selectAuthState) === "signedIn";
  const serial = info?.serial;
  const [role, setRole] = useState<"owner" | "member">();

  useEffect(() => {
    setRole(undefined);
    if (!serial || !signedIn || linkKind === "mock") return;
    const controller = new AbortController();
    getDevice(serial, controller.signal)
      .then((d) => setRole(d.role))
      .catch(() => undefined);
    return () => controller.abort();
  }, [serial, signedIn, linkKind]);

  return role;
}
