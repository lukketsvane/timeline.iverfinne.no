export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEAM_ID = "team_6ukeAMsNaWMRhHombsc7EIwn";
const PROJECT_ID = "prj_XSjxkxAinLDTqN6avq3zTF4Vx2sl";
const PROJECT_NAME = "v0-image-analysis-xy_gitless";
const SOURCE_URL = "https://raw.githubusercontent.com/lukketsvane/iverfinne.no/nightgarden-prod-20260921/.nightgarden-deploy/.vercel/output/static/index.html";

export async function GET() {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) return Response.json({ ok:false, stage:"auth", error:"missing_oidc" }, { status:500 });

  const source = await fetch(SOURCE_URL, { cache:"no-store" });
  if (!source.ok) return Response.json({ ok:false, stage:"source", status:source.status }, { status:502 });
  const html = await source.text();

  const res = await fetch("https://api.vercel.com/v13/deployments?teamId=" + TEAM_ID, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type":"application/json" },
    body: JSON.stringify({
      name: PROJECT_NAME,
      project: PROJECT_ID,
      target: "production",
      files: [{ file:"index.html", data:html }],
      projectSettings: { framework:null }
    })
  });

  const body = await res.text();
  let result:any;
  try { result = JSON.parse(body); } catch { result = body.slice(0,2000); }
  return Response.json({ ok:res.ok, status:res.status, sourceBytes:html.length, result }, { status:res.ok?200:502 });
}
