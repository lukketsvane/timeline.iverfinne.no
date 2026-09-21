export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEAM_ID = "team_6ukeAMsNaWMRhHombsc7EIwn";
const PROJECT_ID = "prj_XSjxkxAinLDTqN6avq3zTF4Vx2sl";
const DOMAIN = "max.iverfinne.no";

export async function GET() {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    console.log("[max-domain] missing VERCEL_OIDC_TOKEN");
    return Response.json({ ok:false, stage:"auth", error:"missing_oidc" }, { status:500 });
  }

  const headers = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };

  const listUrl = "https://api.vercel.com/v9/projects/" + encodeURIComponent(PROJECT_ID) +
    "/domains?teamId=" + encodeURIComponent(TEAM_ID);

  const beforeRes = await fetch(listUrl, { headers, cache:"no-store" });
  const beforeText = await beforeRes.text();
  let before:any;
  try { before = JSON.parse(beforeText); } catch { before = beforeText.slice(0,1000); }

  const existing = Array.isArray(before?.domains)
    ? before.domains.find((d:any) => d?.name === DOMAIN)
    : null;

  if (existing) {
    const out = { ok:true, stage:"already", domain:DOMAIN, project:PROJECT_ID, existing };
    console.log("[max-domain]", JSON.stringify(out));
    return Response.json(out);
  }

  const addRes = await fetch(listUrl, {
    method:"POST",
    headers,
    body: JSON.stringify({ name: DOMAIN }),
  });
  const addText = await addRes.text();
  let added:any;
  try { added = JSON.parse(addText); } catch { added = addText.slice(0,2000); }

  const verifyRes = await fetch(listUrl, { headers, cache:"no-store" });
  const verifyText = await verifyRes.text();
  let verify:any;
  try { verify = JSON.parse(verifyText); } catch { verify = verifyText.slice(0,1000); }

  const verified = Array.isArray(verify?.domains) &&
    verify.domains.some((d:any) => d?.name === DOMAIN);

  const out = {
    ok: addRes.ok && verified,
    stage:"add",
    status:addRes.status,
    domain:DOMAIN,
    project:PROJECT_ID,
    added,
    verified,
  };
  console.log("[max-domain]", JSON.stringify(out));
  return Response.json(out, { status: out.ok ? 200 : 502 });
}
