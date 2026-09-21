export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEAM_ID = "team_6ukeAMsNaWMRhHombsc7EIwn";
const PROJECT_ID = "prj_XSjxkxAinLDTqN6avq3zTF4Vx2sl";
const PROJECT_NAME = "v0-image-analysis-xy_gitless";
const MARKER = "nightgarden-20260921-final";
const SOURCE_URL = "https://raw.githubusercontent.com/lukketsvane/iverfinne.no/nightgarden-prod-20260921/.nightgarden-deploy/.vercel/output/static/index.html";

export async function GET() {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) return Response.json({ ok:false, stage:"auth", error:"missing_oidc" }, { status:500 });

  const headers = { Authorization: "Bearer " + token, "Content-Type":"application/json" };

  const list = await fetch(
    "https://api.vercel.com/v6/deployments?projectId=" + encodeURIComponent(PROJECT_ID) + "&teamId=" + encodeURIComponent(TEAM_ID) + "&limit=20",
    { headers, cache:"no-store" }
  );
  if (list.ok) {
    const listed:any = await list.json();
    const found = (listed.deployments || []).find((d:any) => d?.meta?.nightgardenDeploy === MARKER);
    if (found) return Response.json({ ok:true, stage:"already", id:found.uid || found.id, url:found.url, state:found.state || found.readyState });
  }

  const source = await fetch(SOURCE_URL, { cache:"no-store" });
  if (!source.ok) return Response.json({ ok:false, stage:"source", status:source.status }, { status:502 });
  const html = await source.text();

  const res = await fetch("https://api.vercel.com/v13/deployments?teamId=" + encodeURIComponent(TEAM_ID), {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: PROJECT_NAME,
      project: PROJECT_ID,
      target: "production",
      meta: { nightgardenDeploy: MARKER },
      files: [{ file:"index.html", data:html }],
      projectSettings: { framework:null }
    })
  });

  const body = await res.text();
  let result:any;
  try { result = JSON.parse(body); } catch { result = body.slice(0,2000); }
  console.log("nightgarden deploy bridge", JSON.stringify({ status:res.status, result }));
  return Response.json({ ok:res.ok, stage:"deploy", status:res.status, sourceBytes:html.length, result }, { status:res.ok?200:502 });
}
