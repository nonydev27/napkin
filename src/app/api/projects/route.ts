import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type ProjectPayload = {
  title?: unknown;
  code?: unknown;
  width?: unknown;
  height?: unknown;
  share?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuthenticatedClient() {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured.", status: 503 } as const;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: "Sign in to save or export projects.", status: 401 } as const;
  }

  return { supabase, user: data.user } as const;
}

export async function GET() {
  const auth = await getAuthenticatedClient();
  if ("error" in auth) return errorResponse(auth.error, auth.status);

  const { data, error } = await auth.supabase
    .from("projects")
    .select("id, title, width, height, is_public, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Project history query failed:", error);
    return errorResponse("Could not load project history.", 500);
  }

  return NextResponse.json({ projects: data });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedClient();
  if ("error" in auth) return errorResponse(auth.error, auth.status);

  let payload: ProjectPayload;
  try {
    payload = (await request.json()) as ProjectPayload;
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const { title, code, width, height } = payload;
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 80 ||
    typeof code !== "string" ||
    !code.trim() ||
    code.length > 1_000_000 ||
    !Number.isInteger(width) ||
    !Number.isInteger(height)
  ) {
    return errorResponse("Project details are invalid or too large.", 400);
  }

  const { data, error } = await auth.supabase
    .from("projects")
    .insert({
      user_id: auth.user.id,
      title: title.trim(),
      code,
      width,
      height,
      is_public: payload.share === true,
    })
    .select("id, title, is_public, created_at")
    .single();

  if (error) {
    console.error("Project save failed:", error);
    return errorResponse("Could not save this project.", 500);
  }

  return NextResponse.json({ project: data }, { status: 201 });
}
