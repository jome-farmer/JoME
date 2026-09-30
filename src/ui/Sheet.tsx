import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Sheet.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Bottom sheet on the native <dialog>: focus trap, Esc and backdrop come for free. */
export function Sheet({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-label={title}
      onClose={onClose}
      // A click on the dialog element itself (not its content) is a backdrop click.
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={styles.body}>
        <span className={styles.handle} aria-hidden />
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
