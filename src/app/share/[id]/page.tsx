import { ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { ThemeSwitch } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { makePreviewDocument } from "@/lib/sandbox";

type SharedProject = {
  title: string;
  code: string;
  width: number;
  height: number;
  is_public: boolean;
};

export default function SharedProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="share-page">
      <header className="share-topbar">
        <Brand />
        <div className="projects-header-actions">
          <ThemeSwitch />
          <Link className="button button-lime" href="/">Make your own <ArrowUpRight size={14} /></Link>
        </div>
      </header>
      <Suspense fallback={<div className="not-found-panel">Opening this napkin…</div>}>
        <SharedProjectView params={params} />
      </Suspense>
      <footer className="footer-bottom" style={{ padding: "15px 28px" }}>
        <span>MADE WITH NAPKIN AI · OPEN SOURCE</span>
        <span>DEVELOPED BY FELIX &amp; NONYDEV</span>
      </footer>
    </main>
  );
}

async function SharedProjectView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) {
    return <div className="not-found-panel"><h1>This link is a little lost.</h1><p>That shared napkin isn’t available.</p></div>;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("title, code, width, height, is_public")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();

  if (error) console.error("Shared project lookup failed:", error);
  if (!data) {
    return <div className="not-found-panel"><h1>This link is a little lost.</h1><p>That shared napkin isn’t available.</p></div>;
  }

  const project = data as SharedProject;
  const preview = makePreviewDocument(project.code);

  return (
    <section className="share-canvas-wrap">
      <div className="share-canvas">
        <iframe sandbox="allow-scripts" srcDoc={preview} title={`${project.title} live preview`} />
        <div className="share-meta">
          <strong><Sparkles size={13} /> {project.title}</strong>
          <span>{project.width} × {project.height} px</span>
        </div>
      </div>
    </section>
  );
}
