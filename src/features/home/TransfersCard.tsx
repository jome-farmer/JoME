import { useEffect, useState } from "react";
import { Check, Gift, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectAuthState } from "../../store/authSlice";
import { autoConnect, selectDevice } from "../../store/deviceSlice";
import { listDevices } from "../../services/devices";
import { errorText } from "../../services/device/errors";
import {
  acceptTransfer,
  declineTransfer,
  pendingTransfers,
  type PendingTransfer,
} from "../../services/transfers";
import { addKnownDevices } from "../../lib/storage";
import { identityLabel } from "../../lib/identity";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import styles from "./HomeScreen.module.css";

/**
 * Boards offered to this account (docs/cloud.md, Transfer), next to the
 * invitations. Accepting makes this account the owner, with nobody else on it.
 */
export function TransfersCard() {
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector(selectAuthState) === "signedIn";
  const { state } = useAppSelector(selectDevice);
  const [offers, setOffers] = useState<PendingTransfer[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!signedIn) return void setOffers([]);
    let live = true;
    pendingTransfers()
      .then((list) => live && setOffers(list))
      .catch(() => undefined); // nothing to show is not worth an error on Home
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!offers.length) return null;

  const answer = async (offer: PendingTransfer, accept: boolean) => {
    setBusy(offer.id);
    setError(undefined);
    try {
      if (accept) {
        await acceptTransfer(offer.id);
        await addKnownDevices(await listDevices());
        if (state === "idle")
          void dispatch(autoConnect("signedIn", { launch: false }));
      } else {
        await declineTransfer(offer.id);
      }
      setOffers((list) => list.filter((o) => o.id !== offer.id));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      {offers.map((offer) => (
        <Card key={offer.id} className={styles.invite}>
          <p className={styles.inviteText}>
            <Gift size={18} aria-hidden /> <b>{identityLabel(offer.owner)}</b>{" "}
            wants to give you <b>{offer.device ?? "a JoME"}</b>. You'd become
            its owner, with nobody else on it.
          </p>
          <div className={styles.inviteActions}>
            <Button
              variant="secondary"
              icon={X}
              disabled={busy === offer.id}
              onClick={() => void answer(offer, false)}
            >
              Decline
            </Button>
            <Button
              icon={Check}
              loading={busy === offer.id}
              haptic
              onClick={() => void answer(offer, true)}
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
