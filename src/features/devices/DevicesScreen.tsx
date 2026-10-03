import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CloudSun,
  Cpu,
  Droplet,
  Droplets,
  FlaskConical,
  Plug,
  Waypoints,
} from "lucide-react";
import { useGarden } from "../../device/useGarden";
import { useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { SAMPLE_DEVICES } from "../../services/field";
import { Button } from "../../ui/Button";
import { Sparkline } from "../../ui/Chart";
import { EmptyState } from "../../ui/EmptyState";
import { List, ListRow } from "../../ui/ListRow";
import { Screen } from "../../ui/Screen";
import { Segmented } from "../../ui/Segmented";
import { StatusPill } from "../../ui/StatusPill";
import styles from "./DevicesScreen.module.css";

const VIEWS = ["All", "Controllers", "Sensors", "Valves"] as const;
type View = (typeof VIEWS)[number];
const ICON = { Sensors: Droplets, Weather: CloudSun, Nutrients: FlaskConical };

/** Everything in the garden: the controller, its valves, and (sample) sensors and equipment. */
export function DevicesScreen() {
  const navigate = useNavigate();
  const { state, info, offline } = useAppSelector(selectDevice);
  const { zones, run } = useGarden();
  const [view, setView] = useState<View>("All");
  const show = (v: View) => view === "All" || view === v;

  return (
    <Screen
      title="Devices"
      subtitle="Controllers, sensors and equipment"
      onBack={() => navigate("/more")}
    >
      <Segmented options={VIEWS} value={view} onChange={setView} label="Kind" />

      {show("Controllers") &&
        (state === "ready" && info ? (
          <List>
            <ListRow
              icon={Cpu}
              title={info.name}
              subtitle={`JoME controller · ${info.serial}`}
              trailing={
                offline ? (
                  <StatusPill tone="danger">Offline</StatusPill>
                ) : (
                  <StatusPill tone="ok">Online</StatusPill>
                )
              }
              onClick={() => navigate("/device")}
            />
          </List>
        ) : (
          <EmptyState
            title="No controller connected"
            action={
              <Button icon={Plug} onClick={() => navigate("/connect")}>
                Connect a controller
              </Button>
            }
          />
        ))}

      {show("Sensors") && (
        <section className={styles.section}>
          <h2 className={styles.label}>
            Sensors and equipment <span>· sample</span>
          </h2>
          <List>
            {SAMPLE_DEVICES.map((d) => (
              <ListRow
                key={d.id}
                icon={ICON[d.kind]}
                title={d.name}
                subtitle={`${d.where} · ${d.reading}`}
                trailing={
                  d.trend && (
                    <span className={styles.spark}>
                      <Sparkline
                        values={d.trend}
                        tone={d.low ? "warn" : "ok"}
                      />
                    </span>
                  )
                }
              />
            ))}
          </List>
        </section>
      )}

      {show("Valves") && zones.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.label}>Valves</h2>
          <List>
            {[...zones]
              .sort((a, b) => a.valve - b.valve)
              .map((z) => (
                <ListRow
                  key={z.zone}
                  icon={Waypoints}
                  title={`Valve ${z.valve}`}
                  subtitle={z.name}
                  trailing={
                    run?.zone === z.zone ? (
                      <StatusPill tone="flow" icon={Droplet}>
                        Open
                      </StatusPill>
                    ) : (
                      <StatusPill tone={z.enabled ? "idle" : "off"}>
                        {z.enabled ? "Closed" : "Off"}
                      </StatusPill>
                    )
                  }
                  onClick={() => navigate(`/zones/${z.zone}`)}
                />
              ))}
          </List>
        </section>
      )}
    </Screen>
  );
}
