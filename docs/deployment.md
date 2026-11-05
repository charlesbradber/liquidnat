# Demo hosting — cPanel / WHM

The owner-selected live demo is **https://demo.liquidnat.com/**. SSH administration host: `master.mywebsitepanel.com`. Existing cPanel user: `liquidnat`. Document root: `/home/liquidnat/public_html/demo.liquidnat.com/`. This replaces the previous private Sites preview as the normal deployment destination; future GitHub deployments do not call Sites.

## Automatic deployment

`.github/workflows/deploy-demo.yml` runs only on pushes to `main` that change `management/web/**`, `deploy/demo/**`, or that deployment workflow. Engine, unrelated landing page and ordinary documentation changes do not trigger it. Pull requests never deploy. The separate demo test workflow is also filtered to demo/API/deployment inputs.

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
