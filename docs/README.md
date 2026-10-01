# JoME docs

| Doc | What it covers |
|---|---|
| [roadmap.md](roadmap.md) | Refactor phases and open questions |
| [architecture.md](architecture.md) | Layers, folders, device layer, state, testing |
| [device-protocol.md](device-protocol.md) | App ↔ board contract: BLE NUS, USB serial, JSON lines |
| [cloud.md](cloud.md) | App ↔ server contract (DouSHamBE): sign-in, devices, commands, live events, cloud copy |
| [assistant.md](assistant.md) | App ↔ AI agent contract: streaming chat, device tools, safety tiers |
| [deployment.md](deployment.md) | Web deploy to app.jome-farmer.ir, mobile releases |
| [testing-hardware.md](testing-hardware.md) | Manual release checklist on real hardware |
| [adr/](adr/) | Architecture Decision Records |
| [../design/](../design/README.md) | Design system, screens, mockups |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Gitflow, commits, PRs, code style |

## ADRs

Record every decision that is expensive to reverse (framework, protocol,
storage, app ID) as `adr/NNNN-short-title.md` with Status, Context, Decision
and Consequences. Never edit an accepted ADR. Supersede it with a new one.
