"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  questions as fallbackQuestions,
  subjects as fallbackSubjects,
  type Question,
} from "@/lib/questions";

type SortMode = "recent" | "trending";
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

const gatedMessages: Record<string, string> = {
  create: "Creating posts is available after sign-in.",
  insight:
    "Notifications and insight personalization will unlock after sign-in.",
  save: "Saving threads is disabled in signed-out mode.",
  vote: "Voting is disabled in signed-out mode.",
};

export function LandingPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("All");
  const [sort, setSort] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [feedQuestions, setFeedQuestions] = useState<Question[]>([]);
  const [availableSubjects, setAvailableSubjects] =
    useState<string[]>(fallbackSubjects);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [session, setSession] = useState<SessionPayload>({
    signedIn: false,
  });

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
    let cancelled = false;

    async function hydrateAuthState() {
      try {
        const response = await fetch("/auth/session", {
          credentials: "same-origin",
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as SessionPayload;
        if (!cancelled) {
          setSession({
            signedIn: Boolean(payload.signedIn),
            user: payload.user || undefined,
          });
        }
      } catch {
        if (!cancelled) {
          setSession({ signedIn: false });
        }
      }
    }

    hydrateAuthState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      sort,
      subject,
    });

    if (query.trim()) {
      params.set("q", query.trim());
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
          subjects?: string[];
        };

        setFeedQuestions(payload.questions || []);
        setAvailableSubjects(
          payload.subjects?.length ? payload.subjects : ["All"],
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
        setAvailableSubjects(fallbackSubjects);
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
  }, [query, sort, subject]);

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
              questions={feedQuestions}
              selectedSubject={subject}
              selectedSort={sort}
              subjects={availableSubjects}
              setSelectedSubject={setSubject}
              setSelectedSort={setSort}
            />

            <QuestionFeed
              clearFilters={clearFilters}
              error={feedError}
              loading={feedLoading}
              onGatedAction={handleGatedAction}
              questions={feedQuestions}
              query={query}
              selectedSubject={subject}
              selectedSort={sort}
              setSelectedSort={setSort}
            />

            <RightRail />
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
            M
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
  useEffect(() => {
    document.body.classList.toggle("info-open", open);

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (open) {
      document.addEventListener("keydown", closeOnEscape);
    }

    return () => {
      document.body.classList.remove("info-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

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
            X
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
  questions,
  selectedSubject,
  selectedSort,
  subjects,
  setSelectedSubject,
  setSelectedSort,
}: {
  questions: Question[];
  selectedSubject: string;
  selectedSort: SortMode;
  subjects: string[];
  setSelectedSubject: (subject: string) => void;
  setSelectedSort: (sort: SortMode) => void;
}) {
  function count(subject: string) {
    return subject === "All"
      ? questions.length
      : questions.filter((item) => item.subject === subject).length;
  }

  return (
    <aside className="sidebar">
      <p className="label">Subjects</p>
      <div className="subjects">
        {subjects.map((item) => (
          <button
            className={`sub-btn ${selectedSubject === item ? "active" : ""}`}
            key={item}
            onClick={() => setSelectedSubject(item)}
            type="button"
          >
            <span>{item === "All" ? "All topics" : item}</span>
            <span className="muted">{count(item)}</span>
          </button>
        ))}
      </div>

      <p className="label">View</p>
      <div className="times">
        {(["recent", "trending"] as SortMode[]).map((item) => (
          <button
            className={`time-btn ${selectedSort === item ? "active" : ""}`}
            key={item}
            onClick={() => setSelectedSort(item)}
            type="button"
          >
            <span>{item[0].toUpperCase() + item.slice(1)}</span>
          </button>
        ))}
      </div>

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
  onGatedAction,
  questions,
  query,
  selectedSubject,
  selectedSort,
  setSelectedSort,
}: {
  clearFilters: () => void;
  error: string;
  loading: boolean;
  onGatedAction: (action: string) => void;
  questions: Question[];
  query: string;
  selectedSubject: string;
  selectedSort: SortMode;
  setSelectedSort: (sort: SortMode) => void;
}) {
  const scope =
    selectedSubject === "All" ? "all study topics" : selectedSubject;
  const title =
    selectedSort === "trending"
      ? "Trending study questions"
      : "Recent study questions";
  const summary = `Showing ${questions.length} ${selectedSort} threads across ${scope}${
    query ? ` matching "${query}".` : "."
  }`;

  return (
    <section className="feed">
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
            <QuestionCard
              key={question.id}
              onGatedAction={onGatedAction}
              question={question}
            />
          ))
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

      <div className="banner">
        <strong>Signed out mode is active</strong>
        <span>
          You can browse questions and use search now. Creating posts, saving
          threads, voting, notifications, and profile actions will ask you to
          sign in.
        </span>
      </div>
    </section>
  );
}

function QuestionCard({
  onGatedAction,
  question,
}: {
  onGatedAction: (action: string) => void;
  question: Question;
}) {
  const questionHref = `/questions/${question.id}`;

  return (
    <article className="q">
      <div className="topline">
        <div className="meta">
          <span>{question.subject}</span>
          <span>|</span>
          <span>{question.author}</span>
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
          <button
            className="ghost"
            onClick={() => onGatedAction("save")}
            type="button"
          >
            Save
          </button>
          <button
            className="ghost"
            onClick={() => onGatedAction("vote")}
            type="button"
          >
            Vote
          </button>
          <Link className="btn" href={questionHref}>
            Open thread
          </Link>
        </div>
      </div>
    </article>
  );
}

function RightRail() {
  const [trendingTags, setTrendingTags] = useState<
    Array<{ name: string; count: number }>
  >([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const response = await fetch("/api/trending");
        if (response.ok) {
          const data = (await response.json()) as {
            tags: Array<{ name: string; count: number }>;
          };
          setTrendingTags(data.tags);
        }
      } catch (error) {
        console.error("Failed to fetch trending tags:", error);
      } finally {
        setTrendingLoading(false);
      }
    }

    fetchTrending();
  }, []);

  const trendingText =
    trendingLoading || !trendingTags.length
      ? "Loading trending topics..."
      : trendingTags.slice(0, 4).map((tag) => tag.name).join(", ") + ".";

  return (
    <aside className="right">
      <section className="insight">
        <div className="head">
          <h3>Insights</h3>
          <span className="pill">Right panel</span>
        </div>
        <p>
          Keep lightweight signals visible without turning the page into a heavy
          dashboard.
        </p>
        <ul className="mini">
          <li>
            <strong>Trending this week</strong>
            <span>{trendingText}</span>
            {!trendingLoading && trendingTags.length > 0 && (
              <div className="tag-counts">
                {trendingTags.slice(0, 5).map((tag) => (
                  <span key={tag.name} className="count-badge">
                    {tag.name} ({tag.count})
                  </span>
                ))}
              </div>
            )}
          </li>
          <li>
            <strong>Most compared answers</strong>
            <span>
              Threads with multiple valid approaches are highlighted to
              encourage flexible understanding.
            </span>
          </li>
        </ul>
      </section>

      <section className="insight">
        <div className="head">
          <h3>Activity</h3>
          <span className="pill">Notification-ready</span>
        </div>
        <ul className="activity">
          <li>
            <span className="dot" aria-hidden="true" />
            <span>
              <strong>2 new community answers</strong>
              <br />A recursion thread gained fresh explanations in the last
              hour.
            </span>
          </li>
          <li>
            <span className="dot" aria-hidden="true" />
            <span>
              <strong>1 AI-assisted thread updated</strong>
              <br />A calculus question now has both an instant hint and a
              verified student answer.
            </span>
          </li>
          <li>
            <span className="dot" aria-hidden="true" />
            <span>
              <strong>4 students compared solutions</strong>
              <br />
              Multiple-answer viewing remains one of the clearest learning
              differentiators.
            </span>
          </li>
        </ul>
      </section>

      <section className="insight">
        <div className="head">
          <h3>Design notes</h3>
          <span className="pill">Phase 1</span>
        </div>
        <p>
          This panel is intentionally lightweight for now. It supports the
          hybrid concept, shows room for notifications later, and collapses
          cleanly below the feed on mobile.
        </p>
      </section>
    </aside>
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
