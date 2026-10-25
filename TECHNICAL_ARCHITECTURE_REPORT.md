# Kirito-bot Technical Architecture and Technical Overview Report

Repository: YashSensei/Kirito-bot  
Source lineage: CopilotKit/openbot  
Reviewed commit: 5529583 (first commit)  
Review date: 25 October 2026

## 1. Executive summary

Kirito-bot is a self-hostable, multi-agent AI workspace. The repository combines a React/Vite client, a Bun/Hono API, PostgreSQL persistence, enterprise identity, model and agent adapters, a policy and audit layer, persistent browser computers, scheduled work, external integrations, and Docker-based isolation services.

The system is easiest to understand as three trust planes:

1. **Control plane:** the API server, authentication, Bot registry, routing, policy, approvals, audit, channels, memory, queues, and persistence.
2. **Execution plane:** remote or built-in agent runtimes and the agent-computer process that controls Chromium, shell commands, files, and screen streams.
3. **Infrastructure plane:** PostgreSQL, Docker, the supervisor, workers, optional SPIRE identity, images, Compose, and Kubernetes assets.

The strongest design choice is the server-side computer gateway. A consequential browser or host action is resolved against a server-held snapshot, evaluated against policy, recorded in the audit store, and only then sent to the computer process. This makes authorization and audit part of execution rather than an after-the-fact report.

The main engineering challenge is breadth. Many provider modes, agent protocols, identity modes, integrations, service processes, and deployment profiles create a large configuration surface. The implementation is defensive and heavily tested, but production operation needs strict secret management, durable PostgreSQL, per-Bot isolation, queue metrics, and an operator-focused deployment guide.

## 2. Scope and method

This report is based on repository inspection. It covers package manifests, the API composition root, HTTP/WebSocket front door, database client and schemas, domain stores, computer gateway, browser computer, supervisor, worker, agent harnesses, Docker/Compose files, SPIRE configuration, deployment assets, and tests. The current root README contains only the project title, so design intent is inferred from implementation, comments, configuration, and tests.

## 3. Repository topology

The root package is a Bun workspace. The main workspaces are app, server, worker, shared, and toolkit.

| Area | Responsibility | Main technologies |
|---|---|---|
| app | Browser UI, routes, chat, channels, settings, approvals, Bot administration | React 19, Vite, TanStack Router/Query, Tailwind/shadcn |
| server | HTTP API, authentication, orchestration, persistence, policy, audit, integrations | Bun, TypeScript, Hono, Drizzle, PostgreSQL |
| shared | Cross-runtime contracts, model/provider definitions, user-content and work-ownership helpers | TypeScript and small Python helpers |
| toolkit | Turn execution, locks, leases, history sanitization, continuation, limits | TypeScript |
| worker | Local recurring routine sweeps and queue purging | Bun |
| agent-computer | Playwright/Chromium, browser sessions, screen stream, shell, workspace, egress | Bun, Playwright |
| supervisor | Narrow Docker socket boundary for per-Bot computers | Bun, Hono, Dockerode |
| agent-* | Built-in and framework agent endpoints | TypeScript/Python and agent SDKs |
| mobile and desktop | Mobile client and desktop packaging | Expo/React Native and Tauri assets |
| tests | Unit, component, integration, smoke, Compose, and live tests | Bun test, Testing Library, Python |
| docker, spire, charts | Container startup, workload identity, Kubernetes assets | Docker, s6, SPIRE, Helm |

Root package scripts define build, dev, formatting, linting, type checking, normal tests, smoke tests, opt-in live integrations, and an architecture diagram generator. The Bun lockfile commits the resolved dependency graph.

## 4. High-level architecture

~~~mermaid
flowchart LR
  User[Browser mobile desktop] --> UI[React Vite app]
  UI --> API[Bun Hono API]
  API --> Auth[Better Auth SSO OAuth SCIM]
  API --> DB[(PostgreSQL pgvector)]
  API --> Runtime[CopilotKit AG-UI runtimes]
  API --> Policy[Policy approvals audit]
  API --> Agents[Built-in and remote agents]
  API --> Gateway[Computer gateway]
  Gateway --> Computer[agent-computer]
  Computer --> Browser[Persistent Chromium]
  Computer --> Shell[Shell and workspace]
  Computer --> Web[External web]
  API --> Supervisor[Supervisor API]
  Supervisor --> Docker[Docker socket]
  Docker --> PerBot[Per-Bot computers]
  API --> Integrations[Slack email GitHub MCP Composio Arcade]
  Worker[Worker or CronJob] --> DB
  Worker --> API
  SPIRE[SPIRE optional] -. workload identity .-> PerBot
~~~

The API server is the coordination point. It authenticates people, resolves Bot ownership, loads context, selects a runtime, evaluates capabilities and policy, persists activity, and routes actions. The browser computer is a separate process and is reached through the gateway. The supervisor is a separate privileged adapter for Docker lifecycle management.

## 5. Control-plane design

### 5.1 Composition root

server/src/index.ts is the composition root. It creates the database client, domain stores, authentication service, agent resolver, policy stores, approval service, channel hub, routine runner, computer provider, computer gateway, delivery router, integration clients, memory services, and Hono application. It starts the HTTP/WebSocket front door through server/src/http-server.ts.

Feature modules expose factories such as createApprovalStore, createComputerGateway, createAgentProfileStore, createMemoryStore, and createDeliveryStore. This gives tests replaceable dependencies and keeps SQL out of route handlers. The trade-off is a large startup module with many ordering and configuration dependencies.

### 5.2 HTTP and WebSocket boundary

server/src/http-server.ts owns Bun server integration. It handles ordinary requests through Hono, authenticated computer live-stream upgrades, channel activity sockets, and endpoint-specific timeouts. The computer stream is proxied rather than exposed directly: the server checks the person session, checks access to the selected Bot, obtains the internal computer address through the gateway, and opens the inward socket with the computer credential.

This prevents a browser from receiving the computer token and prevents a signed-in user from selecting another Bot identifier to watch its screen.

### 5.3 Hono route surface

server/src/app.ts mounts route groups under /api. The surface includes authentication and SSO/SCIM, user and onboarding routes, preferences and instructions, administration, credentials, identity providers, audit events, CopilotKit runtime routes, computers, host access, agents, routing, channels, attachments, routines, delivery webhooks, demonstrations, Bots, team Bots, approvals, passwords, proactive work, memory, responsibilities and triggers, components, plugins, and threads.

Most routes use requireUser plus a more specific role, organization, Bot ownership, approval, or signed-callback check. Route ordering is significant: specific paths are mounted before broad route groups so that a generic router cannot shadow an admin or callback endpoint.

### 5.4 Agent registry and runtime selection

Bot profiles are persisted with a runtime type and configuration. The runtime loader supports built-in agents, remote AG-UI endpoints, and remote Mastra endpoints. A profile can identify a particular remote agent when an endpoint hosts a roster.

server/src/copilot.ts normalizes model provider and base URL configuration and creates a standing role message. That message carries Bot name, title, role description, provenance guidance, and untrusted-content guidance. It gives different agent frameworks a common semantic contract.

The selector distinguishes the built-in Responses-capable runtime from managed endpoints using Chat Completions-compatible APIs. BOT_PROVIDER, BOT_MODEL, OPENAI_BASE_URL, and ANTHROPIC_BASE_URL are normalized before SDK calls.

### 5.5 Turns, locks, and continuation

toolkit/src/run-turn.ts, thread-lock.ts, lease.ts, continuation.ts, and thread-history.ts form the turn-control layer. They prevent overlapping turns on one thread, claim work, support long-running tool continuation, sanitize history crossing runtime boundaries, and settle turns consistently.

The server reuses these primitives for channels, callbacks, proactive work, approvals, and routines. This reduces duplicated concurrency behavior but makes toolkit changes high impact because many features rely on the same lock and lease semantics.

## 6. Execution-plane design

### 6.1 Browser computer

agent-computer/src/index.ts is a long-lived Bun service owning Playwright and Chromium. Its capabilities include browser/session management, navigation, accessibility snapshots, click/type/scroll, sign-in helpers, screen streaming, file read/write/download, demonstrations, human takeover, egress handling, and shell execution.

The process refuses to start without COMPUTER_TOKEN. Profiles and workspace files are volume-backed. Long-lived profiles preserve signed-in sessions between turns; workspace files preserve Bot notes and downloaded artifacts.

The browser action protocol is snapshot-based. A caller receives a snapshot with opaque element references and must send the snapshot identity with an action. Stale references are rejected. This avoids trusting a model-provided CSS selector or visible label and makes actions more deterministic. Canvas-heavy sites still need a vision or pixel fallback.

### 6.2 Computer gateway

server/src/computer/gateway.ts is the server-side action boundary. Its documented order is:

1. Resolve the caller reference against the server-held snapshot.
2. Evaluate policy, with deny winning and missing or malformed policy failing closed.
3. Persist the audit event and decision.
4. Call agent-computer only after the record exists.

The gateway validates computer addresses before placing a computer token in an internal URL. It is used for browser actions, shell commands, file access, and other consequential capabilities.

### 6.3 Supervisor

supervisor/src/index.ts exposes a small Bot-oriented API: ensure, stop, reset, list, and health. It validates Bot IDs, derives container names, applies optional memory/runtime/network parameters, and uses Dockerode. It does not expose arbitrary Docker API passthrough.

The supervisor is the only intended holder of the Docker socket. SUPERVISOR_TOKEN protects its network API, but the deeper boundary is its restricted vocabulary: even a caller with the token can only cycle or inspect Bot computers identified by validated Bot IDs. Optional COMPUTER_RUNTIME=runsc enables gVisor where available. Optional SPIRE registration gives a computer a workload identity.

## 7. Data architecture

PostgreSQL is the system of record, with Drizzle schemas split under server/src/db/schema. The schema covers identity, sessions, users, organizations, SSO/SCIM, Bot profiles, channels, threads, audit events, approvals, credentials, computer state, routines, work queues, deliveries, plugins, memories, learning, voice, and demonstrations.

server/src/db/client.ts parses DATABASE_URL rather than passing it blindly to Bun. It validates URL shape, database name, port range, percent-encoding, and supported sslmode values. It translates sslmode and sslrootcert into Bun TLS options and avoids echoing passwords in errors. This is useful for managed PostgreSQL and Windows development.

Domain stores isolate query and transaction details from routes. The design is maintainable at feature level, but cross-domain workflows still require care: one Bot action can touch identity, channel, approval, policy, audit, queue, and computer state in one logical turn.

## 8. Representative flows

### 8.1 User turn with a computer action

~~~mermaid
sequenceDiagram
  participant U as UI
  participant A as API
  participant D as Database
  participant R as Agent runtime
  participant G as Gateway
  participant C as Computer
  U->>A: authenticated turn
  A->>D: load actor Bot thread history policy
  A->>R: turn with standing role
  R-->>A: text and tool events
  R->>A: browser action request
  A->>G: resolve reference and evaluate
  G->>D: audit decision
  G->>C: authenticated action
  C-->>G: result or new snapshot
  G-->>R: tool result
  A-->>U: streamed activity
~~~

### 8.2 Scheduled routine

server/src/routines/sweep.ts offers due routines and dispatches claimed runs. worker/src/index.ts is a local replacement for an external CronJob. It runs a 30-second sweep, catches failures so a laptop worker survives transient database errors, and purges old queue items roughly hourly. It sends only a routine-run identifier and a bearer secret to the API.

In production, an external scheduler can invoke the one-shot sweep with a deadline and restart semantics. The local worker intentionally has a different failure policy because a laptop may not have a process supervisor.

### 8.3 Approval and takeover

Sensitive actions can create persisted approval requests. The UI or channel presents the request, and acceptance or refusal resumes or terminates the logical turn. Browser handoff lets a person temporarily control the computer. The server remains responsible for resumption and audit, so a UI action cannot silently bypass the turn state machine.

### 8.4 Per-Bot provisioning

~~~mermaid
sequenceDiagram
  participant A as API
  participant S as Supervisor
  participant D as Docker
  participant C as Per-Bot computer
  participant I as SPIRE optional
  A->>S: ensure Bot computer with token
  S->>S: validate ID and derive names
  S->>I: register identity if enabled
  S->>D: create or start container
  D-->>C: start with volumes and token
  C-->>S: health
  S-->>A: address state identity
~~~

## 9. Security architecture

### 9.1 Identity and authentication

Better Auth integration supports session authentication, password flows, OAuth, enterprise SSO, SCIM provisioning, role assignment, session revocation, and break-glass administrators. The code handles missing or ambiguous identity claims, including Microsoft/Entra profiles where email may appear as upn or preferred_username.

The architecture separates person session identity, Bot ownership, agent callback credentials, computer credentials, supervisor credentials, and optional SPIFFE workload identity. A remote agent or browser process is therefore not treated as the person who initiated a turn.

### 9.2 Authorization

Authorization is layered:

- requireUser authenticates a person.
- Role and organization guards protect administration.
- Bot access checks protect screens and Bot data.
- Computer policies govern actions.
- Approval gates add human consent.
- Shared-use gates manage team resources.
- Callback assertions bind remote calls to a Bot and expected run.
- The gateway resolves opaque references before evaluating action semantics.

The implementation generally fails closed for missing secrets, malformed policies, invalid computer addresses, and unverifiable identities.

### 9.3 Network and egress boundaries

Compose binds database, computer, supervisor, and agent ports to loopback for local use. A deployment running the API inside Compose can use internal service DNS and avoid host publishing. Egress controls are separate from inbound computer authentication and restrict where a Bot can browse or connect.

Every new fetch path, plugin adapter, browser protocol, and callback route should be reviewed for SSRF, private-network access, token leakage, and cross-Bot address confusion.

### 9.4 Secrets and sensitive state

Sensitive data includes model keys, OAuth credentials, browser profiles, workspace documents, callback tokens, and database passwords. The code includes startup refusal for missing critical tokens, credential stores, secret masking in snapshots, redacted DATABASE_URL errors, and selective environment forwarding to harnesses and computer containers.

Compose defaults are development conveniences. Production must replace them with a secret manager, rotate keys, restrict environment visibility, encrypt backups, and document deletion of profiles and workspaces.

### 9.5 Container privilege

The root Dockerfile uses s6-overlay to supervise processes and stop the container if a supervised service exits. API and migration processes use apiuser, browser and shell use pwuser, and embedded PostgreSQL uses postgres. sudo is limited to package-management commands.

This is defense in depth rather than a complete sandbox. A shared container is not per-Bot isolation, and Chromium may run without its own sandbox in some environments. Stronger deployments use per-Bot computers, gVisor or Kata where supported, no-new-privileges, minimal mounts, and dedicated hosts for the Docker supervisor.

## 10. Deployment architecture

### 10.1 Single container

Dockerfile builds the React app and packages the API, server, shared code, toolkit, agent-computer source, Chromium, optional embedded PostgreSQL, and s6 service definitions. The API serves the app on one origin; the browser port stays private inside the container.

This is convenient for a small installation. It does not provide per-Bot computer isolation unless a separate supervisor is deployed. Embedded PostgreSQL needs a durable volume or an external database to survive replacement.

### 10.2 Compose

docker-compose.yml defines PostgreSQL with pgvector, migration, an agent-computer, optional SPIRE server/agent, supervisor, managed agent-bot, optional selected harness, and an agent-langgraph service. The data network is intentionally limited to database and migration paths; other services use the default network. Health checks gate startup.

The Compose design supports both a host-running API and a container-network API. Operators should preserve loopback bindings and avoid publishing internal services on all host interfaces.

### 10.3 Kubernetes direction

charts, SPIRE files, health checks, pinned user IDs, and comments about fsGroup, CronJobs, deadlines, and hostPath volumes indicate a Kubernetes deployment path. Operators must verify profile/workspace volume ownership, external database durability, supported runtimes for per-Bot computers, SPIRE socket permissions, network policies, and CronJob alerts.

## 11. Observability and operations

The repository includes health checks, structured JSON logs, audit events, retention jobs, telemetry modules, OpenTelemetry log dependencies, queue state, and explicit startup errors. Important signals are API and dependency health, browser profile writeability, computer reachability, routine offered/claimed/fired/skipped counts, queue backlog and stale leases, audit write failures, model/provider availability, remote-agent latency, egress refusals, approval wait time, and WebSocket disconnects.

A production deployment should centralize logs, add metrics and traces around each turn, alert on overdue routines and stalled turns, and retain audit events according to policy. The code supplies useful event names, but dashboards and escalation procedures remain deployment responsibilities.

## 12. Testing and quality

Testing spans unit tests for policy, parsing, stores, locks, leases, model selection, and protocol helpers; React component and route tests; server integration tests; Python agent tests; Compose and clean-checkout tests; smoke journeys; and opt-in live screen, Composio, and Arcade tests. Root scripts also run formatting, linting, type checks, and CI-specific test orchestration.

The main limitation is environmental coverage. Provider credentials, OAuth, Docker, live browsers, and external integrations are optional. CI can pass while staging has a wrong provider key, missing Docker socket, incompatible database TLS, or unavailable browser runtime. A release pipeline should add an authenticated staging smoke test.

## 13. Architectural strengths

1. Control and execution are separated cleanly.
2. The gateway makes policy and audit part of action execution.
3. The agent registry supports heterogeneous runtimes behind a common profile.
4. Domain stores keep persistence concerns localized.
5. Human approval and takeover are part of the turn model.
6. Configuration parsing is defensive and errors avoid exposing secrets.
7. Deployment modes range from one container to per-Bot Docker and Kubernetes/SPIRE.
8. Tests encode invariants such as stale references, policy ordering, and callback boundaries.

## 14. Main risks and recommendations

### Configuration complexity

Many services, provider modes, ports, tokens, and integrations can produce partial health. Add a generated configuration reference and a doctor command that checks database, provider, computer, supervisor, and callback connectivity without printing secrets.

### Development defaults in production

Database passwords, computer tokens, supervisor tokens, and SPIRE join tokens have local defaults. Production mode should reject known defaults and require explicit secret injection.

### Persistent browser profiles

Profiles contain real login sessions and workspaces contain potentially sensitive files. Encrypt or isolate volumes, restrict backup access, document retention, rotate sessions on retirement, and make deletion an audited admin operation.

### Docker socket and shared kernel

The supervisor is high impact and the browser may run without a Chromium sandbox. Use a dedicated host or VM, minimize mounts, enforce no-new-privileges, prefer rootless or sandboxed runtimes, and monitor every supervisor operation.

### Large composition root

The server bootstrap is powerful but difficult to reason about. Split lifecycle initialization into typed modules for identity, agents, computers, integrations, and background jobs while retaining current factory boundaries.

### Queues and schedulers

Routines, approvals, delivery, proactive work, and channel summaries depend on periodic sweeps. Add queue depth and age metrics, retry/dead-letter dashboards, idempotency keys for external delivery, and overdue-work alerts.

### Remote-agent supply chain

Remote AG-UI/Mastra endpoints can invoke callbacks and tools. Enforce TLS and endpoint allowlists, pin images, scope callback credentials to Bot/run/action, use replay protection, and require administrator approval for endpoint registration.

### Documentation gap

The current README is minimal. Add installation, threat model, backup/restore, migrations, secret rotation, Bot retirement, incident response, and secure production Compose/Kubernetes guides.

## 15. Recommended deployment profiles

### Development

Compose PostgreSQL and one computer, loopback ports, ignored local env file, local worker loop, and opt-in live integrations.

### Small self-hosted production

Managed PostgreSQL with TLS verification, API and supervisor on a protected host, per-Bot computers with durable volumes, a secret manager, a reverse proxy exposing only the API, centralized logs, and daily backups.

### Enterprise production

Kubernetes with separate API, worker, supervisor, and computer workloads; SPIRE and network policies; gVisor or Kata; external PostgreSQL with point-in-time recovery; SSO/SCIM; OpenTelemetry; queue dashboards; audit retention/export; and staging live-provider tests.

## 16. Conclusion

Kirito-bot is designed as an auditable agent operating system rather than a thin chat frontend. Its defining pattern is a durable control plane governing heterogeneous agent runtimes and a separate execution plane for browsers, shells, files, and external systems. The implementation is particularly strong around policy ordering, auditability, stale browser references, human approval, workload identity, and deployment failure modes.

The next engineering priority should be operational simplification: make configuration discoverable, make production-safe defaults unavoidable, expose queue and turn metrics, and document recovery procedures. Those additions would make the existing control-plane and execution-plane separation easier to operate securely.

## Appendix: key file map

- Workspace and commands: package.json
- API composition: server/src/index.ts
- HTTP/WebSocket front door: server/src/http-server.ts
- Route composition: server/src/app.ts
- Model/runtime selection: server/src/copilot.ts
- Database client and TLS parsing: server/src/db/client.ts
- Database schemas: server/src/db/schema/
- Computer gateway: server/src/computer/gateway.ts
- Computer provider: server/src/computer/provider.ts
- Browser service: agent-computer/src/index.ts
- Browser sessions and profiles: agent-computer/src/sessions.ts and profiles.ts
- Workspace confinement: agent-computer/src/workspace.ts
- Egress control: agent-computer/src/egress.ts
- Docker supervisor: supervisor/src/index.ts and docker.ts
- Scheduler: worker/src/index.ts
- Turn primitives: toolkit/src/run-turn.ts, thread-lock.ts, lease.ts
- Compose deployment: docker-compose.yml
- Single-container build: Dockerfile
- Workload identity: spire/server.conf and spire/agent.conf
- Kubernetes assets: charts/
- Frontend entry/routing: app/src/main.tsx, router.tsx, routes/
- Mobile client: mobile/src/
- CI and quality: .github/workflows/, biome.json, package scripts
