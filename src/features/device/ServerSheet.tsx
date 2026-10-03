import { useState } from "react";
import { CloudCheck } from "lucide-react";
import type { DeviceClient } from "../../services/device/client";
import { errorText } from "../../services/device/errors";
import { serverStateText } from "../../services/device/serverLink";
import type { ServerState } from "../../services/device/types";
import { RegistrationFailed, registerBoard } from "../onboarding/registration";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import styles from "./DeviceScreen.module.css";
import type { ServerRow } from "./serverRow";

/**
 * The board's link to JoME's server in words, and a way to register it again
 * (a new one-time token over the local link). Closing it never cancels a run.
 */
export function ServerSheet({
  open,
  onClose,
  row,
  client,
}: {
  open: boolean;
  onClose: () => void;
  row: ServerRow;
  client: DeviceClient;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ServerState>();
  const [error, setError] = useState<string>();

  const connect = async () => {
    setRunning(true);
    setError(undefined);
    setProgress(undefined);
    try {
      await registerBoard(client, { onState: setProgress });
    } catch (err) {
      setError(
        err instanceof RegistrationFailed
          ? serverStateText({ state: "failed", reason: err.reason })
          : errorText(err),
      );
    } finally {
      setRunning(false);
    }
  };

  const text = running
    ? progress
      ? serverStateText(progress)
      : "Asking JoME to register…"
    : (error ?? row.text);

  return (
    <Sheet open={open} onClose={onClose} title="JoME's server">
      <p className={styles.sheetText} role={error ? "alert" : "status"}>
        {text}
      </p>
      {row.canConnect && (
        <Button
          size="lg"
          block
          icon={CloudCheck}
          loading={running}
          onClick={() => void connect()}
        >
          {row.attention || error ? "Connect again" : "Connect to the server"}
        </Button>
      )}
      <Button variant="ghost" block onClick={onClose}>
        Close
      </Button>
    </Sheet>
  );
}
