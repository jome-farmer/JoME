import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useDeviceClient, useOfflineReason } from "../../device/hooks";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { useGarden } from "../../device/useGarden";
import { deleteProgram, saveProgram } from "../../store/gardenSlice";
import type { Program } from "../../services/device/types";
import { formatDuration } from "../../lib/format";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { Stepper } from "../../ui/Stepper";
import { TextField } from "../../ui/TextField";
import { DayChips } from "./DayChips";
import {
  MAX_NAME,
  MAX_STEPS,
  MAX_STEP_MIN,
  moveStep,
  newProgram,
  programProblems,
  totalSeconds,
} from "./program";
import styles from "./Schedule.module.css";
import { errorText } from "../../services/device/errors";

/** Full-screen editor at /schedule/new and /schedule/:id: name, days, start time, zones in order. */
export function ProgramEditor() {
  const { state } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const { id } = useParams();
  const navigate = useNavigate();
  const garden = useGarden();
  const dispatch = useAppDispatch();
  const { programs, zones } = garden;
  const loaded = garden.status !== undefined;
  const existing =
    id === "new" ? undefined : programs.find((p) => String(p.id) === id);

  const [draft, setDraft] = useState<Program>();
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete">();
  const [error, setError] = useState<string>();
  // Offline: Save is refused by the board link and says why; Delete says it before asking.
  const offlineReason = useOfflineReason();
  const blocked = !!offlineReason;
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Start editing once the board's data is in.
  useEffect(() => {
    if (!loaded || draft) return;
    if (id === "new") setDraft(newProgram(zones));
    else if (existing) setDraft(existing);
  }, [loaded, draft, id, zones, existing]);

  if (state !== "ready" || !client) return <Navigate to="/schedule" replace />;
  if (loaded && id !== "new" && !existing && !draft)
    return <Navigate to="/schedule" replace />;
  if (!draft) return <main className={styles.editor} aria-busy />;

  const problems = programProblems(draft, zones);
  const set = (patch: Partial<Program>) => setDraft({ ...draft, ...patch });
  const setStep = (i: number, patch: Partial<Program["steps"][number]>) =>
    set({
      steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
  const unused = zones.find(
    (z) => z.enabled && !draft.steps.some((s) => s.zone === z.zone),
  );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problems.length) return;
    setBusy("save");
    setError(undefined);
    try {
      await dispatch(saveProgram({ ...draft, name: draft.name.trim() }));
      navigate("/schedule", { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(undefined);
    }
  };

  const remove = async () => {
    if (draft.id === undefined) return;
    setBusy("delete");
    try {
      await dispatch(deleteProgram(draft.id));
      navigate("/schedule", { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(undefined);
    }
  };

  return (
    <main className={styles.editor}>
      <header className={styles.editorHead}>
        <IconButton
          icon={ArrowLeft}
          label="Back"
          onClick={() => navigate(-1)}
        />
        <h1 className={styles.editorTitle}>
          {id === "new" ? "New program" : "Edit program"}
        </h1>
        <span className={styles.spacer} />
      </header>

      <form className={styles.form} onSubmit={save} noValidate>
        <TextField
          id="program-name"
          label="Name"
          placeholder="Morning"
          value={draft.name}
          maxLength={MAX_NAME}
          onChange={(e) => set({ name: e.target.value })}
        />

        <div className={styles.group}>
          <span className={styles.groupLabel}>Days</span>
          <DayChips
            days={draft.days}
            onToggle={(day) =>
              set({
                days: draft.days.includes(day)
                  ? draft.days.filter((d) => d !== day)
                  : [...draft.days, day].sort(),
              })
            }
          />
        </div>

        <TextField
          id="program-start"
          label="Start time"
          type="time"
          value={draft.start}
          onChange={(e) => set({ start: e.target.value })}
          hint="Controller's local time. Zones run one after another from here."
        />

        <div className={styles.group}>
          <span className={styles.groupLabel}>
            Zones, in order · {formatDuration(totalSeconds(draft))}
          </span>
          <ol className={styles.steps}>
            {draft.steps.map((s, i) => (
              <li key={i} className={styles.step}>
                <div className={styles.stepHead}>
                  <span className={styles.stepNo}>{i + 1}</span>
                  <select
                    id={`step-${i}-zone`}
                    className={styles.select}
                    value={s.zone}
                    aria-label={`Zone for step ${i + 1}`}
                    onChange={(e) =>
                      setStep(i, { zone: Number(e.target.value) })
                    }
                  >
                    {zones.map((z) => (
                      <option key={z.zone} value={z.zone}>
                        {z.name}
                        {z.enabled ? "" : " (off)"}
                      </option>
                    ))}
                    {!zones.some((z) => z.zone === s.zone) && (
                      <option value={s.zone}>Deleted zone</option>
                    )}
                  </select>
                  <IconButton
                    icon={ArrowUp}
                    label={`Move step ${i + 1} up`}
                    variant="plain"
                    disabled={i === 0}
                    onClick={() => set({ steps: moveStep(draft.steps, i, -1) })}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label={`Move step ${i + 1} down`}
                    variant="plain"
                    disabled={i === draft.steps.length - 1}
                    onClick={() => set({ steps: moveStep(draft.steps, i, 1) })}
                  />
                  <IconButton
                    icon={X}
                    label={`Remove step ${i + 1}`}
                    variant="plain"
                    onClick={() =>
                      set({ steps: draft.steps.filter((_, j) => j !== i) })
                    }
                  />
                </div>
                <Stepper
                  label={`Run time for step ${i + 1}`}
                  value={Math.max(1, Math.round(s.seconds / 60))}
                  onChange={(m) => setStep(i, { seconds: m * 60 })}
                  min={1}
                  max={MAX_STEP_MIN}
                  format={(m) => formatDuration(m * 60)}
                />
              </li>
            ))}
          </ol>
          {draft.steps.length < MAX_STEPS && zones.length > 0 && (
            <button
              type="button"
              className={styles.addStep}
              onClick={() => {
                const z = unused ?? zones[0];
                set({
                  steps: [
                    ...draft.steps,
                    { zone: z.zone, seconds: z.defaultSeconds },
                  ],
                });
              }}
            >
              <Plus size={20} aria-hidden />
              Add a zone
            </button>
          )}
          {zones.length === 0 && (
            <p className={styles.muted}>Add zones on the Zones tab first.</p>
          )}
        </div>

        {tried && problems.length > 0 && (
          <ul className={styles.error} role="alert">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          block
          aria-disabled={blocked}
          loading={busy === "save"}
        >
          Save program
        </Button>

        {draft.id !== undefined &&
          (confirmDelete ? (
            <div
              className={styles.confirm}
              role="alertdialog"
              aria-label="Delete program"
            >
              <p>
                <b>Delete {existing?.name ?? draft.name}?</b> The controller
                stops running it.
              </p>
              <div className={styles.confirmActions}>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  icon={Trash2}
                  loading={busy === "delete"}
                  onClick={() => void remove()}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              icon={Trash2}
              aria-disabled={blocked}
              onClick={() =>
                offlineReason ? setError(offlineReason) : setConfirmDelete(true)
              }
            >
              Delete program
            </Button>
          ))}
      </form>
    </main>
  );
}
