# Third-party and product-IP workstream

Engine and tests in this repository are independently authored for LiquidNAT. No existing BNG, NAT or forwarding engine was imported. DPDK supplies packet I/O and libraries, and is dynamically linked through pkg-config in the development profile.

Record the exact installed package inventory from every lab's `packages.tsv`; that inventory is evidence of packages installed, not a resolved redistribution licence inventory. DPDK, its PMDs, libpcap, compiler runtime, libc, and other transitive dependencies need component-level licence/provenance/notice and source-delivery review before appliance distribution. FreeRADIUS and FRR are planned integrations and are not currently bundled by this repository.

Outstanding: select product licence; inventory licences and modifications; identify linked/packaged boundaries; preserve copyright notices; assess source-delivery obligations; retain approved source/package snapshots; generate SPDX/CycloneDX SBOM; review trademarks and release naming; appoint IP/commercial reviewer. No signed appliance or distributable production image is provided by the foundations lab. CI actions are pinned to immutable upstream commit IDs; their hashes were checked with upstream git tag refs on 2026-11-05.
