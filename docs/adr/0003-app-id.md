# ADR 0003 — App ID: `ir.jomefarmer.jome`

- **Status:** Accepted
- **Date:** 2026-09-30

## Context

Capacitor's `appId` becomes the iOS **bundle identifier** and the Android
**applicationId**. The App Store and Google Play both tie an app's listing,
updates and reviews to this ID, so **it cannot change after the first release**.

The ID was `com.alinaderiparizi.jome`, a personal namespace. The product domain
is `jome-farmer.ir`. The first proposal was `jome.jome-farmer.ir`, but:

- Android allows only letters, digits and `_` in each segment. **A hyphen breaks
  the Android build.**
- iOS allows letters, digits, `-` and `.`, but not `_`.
- By convention the ID is the domain reversed (`ir.…`).

## Decision

`ir.jomefarmer.jome`: the domain `jome-farmer.ir` reversed with the hyphen
removed, followed by the app name. It is valid on both platforms.

## Consequences

- Set in `capacitor.config.ts` before `android/` and `ios/` are generated in Phase 1.
- Every future JoME app uses the same `ir.jomefarmer.*` prefix, for example
  `ir.jomefarmer.installer`.
