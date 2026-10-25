import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type ProjectPayload = {
  id?: unknown;
  title?: unknown;
  code?: unknown;
  width?: unknown;
  height?: unknown;
  share?: unknown;
};

type AuthenticatedClient =
  | { supabase: SupabaseClient; user: User }
  | { error: string; status: number };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isDimension(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

async function getAuthenticatedClient(): Promise<AuthenticatedClient> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured.", status: 503 };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: "Sign in to save or export projects.", status: 401 };
  }

  return { supabase, user: data.user };
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedClient();
  if ("error" in auth) return errorResponse(auth.error, auth.status);

  const projectId = new URL(request.url).searchParams.get("id");
  if (projectId) {
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
      return errorResponse("Project ID is invalid.", 400);
    }

    const { data, error } = await auth.supabase
      .from("projects")
      .select("id, title, code, width, height, is_public")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) {
      console.error("Project load failed:", error);
      return errorResponse("Could not load this project.", 500);
    }
    if (!data) return errorResponse("Project not found or you don’t have access.", 404);

    return NextResponse.json({ project: data });
  }

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

  const { id, title, code, width, height } = payload;
  const shareOnly = payload.share !== undefined &&
    id !== undefined &&
    title === undefined && code === undefined && width === undefined && height === undefined;

  if (
    (id !== undefined && (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) ||
    (payload.share !== undefined && typeof payload.share !== "boolean") ||
    (shareOnly ? false : (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 80 ||
      typeof code !== "string" ||
      !code.trim() ||
      code.length > 1_000_000 ||
      !isDimension(width, 240, 2400) ||
      !isDimension(height, 320, 2400)
    ))
  ) {
    return errorResponse("Project details are invalid or too large.", 400);
  }

  const values: Record<string, unknown> = {};
  if (shareOnly) {
    values.is_public = payload.share === true;
  } else {
    Object.assign(values, {
      title: (title as string).trim(),
      code,
      width,
      height,
    });
    if (payload.share !== undefined) {
      values.is_public = payload.share === true;
    }
  }
  const query = id
    ? auth.supabase.from("projects").update(values).eq("id", id)
    : auth.supabase.from("projects").insert({ ...values, user_id: auth.user.id });
  const { data, error } = await query
    .select("id, title, is_public, created_at")
    .single();

  if (error) {
    console.error("Project save failed:", error);
    return errorResponse("Could not save this project.", 500);
  }

  return NextResponse.json({ project: data }, { status: 201 });
}
