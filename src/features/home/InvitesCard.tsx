import { useEffect, useState } from "react";
import { Check, Mail, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectAuthState } from "../../store/authSlice";
import { autoConnect, selectDevice } from "../../store/deviceSlice";
import { listDevices } from "../../services/devices";
import { errorText } from "../../services/device/errors";
import {
  acceptInvite,
  declineInvite,
  pendingInvites,
  type PendingInvite,
} from "../../services/shares";
import { addKnownDevices } from "../../lib/storage";
import { identityLabel } from "../../lib/identity";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import styles from "./HomeScreen.module.css";

/**
 * Invitations to someone else's board, for the identity this account signed in
 * with (docs/cloud.md, Sharing). Shown on Home, with or without a board
 * connected. Accepting adds the board to this phone's list and, when nothing
 * is connected, opens it.
 */
export function InvitesCard() {
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector(selectAuthState) === "signedIn";
  const { state } = useAppSelector(selectDevice);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!signedIn) return void setInvites([]);
    let live = true;
    pendingInvites()
      .then((list) => live && setInvites(list))
      .catch(() => undefined); // nothing to show is not worth an error on Home
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!invites.length) return null;

  const answer = async (invite: PendingInvite, accept: boolean) => {
    setBusy(invite.id);
    setError(undefined);
    try {
      if (accept) {
        await acceptInvite(invite.id);
        await addKnownDevices(await listDevices());
        if (state === "idle")
          void dispatch(autoConnect("signedIn", { launch: false }));
      } else {
        await declineInvite(invite.id);
      }
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      {invites.map((invite) => (
        <Card key={invite.id} className={styles.invite}>
          <p className={styles.inviteText}>
            <Mail size={18} aria-hidden />{" "}
            <b>{identityLabel(invite.inviter)}</b> invited you to{" "}
            <b>{invite.device ?? "a JoME"}</b>. You'll be able to water it and
            see the garden.
          </p>
          <div className={styles.inviteActions}>
            <Button
              variant="secondary"
              icon={X}
              disabled={busy === invite.id}
              onClick={() => void answer(invite, false)}
            >
              Decline
            </Button>
            <Button
              icon={Check}
              loading={busy === invite.id}
              haptic
              onClick={() => void answer(invite, true)}
            >
              Accept
            </Button>
          </div>
        </Card>
      ))}
      {error && (
        <p className={styles.inviteText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
