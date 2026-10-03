import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  FlaskConical,
  Minus,
  Play,
  Plug,
  Plus,
  Sprout,
  Workflow,
} from "lucide-react";
import { useDeviceClient, useOfflineReason } from "../../device/hooks";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { useGarden } from "../../device/useGarden";
import { setProgramEnabled } from "../../store/gardenSlice";
import { formatDuration } from "../../lib/format";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { List, ListRow } from "../../ui/ListRow";
import { Segmented } from "../../ui/Segmented";
import { StatusPill } from "../../ui/StatusPill";
import { SAMPLE_NUTRIENTS, SAMPLE_RULES } from "../../services/field";
import { Screen } from "../../ui/Screen";
import { Switch } from "../../ui/Switch";
import { DayChips } from "./DayChips";
import { dayPlan, stepsLabel, totalSeconds, weekOf } from "./program";
import styles from "./Schedule.module.css";
import { errorText } from "../../services/device/errors";

const VIEWS = ["Irrigation", "Nutrients", "Rules"] as const;
type View = (typeof VIEWS)[number];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATE_ICON = { done: Check, now: Play, next: Sprout, paused: Minus };
const STATE_WORD = {
  done: "Done",
  now: "Watering now",
  next: "Upcoming",
  paused: "Paused",
};

/** The week's plan, day by day, then the programs that make it. Programs run on the board. */
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
  const navigate = useNavigate();
  const garden = useGarden();
  const dispatch = useAppDispatch();
  const { programs, zones } = garden;
  const [error, setError] = useState<string>();
  const loaded = garden.status !== undefined;
  // Offline, changes look disabled and a tap says why instead of opening anything.
  const offlineReason = useOfflineReason();
  const change = (go: () => void) => () =>
    offlineReason ? setError(offlineReason) : go();
  const sorted = [...programs].sort((a, b) => a.start.localeCompare(b.start));
  const [view, setView] = useState<View>("Irrigation");
  const now = new Date(garden.now);
  const [picked, setPicked] = useState(() => now.toDateString());
  const week = weekOf(now);
  const day = week.find((d) => d.toDateString() === picked) ?? now;
  const plan = dayPlan(programs, day, now, garden.run);
  const zoneName = (zone: number) =>
    zones.find((z) => z.zone === zone)?.name ?? "Deleted zone";
  const add = change(() => navigate("/schedule/new"));

  return (
    <Screen
      title="Schedule"
      subtitle="Irrigation and nutrient plans"
      actions={
        <button
          type="button"
          className={styles.add}
          aria-label="New program"
          aria-disabled={!!offlineReason || undefined}
          onClick={add}
        >
          <Plus size={24} aria-hidden />
        </button>
      }
    >
      <Segmented options={VIEWS} value={view} onChange={setView} label="Plan" />

      {view === "Nutrients" && (
        <>
          <StatusPill tone="off">Sample plan · no doser connected</StatusPill>
          <List>
            {SAMPLE_NUTRIENTS.map((n) => (
              <ListRow
                key={n.time + n.zone}
                icon={FlaskConical}
                title={`${n.time} · ${n.product}`}
                subtitle={`${n.zone} · ${n.amount}`}
              />
            ))}
          </List>
        </>
      )}

      {view === "Rules" && (
        <>
          <StatusPill tone="off">Sample rules · not active yet</StatusPill>
          <List>
            {SAMPLE_RULES.map((r) => (
              <ListRow
                key={r.title}
                icon={Workflow}
                title={r.title}
                subtitle={r.detail}
                trailing={r.on ? "On" : "Off"}
              />
            ))}
          </List>
        </>
      )}

      {view === "Irrigation" && (
        <>
          <div className={styles.week} role="group" aria-label="Day">
            {week.map((d) => {
              const on = d.toDateString() === day.toDateString();
              return (
                <button
                  key={d.toDateString()}
                  type="button"
                  className={on ? styles.dayOn : undefined}
                  aria-pressed={on}
                  onClick={() => setPicked(d.toDateString())}
                >
                  <span>{DAY[d.getDay()]}</span>
                  <b>{d.getDate()}</b>
                </button>
              );
            })}
          </div>

          {loaded && programs.length > 0 && (
            <ol className={styles.plan}>
              {plan.length === 0 && (
                <li className={styles.none}>Nothing waters on this day.</li>
              )}
              {plan.map((r) => {
                const Icon = STATE_ICON[r.state];
                return (
                  <li key={`${r.program.id}-${r.step}`}>
                    <button
                      type="button"
                      className={`${styles.planRow} ${styles[r.state]}`}
                      onClick={() => navigate(`/schedule/${r.program.id}`)}
                    >
                      <time className={styles.planTime}>{r.start}</time>
                      <span className={styles.planIcon}>
                        <Sprout size={20} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className={styles.planText}>
                        <b>{zoneName(r.zone)}</b>
                        <span>
                          {r.program.name} · {formatDuration(r.seconds)}
                        </span>
                      </span>
                      <span
                        className={styles.planState}
                        title={STATE_WORD[r.state]}
                      >
                        <Icon size={16} strokeWidth={2.5} aria-hidden />
                        <span className={styles.srOnly}>
                          {STATE_WORD[r.state]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

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
                  icon={Plus}
                  aria-disabled={!!offlineReason}
                  onClick={add}
                >
                  Create a program
                </Button>
              }
            >
              A program waters zones in order, on the days and at the time you
              pick. It runs on the controller, even when your phone is off.
            </EmptyState>
          )}

          {programs.length > 0 && (
            <button
              type="button"
              className={styles.addSchedule}
              aria-disabled={!!offlineReason || undefined}
              onClick={add}
            >
              <Plus size={20} aria-hidden /> Add schedule
            </button>
          )}

          {programs.length > 0 && <h2 className={styles.label}>Programs</h2>}
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
                    dispatch(setProgramEnabled(p, enabled)).catch(
                      (e: unknown) => setError(errorText(e)),
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
