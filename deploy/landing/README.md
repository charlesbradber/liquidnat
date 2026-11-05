# cPanel landing-site deployment

Workflow: `.github/workflows/landing.yml`. Public URL: https://liquidnat.com/.

Destination: `/home/liquidnat/public_html/` on `master.mywebsitepanel.com`, as account `liquidnat`. The landing deploy receiver is installed root-owned at `/usr/local/sbin/liquidnat-landing-deploy`. A dedicated restricted SSH key permits only `deploy <40-character-sha>`, `rollback <sha>` or `status`; no interactive commands, forwarding, SCP or arbitrary remote paths. GitHub repository secrets are `LANDING_DEPLOY_KEY` and `LANDING_KNOWN_HOSTS`. Private material must never be committed.

The build contains eighteen named PHP entry points, `includes/header.php`, `includes/footer.php`, CSS, JS and SVG. The package and receiver reject arbitrary PHP filenames, dotfiles, traversal, symlinks, unexpected paths, oversized releases and incorrect hashes. Each received release is retained outside the document root in `/home/liquidnat/landing-releases/<commit>/`. Writes replace individual files atomically. A multi-page deployment is not an atomic site-wide switch. No files or directories are deleted, including old landing assets. Existing demo, cPanel and ACME files are untouched.

The workflow runs receiver preservation/rejection tests, checks internal links and JavaScript syntax, then verifies all public PHP-rendered bytes and assets, deployed commit and a successful HTTPS response from the demo subdomain. `deployment.json` is landing-only evidence in the main document root. It does not overwrite demo deployment evidence under the demo document root.

## Manual rollback (administrator SSH)

Select a full commit from `/home/liquidnat/landing-releases`, then run on the master server:

```sh
SSH_ORIGINAL_COMMAND='rollback FULL_40_CHARACTER_COMMIT' /usr/local/sbin/liquidnat-landing-deploy
```

The receiver drops privileges to `liquidnat`, validates the stored manifest and hashes, and restores that release's allowlisted files. It does not delete files introduced in later releases. The demo remains separate. To roll the code forward again, rerun the GitHub Actions workflow for `main` or `landing`.

## Local validation

```sh
python3 landing_page/build.py
node --check landing_page/assets/site.js
python3 deploy/landing/test_receiver.py
python3 deploy/landing/verify.py
```

The acquisition announcement comes from the project owner. Contact uses the configurable `hello@liquidnat.com` mailto recipient; no form-delivery backend is installed by this deployment.

## PHP migration and routing

`apache.conf` is a root-administered marked block appended to the existing cPanel `.htaccess`, preserving all generated handlers and PHP settings. It prioritises index.php, redirects named legacy .html pages to .php on liquidnat.com/www only, and denies direct access to shared includes. The demo host has its own DirectoryIndex and its routing is preserved. Old HTML files remain on disk for recovery but are not the public navigation targets.

The receiver was upgraded through the existing administrative SSH connection; the deployment key remains restricted. Only the eighteen named pages and two templates are executable deployment targets. PHP input is repository-authored; no request parameters are evaluated or used to choose an include. Page metadata is escaped. No database, upload endpoint or server-side contact processing was added.

New PHP releases can be rolled back using the existing retained-release operation. Pre-migration HTML archives remain retained but are deliberately rejected by the PHP receiver. Restoring that historical site requires an administrator to restore the prior receiver and routing block together, not a CI-key workaround. Backups are retained under `/root/liquidnat-landing-receiver-before-php.py` and `/root/liquidnat-landing-htaccess-before-php`.

Local verification executes every page with PHP CLI, checks links and anchors, and lints templates. Live verification compares rendered bytes and assets, checks the PHP index, legacy redirects and denied template access, verifies deployment metadata, and confirms the demo still responds.
