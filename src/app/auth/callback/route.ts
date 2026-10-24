import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const destination = searchParams.get("next");
  const safeDestination =
    destination?.startsWith("/") && !destination.startsWith("//")
      ? destination
      : "/";

  if (!isSupabaseConfigured() || !code) {
    return NextResponse.redirect(new URL("/?auth=error", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/?auth=error", origin));
  }

  const response = NextResponse.redirect(new URL(safeDestination, origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
