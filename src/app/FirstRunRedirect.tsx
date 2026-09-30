import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getKnownDevices } from "../lib/storage";

/** On launch at "/", people with no known controller start at Welcome. Deep links are left alone. */
export function FirstRunRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (pathname !== "/") return;
    void getKnownDevices().then((known) => {
      if (known.length === 0) navigate("/welcome", { replace: true });
    });
  }, [pathname, navigate]);

  return null;
}
