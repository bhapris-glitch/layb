# Layboka Platform Monorepo

Welcome to the **Layboka** merchant workspace repository. This monorepo powers the full-stack Shopify management platform, featuring a Next.js frontend, an Express API backend, and a Shopify app extension.

---

## 📁 Repository Structure

```text
layboka-monorepo/
├── apps/
│   ├── api/          # Express.js REST API server
│   ├── shopify/      # Shopify App Extension integration
│   └── web/          # Next.js 15 frontend application (Tailwind CSS, Lucide Icons)
├── turbo.json        # Turborepo build pipeline configuration
├── pnpm-workspace.yaml # pnpm workspace setup
└── package.json      # Root dependencies & workspace scripts

