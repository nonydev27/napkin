import { ArrowLeft, ArrowRight, ArrowUpRight, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { ThemeSwitch } from "@/components/theme-provider";
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

const PAGE_SIZE = 6;

export default function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <main className="projects-page">
      <header className="projects-header">
        <Brand />
        <div className="projects-header-actions">
          <ThemeSwitch />
          <Link className="header-projects" href="/">Back to the canvas <ArrowLeft size={14} /></Link>
        </div>
      </header>
      <Suspense fallback={<div className="projects-main projects-lede">Loading your projects…</div>}>
        <ProjectHistory searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProjectHistory({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const pageValue = typeof params.page === "string" ? Number(params.page) : 1;
  const requestedPage = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;

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

  const countResult = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  if (countResult.error) {
    console.error("Project history count failed:", countResult.error);
    return (
      <section className="projects-main">
        <span className="eyebrow">YOUR PRIVATE STUDIO</span>
        <h1>We couldn’t load your projects.</h1>
        <p className="projects-lede">Check that the projects database migration has been applied, then try again.</p>
      </section>
    );
  }

  const totalProjects = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const result = await supabase
    .from("projects")
    .select("id, title, width, height, is_public, created_at")
    .order("created_at", { ascending: false })
    .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

  if (result.error) {
    console.error("Project history query failed:", result.error);
    return (
      <section className="projects-main">
        <span className="eyebrow">YOUR PRIVATE STUDIO</span>
        <h1>We couldn’t load your projects.</h1>
        <p className="projects-lede">Check that the projects database migration has been applied, then try again.</p>
      </section>
    );
  }

  const projects = (result.data || []) as Project[];
  const firstVisibleProject = totalProjects ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastVisibleProject = Math.min(currentPage * PAGE_SIZE, totalProjects);
  const firstVisiblePage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 4);
  const visiblePages = Array.from(
    { length: lastVisiblePage - firstVisiblePage + 1 },
    (_, index) => firstVisiblePage + index,
  );

  return (
    <section className="projects-main">
      <span className="eyebrow"><span className="eyebrow-star">✳</span> YOUR PRIVATE STUDIO</span>
      <h1>Your ideas,<br />taking shape.</h1>
      <p className="projects-lede">
        A little home for everything you’ve made{authData.user.email ? `, ${authData.user.email}` : ""}.
      </p>
      {projects.length ? (
        <>
          <div className="projects-list-heading">
            <span>YOUR CANVAS, IN GOOD COMPANY</span>
            <span>SHOWING {firstVisibleProject}–{lastVisibleProject} OF {totalProjects}</span>
          </div>
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
                  <Link href={`/projects/${project.id}`}>View project <ArrowUpRight size={12} /></Link>
                </div>
              </article>
            ))}
          </div>
          {totalPages > 1 && (
            <nav aria-label="Project pages" className="project-pagination">
              {currentPage > 1 ? (
                <Link aria-label="Previous page" className="pagination-arrow" href={`/projects?page=${currentPage - 1}`}>
                  <ArrowLeft size={14} /> <span>Previous</span>
                </Link>
              ) : (
                <span aria-disabled="true" className="pagination-arrow is-disabled">
                  <ArrowLeft size={14} /> <span>Previous</span>
                </span>
              )}
              <div className="pagination-pages">
                {firstVisiblePage > 1 && (
                  <>
                    <Link className="pagination-page" href="/projects?page=1">1</Link>
                    {firstVisiblePage > 2 && <span aria-hidden="true" className="pagination-ellipsis">…</span>}
                  </>
                )}
                {visiblePages.map((page) => (
                  <Link
                    aria-current={page === currentPage ? "page" : undefined}
                    aria-label={`Go to page ${page}`}
                    className={page === currentPage ? "pagination-page is-current" : "pagination-page"}
                    href={`/projects?page=${page}`}
                    key={page}
                  >
                    {page}
                  </Link>
                ))}
                {lastVisiblePage < totalPages && (
                  <>
                    {lastVisiblePage < totalPages - 1 && <span aria-hidden="true" className="pagination-ellipsis">…</span>}
                    <Link className="pagination-page" href={`/projects?page=${totalPages}`}>{totalPages}</Link>
                  </>
                )}
              </div>
              {currentPage < totalPages ? (
                <Link aria-label="Next page" className="pagination-arrow" href={`/projects?page=${currentPage + 1}`}>
                  <span>Next</span> <ArrowRight size={14} />
                </Link>
              ) : (
                <span aria-disabled="true" className="pagination-arrow is-disabled">
                  <span>Next</span> <ArrowRight size={14} />
                </span>
              )}
            </nav>
          )}
        </>
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
