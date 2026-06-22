# Birthday Reminder — "Circle the date"

Remember **and act on** the birthdays and special dates that matter. A reminder
app that doesn't just nudge you — it helps you reach out, with the right message,
at the right local time.

This is a **monorepo** with three independent packages plus shared planning docs.

```
.
├── app/         ← Expo (React Native) — web + iOS + Android, one codebase
├── backend/     ← Node + Express + TypeScript — the API server (talks to MongoDB)
├── website/     ← Next.js — the public marketing/landing site
└── _ai_context/ ← Product, design, and stack docs (PRD, design system, build TODO)
```

> The app never talks to the database directly — it always goes through the
> backend API. See `_ai_context/techstack.md` for the architecture.

---

## Prerequisites

- **Node.js LTS** (v18+; this repo is developed on v24) and **npm**
- **Git**
- For mobile: an **Expo** account and `eas-cli` (`npm i -g eas-cli`) — only needed
  for device/store builds, not for local web/dev.

External service accounts (free tiers) are needed as features land — see the
checklist in `_ai_context/TODO.md`:

- **MongoDB Atlas** (database) — Stage 1
- **Resend** (transactional email) — Stage 4
- **Cloudinary** (person photos) — Stage 6
- **Render / Railway** (backend host) + **Vercel** (site + web app) — Stage 14
- _(Deferred)_ **Twilio** — only when SMS goes live

---

## Workspace strategy

**Independent installs.** Each package has its own `package.json`, its own
`node_modules`, and is installed/run on its own. There is no root workspace tool
(no pnpm/npm workspaces) — this keeps each package self-contained and matches the
deployment story (backend, website, and app deploy separately).

Each package exposes the same baseline scripts where they apply:

| Script             | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the package in development              |
| `npm run build`    | Produce a production build                    |
| `npm run lint`     | Lint the package                              |
| `npm run typecheck`| Type-check with `tsc --noEmit`                |

---

## Getting started

Open three terminals (or run as needed). From the repo root:

### Backend (API)

```bash
cd backend
cp .env.example .env      # then fill in values as stages require them
npm install
npm run dev               # http://localhost:4040  (GET /health, GET /)
```

### App (Expo — web + iOS + Android)

```bash
cd app
cp .env.example .env      # set EXPO_PUBLIC_API_URL
npm install
npm run dev               # Expo dev server; press w for web, or scan QR for device
```

### Website (Next.js)

```bash
cd website
npm install
npm run dev               # http://localhost:3000
```

---

## Conventions

- **TypeScript everywhere.**
- **Secrets** live in per-package `.env` files (never committed). Every key is
  documented in that package's `.env.example`.
- **Code style** is shared "in spirit": a root `.editorconfig` and
  `.prettierrc.json` define formatting; each package keeps its own ESLint config
  appropriate to its framework.
- **Design fidelity:** all colors / spacing / type come from the design tokens in
  `_ai_context/Bday_design/uploads/Bday_DESIGN.md`. Sentence case everywhere.

---

## Where things are documented

| Doc | Purpose |
| --- | --- |
| `_ai_context/Bday_PRD.md`    | Functional requirements (`FR-#`) |
| `_ai_context/techstack.md`   | Stack, architecture, folder structure |
| `_ai_context/Bday_design/uploads/Bday_DESIGN.md` | Design system (`§#`) + tokens |
| `_ai_context/TODO.md`        | The full staged build plan (start here) |
