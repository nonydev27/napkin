"use client";

import dynamic from "next/dynamic";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Copy,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Monitor,
  MousePointer2,
  PanelTop,
  PenLine,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  Upload,
  WandSparkles,
  X,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { makePreviewDocument } from "@/lib/sandbox";
import { Brand, GitHubMark } from "@/components/brand";
import { ThemeSwitch, useTheme } from "@/components/theme-provider";
import { AuthModal } from "@/components/auth-modal";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const CodeEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type CanvasPreset = "mobile" | "tablet" | "desktop" | "custom";
type WorkspaceAction = "download" | "share" | "assets" | "save";
type CanvasSize = { width: number; height: number };

const PRESETS: Record<Exclude<CanvasPreset, "custom">, CanvasSize> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 960 },
};

const TOUR_STEPS = [
  {
    title: "Drop in your napkin",
    description: "Upload a photo of any sketch. Rough lines, coffee stains and all.",
    target: "upload-zone",
  },
  {
    title: "Pick your canvas",
    description: "Choose a device size or set the exact dimensions for your idea.",
    target: "canvas-settings",
  },
  {
    title: "Make it real",
    description: "Generate a responsive UI, then tweak the code and preview side by side.",
    target: "generate-button",
  },
];

function MagneticButton({
  children,
  className = "",
  ...props
}: React.ComponentProps<typeof motion.button>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 18 });
  const springY = useSpring(y, { stiffness: 280, damping: 18 });
  const { onMouseMove, onMouseLeave, style, ...buttonProps } = props;

  return (
    <motion.button
      className={className}
      onMouseLeave={(event) => {
        x.set(0);
        y.set(0);
        onMouseLeave?.(event);
      }}
      onMouseMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - bounds.left - bounds.width / 2) * 0.12);
        y.set((event.clientY - bounds.top - bounds.height / 2) * 0.12);
        onMouseMove?.(event);
      }}
      style={{ ...style, x: springX, y: springY }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      {...buttonProps}
    >
      {children}
    </motion.button>
  );
}

function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
      transition={{ delay, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ amount: 0.18, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

export function NapkinApp() {
  const workspaceRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const undoStack = useRef<ImageData[]>([]);
  const drawingRevision = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const glowY = useTransform(scrollY, [0, 850], [0, 220]);
  const glowRotate = useTransform(scrollY, [0, 900], [-8, 16]);
  const { theme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<WorkspaceAction | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [preset, setPreset] = useState<CanvasPreset>("desktop");
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(PRESETS.desktop);
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sketchMode, setSketchMode] = useState<"upload" | "draw">("upload");
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const oauthResume = useRef(false);
  const resumeOAuthAction = useRef<(action: WorkspaceAction, currentCode: string) => void>(() => {});

  const generated = code.length > 0;
  const aspectRatio = useMemo(
    () => canvasSize.width / canvasSize.height,
    [canvasSize.height, canvasSize.width],
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user: currentUser } }) => setUser(currentUser));
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewCode(code), 120);
    return () => window.clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const alreadySeen = window.localStorage.getItem("napkin-tour-seen");
    if (alreadySeen) return;
    const timer = window.setTimeout(() => setTourStep(-1), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (tourStep === null || tourStep < 0) return;
    const target = document.querySelector<HTMLElement>(
      `[data-tour="${TOUR_STEPS[tourStep].target}"]`,
    );
    if (!target) return;
    target.classList.add("tour-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => target.classList.remove("tour-highlight");
  }, [tourStep]);

  useEffect(() => {
    const action = window.sessionStorage.getItem("napkin-auth-action") as WorkspaceAction | null;
    const savedCode = window.sessionStorage.getItem("napkin-auth-code");
    if (
      action &&
      ["download", "share", "assets", "save"].includes(action) &&
      savedCode
    ) {
      oauthResume.current = true;
      const timer = window.setTimeout(() => {
        setPendingAction(action);
        setCode(savedCode);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  function finishTour() {
    window.localStorage.setItem("napkin-tour-seen", "true");
    setTourStep(null);
  }

  function setImage(nextFile?: File) {
    setError("");
    setMessage("");
    if (!nextFile) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(nextFile.type)) {
      setError("That file type isn’t supported. Try a PNG, JPG or WebP.");
      return;
    }
    if (nextFile.size > 8 * 1024 * 1024) {
      setError("Your sketch needs to be smaller than 8 MB.");
      return;
    }
    setFile(nextFile);
    setImagePreview(URL.createObjectURL(nextFile));
    setMessage("");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSketchMode("upload");
    setImage(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    setImage(event.dataTransfer.files[0]);
  }

  function drawingPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    undoStack.current.push(context.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > 30) undoStack.current.shift();
    const point = drawingPoint(event);

    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.strokeStyle = "#202119";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    canvas.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    setHasDrawing(true);
    setError("");
  }

  function continueDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = drawingPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function finishDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = event.currentTarget;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    const revision = ++drawingRevision.current;
    canvas.toBlob((blob) => {
      if (revision !== drawingRevision.current) return;
      if (!blob || blob.size > 8 * 1024 * 1024) {
        setError("Could not prepare that sketch. Try drawing a smaller, simpler version.");
        return;
      }
      setImage(new File([blob], "my-napkin-sketch.png", { type: "image/png" }));
    }, "image/png");
  }

  function undoDrawing() {
    const canvas = drawingCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || undoStack.current.length === 0) return;
    const previous = undoStack.current.pop();
    if (!previous) return;
    context.putImageData(previous, 0, 0);
    const stillHasDrawing = undoStack.current.length > 0;
    setHasDrawing(stillHasDrawing);
    if (!stillHasDrawing) {
      drawingRevision.current += 1;
      setFile(null);
      setImagePreview("");
      return;
    }
    const revision = ++drawingRevision.current;
    canvas.toBlob((blob) => {
      if (blob && revision === drawingRevision.current) {
        setImage(new File([blob], "my-napkin-sketch.png", { type: "image/png" }));
      }
    }, "image/png");
  }

  function clearDrawing() {
    const canvas = drawingCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    drawingRevision.current += 1;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    undoStack.current = [];
    setHasDrawing(false);
    setFile(null);
    setImagePreview("");
    setError("");
    setMessage("");
  }

  function selectPreset(nextPreset: CanvasPreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") setCanvasSize(PRESETS[nextPreset]);
  }

  async function generate() {
    if (!file && !prompt.trim()) {
      setError("Start by uploading a sketch, drawing one, or describing your idea below.");
      if (sketchMode === "draw") drawingCanvasRef.current?.focus();
      else fileInputRef.current?.focus();
      return;
    }
    setError("");
    setMessage("");
    setIsGenerating(true);

    try {
      const formData = new FormData();
      if (file) formData.set("image", file);
      formData.set("prompt", prompt);
      formData.set("width", String(canvasSize.width));
      formData.set("height", String(canvasSize.height));
      const response = await fetch("/api/generate", { method: "POST", body: formData });
      const result = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !result.code) {
        throw new Error(result.error || "We couldn’t generate that design.");
      }
      setCode(result.code);
      setProjectId(null);
      setMessage("Your idea just became a starting point. Make it yours.");
      if (user) void saveProject(result.code, false, user, null);
      if (window.innerWidth < 760) setShowPreview(true);
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveProject(
    currentCode = code,
    share = false,
    authenticatedUser = user,
    currentProjectId = projectId,
  ) {
    if (!authenticatedUser) {
      const action = share ? "share" : "save";
      window.sessionStorage.setItem("napkin-auth-action", action);
      window.sessionStorage.setItem("napkin-auth-code", currentCode);
      setPendingAction(action);
      setAuthOpen(true);
      return;
    }
    if (!currentCode) return;

    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentProjectId,
          title: file?.name.replace(/\.[^.]+$/, "") || "Untitled napkin",
          code: currentCode,
          width: canvasSize.width,
          height: canvasSize.height,
          share,
        }),
      });
      const result = (await response.json()) as {
        project?: { id: string; is_public: boolean };
        error?: string;
      };
      if (!response.ok || !result.project) {
        throw new Error(result.error || "Could not save your project.");
      }
      setProjectId(result.project.id);
      if (share) {
        const shareUrl = `${window.location.origin}/share/${result.project.id}`;
        try {
          await navigator.clipboard.writeText(shareUrl);
          setMessage("Share link copied — your design is ready to send.");
        } catch {
          setMessage(`Your share link: ${shareUrl}`);
        }
      } else {
        setMessage("Saved to My Projects.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your project.");
    } finally {
      setIsSaving(false);
    }
  }

  function downloadCode() {
    if (!code) return;
    const blob = new Blob([code], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${file?.name.replace(/\.[^.]+$/, "") || "napkin-ui"}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Your HTML is ready to make its way into the world.");
  }

  function exportAssets() {
    downloadCode();
    if (file) {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Exported your HTML and original sketch.");
    }
  }

  function requestAction(action: WorkspaceAction) {
    if (!code) {
      setError("Generate a design first, then you can export or share it.");
      return;
    }
    if (!user) {
      window.sessionStorage.setItem("napkin-auth-action", action);
      window.sessionStorage.setItem("napkin-auth-code", code);
      setPendingAction(action);
      setAuthOpen(true);
      return;
    }
    if (action === "share") {
      void saveProject(code, true);
    } else if (action === "download") {
      downloadCode();
    } else {
      exportAssets();
    }
  }

  function onAuthenticated(nextUser: User) {
    setUser(nextUser);
    setAuthOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    window.sessionStorage.removeItem("napkin-auth-action");
    window.sessionStorage.removeItem("napkin-auth-code");
    if (action === "share") {
      void saveProject(code, true, nextUser);
    } else if (action === "download") {
      downloadCode();
      void saveProject(code, false, nextUser);
    } else if (action === "assets") {
      exportAssets();
      void saveProject(code, false, nextUser);
    } else if (action === "save") {
      void saveProject(code, false, nextUser);
    } else if (code) {
      void saveProject(code, false, nextUser);
    }
  }

  useEffect(() => {
    resumeOAuthAction.current = (action, currentCode) => {
      if (action === "share") void saveProject(currentCode, true);
      else if (action === "save") void saveProject(currentCode);
      else if (action === "assets") exportAssets();
      else downloadCode();
    };
  });

  useEffect(() => {
    if (!user || !oauthResume.current || !pendingAction || !code) return;
    oauthResume.current = false;
    window.sessionStorage.removeItem("napkin-auth-action");
    window.sessionStorage.removeItem("napkin-auth-code");
    resumeOAuthAction.current(pendingAction, code);
    window.setTimeout(() => setPendingAction(null), 0);
  }, [user, pendingAction, code]);

  async function signOut() {
    if (!isSupabaseConfigured()) return;
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) setError(signOutError.message);
    else {
      setUser(null);
      setProjectId(null);
      setMessage("Signed out. Your saved projects are still here when you return.");
    }
  }

  function scrollToWorkspace() {
    workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const previewSrcDoc = (previewCode || code)
    ? makePreviewDocument(previewCode || code)
    : "";

  return (
    <main className="site-shell" id="top">
      <motion.div aria-hidden="true" className="scroll-progress" style={{ scaleX: scrollYProgress }} />
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav aria-label="Main navigation" className={mobileMenuOpen ? "main-nav nav-open" : "main-nav"}>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#workspace" onClick={() => setMobileMenuOpen(false)}>The workspace</a>
            <a href="https://github.com/nonydev27/napkin" rel="noreferrer" target="_blank">Open source <ExternalLink size={13} /></a>
          </nav>
          <div className="header-actions">
            <ThemeSwitch />
            {user ? (
              <>
                <Link className="header-projects" href="/projects">My Projects</Link>
                <button className="user-pill" onClick={signOut} title="Sign out">
                  <span className="user-avatar">{(user.email?.[0] || "n").toUpperCase()}</span>
                  <span className="user-email">{user.email}</span>
                  <ChevronDown size={14} />
                </button>
              </>
            ) : (
              <button className="header-login" onClick={() => setAuthOpen(true)}>Sign in</button>
            )}
            <MagneticButton className="button button-primary header-cta" onClick={scrollToWorkspace}>
              Start creating <ArrowUpRight size={15} />
            </MagneticButton>
            <button
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <section className="hero-section">
        <motion.div
          aria-hidden="true"
          className="hero-glow"
          style={{ y: glowY, rotate: glowRotate }}
        />
        <div className="hero-grid" />
        <div className="hero-copy">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="hero-kicker"
            initial={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.1 }}
          >
            <span className="live-dot" />
            OPEN SOURCE · MADE FOR THE “WHAT IF?”
          </motion.div>
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 22 }}
            transition={{ delay: 0.16, duration: 0.65 }}
          >
            From napkin
            <br />
            <span className="hero-highlight">to <span className="scribble-word">real.</span></span>
          </motion.h1>
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="hero-description"
            initial={{ opacity: 0, y: 16 }}
            transition={{ delay: 0.25, duration: 0.55 }}
          >
            Sketch the thing you can’t stop thinking about. We’ll turn it into a UI you can
            actually build — code, canvas and all.
          </motion.p>
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="hero-actions"
            initial={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.34 }}
          >
            <MagneticButton className="button button-lime hero-button" onClick={scrollToWorkspace}>
              <WandSparkles size={17} /> Bring your sketch to life <ArrowRight size={16} />
            </MagneticButton>
            <a className="hero-text-link" href="#how-it-works">
              See how it works <ArrowDown size={14} />
            </a>
          </motion.div>
          <motion.div
            animate={{ opacity: 1 }}
            className="hero-proof"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.55 }}
          >
            <span className="avatar-stack" aria-hidden="true">
              <i>F</i><i>N</i><i>✳</i>
            </span>
            <span><strong>Developed by Felix &amp; Nonydev</strong><br />A little sketch goes a long way.</span>
            <span className="proof-divider" />
            <a href="https://github.com/nonydev27/napkin" rel="noreferrer" target="_blank"><GitHubMark size={15} /> MIT licensed</a>
          </motion.div>
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0, rotate: 1.4 }}
          className="hero-art"
          initial={{ opacity: 0, y: 28, rotate: 5 }}
          transition={{ delay: 0.22, duration: 0.75, type: "spring", stiffness: 90 }}
        >
          <div aria-hidden="true" className="art-orbit orbit-one" />
          <div aria-hidden="true" className="art-orbit orbit-two" />
          <div className="sketch-card">
            <div className="sketch-meta"><span><span className="live-dot" /> IDEA IN PROGRESS</span><span>01 / 03</span></div>
            <div className="sketch-paper">
              <div className="paper-top"><span className="paper-logo">good day</span><span className="paper-menu"><i /><i /><i /></span></div>
              <div className="paper-hero">
                <span className="hand-label">a little sunshine ☼</span>
                <div className="hand-title">Make today<br />feel <u>lighter.</u></div>
                <span className="hand-subtitle">Good things, sent softly.</span>
                <div className="hand-button">Find your happy <span>↗</span></div>
              </div>
              <div className="paper-bottom"><span>☼</span><span>Thoughtful things for thoughtful people.</span><span>↘</span></div>
              <span className="sketch-sticker">a napkin<br />no. 041</span>
            </div>
            <div className="art-caption"><span>✳</span><span>raw idea</span><span className="caption-dash" /><span>ready to build</span><span>↗</span></div>
          </div>
          <motion.div
            animate={{ y: [0, -7, 0], rotate: [0, -2, 0] }}
            className="floating-chip ai-chip"
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="chip-icon"><Sparkles size={15} /></span><span>Gemma made<br /><strong>the first draft</strong></span>
          </motion.div>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            className="floating-chip code-chip"
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Code2 size={16} /><span>Not a mockup.<br /><strong>Real HTML.</strong></span>
          </motion.div>
          <div className="hero-spark spark-one">✳</div><div className="hero-spark spark-two">✴</div>
        </motion.div>

        <div className="hero-footer">
          <span>IDEAS DON’T WAIT FOR PERMISSION.</span>
          <a href="#workspace">MAKE YOUR FIRST DRAFT <ArrowDown size={13} /></a>
        </div>
      </section>

      <section className="how-section section-wrap" id="how-it-works">
        <ScrollReveal className="section-heading">
          <span className="eyebrow"><span className="eyebrow-star">✳</span> YOUR IDEA, UNSTUCK</span>
          <h2>A sketch is a<br /><span>very good start.</span></h2>
          <p>No design degree. No blank canvas panic. Just you, a doodle, and a little bit of “what if”.</p>
        </ScrollReveal>
        <div className="steps-grid">
          {[
            { number: "01", icon: <Upload size={19} />, title: "Drop the napkin", copy: "A photo, screenshot or chaotic little sketch. If you can see the idea, we can work with it.", tag: "PNG · JPG · WEBP" },
            { number: "02", icon: <PanelTop size={19} />, title: "Pick your canvas", copy: "Phone, tablet, desktop, or the exact dimensions your idea has been asking for.", tag: "YOUR VIEW, YOUR RULES" },
            { number: "03", icon: <WandSparkles size={19} />, title: "Make it yours", copy: "Get real HTML back. Tweak it live, then save it, share it or take it into your editor.", tag: "YOURS TO KEEP" },
          ].map((step, index) => (
            <motion.article
              className="step-card"
              initial={{ opacity: 0, y: 24 }}
              key={step.number}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: index * 0.11, duration: 0.5 }}
              whileHover={{ y: -6, rotate: index === 1 ? 0 : index === 0 ? -0.7 : 0.7 }}
            >
              <span className="step-number">{step.number}</span>
              <span className="step-icon">{step.icon}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              <span className="step-tag">{step.tag}</span>
            </motion.article>
          ))}
        </div>
        <ScrollReveal className="belief-strip" delay={0.1}>
          <span>✳</span> Not a pixel-perfect promise. A way to get from “I have an idea” to “I can work with this.”
          <span className="belief-accent">That’s the magic.</span>
        </ScrollReveal>
      </section>

      <section className="workspace-section" id="workspace" ref={workspaceRef}>
        <ScrollReveal className="workspace-intro section-wrap">
          <div>
            <span className="eyebrow"><span className="eyebrow-star">✳</span> THE NAPKIN WORKSPACE</span>
            <h2>Okay, let’s <span>make a thing.</span></h2>
          </div>
          <div className="workspace-intro-right">
            <span className="workspace-status"><i /> YOUR CANVAS IS READY</span>
            <button className="tour-link" onClick={() => setTourStep(-1)}><CircleHelp size={15} /> Take the quick tour</button>
          </div>
        </ScrollReveal>

        <ScrollReveal className="workspace-frame section-wrap" delay={0.08}>
          <div className="workspace-topbar">
            <div className="window-dots"><i /><i /><i /></div>
            <div className="workspace-file"><span className="file-dot" />{file?.name || "untitled-napkin"}<span className="file-status">{generated ? "saved locally" : "draft"}</span></div>
            <div className="topbar-actions">
              {generated && (
                <>
                  <button className="topbar-action" disabled={isSaving} onClick={() => void saveProject()}><Check size={14} /> {isSaving ? "Saving…" : "Save"}</button>
                  <button className="topbar-action" onClick={() => requestAction("share")}><ExternalLink size={14} /> Share</button>
                  <button className="topbar-export" onClick={() => requestAction("download")}><ArrowDownToLine size={14} /> Export</button>
                </>
              )}
            </div>
          </div>

          <div className={generated ? "workspace-content is-generated" : "workspace-content"}>
            <aside className="workspace-sidebar">
              <div className="side-heading"><span>01</span> YOUR SKETCH</div>
              <div
                className={`sketch-maker ${isDragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
                data-tour="upload-zone"
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
              >
                <div aria-label="Choose how to add a sketch" className="sketch-mode-tabs" role="tablist">
                  <button
                    aria-selected={sketchMode === "upload"}
                    className={sketchMode === "upload" ? "sketch-mode-tab active" : "sketch-mode-tab"}
                    onClick={() => setSketchMode("upload")}
                    role="tab"
                    type="button"
                  >
                    <ImagePlus size={13} /> Upload
                  </button>
                  <button
                    aria-selected={sketchMode === "draw"}
                    className={sketchMode === "draw" ? "sketch-mode-tab active" : "sketch-mode-tab"}
                    onClick={() => setSketchMode("draw")}
                    role="tab"
                    type="button"
                  >
                    <PenLine size={13} /> Draw here
                  </button>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={onFileChange}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
                {sketchMode === "upload" ? (
                  imagePreview ? (
                    <div className="upload-zone has-file">
                      <div className="upload-preview">
                        <Image
                          alt="Your sketch, ready for generation"
                          className="sketch-image"
                          height={150}
                          src={imagePreview}
                          unoptimized
                          width={260}
                        />
                        <button className="replace-sketch" onClick={() => fileInputRef.current?.click()} type="button">
                          <PenLine size={13} /> Choose another
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`upload-zone ${isDragging ? "is-dragging" : ""}`}>
                      <button className="upload-trigger" onClick={() => fileInputRef.current?.click()} type="button">
                        <span className="upload-icon"><ImagePlus size={19} /></span>
                        <strong>Choose a photo of your sketch</strong>
                        <span>or <u>drop an image here</u></span>
                        <small>PNG, JPG or WebP · max 8 MB</small>
                      </button>
                    </div>
                  )
                ) : (
                  <div className="drawing-pad">
                    <div className="drawing-toolbar">
                      <span><span className={hasDrawing ? "drawing-status ready" : "drawing-status"} />{hasDrawing ? "Sketch ready" : "Draw your idea"}</span>
                      <div>
                        <button aria-label="Undo last stroke" disabled={!hasDrawing} onClick={undoDrawing} type="button"><Undo2 size={14} /> Undo</button>
                        <button aria-label="Clear sketch" disabled={!hasDrawing} onClick={clearDrawing} type="button"><Trash2 size={13} /> Clear</button>
                      </div>
                    </div>
                    <canvas
                      aria-label="Sketch canvas. Draw with your mouse, finger, or stylus."
                      className="drawing-canvas"
                      height={380}
                      onPointerCancel={finishDrawing}
                      onPointerDown={startDrawing}
                      onPointerMove={continueDrawing}
                      onPointerUp={finishDrawing}
                      ref={drawingCanvasRef}
                      role="img"
                      tabIndex={0}
                      width={640}
                    />
                    <p className="drawing-hint">Mouse, finger or stylus · rough is perfect</p>
                  </div>
                )}
              </div>
              {file && <p className="file-caption"><Check size={13} /> {sketchMode === "draw" ? "Your drawing is ready to generate" : file.name}</p>}

              <div className="settings-divider" />
              <div className="side-heading" data-tour="canvas-settings"><span>02</span> MAKE IT FIT</div>
              <p className="settings-caption">Pick a size. Change it whenever.</p>
              <div className="preset-grid">
                {([
                  ["mobile", <Smartphone key="mobile-icon" size={16} />, "Phone"],
                  ["tablet", <Tablet key="tablet-icon" size={16} />, "Tablet"],
                  ["desktop", <Monitor key="desktop-icon" size={16} />, "Desktop"],
                  ["custom", <MousePointer2 key="custom-icon" size={16} />, "Custom"],
                ] as const).map(([value, icon, label]) => (
                  <button
                    aria-pressed={preset === value}
                    className={`preset-button ${preset === value ? "selected" : ""}`}
                    key={value}
                    onClick={() => selectPreset(value)}
                    type="button"
                  >
                    {icon}<span>{label}</span>
                  </button>
                ))}
              </div>
              <AnimatePresence initial={false}>
                {preset === "custom" && (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    className="custom-dimensions"
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                  >
                    <label>Width <input max={2400} min={240} onChange={(event) => setCanvasSize({ ...canvasSize, width: Number(event.target.value) || 240 })} type="number" value={canvasSize.width} /></label>
                    <span>×</span>
                    <label>Height <input max={2400} min={320} onChange={(event) => setCanvasSize({ ...canvasSize, height: Number(event.target.value) || 320 })} type="number" value={canvasSize.height} /></label>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="dimension-preview"><span>CANVAS</span><strong>{canvasSize.width} × {canvasSize.height}<small> px</small></strong></div>

              <div className="prompt-field">
                <label htmlFor="design-direction">
                  {file ? "A little extra direction" : "Describe your idea"}
                  <span>{file ? "OPTIONAL" : "NO SKETCH? NO PROBLEM"}</span>
                </label>
                <textarea
                  id="design-direction"
                  maxLength={1200}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={file
                    ? "“Warm, editorial, with a hint of citrus…”"
                    : "“A cozy coffee shop website with a menu and a map…”"}
                  rows={3}
                  value={prompt}
                />
              </div>
              {!file && !prompt.trim() && (
                <p className="generation-hint">Upload a sketch, draw above, or describe your idea to begin.</p>
              )}
              <MagneticButton
                className="button button-lime generate-button"
                data-tour="generate-button"
                disabled={isGenerating || (!file && !prompt.trim())}
                onClick={() => void generate()}
              >
                {isGenerating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
                {isGenerating
                  ? "Making your first draft…"
                  : generated
                    ? "Generate a new draft"
                    : file
                      ? "Turn your sketch into a UI"
                      : prompt.trim()
                        ? "Create UI from my idea"
                        : "Add an idea to get started"}
                {!isGenerating && <ArrowRight size={16} />}
              </MagneticButton>
              <p className="privacy-note"><LockKeyhole size={12} /> Your sketch is processed securely and not stored by Napkin.</p>
            </aside>

            <section aria-label="Preview and generated code" className="editor-area">
              {generated ? (
                <>
                  <div className="editor-toolbar">
                    <div className="editor-tabs">
                      <button className={showPreview ? "editor-tab active" : "editor-tab"} onClick={() => setShowPreview(true)}><PanelTop size={14} /> Preview</button>
                      <button className={!showPreview ? "editor-tab active" : "editor-tab"} onClick={() => setShowPreview(false)}><Code2 size={14} /> index.html</button>
                    </div>
                    <div className="editor-actions">
                      <span><i /> LIVE</span>
                      <button aria-label="Copy code" className="icon-button" onClick={() => void navigator.clipboard.writeText(code).then(() => setMessage("Code copied to your clipboard."))}><Copy size={14} /></button>
                    </div>
                  </div>
                  <div className="editor-panels">
                    <div className={`preview-panel ${showPreview ? "panel-visible" : "panel-hidden"}`}>
                      <div className="preview-canvas" style={{ aspectRatio }}>
                        <iframe
                          sandbox="allow-scripts"
                          srcDoc={previewSrcDoc}
                          title="Generated UI live preview"
                        />
                      </div>
                      <div className="preview-meta"><span><span className="preview-live-dot" /> LIVE PREVIEW</span><span>{canvasSize.width} × {canvasSize.height}</span></div>
                    </div>
                    <div className={`code-panel ${showPreview ? "panel-hidden" : "panel-visible"}`}>
                      <div className="code-title"><span className="html-icon">&lt;/&gt;</span> index.html <span className="code-language">HTML</span></div>
                      <CodeEditor
                        defaultLanguage="html"
                        height="100%"
                        onChange={(value) => setCode(value || "")}
                        options={{
                          automaticLayout: true,
                          fontSize: 13,
                          fontFamily: "var(--font-app-mono), monospace",
                          minimap: { enabled: false },
                          padding: { top: 18 },
                          scrollBeyondLastLine: false,
                          wordWrap: "on",
                          lineNumbersMinChars: 3,
                          scrollbar: { verticalScrollbarSize: 8 },
                          tabSize: 2,
                        }}
                        theme={theme === "light" ? "vs" : "vs-dark"}
                        value={code}
                      />
                    </div>
                  </div>
                  <div className="editor-footer"><span><span className="preview-live-dot" /> Your edits show up in the preview as you type.</span><button onClick={() => requestAction("assets")}><ArrowDownToLine size={13} /> Export assets</button></div>
                </>
              ) : (
                <div className="empty-editor">
                  <div className="empty-editor-grid" />
                  <div className="empty-editor-orb">✳</div>
                  <span className="empty-badge"><Code2 size={13} /> YOUR LIVE CANVAS</span>
                  <h3>Your idea goes<br /><span>here.</span></h3>
                  <p>Once you add a sketch, this space turns into your own little build studio.</p>
                  <div className="empty-preview-window">
                    <div className="empty-window-top"><i /><i /><i /><span>your-next-big-idea.html</span></div>
                    <div className="empty-window-content">
                      <span className="empty-line line-short" /><span className="empty-line line-long" /><span className="empty-line line-medium" />
                      <span className="empty-line line-button" />
                    </div>
                  </div>
                  <span className="empty-editor-caption"><Sparkles size={13} /> NO BLANK PAGE ENERGY</span>
                </div>
              )}
            </section>
          </div>

          {(error || message) && (
            <div aria-live="polite" className={error ? "workspace-alert alert-error" : "workspace-alert"}>
              <span>{error || message}</span>
              <button aria-label="Dismiss message" onClick={() => { setError(""); setMessage(""); }}><X size={14} /></button>
            </div>
          )}
        </ScrollReveal>
        <div className="workspace-footnote section-wrap"><span>✳</span> An idea is a beginning, not a final answer. This is yours to keep changing.</div>
      </section>

      <motion.section
        className="closer-section"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ amount: 0.2, once: true }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <div className="closer-star">✳</div>
        <span className="eyebrow">GOOD IDEAS AREN’T SUPPOSED TO STAY ON NAPKINS</span>
        <h2>What are you<br /><span>waiting to make?</span></h2>
        <MagneticButton className="button button-lime" onClick={scrollToWorkspace}><WandSparkles size={17} /> Start with a sketch <ArrowRight size={16} /></MagneticButton>
        <div className="closer-doodle">✳ <span>made by you</span> ↗</div>
      </motion.section>

      <footer className="site-footer">
        <ScrollReveal className="footer-callout">
          <div>
            <span className="footer-callout-kicker"><Sparkles size={13} /> YOUR NEXT IDEA IS ALREADY WAITING</span>
            <p>One sketch is all it takes to get going.</p>
          </div>
          <MagneticButton className="button button-lime" onClick={scrollToWorkspace}>
            Make something <ArrowUpRight size={15} />
          </MagneticButton>
        </ScrollReveal>
        <div className="footer-top">
          <Brand />
          <p>Ideas deserve to get out of your notes app.</p>
          <div className="footer-links">
            <a href="https://github.com/nonydev27/napkin" rel="noreferrer" target="_blank"><GitHubMark size={15} /> GitHub</a>
            <a href="#how-it-works">How it works</a>
            {user && <Link href="/projects">My Projects</Link>}
            {user && <button onClick={signOut}>Sign out</button>}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 NAPKIN · DEVELOPED BY FELIX &amp; NONYDEV</span>
          <span>MADE FOR THE “WHAT IF?”</span>
          <a href="#top">BACK TO TOP <ArrowUpRight size={11} /></a>
        </div>
      </footer>

      <AnimatePresence>
        {tourStep !== null && (
          <motion.div
            animate={{ opacity: 1 }}
            className="tour-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <motion.div
              aria-labelledby="tour-heading"
              aria-modal="true"
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="tour-card"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              key={tourStep}
              onKeyDown={(event) => {
                if (event.key === "Escape") finishTour();
              }}
              role="dialog"
            >
              <button aria-label="Close tour" className="icon-button tour-close" onClick={finishTour}><X size={16} /></button>
              <span className="tour-label"><Sparkles size={13} /> THE 10-SECOND TOUR</span>
              {tourStep < 0 ? (
                <>
                  <h3 id="tour-heading">First time here?</h3>
                  <p>Let’s make something out of that sketch you’ve been carrying around.</p>
                </>
              ) : (
                <>
                  <span className="tour-count">0{tourStep + 1} / 03</span>
                  <h3 id="tour-heading">{TOUR_STEPS[tourStep].title}</h3>
                  <p>{TOUR_STEPS[tourStep].description}</p>
                </>
              )}
              <div className="tour-actions">
                <button className="tour-skip" onClick={finishTour}>Skip tour</button>
                <button
                  className="button button-lime"
                  onClick={() => {
                    if (tourStep < 0) {
                      scrollToWorkspace();
                      setTourStep(0);
                    }
                    else if (tourStep === TOUR_STEPS.length - 1) finishTour();
                    else setTourStep(tourStep + 1);
                  }}
                >
                  {tourStep === TOUR_STEPS.length - 1 ? "Let’s go" : "Next"} <ArrowRight size={14} />
                </button>
              </div>
              <div aria-hidden="true" className="tour-progress"><i style={{ width: `${tourStep < 0 ? 8 : ((tourStep + 1) / TOUR_STEPS.length) * 100}%` }} /></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        onAuthenticated={onAuthenticated}
        onClose={() => { setAuthOpen(false); setPendingAction(null); }}
        open={authOpen}
      />
    </main>
  );
}
