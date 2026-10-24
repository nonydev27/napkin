import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ShareToggle } from "@/components/share-toggle";
import { ProjectDownloadButton } from "@/components/project-actions";
import { Brand } from "@/components/brand";
import { ThemeSwitch } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { makePreviewDocument } from "@/lib/sandbox";

type Project = {
  title: string;
  code: string;
  width: number;
  height: number;
  is_public: boolean;
  created_at: string;
};

export default function ProjectPage({
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
          <Link className="header-projects" href="/projects"><ArrowLeft size={14} /> All projects</Link>
        </div>
      </header>
      <Suspense fallback={<div className="not-found-panel">Opening your project…</div>}>
        <ProjectDetail params={params} />
      </Suspense>
    </main>
  );
}

async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) {
    return <div className="not-found-panel"><h1>This napkin isn’t available.</h1></div>;
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return (
      <div className="not-found-panel">
        <LockKeyhole size={22} />
        <h1>Sign in to see your projects.</h1>
        <Link className="button button-lime" href="/">Back to Napkin</Link>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .select("title, code, width, height, is_public, created_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) console.error("Project detail lookup failed:", error);
  if (!data) {
    return (
      <div className="not-found-panel">
        <h1>This napkin isn’t available.</h1>
        <p>Only you can see this saved project.</p>
        <Link className="button button-lime" href="/projects">Back to My Projects</Link>
      </div>
    );
  }

  const project = data as Project;
  return (
    <section className="share-canvas-wrap">
      <div className="share-canvas">
        <div className="project-detail-toolbar">
          <div>
            <span className="eyebrow"><LockKeyhole size={12} /> {project.is_public ? "SHARED LINK" : "PRIVATE PROJECT"}</span>
            <h1>{project.title}</h1>
          </div>
          <div className="project-detail-actions">
            <ShareToggle id={id} isPublic={project.is_public} />
            <ProjectDownloadButton code={project.code} title={project.title} />
          </div>
        </div>
        <iframe
          sandbox="allow-scripts"
          srcDoc={makePreviewDocument(project.code)}
          title={`${project.title} live preview`}
        />
        <div className="share-meta">
          <strong>{project.title}</strong>
          <span>{project.width} × {project.height} px · saved {new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </section>
  );
}
