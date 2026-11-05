# LiquidNAT PHP marketing website

The live site is https://liquidnat.com/ on the existing cPanel host, separate from the Manager demo.

## Build and preview

```sh
python3 landing_page/build.py
php -S 127.0.0.1:8080 -t landing_page/dist
```

PHP CLI is required for linting and verification. Eighteen real PHP entry points share server-rendered navigation, metadata and footer templates. Source pages are in `pages/*.php`, shared components in `shared/*.php`, styles and client interactions in `assets/`. The build copies them into ignored `dist/`, validates PHP syntax and adds content-derived cache versions to CSS/JS links. Change the contact recipient in `site.json`.

The expanded comparison includes a twelve-area matrix, category filters, a detailed netElastic comparison and a browser-local cost worksheet with CSV export. Costs are entirely visitor-entered; no prices or savings are assumed and no values are stored or transmitted. The contact form still prepares an email for the visitor to send, rather than providing server-side delivery.

Guides cover addressing/CGNAT, deployment, migration and sizing. Homepage, Manager and technical guides link to https://demo.liquidnat.com/. Fixture counts and graphs are identified as simulations; production BNG/CGNAT capability and capacity are not inferred from the UI.

netElastic product-family and selected package features were checked against https://netelastic.com/products and https://netelastic.com/products/packages/ on 5 November 2026. Recheck supplier details before future comparison edits. Acquisition copy comes from the owner.

## Check and deploy

```sh
python3 landing_page/build.py
node --check landing_page/assets/site.js
python3 deploy/landing/test_receiver.py
python3 deploy/landing/verify.py
```

`.github/workflows/landing.yml` builds and deploys qualifying site changes on `main` or the dedicated `landing` preview branch. Keep feature work separate and integrate main at active-work checkpoints. The receiver accepts only the named PHP entry points, two shared templates and allowlisted assets. It cannot publish arbitrary PHP paths, cPanel config, credentials or files under the demo subdomain.

See `../deploy/landing/README.md` for root-administered routing configuration, preservation and rollback details.
