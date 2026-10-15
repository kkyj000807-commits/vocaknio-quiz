import { describe, expect, it } from "vitest";
import { accessDeniedForAnonymous, verifyAccess } from "../scripts/verify-private-access.mjs";

describe("owner-only cloudflare Access smoke gate", () => {
  it("requires Access for every asset, not just the landing page", () => {
    expect(accessDeniedForAnonymous(403)).toBe(true);
    expect(accessDeniedForAnonymous(302, "https://team.cloudflareaccess.com/cdn-cgi/access/login")).toBe(true);
    expect(accessDeniedForAnonymous(200)).toBe(false);
    expect(accessDeniedForAnonymous(302, "https://example.com/login")).toBe(false);
  });
  it("blocks completion on a single anonymous downloadable asset", async () => {
    const fetcher = async url => ({
      status: url.pathname.endsWith(".json") ? 200 : 403,
      headers: { get: () => null }
    });
    const result = await verifyAccess("https://finetune-private.example.workers.dev", ["/vocaknio-quiz/", "/vocaknio-quiz/release.json"], fetcher);
    expect(result.status).toBe("FAIL_PUBLICLY_ACCESSIBLE_OR_UNVERIFIED");
  });
  it("accepts fully denied sample asset routes", async () => {
    const fetcher = async () => ({ status: 403, headers: { get: () => null } });
    const result = await verifyAccess("https://finetune-private.example.workers.dev", ["/vocaknio-quiz/", "/vocaknio-quiz/release.json"], fetcher);
    expect(result.status).toBe("PASS_ANONYMOUS_BLOCKED");
  });
});
