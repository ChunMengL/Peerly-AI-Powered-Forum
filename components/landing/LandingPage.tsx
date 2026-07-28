"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  questions as fallbackQuestions,
  subjects as fallbackSubjects,
  type Question,
} from "@/lib/questions";

type SortMode = "recent" | "trending";
type SubjectCount = {
  name: string;
  count: number;
};
type ToastMessage = {
  title: string;
  message: string;
};
type SessionPayload = {
  signedIn: boolean;
  user?: {
    name?: string;
    email?: string;
    picture?: string;
  };
};
type Recommendation = {
  id: string;
  title: string;
  subject: string;
  tags: string[];
  score: number;
  reason: string;
};

const gatedMessages: Record<string, string> = {
  create: "Creating posts is available after sign-in.",
  insight:
    "Notifications and insight personalization will unlock after sign-in.",
};

const fallbackSubjectCounts: SubjectCount[] = fallbackSubjects.map((name) => ({
  name,
  count:
    name === "All"
      ? fallbackQuestions.length
      : fallbackQuestions.filter((item) => item.subject === name).length,
}));

export function LandingPage({
  initialSession,
}: {
  initialSession: SessionPayload;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("All");
  const [sort, setSort] = useState<SortMode>("recent");
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");
  // Debounced mirror of `query`: the feed fetch keys off this, so keystrokes
  // fire one request per pause instead of one per character. Subject/sort still
  // read `query`'s settled value and stay instant.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [feedQuestions, setFeedQuestions] = useState<Question[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectCount[]>(
    fallbackSubjectCounts,
  );
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  // Seeded from the server render for a no-flash first paint, then reconciled
  // against the live browser session below.
  const [session, setSession] = useState<SessionPayload>(initialSession);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // The home page's Server Component render can report signed-out on Vercel even
  // when the cookie is valid, so reconcile the topbar via /auth/session — a route
  // handler that reads the cookie the same way /api/questions does (which works on
  // the deploy). Only ever reflects the server's answer; a network error keeps the
  // seeded value rather than forcing signed-out.
  useEffect(() => {
    let cancelled = false;

    fetch("/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SessionPayload | null) => {
        if (!cancelled && payload) {
          setSession(payload);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("is-page-entering");
    const timer = window.setTimeout(() => {
      document.body.classList.remove("is-page-entering");
    }, 240);

    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("is-page-entering", "is-page-leaving");
    };
  }, []);

  useEffect(() => {
    if (!session.signedIn) {
      // The strip is render-gated on session.signedIn, so no reset is needed.
      return;
    }

    const controller = new AbortController();

    async function fetchRecommendations() {
      try {
        const response = await fetch("/api/recommendations?limit=5", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) {
          setRecommendations([]);
          return;
        }
        const payload = (await response.json()) as {
          recommendations?: Recommendation[];
        };
        setRecommendations(payload.recommendations || []);
      } catch {
        if (!controller.signal.aborted) {
          setRecommendations([]);
        }
      }
    }

    fetchRecommendations();

    return () => {
      controller.abort();
    };
  }, [session.signedIn]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      sort,
      subject,
    });

    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery.trim());
    }

    // Gated on the session too: signing out mid-visit hides the control, and an
    // orphaned mine=1 would otherwise leave the feed permanently empty.
    if (mineOnly && session.signedIn) {
      params.set("mine", "1");
    }

    async function fetchQuestions() {
      setFeedLoading(true);
      setFeedError("");

      try {
        const response = await fetch(`/api/questions?${params.toString()}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Could not load questions from the database.");
        }

        const payload = (await response.json()) as {
          questions?: Question[];
          subjects?: SubjectCount[];
        };

        setFeedQuestions(payload.questions || []);
        setAvailableSubjects(
          payload.subjects?.length
            ? payload.subjects
            : [{ name: "All", count: 0 }],
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setFeedError(
          error instanceof Error
            ? error.message
            : "Could not load questions from the database.",
        );
        setFeedQuestions(fallbackQuestions);
        setAvailableSubjects(fallbackSubjectCounts);
      } finally {
        if (!controller.signal.aborted) {
          setFeedLoading(false);
        }
      }
    }

    fetchQuestions();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, mineOnly, session.signedIn, sort, subject]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigateWithTransition(url: string) {
    if (!url) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      router.push(url);
      return;
    }

    document.body.classList.add("is-page-leaving");
    window.setTimeout(() => router.push(url), 180);
  }

  function showToast(title: string, message: string) {
    setToast({ title, message });
  }

  function handleGatedAction(action: string) {
    if (action === "profile") {
      navigateWithTransition(session.signedIn ? "/profile" : "/login");
      return;
    }

    if (action === "create" && session.signedIn) {
      navigateWithTransition("/questions/new");
      return;
    }

    showToast(
      "Sign in required",
      gatedMessages[action] || "This action is available after sign-in.",
    );
  }

  function clearFilters() {
    setSubject("All");
    setSort("recent");
    setMineOnly(false);
    setQuery("");
  }

  return (
    <div className="landing-page" data-theme="light">
      <div className="shell">
        <TopBar
          drawerOpen={drawerOpen}
          onInfoOpen={() => setInfoOpen(true)}
          onGatedAction={handleGatedAction}
          onMenuToggle={() => setDrawerOpen((value) => !value)}
          query={query}
          session={session}
          setQuery={setQuery}
        />

        <MobileDrawer onInfoOpen={() => setInfoOpen(true)} open={drawerOpen} />

        <main id="home">
          <HeroSection
            onGatedAction={handleGatedAction}
            onInfoOpen={() => setInfoOpen(true)}
          />

          <section className="workspace">
            <FilterSidebar
              mineOnly={mineOnly}
              selectedSubject={subject}
              session={session}
              subjects={availableSubjects}
              setMineOnly={setMineOnly}
              setSelectedSubject={setSubject}
            />

            <QuestionFeed
              clearFilters={clearFilters}
              error={feedError}
              loading={feedLoading}
              mineOnly={mineOnly}
              recommendations={recommendations}
              questions={feedQuestions}
              query={query}
              selectedSubject={subject}
              selectedSort={sort}
              session={session}
              setSelectedSort={setSort}
            />
          </section>
        </main>
      </div>

      <AboutModal onClose={() => setInfoOpen(false)} open={infoOpen} />
      <Toast toast={toast} />
    </div>
  );
}

function TopBar({
  drawerOpen,
  onInfoOpen,
  onGatedAction,
  onMenuToggle,
  query,
  session,
  setQuery,
}: {
  drawerOpen: boolean;
  onInfoOpen: () => void;
  onGatedAction: (action: string) => void;
  onMenuToggle: () => void;
  query: string;
  session: SessionPayload;
  setQuery: (query: string) => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-logo">
          <Image
            alt="Peerly logo"
            height={56}
            priority
            src="/Images/peerly_logo.png"
            width={130}
          />
        </div>
      </div>

      <nav className="nav" aria-label="Primary">
        <a href="#home">Home</a>
        <button className="nav-link" onClick={onInfoOpen} type="button">
          About
        </button>
      </nav>

      <div className="tools">
        <label className="search" htmlFor="searchInput">
          <span aria-hidden="true">Go</span>
          <span className="sr">Search questions</span>
          <input
            id="searchInput"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions, topics, or keywords"
            type="search"
            value={query}
          />
        </label>

        <div className="actions">
          <button
            className="btn primary"
            onClick={() => onGatedAction("create")}
            type="button"
          >
            Create
          </button>
          <button
            aria-label="Open notifications"
            className="btn notification-btn"
            onClick={() => onGatedAction("insight")}
            type="button"
          >
            <Image
              alt=""
              aria-hidden="true"
              height={18}
              src="/Images/notification.png"
              width={18}
            />
          </button>
          <button
            className="btn login-cta"
            onClick={() => onGatedAction("profile")}
            type="button"
          >
            {session.signedIn ? "Profile" : "Sign In / Sign Up"}
          </button>
          <button
            aria-expanded={drawerOpen}
            aria-label="Open mobile menu"
            className="icon menu"
            onClick={onMenuToggle}
            type="button"
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileDrawer({
  onInfoOpen,
  open,
}: {
  onInfoOpen: () => void;
  open: boolean;
}) {
  return (
    <div className={`drawer ${open ? "show" : ""}`}>
      <p className="label">Navigate</p>
      <nav className="nav drawer-nav" aria-label="Mobile primary">
        <a href="#home">Home</a>
        <button className="nav-link" onClick={onInfoOpen} type="button">
          About
        </button>
      </nav>
      <ul className="mini drawer-list">
        <li>
          <strong>Browse first, sign in to interact</strong>
          <span>
            Guests can search and explore. Creating, voting, saving,
            notifications, and profile access remain gated.
          </span>
        </li>
      </ul>
    </div>
  );
}

function HeroSection({
  onInfoOpen,
  onGatedAction,
}: {
  onInfoOpen: () => void;
  onGatedAction: (action: string) => void;
}) {
  return (
    <section className="hero">
      <article className="card">
        <span className="eyebrow">Hybrid AI + community learning</span>
        <h1>One study feed, clearer answers, better context.</h1>
        <p>
          Peerly helps students ask questions, compare multiple explanations,
          and use AI without losing the value of verified community input. The
          homepage is built to feel like the product itself, not a separate
          marketing page.
        </p>
        <div className="hero-actions">
          <button
            className="btn primary"
            onClick={() => onGatedAction("create")}
            type="button"
          >
            Ask a question
          </button>
          <button className="btn" onClick={onInfoOpen} type="button">
            See how it works
          </button>
        </div>
      </article>
    </section>
  );
}

function AboutModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const paneRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without putting it in the effect deps: the parent
  // passes a fresh closure each render, and re-running the effect while open
  // would steal focus back to the trigger mid-dialog.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    document.body.classList.add("info-open");
    // Remember what opened the dialog so focus returns there on close.
    triggerRef.current = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        paneRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) || [],
      );

    focusables()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("info-open");
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={`modal-backdrop ${open ? "show" : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="infoTitle"
        aria-modal="true"
        className="info-pane"
        ref={paneRef}
        role="dialog"
      >
        <div className="info-head">
          <div>
            <span className="eyebrow">About Peerly</span>
            <h2 id="infoTitle">How the homepage supports studying</h2>
          </div>
          <button
            aria-label="Close about panel"
            className="icon close-info"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="info-grid">
          <section className="info-block">
            <div className="head">
              <h3>What the homepage shows first</h3>
              <span className="pill">Question feed default</span>
            </div>
            <ul className="list">
              <li>
                <strong>Fast scanning</strong>
                <span>
                  Cards emphasize titles, tags, previews, and useful stats so
                  students can decide what to open quickly.
                </span>
              </li>
              <li>
                <strong>Confidence cues</strong>
                <span>
                  Status badges make it easier to spot AI-assisted threads,
                  community traction, and verified activity.
                </span>
              </li>
              <li>
                <strong>Open browsing</strong>
                <span>
                  Visitors can explore before signing in, which works better for
                  demos and first-time discovery.
                </span>
              </li>
            </ul>
          </section>

          <section className="info-block">
            <div className="head">
              <h3>How Peerly fits the FYP</h3>
              <span className="pill">Academic mode</span>
            </div>
            <ul className="mini">
              <li>
                <strong>Top nav for familiar movement</strong>
                <span>
                  Home, About, search, Create, insight access, and profile entry
                  are visible from the first screen.
                </span>
              </li>
              <li>
                <strong>Sidebar for structured discovery</strong>
                <span>
                  Subjects and recency filters keep the browsing model closer to
                  study workflows than general social feeds.
                </span>
              </li>
            </ul>
          </section>

          <section className="info-block">
            <div className="head">
              <h3>Core learning model</h3>
              <span className="pill">Hybrid support</span>
            </div>
            <div className="info-stats">
              <div className="stat">
                <strong>Community-first</strong>
                <span>
                  Multiple approaches stay visible so students can compare
                  methods instead of following only one path.
                </span>
              </div>
              <div className="stat">
                <strong>AI assisted</strong>
                <span>
                  Fast support is available when needed, with room for later
                  verification and community follow-up.
                </span>
              </div>
              <div className="stat">
                <strong>Study focused</strong>
                <span>
                  Tags, filters, and feed signals keep the experience academic
                  rather than noisy.
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function FilterSidebar({
  mineOnly,
  selectedSubject,
  session,
  subjects,
  setMineOnly,
  setSelectedSubject,
}: {
  mineOnly: boolean;
  selectedSubject: string;
  session: SessionPayload;
  subjects: SubjectCount[];
  setMineOnly: (mineOnly: boolean) => void;
  setSelectedSubject: (subject: string) => void;
}) {
  return (
    <aside className="sidebar">
      <p className="label">Subjects</p>
      <div className="subjects">
        {subjects.map((item) => (
          <button
            className={`sub-btn ${
              selectedSubject === item.name ? "active" : ""
            }`}
            key={item.name}
            onClick={() => setSelectedSubject(item.name)}
            type="button"
          >
            <span>{item.name === "All" ? "All topics" : item.name}</span>
            <span className="muted">{item.count}</span>
          </button>
        ))}
      </div>

      {session.signedIn ? (
        <>
          <p className="label">Your posts</p>
          <div className="times">
            <button
              aria-pressed={mineOnly}
              className={`time-btn ${mineOnly ? "active" : ""}`}
              onClick={() => setMineOnly(!mineOnly)}
              type="button"
            >
              <span>My posts</span>
            </button>
          </div>
        </>
      ) : null}

      <div className="note">
        <strong>Why this layout works</strong>
        <span>
          The homepage explains the app by showing the app. Students see content
          first, while markers still understand the hybrid learning model from
          the structure itself.
        </span>
      </div>
    </aside>
  );
}

function QuestionFeed({
  clearFilters,
  error,
  loading,
  mineOnly,
  questions,
  query,
  recommendations,
  selectedSubject,
  selectedSort,
  session,
  setSelectedSort,
}: {
  clearFilters: () => void;
  error: string;
  loading: boolean;
  mineOnly: boolean;
  questions: Question[];
  query: string;
  recommendations: Recommendation[];
  selectedSubject: string;
  selectedSort: SortMode;
  session: SessionPayload;
  setSelectedSort: (sort: SortMode) => void;
}) {
  const scope =
    selectedSubject === "All" ? "all study topics" : selectedSubject;
  const title = mineOnly
    ? "Your study questions"
    : selectedSort === "trending"
      ? "Trending study questions"
      : "Recent study questions";
  const summary = `Showing ${questions.length} ${
    mineOnly ? "of your" : selectedSort
  } threads across ${scope}${query ? ` matching "${query}".` : "."}`;

  return (
    <section className="feed">
      {session.signedIn && recommendations.length > 0 ? (
        <RecommendedStrip recommendations={recommendations} />
      ) : null}

      <div className="toolbar">
        <div className="feed-head">
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
        <div className="feed-actions">
          <div className="seg" role="tablist" aria-label="Sort feed">
            {(["recent", "trending"] as SortMode[]).map((item) => (
              <button
                className={selectedSort === item ? "active" : ""}
                key={item}
                onClick={() => setSelectedSort(item)}
                type="button"
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn" onClick={clearFilters} type="button">
            Clear filters
          </button>
        </div>
      </div>

      <div className="qlist">
        {loading ? (
          <div className="empty">
            <h3>Loading questions</h3>
            <p className="muted">
              Peerly is fetching the latest question feed from the database.
            </p>
          </div>
        ) : questions.length ? (
          questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))
        ) : selectedSort === "trending" ? (
          <div className="empty">
            <h3>Nothing is trending right now</h3>
            <p className="muted">
              Trending covers questions posted in the last 48 hours that are
              picking up views, votes, or discussion. Switch to Recent to see
              the full feed.
            </p>
          </div>
        ) : (
          <div className="empty">
            <h3>No questions match this view yet</h3>
            <p className="muted">
              Try clearing the search or switching category filters. The feed is
              designed to stay readable even as subjects and search terms
              change.
            </p>
          </div>
        )}
      </div>

      {error ? (
        <div className="banner">
          <strong>Database feed fallback</strong>
          <span>{error} Showing local sample questions for now.</span>
        </div>
      ) : null}

      {!session.signedIn ? (
        <div className="banner">
          <strong>Signed out mode is active</strong>
          <span>
            You can browse questions and use search now. Creating posts,
            notifications, and profile actions will ask you to sign in.
          </span>
        </div>
      ) : null}
    </section>
  );
}

function RecommendedStrip({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  return (
    <section className="recommend" aria-label="Recommended for you">
      <div className="recommend-head">
        <h2>Recommended for you</h2>
        <span className="pill">Personalized</span>
      </div>
      <div className="recommend-list">
        {recommendations.map((item) => (
          <article className="recommend-card" key={item.id}>
            <span className="recommend-reason">{item.reason}</span>
            <h3>
              <Link className="open-btn" href={`/questions/${item.id}`}>
                {item.title}
              </Link>
            </h3>
            <span className="recommend-subject">{item.subject}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function QuestionCard({ question }: { question: Question }) {
  const questionHref = `/questions/${question.id}`;

  return (
    <article className="q">
      <div className="topline">
        <div className="q-identity">
          <span className="q-subject">{question.subject}</span>
          <span className="q-author">
            <span className="q-author-label">Asked by</span>
            <strong>{question.author}</strong>
          </span>
        </div>
        <span>{question.time}</span>
      </div>
      <div className="meta">
        {question.badges.map(([label, tone]) => (
          <span className={`badge ${tone}`} key={label}>
            {label}
          </span>
        ))}
      </div>
      <h3>
        <Link className="open-btn" href={questionHref}>
          {question.title}
        </Link>
      </h3>
      <p>{question.preview}</p>
      <div className="tags">
        {question.tags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <div className="statbar">
        <div className="stats">
          <span className="chip">Ans {question.answers}</span>
          <span className="chip">Votes {question.votes}</span>
          <span className="chip">Views {question.views}</span>
        </div>
        <div className="q-actions">
          <Link className="btn" href={questionHref}>
            Open thread
          </Link>
        </div>
      </div>
    </article>
  );
}

function Toast({ toast }: { toast: ToastMessage | null }) {
  return (
    <div
      aria-live="polite"
      className={`toast ${toast ? "show" : ""}`}
      role="status"
    >
      {toast ? (
        <>
          <strong>{toast.title}</strong>
          <span className="muted">{toast.message}</span>
        </>
      ) : null}
    </div>
  );
}
