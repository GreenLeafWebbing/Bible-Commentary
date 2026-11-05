import { NextResponse } from "next/server";
import { availableVersions, defaultVersionId } from "@/lib/youversion";

export const revalidate = 86400;

/** Public list of translations this site can show (ids and names only). */
export async function GET() {
  const [versions, defaultId] = await Promise.all([availableVersions(), defaultVersionId()]);
  return NextResponse.json({ defaultId, versions });
}
