import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./TextField.module.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** Shown under the field; replaced by `error` when set. */
  hint?: string;
  error?: string;
  id?: string;
};

/** Labelled input. type="password" gets a show/hide button. */
export function TextField({
  label,
  hint,
  error,
  id,
  type = "text",
  ...rest
}: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.box} ${error ? styles.invalid : ""}`}>
        <input
          id={inputId}
          className={styles.input}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? (
              <EyeOff size={20} aria-hidden />
            ) : (
              <Eye size={20} aria-hidden />
            )}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p id={noteId} className={error ? styles.error : styles.hint}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
