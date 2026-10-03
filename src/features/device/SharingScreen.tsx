import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Mail, UserMinus, UserPlus, X } from "lucide-react";
import { useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { ApiError } from "../../services/client";
import { errorText } from "../../services/device/errors";
import {
  inviteTo,
  listShares,
  removeShare,
  type Shares,
} from "../../services/shares";
import { identityLabel, toShareIdentity } from "../../lib/identity";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { List, ListRow } from "../../ui/ListRow";
import { Screen } from "../../ui/Screen";
import { TextField } from "../../ui/TextField";
import styles from "./DeviceScreen.module.css";
import { useBoardRole } from "./useRole";

/** The words for an invitation that was refused. */
function inviteError(e: unknown): string {
  if (e instanceof ApiError && e.code === "TOO_MANY_REQUESTS")
    return "You've sent as many invitations as are allowed today. Try again tomorrow.";
  return errorText(e);
}

type Pending =
  | { kind: "member"; target: string; label: string }
  | { kind: "invite"; target: string; label: string };

/**
 * Design screen 10b: who has this board. The owner invites people by email or
 * phone number, sees who joined and who is still invited, and removes either.
 */
export function SharingScreen() {
  const navigate = useNavigate();
  const { info } = useAppSelector(selectDevice);
  const role = useBoardRole();
  const serial = info?.serial;

  const [shares, setShares] = useState<Shares>();
  const [loadError, setLoadError] = useState<string>();
  const [to, setTo] = useState("");
  const [formError, setFormError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState<Pending>();
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const load = useCallback(async () => {
    if (!serial) return;
    try {
      setShares(await listShares(serial));
      setLoadError(undefined);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [serial]);

  useEffect(() => {
    if (role === "owner") void load();
  }, [role, load]);

  if (!info || !serial) return <Navigate to="/device" replace />;
  // Only the owner shares; a member (or an unknown role, until it loads) has nothing here.
  if (role === "member") return <Navigate to="/device" replace />;

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const identity = toShareIdentity(to);
    if (!identity) {
      setFormError(
        "Use an email address or an Iranian mobile, like 0912 345 6789.",
      );
      return;
    }
    setSending(true);
    setFormError(undefined);
    try {
      await inviteTo(serial, identity);
      setTo("");
      await load();
    } catch (err) {
      setFormError(inviteError(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    setRemoving(true);
    setActionError(undefined);
    try {
      await removeShare(serial, confirm.target);
      setConfirm(undefined);
      await load();
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Screen
      title="Sharing"
      subtitle={`People who can use ${info.name}`}
      onBack={() => navigate(-1)}
    >
      <Card className={styles.card}>
        <form onSubmit={(e) => void invite(e)} noValidate>
          <TextField
            id="share-to"
            label="Invite by email or phone number"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            inputMode="email"
            autoComplete="off"
            placeholder="ali@example.com or 0912 345 6789"
            hint="They sign in to JoME with this email or number and accept the invitation. Members can water and read the garden; only you can share, hand over or remove it."
            error={formError}
          />
          <Button type="submit" block icon={UserPlus} loading={sending}>
            Invite
          </Button>
        </form>
      </Card>

      {loadError && (
        <p className={styles.confirm} role="alert">
          {loadError}
        </p>
      )}

      {shares && shares.members.length > 0 && (
        <List>
          {shares.members.map((m) => (
            <ListRow
              key={m.userId}
              icon={UserMinus}
              title={identityLabel(m.identity)}
              subtitle="Can use this JoME. Tap to remove."
              onClick={() =>
                setConfirm({
                  kind: "member",
                  target: m.userId,
                  label: identityLabel(m.identity),
                })
              }
            />
          ))}
        </List>
      )}

      {shares && shares.invites.length > 0 && (
        <List>
          {shares.invites.map((i) => (
            <ListRow
              key={i.id}
              icon={Mail}
              title={identityLabel(i.identity)}
              subtitle="Invited. Waiting for them to accept. Tap to cancel."
              onClick={() =>
                setConfirm({
                  kind: "invite",
                  target: i.id,
                  label: identityLabel(i.identity),
                })
              }
            />
          ))}
        </List>
      )}

      {shares && !shares.members.length && !shares.invites.length && (
        <p className={styles.sheetText}>Only you use {info.name} so far.</p>
      )}

      {confirm && (
        <div
          className={styles.confirm}
          role="alertdialog"
          aria-label={
            confirm.kind === "member" ? "Remove" : "Cancel invitation"
          }
        >
          <p>
            {confirm.kind === "member" ? (
              <>
                <b>Remove {confirm.label}?</b> They lose access to {info.name}{" "}
                within seconds.
              </>
            ) : (
              <>
                <b>Cancel the invitation for {confirm.label}?</b> They won't be
                able to accept it.
              </>
            )}
          </p>
          <div className={styles.confirmActions}>
            <Button
              variant="secondary"
              data-cancel
              onClick={() => setConfirm(undefined)}
            >
              Keep
            </Button>
            <Button
              variant="danger"
              icon={X}
              loading={removing}
              haptic
              onClick={() => void remove()}
            >
              {confirm.kind === "member" ? "Remove" : "Cancel invitation"}
            </Button>
          </div>
          {actionError && <p role="alert">{actionError}</p>}
        </div>
      )}
    </Screen>
  );
}
