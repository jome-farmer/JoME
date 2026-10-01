import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Sprout } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store";
import { rename, selectDevice } from "../../store/deviceSlice";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { StepDots } from "./StepDots";
import styles from "./Onboarding.module.css";
import { errorText } from "../../services/device/errors";

const MAX = 32; // Longest name the board stores (jome-farmer/protocol §7).

/** Setup step 5: name the garden. The name is stored on the board. */
export function NameScreen() {
  const navigate = useNavigate();
  const { state, info } = useAppSelector(selectDevice);
  const dispatch = useAppDispatch();
  const [name, setName] = useState(info?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (state !== "ready" || !info) return <Navigate to="/connect" replace />;

  const trimmed = name.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    setSaving(true);
    setError(undefined);
    try {
      if (trimmed !== info.name) await dispatch(rename(trimmed));
      navigate("/", { replace: true });
    } catch (err) {
      setError(`Couldn't save the name. ${errorText(err)}`);
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <StepDots step={4} />
      <div className={styles.hero}>
        <img src="/logo/symbol.svg" alt="" className={styles.mascotSmall} />
        <div>
          <h1 className={styles.title}>Name your garden</h1>
          <p className={styles.sub}>
            You'll see this name in the app and when you connect.
          </p>
        </div>
      </div>
      <form className={styles.section} onSubmit={submit}>
        <TextField
          id="garden-name"
          label="Garden name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX))}
          placeholder="Front garden"
          maxLength={MAX}
          autoFocus
          enterKeyHint="done"
          hint={`${trimmed.length}/${MAX}`}
          error={error}
        />
        <Button
          type="submit"
          size="lg"
          block
          icon={Sprout}
          disabled={!trimmed}
          loading={saving}
        >
          Start gardening
        </Button>
      </form>
    </main>
  );
}
