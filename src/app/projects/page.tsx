import { ArrowLeft, ArrowUpRight, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Project = {
  id: string;
  title: string;
  width: number;
  height: number;
  is_public: boolean;
  created_at: string;
};

export default function ProjectsPage() {
  return (
    <main className="projects-page">
      <header className="projects-header">
        <Brand />
        <Link className="header-projects" href="/">Back to the canvas <ArrowLeft size={14} /></Link>
      </header>
      <Suspense fallback={<div className="projects-main projects-lede">Loading your projects…</div>}>
        <ProjectHistory />
      </Suspense>
    </main>
  );
}

async function ProjectHistory() {
  if (!isSupabaseConfigured()) {
    return (
      <section className="projects-main">
        <span className="eyebrow"><LockKeyhole size={13} /> YOUR PRIVATE STUDIO</span>
        <h1>Projects, saved.</h1>
        <p className="projects-lede">Connect Supabase to turn on your private project history.</p>
        <Link className="button button-lime" href="/">Back to Napkin <ArrowUpRight size={15} /></Link>
      </section>
    );
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return (
      <section className="projects-main">
        <span className="eyebrow"><LockKeyhole size={13} /> PRIVATE BY DEFAULT</span>
        <h1>Your ideas<br />are yours.</h1>
        <p className="projects-lede">Sign in from the canvas to see your saved work.</p>
        <Link className="button button-lime" href="/">Go to Napkin <ArrowUpRight size={15} /></Link>
      </section>
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, title, width, height, is_public, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Project history query failed:", error);
    return (
      <section className="projects-main">
        <span className="eyebrow">YOUR PRIVATE STUDIO</span>
        <h1>We couldn’t load your projects.</h1>
        <p className="projects-lede">Check that the projects database migration has been applied, then try again.</p>
      </section>
    );
  }

  const projects = (data || []) as Project[];
  return (
    <section className="projects-main">
      <span className="eyebrow"><span className="eyebrow-star">✳</span> YOUR PRIVATE STUDIO</span>
      <h1>Your ideas,<br />taking shape.</h1>
      <p className="projects-lede">
        A little home for everything you’ve made{authData.user.email ? `, ${authData.user.email}` : ""}.
      </p>
      {projects.length ? (
        <div className="project-grid">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div>
                <span className="project-card-icon"><Sparkles size={15} /></span>
                <h2>{project.title}</h2>
                <p>{project.width} × {project.height} px</p>
              </div>
              <div className="project-card-footer">
                <span>{new Date(project.created_at).toLocaleDateString()}</span>
                {project.is_public ? (
                  <Link href={`/share/${project.id}`}>Open share link <ArrowUpRight size={12} /></Link>
                ) : (
                  <span>Private</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="project-empty">
          <Sparkles aria-hidden="true" size={24} />
          <h2>Nothing on the napkin yet.</h2>
          <p>Your first sketch can become your first saved project.</p>
          <Link className="button button-lime" href="/">Start with a sketch <ArrowUpRight size={14} /></Link>
        </div>
      )}
    </section>
  );
}
