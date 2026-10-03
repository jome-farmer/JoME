import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Gift, X } from "lucide-react";
import { useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { ApiError } from "../../services/client";
import { errorText } from "../../services/device/errors";
import {
  cancelOffer,
  offerBoard,
  pendingOffer,
  type Transfer,
} from "../../services/transfers";
import { identityLabel, toShareIdentity } from "../../lib/identity";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Screen } from "../../ui/Screen";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import styles from "./DeviceScreen.module.css";
import { useBoardRole } from "./useRole";

/** The words for an offer that was refused. */
function offerError(e: unknown): string {
  if (e instanceof ApiError && e.code === "CANNOT_TRANSFER_TO_SELF")
    return "That is your own account.";
  if (e instanceof ApiError && e.code === "TRANSFER_PENDING")
    return "This JoME already has an offer waiting. Cancel it first.";
  return errorText(e);
}

/**
 * Hand the board to someone else (selling or gifting it). The offer is tied to
 * the recipient's email or number: it appears when they sign in with it, and
 * they become the owner when they accept.
 */
export function TransferScreen() {
  const navigate = useNavigate();
  const { info } = useAppSelector(selectDevice);
  const role = useBoardRole();
  const serial = info?.serial;

  const [offer, setOffer] = useState<Transfer>();
  const [loaded, setLoaded] = useState(false);
  const [to, setTo] = useState("");
  const [keep, setKeep] = useState(true);
  const [formError, setFormError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const load = useCallback(async () => {
    if (!serial) return;
    try {
      setOffer(await pendingOffer(serial));
      setActionError(undefined);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setLoaded(true);
    }
  }, [serial]);

  useEffect(() => {
    if (role === "owner") void load();
  }, [role, load]);

  if (!info || !serial) return <Navigate to="/device" replace />;
  if (role === "member") return <Navigate to="/device" replace />;

  const send = async (e: FormEvent) => {
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
      setOffer(await offerBoard(serial, identity, keep));
      setTo("");
    } catch (err) {
      setFormError(offerError(err));
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    setActionError(undefined);
    try {
      await cancelOffer(serial);
      setOffer(undefined);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Screen
      title="Hand over"
      subtitle={`Give ${info.name} to someone else`}
      onBack={() => navigate(-1)}
    >
      {offer ? (
        <Card className={styles.card}>
          <p className={styles.sheetText}>
            <Gift size={18} aria-hidden /> Offered to{" "}
            <b>{identityLabel(offer.identity)}</b>. They see it when they sign
            in with that{" "}
            {offer.identity.startsWith("phone:") ? "number" : "email"} and
            accept it. The offer ends after 7 days.{" "}
            {offer.keepAccess
              ? "You stay on as a member."
              : "You lose access when they accept."}
          </p>
          <Button
            variant="secondary"
            icon={X}
            loading={cancelling}
            onClick={() => void cancel()}
          >
            Cancel the offer
          </Button>
        </Card>
      ) : (
        loaded && (
          <Card className={styles.card}>
            <form onSubmit={(e) => void send(e)} noValidate>
              <TextField
                id="transfer-to"
                label="Give it to (email or phone number)"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                inputMode="email"
                autoComplete="off"
                placeholder="ali@example.com or 0912 345 6789"
                hint="They become the owner and start with nobody else on it: the people you shared it with don't follow. The controller keeps its zones and programs."
                error={formError}
              />
              <div className={styles.head}>
                <span>Keep access for me</span>
                <Switch
                  checked={keep}
                  onChange={setKeep}
                  label="Keep access for me"
                />
              </div>
              <p className={styles.sheetText}>
                {keep
                  ? "You stay on as a member and can still water it."
                  : "It leaves your list as soon as they accept."}
              </p>
              <Button type="submit" block icon={Gift} loading={sending}>
                Offer {info.name}
              </Button>
            </form>
          </Card>
        )
      )}
      {actionError && (
        <p className={styles.confirm} role="alert">
          {actionError}
        </p>
      )}
    </Screen>
  );
}
