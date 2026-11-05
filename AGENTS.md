# Repository working instructions

- The owner's priority is the interactive web demo, alongside the underlying platform. Keep simulations labelled and do not replace the independently authored packet engine with an existing forwarding engine.
- The demo's deployment destination is **https://demo.liquidnat.com/** on SSH host **master.mywebsitepanel.com**, document root **/home/liquidnat/public_html/demo.liquidnat.com/**. Publish demo changes there through `.github/workflows/deploy-demo.yml`. Do not publish subsequent updates to the historical Sites preview unless the owner explicitly requests it.
- Keep deployment scoped to this demo. Preserve cPanel-generated configuration, `.well-known/acme-challenge`, other domains, and unrelated work in `landing_page/`.
- Test relevant changes on a feature branch and commit. Fast-forward the dedicated `demo` branch to tested feature commits to publish without merging `main`. Merge into `main` at the owner’s active-work checkpoints. Never force-push or stage unrelated files.
- Frontend: `cd management/web && npm ci && npm test && npm run build`. PHP simulator: `npm run build:api`, then from repository root `python3 tests/demo_api.py`. Deployment boundary: `python3 tests/demo_deployment.py`.
- The deploy workflow triggers only for demo frontend/deployment files on `main` or `demo`. Engine-only, landing-page-only, and ordinary documentation changes must not deploy the demo. No production secrets or private keys belong in Git or web output.
- See `docs/deployment.md` for the restricted deployment key, release verification, cPanel configuration and rollback procedure. The optional PHP simulator API remains a local development service; only static browser assets are published.

- During active development, keep work on feature branches and merge to main at roughly hourly checkpoints, or sooner for a substantial release-ready batch. Keep the demo current with completed changes.
