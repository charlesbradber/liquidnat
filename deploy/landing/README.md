# cPanel landing-site deployment

Workflow: `.github/workflows/landing.yml`. Public URL: https://liquidnat.com/.

Destination: `/home/liquidnat/public_html/` on `master.mywebsitepanel.com`, as account `liquidnat`. The landing deploy receiver is installed root-owned at `/usr/local/sbin/liquidnat-landing-deploy`. A dedicated restricted SSH key permits only `deploy <40-character-sha>`, `rollback <sha>` or `status`; no interactive commands, forwarding, SCP or arbitrary remote paths. GitHub repository secrets are `LANDING_DEPLOY_KEY` and `LANDING_KNOWN_HOSTS`. Private material must never be committed.

The build contains static HTML, CSS, JS and SVG only. The package and receiver reject PHP, dotfiles, traversal, symlinks, unexpected paths, oversized releases and incorrect hashes. Each received release is retained outside the document root in `/home/liquidnat/landing-releases/<commit>/`. Writes replace individual files atomically. A multi-page deployment is not an atomic site-wide switch. No files or directories are deleted, including old landing assets. Existing demo, cPanel and ACME files are untouched.

The workflow runs receiver preservation/rejection tests, checks internal links and JavaScript syntax, then verifies all public HTML bytes, deployed commit and a successful HTTPS response from the demo subdomain. `deployment.json` is landing-only evidence in the main document root. It does not overwrite demo deployment evidence under the demo document root.

## Manual rollback (administrator SSH)

Select a full commit from `/home/liquidnat/landing-releases`, then run on the master server:

```sh
SSH_ORIGINAL_COMMAND='rollback FULL_40_CHARACTER_COMMIT' /usr/local/sbin/liquidnat-landing-deploy
```

The receiver drops privileges to `liquidnat`, validates the stored manifest and hashes, and restores that release's allowlisted files. It does not delete files introduced in later releases. The demo remains separate. To roll the code forward again, rerun the GitHub Actions workflow for `main`.

## Local validation

```sh
python3 landing_page/build.py
node --check landing_page/assets/site.js
python3 deploy/landing/test_receiver.py
python3 deploy/landing/verify.py
```

The acquisition announcement comes from the project owner. Contact uses the configurable `hello@liquidnat.com` mailto recipient; no form-delivery backend is installed by this deployment.
