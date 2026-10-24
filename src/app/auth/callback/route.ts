import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const destination = searchParams.get("next");
  let safeDestination = "/";
  if (destination) {
    const parsedDestination = new URL(destination, origin);
    if (parsedDestination.origin === origin) {
      safeDestination = `${parsedDestination.pathname}${parsedDestination.search}${parsedDestination.hash}`;
    }
  }

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
