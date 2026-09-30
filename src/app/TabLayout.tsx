import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarDays,
  Cpu,
  House,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { ConnectionBanner } from "./ConnectionBanner";
import styles from "./TabLayout.module.css";

type Tab = { to: string; label: string; icon: LucideIcon | "mascot" };

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/zones", label: "Zones", icon: Sprout },
  { to: "/assistant", label: "JoME", icon: "mascot" },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/device", label: "Device", icon: Cpu },
];

export function TabLayout() {
  return (
    <div className={styles.layout}>
      <ConnectionBanner />
      <div className={styles.content}>
        <Outlet />
      </div>
      <nav className={styles.tabbar} aria-label="Main">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className={styles.tab}>
            <span className={styles.icon}>
              {Icon === "mascot" ? (
                <img src="/logo/symbol.svg" alt="" className={styles.mascot} />
              ) : (
                <Icon size={24} strokeWidth={1.75} aria-hidden />
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
