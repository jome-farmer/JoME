import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, Plug, Plus } from "lucide-react";
import { useDeviceClient, useOfflineReason } from "../../device/hooks";
import { useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { useGarden } from "../../device/useGarden";
import { formatDuration } from "../../lib/format";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { Screen } from "../../ui/Screen";
import { Switch } from "../../ui/Switch";
import { DayChips } from "./DayChips";
import { stepsLabel, totalSeconds } from "./program";
import styles from "./Schedule.module.css";
import { errorText } from "../../services/device/errors";

/** Mockup 6: programs run on the board. The start time is the biggest thing because it's what people scan for. */
export function ScheduleScreen() {
  const { state } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const navigate = useNavigate();

  if (state !== "ready" || !client) {
    return (
      <Screen title="Schedule">
        <EmptyState
          title="No programs yet"
          action={
            <Button icon={Plug} onClick={() => navigate("/connect")}>
              Connect a controller
            </Button>
          }
        >
          Programs run on the controller, so your garden is watered even when
          your phone is off.
        </EmptyState>
      </Screen>
    );
  }
  return <Connected />;
}

function Connected() {
  const client = useDeviceClient();
  const navigate = useNavigate();
  const garden = useGarden(client);
  const { programs, zones } = garden;
  const [error, setError] = useState<string>();
  const loaded = garden.status !== undefined;
  // Offline, changes look disabled and a tap says why instead of opening anything.
  const offlineReason = useOfflineReason();
  const change = (go: () => void) => () =>
    offlineReason ? setError(offlineReason) : go();
  const sorted = [...programs].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Screen
      title="Schedule"
      actions={
        <IconButton
          icon={Plus}
          label="New program"
          aria-disabled={!!offlineReason || undefined}
          onClick={change(() => navigate("/schedule/new"))}
        />
      }
    >
      {(error || garden.error) && (
        <p className={styles.error} role="alert">
          {error ?? `Couldn't read programs. ${garden.error}`}
        </p>
      )}

      {loaded && programs.length === 0 && (
        <EmptyState
          title="No programs yet"
          action={
            <Button
              icon={CalendarPlus}
              aria-disabled={!!offlineReason}
              onClick={change(() => navigate("/schedule/new"))}
            >
              Create a program
            </Button>
          }
        >
          A program waters zones in order, on the days and at the time you pick.
          It runs on the controller, even when your phone is off.
        </EmptyState>
      )}

      <ul className={styles.list}>
        {sorted.map((p) => (
          <li
            key={p.id}
            className={`${styles.card} ${p.enabled ? "" : styles.paused}`}
          >
            <button
              type="button"
              className={styles.open}
              onClick={() => navigate(`/schedule/${p.id}`)}
              aria-label={`Edit ${p.name}`}
            >
              <span className={styles.label}>{p.name}</span>
              <span className={styles.when}>{p.start}</span>
              <DayChips days={p.days} />
              <span className={styles.meta}>
                {stepsLabel(p, zones)} ·{" "}
                <b>{formatDuration(totalSeconds(p))}</b>
                {!p.enabled && " · paused"}
              </span>
            </button>
            <Switch
              checked={p.enabled}
              label={`${p.name} program`}
              aria-disabled={!!offlineReason}
              onChange={(enabled) => {
                setError(undefined);
                garden
                  .setProgramEnabled(p, enabled)
                  .catch((e: unknown) => setError(errorText(e)));
              }}
            />
          </li>
        ))}
      </ul>
    </Screen>
  );
}
