# Demo hosting — cPanel / WHM

The owner-selected live demo is **https://demo.liquidnat.com/**. SSH administration host: `master.mywebsitepanel.com`. Existing cPanel user: `liquidnat`. Document root: `/home/liquidnat/public_html/demo.liquidnat.com/`. This replaces the previous private Sites preview as the normal deployment destination; future GitHub deployments do not call Sites.

## Automatic deployment

`.github/workflows/deploy-demo.yml` runs only on pushes to `main` or the dedicated `demo` branch that change `management/web/**`, `deploy/demo/**`, or that deployment workflow. Engine, unrelated landing page and ordinary documentation changes do not trigger it. Pull requests never deploy. The separate demo test workflow is also filtered to demo/API/deployment inputs.

The `demo` branch is the live preview track: after local checks pass, fast-forward it to a reviewed feature commit and push. This publishes the same tested source without merging into `main`. Keep merges into `main` at roughly hourly checkpoints during active development, or sooner for a substantial release-ready batch, as requested by the owner. Do not force-push either branch. If `demo` has diverged, inspect and integrate that work on the feature branch before advancing it. Engine-only or documentation-only pushes on either branch still do not deploy. A later qualifying `main` push also publishes, so integrate the current preview before releasing a different main change.

The build job has no deployment credentials. It installs the locked frontend dependencies using Node 22, runs model/DOM interaction tests, builds the static app, checks the archive boundary, and creates a deterministic release archive tagged with the source SHA. Only index.html, explicitly allowed browser assets, and an internal hash manifest enter the archive. PHP, `.env`, dotfiles, source files and the Cloudflare-only `_headers` file are excluded or rejected.

The separate deployment job downloads that run's artifact, uses the encrypted repository secret **DEMO_DEPLOY_SSH_KEY**, and connects to **liquidnat@master.mywebsitepanel.com**. `deploy/demo/known_hosts` pins the server's Ed25519 key, obtained over the existing verified administrative SSH connection. Host checking is mandatory; do not use `StrictHostKeyChecking=no` or blindly replace this pin from an unauthenticated scan. All third-party Actions are pinned to upstream commit IDs. Deployments are serialized and not cancelled midway.

The private key was generated on the SSH server, streamed directly into the encrypted GitHub secret, and never printed, committed or copied into the web root. The CI key's authorized_keys entry has `restrict` and a fixed forced command. It cannot obtain a shell, SCP/rsync files, forward ports or run arbitrary commands. The cPanel account's existing general login settings and unrelated keys are unchanged.

## Receiver and cPanel configuration

The root-owned executable `/usr/local/sbin/liquidnat-demo-deploy` is installed from `deploy/demo/receiver.py`. It accepts only `deploy <full-sha>`, `rollback <full-sha>`, and `status`, runs with the liquidnat account's UID/GID, and checks the fixed document/release roots. It validates archive size, types, names, every file hash and the source SHA. Links, traversal, PHP, dotfiles, arbitrary paths, missing assets and conflicting hashed assets reject before the index changes.

Releases and manifests are retained outside public_html in `/home/liquidnat/demo-releases/<sha>/` (private 0700 parent). Assets are installed first; publishing the new index uses one atomic rename. Existing hashed assets remain available for open browser tabs and rollback. No automatic recursive cleanup is performed; inspect disk usage and retain the required rollback releases before any deliberate cleanup. `/deployment.json` records the deployed SHA, time and simulation flag.

The cPanel-generated sections of `.htaccess`, php.ini, .user.ini, and AutoSSL challenge directory are preserved. A separate marked block from `deploy/demo/apache.conf` disables directory listings/CGI, redirects HTTP to HTTPS except ACME challenges, denies PHP/INI access, sets the demo's CSP and other headers, prevents HTML/metadata caching and enables immutable hashed-asset caching. A copy of the original `.htaccess` is retained in `/root/liquidnat-demo-ci-bootstrap/original.htaccess`.

The receiver and Apache block are root-administered bootstrap configuration; the CI key cannot rewrite them. To change these server-side controls, use the operator's existing administrative SSH access and install the reviewed repository versions. Then test before publishing. Do not broaden the deployment key to a general shell as a workaround.

## Verification and rollback

Every deployment is followed by `deploy/demo/smoke.py`: it uses verified HTTPS, checks the live commit, hashes every deployed file against the exact release manifest, and validates cache/security headers. A green upload alone is not treated as a verified deployment. Initial deployment and restricted-command rejection were also tested directly over SSH.

From an administrator SSH session, the equivalent receiver operations are:

```sh
sudo -u liquidnat env SSH_ORIGINAL_COMMAND=status /usr/local/sbin/liquidnat-demo-deploy
sudo -u liquidnat env SSH_ORIGINAL_COMMAND='rollback FULL_40_CHARACTER_SHA' /usr/local/sbin/liquidnat-demo-deploy
```

Choose an actual retained SHA from the release manifests; never interpolate an untrusted path. Rollback verifies retained file hashes and republishes the old static index. It does not change subscriber state in browsers or run appliance/database migrations. Verify `/deployment.json` and the expected artifact over HTTPS afterwards.

For CI-key rotation, generate a new dedicated Ed25519 key on the admin host, append a restricted forced-command public-key entry for liquidnat, replace only `DEMO_DEPLOY_SSH_KEY` through stdin, verify a deployment, then remove the superseded dedicated public key. Keep production/root administrative keys separate. No key material belongs in documentation.

Only the browser simulator is public. The PHP/SQLite/Node simulator API is not deployed, and no real gateway, RADIUS endpoint, SSH console or packet engine is exposed by the demo.

## Verified installation — 2026-11-05

Initial cPanel deployment was checked directly over HTTPS, including every HTML/JS/CSS hash, HTTP-to-HTTPS redirect and cache/security headers. An arbitrary `id` command through the dedicated CI key was rejected by the receiver. The original cPanel directives and AutoSSL directory remained present.

The first automatic deployment completed successfully from source **5a6841fd97c5d48d0327a81f99225db824b59522**: [build, restricted SSH publish, and live HTTPS verification](https://github.com/charlesbradber/liquidnat/actions/runs/42030904129). The demo/API and Gateway workflows also passed for that commit. `/deployment.json` reported that exact SHA. The temporary private-key copy on the SSH server was removed after this successful CI run; the encrypted repository secret remains available for future deployments.

A separate integration worktree at `/home/charlesbradbeer/projects/liquidnat-demo-integration` was used to merge concurrent marketing-site work. The original checkout's unrelated untracked landing-page files were preserved.
