# Contributing to SoundSphere

Thank you for your interest in contributing to SoundSphere.

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Install dependencies at the repository root:
   ```bash
   npm install
   ```
3. Run the verification suite before opening a pull request:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```

## Coding Standards

- Use strict TypeScript across `shared`, `server`, and `client`.
- Validate all incoming API payloads and environment variables with Zod.
- Keep secret keys (`JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) strictly inside `server/` and never expose them in `client/` or `VITE_*` variables.
- Follow the existing dark charcoal & emerald UI palette without adding unrequested dependencies or fabricated sample user data.
- Add unit or integration tests in `server/tests/` or `client/src/tests/` for new features and bug fixes.
