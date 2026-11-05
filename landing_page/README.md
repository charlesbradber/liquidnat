# LiquidNAT marketing website

Local website for liquidnat.com. Independent from the existing Manager app. No packages or JavaScript build tools required.

## Build and preview

Inside Ubuntu:

```sh
cd /home/charlesbradbeer/projects/liquidnat/landing_page
python3 build.py
python3 -m http.server 8080 --directory dist --bind 127.0.0.1
```

Visit http://localhost:8080. Production deployment is handled by `.github/workflows/landing.yml` on pushes to `main` that change this site, the landing deployment code or its workflow. It can also be run manually from GitHub Actions on `main`.

The workflow builds and validates the static site, packages a hash-verified release and sends it over pinned-host SSH to a restricted receiver on `master.mywebsitepanel.com`. The fixed destination is `/home/liquidnat/public_html/`. Only allowlisted HTML files and `assets/` files are written; there is no directory sync or deletion. The existing `demo.liquidnat.com/`, `.well-known/`, cPanel `.htaccess`, `php.ini` and `.user.ini` are preserved.

See `../deploy/landing/README.md` for deployment and rollback details.

## Editing

- Shared navigation and acquisition strip: `shared/header.html`.
- Shared footer and closing call to action: `shared/footer.html`.
- Individual page content: `pages/*.html`. The first line is the page title, second is its search description, and remaining lines are HTML content.
- Shared responsive styles: `assets/site.css`.
- Menu, comparison filters and enquiry builder: `assets/site.js`.
- Contact recipient: `site.json`. `hello@liquidnat.com` is a configurable assumed mailbox; confirm it is provisioned before publishing.
- Run `python3 build.py` after edits. Generated HTML contains the shared components, so it works on static hosting with no JavaScript fetch needed for navigation.

## Content and behaviour

13 separate pages cover Home, Platform, Gateway, RADIUS, Manager, Solutions/migration, Comparisons, netElastic comparison, Resources/FAQ, About, Acquisition news, Contact and Privacy. A 404 fallback is also generated.

The acquisition statement is supplied by the project owner. Product architecture and evaluation content are based on `../goal.md` and `../README.md`. The public copy avoids development-status banners, invented capacities, fabricated customers, unsupported production guarantees and unverified feature-parity claims. The Manager illustration is labelled as illustrative.

Competitor family names were checked against https://netelastic.com/products on 5 November 2026. Recheck dated competitor content before a future release. The comparison is a purchasing guide, not an assertion of identical shipping features.

The contact form validates input and opens a prefilled email. It does not send or store an enquiry. A copyable fallback is provided. Connect a real endpoint if server delivery is required. No analytics, external fonts, cookies, browser storage or third-party script dependencies are included. Review hosting-specific privacy arrangements when deploying.
