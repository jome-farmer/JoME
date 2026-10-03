import { useEffect, useState, type ReactNode } from "react";
import {
  Bluetooth,
  CloudRain,
  Droplet,
  Play,
  Plus,
  Square,
  Terminal,
  Trash2,
  Wifi,
} from "lucide-react";
import "../ui/base.css";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { IconButton } from "../ui/IconButton";
import { List, ListRow } from "../ui/ListRow";
import { Sheet } from "../ui/Sheet";
import { StatusPill } from "../ui/StatusPill";
import { Stepper } from "../ui/Stepper";
import { Switch } from "../ui/Switch";
import { WaterRing } from "../ui/WaterRing";
import { Segmented } from "../ui/Segmented";
import { BarChart, Donut, Sparkline } from "../ui/Chart";
import { formatDuration } from "../lib/format";
import styles from "./UiGallery.module.css";

type Theme = "system" | "light" | "dark";

/** Living reference for src/ui at /ui. Compare against design/mockups.html. */
export default function UiGallery() {
  const [theme, setTheme] = useState<Theme>("system");
  const [on, setOn] = useState(true);
  const [minutes, setMinutes] = useState(10);
  const [sheet, setSheet] = useState(false);
  const [left, setLeft] = useState(402);
  const [view, setView] = useState<"Map" | "Zones" | "Sensors">("Map");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 600)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1>JoME UI</h1>
        <div className={styles.row}>
          {(["system", "light", "dark"] as const).map((t) => (
            <Button
              key={t}
              variant={t === theme ? "primary" : "secondary"}
              onClick={() => setTheme(t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </header>

      <Section title="Button">
        <div className={styles.row}>
          <Button icon={Play}>Run 10 min</Button>
          <Button variant="secondary">Skip for now</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger" icon={Square}>
            Stop watering
          </Button>
          <Button loading>Join network</Button>
          <Button disabled>Disabled</Button>
        </div>
        <Button size="lg" block>
          Get started
        </Button>
      </Section>

      <Section title="IconButton">
        <div className={styles.row}>
          <IconButton icon={Plus} label="New program" />
          <IconButton icon={Terminal} label="Serial terminal" variant="plain" />
        </div>
      </Section>

      <Section title="StatusPill">
        <div className={styles.row}>
          <StatusPill tone="flow" icon={Droplet}>
            Watering
          </StatusPill>
          <StatusPill tone="idle">Idle</StatusPill>
          <StatusPill tone="off">Off</StatusPill>
          <StatusPill tone="ok" icon={Bluetooth}>
            Connected
          </StatusPill>
          <StatusPill tone="warn" icon={CloudRain}>
            Rain delay
          </StatusPill>
          <StatusPill tone="danger">Offline</StatusPill>
          <StatusPill tone="flow" live>
            Connecting…
          </StatusPill>
        </div>
      </Section>

      <Section title="Segmented">
        <Segmented
          options={["Map", "Zones", "Sensors"] as const}
          value={view}
          onChange={setView}
          label="View"
        />
      </Section>

      <Section title="BarChart, Sparkline and Donut (never blue)">
        <Card>
          <BarChart
            values={[120, 80, 95, 0, 90, 88, 140]}
            labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
            highlight={6}
            label="Water per day"
          />
        </Card>
        <div className={styles.row}>
          <span style={{ inlineSize: 96 }}>
            <Sparkline values={[60, 64, 62, 66, 68, 65, 68]} />
          </span>
          <span style={{ inlineSize: 96 }}>
            <Sparkline values={[50, 48, 46, 45, 44, 43, 42]} tone="warn" />
          </span>
          <Donut
            parts={[28, 18, 24, 15, 10, 5]}
            center="1,300 L"
            label="By zone"
          />
        </div>
      </Section>

      <Section title="WaterRing in a hero Card">
        <Card hero className={styles.hero}>
          <WaterRing remaining={left} total={600} />
          <div className={styles.stack}>
            <StatusPill tone="flow" icon={Droplet}>
              Watering
            </StatusPill>
            <b>Vegetable beds</b>
            <span className={styles.muted}>Zone 3 · Evening program</span>
          </div>
        </Card>
      </Section>

      <Section title="Switch and Stepper">
        <div className={styles.row}>
          <Switch checked={on} onChange={setOn} label="Morning program" />
          <Switch
            checked={false}
            onChange={() => {}}
            label="Disabled example"
            disabled
          />
        </div>
        <Stepper
          label="Duration"
          value={minutes}
          onChange={setMinutes}
          min={1}
          max={60}
          format={(m) => formatDuration(m * 60)}
        />
      </Section>

      <Section title="List and ListRow">
        <List>
          <ListRow
            icon={Wifi}
            title="Wi‑Fi"
            trailing="Baharestan-Home"
            onClick={() => {}}
          />
          <ListRow
            icon={CloudRain}
            title="Rain delay"
            subtitle="Pauses all programs"
            trailing="Off"
            onClick={() => {}}
          />
          <ListRow
            icon={Bluetooth}
            title="JoME-0001"
            subtitle="Strong signal"
          />
          <ListRow
            icon={Trash2}
            title="Forget this device"
            tone="danger"
            onClick={() => {}}
          />
        </List>
      </Section>

      <Section title="Sheet">
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Open zone sheet
        </Button>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Front lawn">
          <Stepper
            label="Duration"
            value={minutes}
            onChange={setMinutes}
            min={1}
            max={60}
            format={(m) => formatDuration(m * 60)}
          />
          <Button size="lg" block icon={Play} onClick={() => setSheet(false)}>
            Run {formatDuration(minutes * 60)}
          </Button>
        </Sheet>
      </Section>

      <Section title="EmptyState">
        <Card>
          <EmptyState
            title="No programs yet"
            action={<Button icon={Plus}>New program</Button>}
          >
            Programs run on the controller, even when your phone is off.
          </EmptyState>
        </Card>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
