import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "../store";
import { selectAuthState } from "../store/authSlice";
import { getKnownDevices } from "../lib/storage";

/**
 * On launch at "/", people who are signed out (unless they're in the demo) or
 * have no known controller start at Welcome. Deep links are left alone.
 * Signing out later, or a session the server rejects, also goes to Welcome.
 */
export function FirstRunRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const state = useAppSelector(selectAuthState);
  const checked = useRef(false);
  const was = useRef(state);

  useEffect(() => {
    const previous = was.current;
    was.current = state;
    if (previous === "signedIn" && state === "signedOut") {
      navigate("/welcome", { replace: true });
      return;
    }
    if (checked.current || state === "loading") return;
    checked.current = true;
    if (pathname !== "/") return;
    void getKnownDevices().then((known) => {
      const demo = known[0]?.lastLink === "mock";
      if (known.length === 0 || (state === "signedOut" && !demo))
        navigate("/welcome", { replace: true });
    });
  }, [state, pathname, navigate]);

  return null;
}
