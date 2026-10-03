import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CalendarDays,
  House,
  Map,
  Menu,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { ConnectionBanner } from "./ConnectionBanner";
import styles from "./TabLayout.module.css";

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/zones", label: "Zones", icon: Sprout },
  { to: "/map", label: "Map", icon: Map },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/more", label: "More", icon: Menu },
];

/** Screens opened from More keep More lit. */
const UNDER_MORE = ["/more", "/device", "/devices", "/assistant", "/analytics"];

export function TabLayout() {
  const { pathname } = useLocation();
  const underMore = UNDER_MORE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  return (
    <div className={styles.layout}>
      <ConnectionBanner />
      <div className={styles.content}>
        <Outlet />
      </div>
      <nav className={styles.tabbar} aria-label="Main">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `${styles.tab} ${isActive || (to === "/more" && underMore) ? styles.active : ""}`
            }
          >
            <span className={styles.icon}>
              <Icon size={24} strokeWidth={1.75} aria-hidden />
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
