/**
 * /api/context — Neptune Chat self-context endpoint.
 *
 * Returns the agent's identity, repo, Vercel project, capabilities,
 * and sibling agent info. Used by cross-agent awareness.
 */
import { NextResponse } from "next/server";
import { getSelfContext } from "@/lib/ai/tools/self-code";

export async function GET() {
  const context = getSelfContext();

  return NextResponse.json(
    {
      ...context,
      siblingAgent: {
        name: "Neptune V2",
        url: "https://neptune-v2.vercel.app",
        repo: "github.com/abhiswami2121/neptune-v2",
        vercelProjectId: "prj_lEoqz6p4zgdrLlObPl845TI2ApOm",
        contextEndpoint: "https://neptune-v2.vercel.app/api/context",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
