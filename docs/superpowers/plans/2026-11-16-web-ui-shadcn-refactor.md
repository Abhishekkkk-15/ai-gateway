# Web UI Modern Shadcn Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely refactor the AI Gateway web dashboard (`apps/web`) into a modern, responsive shadcn/ui interface featuring the `dashboard-01` collapsible sidebar shell, `login-04` split authentication card, Recharts telemetry visualizations, and dark/light theme switching.

**Architecture:** Initialize official shadcn configurations in `apps/web` with Zinc/Neutral dark-first semantic tokens. Introduce a `ThemeProvider` context for instant theme switching. Structure the app shell around `SidebarProvider` + `AppSidebar` and `SiteHeader`, integrating KPI metric cards, interactive charts, and rich data tables while maintaining all backend API connections.

**Tech Stack:** React 19, Vite, Tailwind CSS v3, shadcn/ui primitives, Lucide React, Recharts, @tanstack/react-query.

**Spec:** Modern UI refactor request based on `dashboard-01` and `login-04` blocks with complete dark/light theme support.

## Global Constraints
- Must run cleanly under React 19 and Vite with zero build or runtime errors.
- Adhere strictly to shadcn composition rules: use `flex` with `gap-*` (no `space-x-*` or `space-y-*`), `size-*` for equal dimensions, and semantic tokens (`bg-background`, `text-muted-foreground`, etc.).
- Maintain full parity with all existing gateway features: Providers, Models, Keys, Playground (with reasoning tokens), and Logs.
- Hot-path gateway server must continue serving the built dashboard statically at `http://localhost:3000/`.

## Review Focus
1. Theme persistence: Switching between Dark, Light, and System modes must persist in `localStorage` without FOUC (flash of unstyled content).
2. Layout responsiveness: The collapsible sidebar in `dashboard-01` must collapse neatly on mobile screens and expand cleanly on desktop.
3. Form usability: Provider configuration, custom OpenAI registration, and gateway key creation dialogs must validate inputs with clean validation feedback.
4. Interactive charts: Recharts telemetry area chart must resize responsively and handle empty log states gracefully.
5. Playground streaming: SSE chat completions must stream both reasoning content and final markdown tokens without breaking layout.

---

### Task 1: Theme System & Shadcn Configuration Setup

**Files:**
- Create: `apps/web/components.json`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/index.css`
- Create: `apps/web/src/context/ThemeContext.tsx`
- Create: `apps/web/src/components/ThemeToggle.tsx`
- Test: `apps/web/tests/theme.test.tsx`

**Steps:**
- [ ] Add necessary runtime dependencies to `apps/web` (`recharts`, `@tanstack/react-table`).
- [ ] Create `apps/web/components.json` with standard shadcn configuration (style: "new-york", rsc: false, base: "radix").
- [ ] Update `apps/web/src/index.css` with complete dark and light semantic color palettes (background, foreground, card, primary, secondary, muted, accent, destructive, border, input, ring, chart-1..5, sidebar-*).
- [ ] Implement `ThemeContext.tsx` with `'dark' | 'light' | 'system'` support and `localStorage` persistence.
- [ ] Implement `ThemeToggle.tsx` with Sun/Moon icon toggle.
- [ ] Write unit test in `apps/web/tests/theme.test.tsx` verifying theme switching.
- [ ] Run test and commit.

---

### Task 2: Core Shadcn UI Primitives & Sidebar Components

**Files:**
- Create/Update: `apps/web/src/components/ui/Sidebar.tsx`
- Create: `apps/web/src/components/ui/Chart.tsx`
- Create: `apps/web/src/components/ui/Separator.tsx`
- Create: `apps/web/src/components/ui/DropdownMenu.tsx`
- Update: `apps/web/src/components/ui/Button.tsx`
- Update: `apps/web/src/components/ui/Card.tsx`
- Update: `apps/web/src/components/ui/Badge.tsx`
- Update: `apps/web/src/components/ui/Input.tsx`
- Update: `apps/web/src/components/ui/Dialog.tsx`
- Test: `apps/web/tests/primitives.test.tsx`

**Steps:**
- [ ] Implement `Sidebar.tsx` supporting `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarTrigger`, `SidebarInset`.
- [ ] Implement `Chart.tsx` (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent` wrapping Recharts).
- [ ] Implement `Separator.tsx` and accessible `DropdownMenu.tsx`.
- [ ] Ensure all components follow shadcn styling rules (no `space-x-*`/`space-y-*`, semantic classes).
- [ ] Write smoke tests in `apps/web/tests/primitives.test.tsx` verifying render.
- [ ] Run tests and commit.

---

### Task 3: Dual-Column Login Screen (`login-04`)

**Files:**
- Modify: `apps/web/src/pages/LoginPage.tsx`
- Test: `apps/web/tests/login-page.test.tsx`

**Steps:**
- [ ] Refactor `LoginPage.tsx` to the `login-04` split layout:
  - Left column: AI Gateway branding, "Welcome back", single admin credentials form with error alerts and loading button.
  - Right column: High-tech AI Gateway graphic panel with architectural badges ("OpenAI SDK Compatible", "Zero-DB Hot Path", "AES-256 Encryption").
- [ ] Include theme toggle in the login header.
- [ ] Write test verifying login form submission and error handling.
- [ ] Run tests and commit.

---

### Task 4: Dashboard Shell (`dashboard-01`) & Real-Time Overview Page

**Files:**
- Create: `apps/web/src/components/layout/AppSidebar.tsx`
- Create: `apps/web/src/components/layout/SiteHeader.tsx`
- Create: `apps/web/src/pages/OverviewPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/tests/dashboard-layout.test.tsx`

**Steps:**
- [ ] Implement `AppSidebar.tsx` with navigation routes (Overview, Providers, Models, Keys, Playground, Logs), active state indicators, gateway status dot, and user profile footer.
- [ ] Implement `SiteHeader.tsx` with `SidebarTrigger`, route breadcrumb, live uptime indicator, and `ThemeToggle`.
- [ ] Implement `OverviewPage.tsx` with:
  - KPI Section cards (Total Requests, Loaded Models, Active Providers, Avg TTFT) with percentage/status badges.
  - Interactive Area Chart (`ChartAreaInteractive`) plotting latency/requests over time.
  - Quick recent activity table.
- [ ] Connect `App.tsx` to the new layout.
- [ ] Write test verifying layout navigation.
- [ ] Run tests and commit.

---

### Task 5: Refactor Feature Pages into Modern Design System

**Files:**
- Modify: `apps/web/src/pages/ProvidersPage.tsx`
- Modify: `apps/web/src/pages/ModelsPage.tsx`
- Modify: `apps/web/src/pages/KeysPage.tsx`
- Modify: `apps/web/src/pages/PlaygroundPage.tsx`
- Modify: `apps/web/src/pages/LogsPage.tsx`
- Test: `apps/web/tests/dashboard.test.tsx`

**Steps:**
- [ ] Refactor `ProvidersPage.tsx` with modern card layouts, status badges (`Active`, `Disabled`, `Not Configured`), model sync spinners, and Add Custom Provider dialog.
- [ ] Refactor `ModelsPage.tsx` with modern search bar, capability badges, alias modal, and availability toggle.
- [ ] Refactor `KeysPage.tsx` with key generation dialog, SDK integration code blocks (Python/Node.js), and revocation controls.
- [ ] Refactor `PlaygroundPage.tsx` with multi-model select, parameter controls, reasoning stream viewer, TTS audio player, and STT uploader.
- [ ] Refactor `LogsPage.tsx` with filterable data table and status code badges.
- [ ] Verify test suite passes.
- [ ] Commit changes.

---

### Task 6: Verification, Production Build & Live Server Restart

**Files:**
- Verify: `apps/web/dist`
- Verify: Gateway server on port 3000

**Steps:**
- [ ] Run `pnpm --filter @ai-gateway/web build` to verify production Vite bundle compiles without warnings.
- [ ] Run complete monorepo test suite (`pnpm test`).
- [ ] Rebuild and restart gateway server daemon (`node --env-file=.env apps/gateway/dist/index.js`).
- [ ] Verify `http://localhost:3000/` serves the refactored dark/light shadcn dashboard.
- [ ] Commit all remaining changes.
