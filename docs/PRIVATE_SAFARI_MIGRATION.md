# FINETUNE private Safari deployment — migration runbook

## Goal and current safety status

Use the same FINETUNE app in iPhone Safari, but require an owner-only sign-in **before** any HTML, JavaScript, JSON or audio asset is served. Cloudflare Workers Static Assets + **Worker-level Cloudflare Access (ALL traffic, production AND previews)** is the intended host. The deployment configuration starts with `workers_dev: false` and has **no public route**. The current GitHub Pages URL remains public until explicitly disabled; this branch alone does not protect existing Pages or the public Git repository.

**Do not** use an in-app password overlay, obscured URL, `robots.txt`, or simple client-side auth. Do not upload learning backups to GitHub, static assets, analytics, or other shared services.

## Phase 1 — preserve existing Safari records

1. In the original iPhone Safari, open the existing FINETUNE Settings → **학습 기록 백업·복원** → **백업 파일 다운로드**.
2. Confirm the JSON backup actually appears in the iPhone Files/Downloads folder. Keep an independent copy in a private location; never push it to GitHub.
3. If the app reports unreadable records, preserve the original Safari origin and its storage; do not clear Safari site data. A partial backup is not a verified migration.
4. Record an approximate pre-migration count for wrong words, bookmarks, MASTER and history, to compare after import.

**Important:** Safari localStorage/IndexedDB is origin-scoped. A new `workers.dev` hostname cannot automatically read the old `github.io` study history. This requires exporting from the old origin and importing into the new one.

## Phase 2 — prepare a clean nonpublic Workers deployment

1. Work from the current validated FINETUNE candidate source, not stale `main`. Preserve existing dirty user files, learning IDs and quiz keys.
2. Produce a clean release using the existing project's Production builder and its full audit, in a fresh directory. The generated `release.json` must have `sourceDirty: false`.
3. Run `node scripts/prepare-private-deploy.mjs <verified-production-export-folder>`. This verifies the existing audit and copies exactly the audited static output under `output/finetune-private-deploy/vocaknio-quiz/`, keeping the existing Expo `/vocaknio-quiz/` asset paths valid. Output is ignored by Git.
4. Confirm `wrangler.private.jsonc` still has `workers_dev: false` and **no route/custom domain**. Authenticate to your own Cloudflare account and stage the Worker with `npx wrangler deploy --config wrangler.private.jsonc`. Do not enable the public route yet.
5. In Cloudflare, enable Zero Trust if needed. Workers & Pages → `finetune-private` → Access → **Protect this Worker behind Access** → **All traffic** (production + previews). Allow only the actual owner's Cloudflare account or **one exact verified email address**. Do not choose everyone, an entire email domain, bypass, or previews-only.
6. In Access application settings verify that no more-specific hostname/path rule bypasses the Worker-level policy. Then enable the Worker's `workers.dev` URL and redeploy the same audited assets. A private access policy must exist **before** enabling any reachable route.
7. New site path: `https://finetune-private.<your-cloudflare-subdomain>.workers.dev/vocaknio-quiz/`. Set Safari bookmark or Add to Home Screen only after private access is verified. Never hardcode your address, owner email, Access tokens or backup data in source control.

## Phase 3 — acceptance tests before cutting off Pages

Run these checks from an unauthenticated/private-browser session as well as authenticated Safari:

- **Unauthenticated:** root HTML, `/vocaknio-quiz/release.json`, JS/CSS, `/vocaknio-quiz/data/vocab-definitions/oewn-2025/v101.json`, study JSON, and at least one deep route must all require sign-in or be denied. A direct asset URL must not return anonymous HTTP 200 with content.
- **Authorized:** iPhone Safari login succeeds. Open home, wordbook, quiz, wrong book and statistics. Test full quiz→grade→review flow, scroll/safe-area and reload.
- **Data migration:** Settings → 학습 기록 백업·복원 → choose the saved JSON → inspect preview → restore only if there are no conflicts. Refresh and compare counts, MASTER status, wrong words, quiz sessions and statistics. Do not reset or merge conflicting records blindly.
- **Asset/version:** `release.json`, the deployed JS hash and learning dictionaries are consistent. The old base path `/vocaknio-quiz/` resolves for static assets and navigation. Check that no Cloudflare auth page was accidentally cached as quiz data.

## Phase 4 — close old public paths

Only after Phase 3 passes and the owner verifies continued Safari access:

1. Disable the existing GitHub Pages site. It cannot become owner-only merely by adding a login modal. Stop publishing new private material to `gh-pages`.
2. Change the GitHub repository visibility to **Private** using repository settings with the owner's explicit authorization. Existing public Git history, external clones and public distribution may persist; a visibility change does not erase them.
3. Review other publicly accessible hosts, routes, previews, artifacts and forks. Cloudflare Access protection of the **new** Worker does not protect the **old** GitHub Pages website.
4. Preserve a known-good private release and a secure learner backup. Adjust only the old-host-specific app links and automation after the private replacement is verified.

## Rollback and blockers

- Until migration is verified, do not shut off the old origin or clear any browser data.
- If an Access policy cannot be configured, do not expose the new Worker. Leave `workers_dev: false` and stop.
- This change **does not** configure the Cloudflare account, Access allowlist or live deployment on your behalf. Those actions require the owner's connected hosting account and exact allowed identity.
- Do not confuse `wrangler deploy` exit 0 with private access verified. Test unauthorized asset requests before claiming security success.
- The content previously published on GitHub Pages is already exposed; this process prevents future easy anonymous access after cutover but cannot revoke old downloads.
- Backend sign-in/sync endpoints are separate and are NOT made secure by protecting a static frontend alone. Verify or disable unused auth/sync affordances as appropriate.

References: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ ; https://developers.cloudflare.com/workers/static-assets/ ; https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/
