const TEAM_ID = "team_6ukeAMsNaWMRhHombsc7EIwn";
const PROJECT_ID = "prj_XSjxkxAinLDTqN6avq3zTF4Vx2sl";
const PROJECT_NAME = "v0-image-analysis-xy_gitless";
const SOURCE_URL = "https://raw.githubusercontent.com/lukketsvane/iverfinne.no/nightgarden-prod-20260921/.nightgarden-deploy/.vercel/output/static/index.html";

async function main() {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    console.log("[nightgarden] VERCEL_OIDC_TOKEN unavailable during build; skipping.");
    return;
  }

  const source = await fetch(SOURCE_URL);
  if (!source.ok) {
    console.log("[nightgarden] source fetch failed", source.status);
    return;
  }
  const html = await source.text();

  const res = await fetch("https://api.vercel.com/v13/deployments?teamId=" + encodeURIComponent(TEAM_ID), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: PROJECT_NAME,
      project: PROJECT_ID,
      target: "production",
      meta: { nightgardenDeploy: "nightgarden-build-20260921" },
      files: [{ file: "index.html", data: html }],
      projectSettings: { framework: null }
    })
  });
  const body = await res.text();
  console.log("[nightgarden] deploy response", res.status, body.slice(0, 800));
}

main().catch(err => console.log("[nightgarden] deploy error", String(err)));
