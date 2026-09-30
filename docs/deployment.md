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

Deep links such as `/zones` work because the workflow copies `index.html` to
`404.html`.

### At 1.0: switch to `main`

1. In `deploy.yml`, change `branches: [develop]` to `branches: [main]`.
2. Optionally remove `develop` from the `github-pages` environment's allowed
   branches, or keep it for a later staging site.

## Mobile

iOS and Android builds are released through the stores from `release/*`. See
[CONTRIBUTING.md](../CONTRIBUTING.md#releasing).
