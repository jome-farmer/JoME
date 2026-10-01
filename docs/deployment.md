# Deployment

## Web: https://app.jome-farmer.ir

The web build is the same app that ships to phones. In desktop Chrome or Edge
it also works as the bench tool, because Web Bluetooth and Web Serial are
available there. Both APIs require **HTTPS**.

| | |
|---|---|
| Host | GitHub Pages (`jome-farmer/JoME`, Settings → Pages) |
| Workflow | [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) |
| Deploys from | **`develop`**, on every push. Can also be run manually from the Actions tab. |
| Domain | `app.jome-farmer.ir`: DNS `CNAME app → jome-farmer.github.io`, HTTPS enforced |
| Allowed branches | Environment `github-pages`: `main`, `develop` |

The app calls the API at `https://api.jome-farmer.ir` by default (the same in
the native release builds), so the deploy needs no `VITE_API_URL`. The server
allows `https://app.jome-farmer.ir` and the native origins in CORS
([cloud.md](cloud.md)).

Deep links such as `/zones` work because the workflow copies `index.html` to
`404.html`.

### At 1.0: switch to `main`

1. In `deploy.yml`, change `branches: [develop]` to `branches: [main]`.
2. Optionally remove `develop` from the `github-pages` environment's allowed
   branches, or keep it for a later staging site.

## Mobile

iOS and Android builds are released through the stores from `release/*`. CI
builds both native projects on every PR (the `android` and `ios` jobs in
`ci.yml`).

### Android release signing

Play only accepts a signed bundle, and Google sign-in only works for keys
whose SHA-1 is registered ([cloud.md](cloud.md#google-sign-in-setup)).

1. Create the **upload key** once, outside the repo, and back it up (losing it
   means a reset through Play support):
   ```bash
   keytool -genkeypair -v -keystore jome-upload.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Point Gradle at it in `~/.gradle/gradle.properties` (or the same names as
   env vars, for CI). Nothing secret goes in the repo:
   ```properties
   JOME_UPLOAD_STORE_FILE=/path/to/jome-upload.jks
   JOME_UPLOAD_STORE_PASSWORD=...
   JOME_UPLOAD_KEY_ALIAS=upload
   JOME_UPLOAD_KEY_PASSWORD=...
   ```
3. Build the release bundle: `cd android && ./gradlew bundleRelease`
   (`app/build/outputs/bundle/release/`). Without the properties the release
   build is unsigned; debug builds and CI are unaffected.
4. Check the key: `./gradlew signingReport` should show `release` with the
   keystore, and `keytool -list -v -keystore jome-upload.jks -alias upload`
   prints the SHA-1 to register.

Play re-signs the app with its own **Play App Signing** key, so Google
sign-in needs that key's SHA-1 too, from Play Console → App integrity → App
signing → *App signing key certificate*.

Icons and splash screens are generated from `assets/logo.png`, which is
`public/logo/symbol.svg` rendered at 1024 px with safe padding:

```bash
npx @capacitor/assets generate --ios --android \
  --iconBackgroundColor '#f4f7f5' --iconBackgroundColorDark '#0a1811' \
  --splashBackgroundColor '#f4f7f5' --splashBackgroundColorDark '#0a1811' \
  --logoSplashScale 0.5
``` See
[CONTRIBUTING.md](../CONTRIBUTING.md#releasing).
