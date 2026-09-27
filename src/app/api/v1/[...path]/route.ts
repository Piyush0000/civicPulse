import type { NextRequest } from "next/server";
import { boot } from "@/lib/boot";
import { dispatch } from "@/server/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  void boot(); // serverless platforms may skip instrumentation; make sure the demo world exists
  const { path } = await ctx.params;
  return dispatch(req, path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
