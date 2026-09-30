import { useEffect, useState } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import styles from "./Splash.module.css";

/** Longest the overlay can stay, even if animationend never fires (e.g. a backgrounded tab). */
const MAX_MS = 2200;

/**
 * Animated launch splash (design/splash.html). Plays once per cold start over the app,
 * which keeps loading underneath. Takes over from the static native launch screen.
 */
export function Splash() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    // We're on screen: drop the native splash with no fade, so the handoff is seamless.
    void SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
    const timer = setTimeout(() => setDone(true), MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  if (done) return null;

  return (
    <div
      className={styles.splash}
      aria-hidden
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setDone(true);
      }}
    >
      <div className={styles.mascotWrap}>
        <svg className={styles.ripples} viewBox="0 0 256 256">
          <circle className={styles.r1} cx="128" cy="142" r="110" />
          <circle className={styles.r2} cx="128" cy="142" r="110" />
        </svg>
        {/* public/logo/symbol.svg verbatim; only <g> wrappers for eyes and sprout, plus the drop. */}
        <svg className={styles.mascot} viewBox="0 0 256 256">
          <defs>
            <clipPath id="splash-face">
              <rect x="58" y="100" width="140" height="126" rx="40" />
            </clipPath>
          </defs>
          <rect x="30" y="140" width="24" height="52" rx="12" fill="#1E88E5" />
          <rect x="202" y="140" width="24" height="52" rx="12" fill="#1E88E5" />
          <rect
            x="58"
            y="100"
            width="140"
            height="126"
            rx="40"
            fill="#F4F7F5"
          />
          <rect
            x="58"
            y="100"
            width="140"
            height="40"
            fill="#D5E0DA"
            clipPath="url(#splash-face)"
          />
          <rect
            x="58"
            y="100"
            width="140"
            height="126"
            rx="40"
            fill="none"
            stroke="#0F3D2B"
            strokeWidth="9"
          />
          <rect x="80" y="136" width="96" height="58" rx="26" fill="#0F3D2B" />
          <g className={styles.eyes}>
            <ellipse cx="106" cy="165" rx="9" ry="13" fill="#4CE08A" />
            <ellipse cx="150" cy="165" rx="9" ry="13" fill="#4CE08A" />
            <circle cx="110" cy="158" r="3.5" fill="#fff" />
            <circle cx="154" cy="158" r="3.5" fill="#fff" />
          </g>
          <path
            d="M108 208Q128 222 148 208"
            stroke="#0F3D2B"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <g className={styles.sprout}>
            <path
              d="M128 46V64"
              stroke="#0F3D2B"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M128 52C128 28 146 18 170 20C170 44 152 56 128 52Z"
              fill="#2FA860"
            />
            <path
              d="M128 56C128 40 116 32 98 34C98 50 112 60 128 56Z"
              fill="#8FDCA8"
            />
          </g>
          <path
            d="M70 112C70 76 98 62 128 62C158 62 186 76 186 112Z"
            fill="#F4B942"
            stroke="#0F3D2B"
            strokeWidth="9"
            strokeLinejoin="round"
          />
          <path d="M71 84H185L186 112H70Z" fill="#14703F" />
          <ellipse
            cx="128"
            cy="114"
            rx="108"
            ry="16"
            fill="#F4B942"
            stroke="#0F3D2B"
            strokeWidth="9"
          />
          <path
            className={styles.drop}
            d="M156 8C160 15 165 20 165 26A9 9 0 0 1 147 26C147 20 152 15 156 8Z"
            fill="#1E88E5"
          />
        </svg>
      </div>
      {/* Wordmark strokes from public/logo/horizontal.svg (its translate folded into the viewBox). */}
      <svg className={styles.wordmark} viewBox="246 60 414 136">
        <path
          className={`${styles.letter} ${styles.l1}`}
          pathLength={1}
          d="M306 72V136A48 48 0 0 1 258 184"
        />
        <circle
          className={`${styles.letter} ${styles.l2} ${styles.o}`}
          pathLength={1}
          cx="380"
          cy="148"
          r="36"
        />
        <path
          className={`${styles.letter} ${styles.l3}`}
          pathLength={1}
          d="M452 184V72L500 140L548 72V184"
        />
        <path
          className={`${styles.letter} ${styles.l4}`}
          pathLength={1}
          d="M648 72H596V184H648M596 128H640"
        />
      </svg>
    </div>
  );
}
