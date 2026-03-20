# UI Updates Notes

## Build note
- Keep shared shell/admin files committed with the pages that import them.
- Missing files under `frontend/components/shell/` or `frontend/components/admin/useAdminPanel.ts` will make `npm run build` fail immediately because the App Router pages import them directly.
