const data = [
  {
    id: 1,
    title:
      "How do I decide between dynamic programming and greedy for interval scheduling variants?",
    preview:
      "I understand the basic interval scheduling strategy, but when weights and penalties are introduced I get confused about when greedy stops being reliable. I want a way to reason through it before coding.",
    author: "Year 2 CS student",
    subject: "Programming",
    tags: ["algorithms", "dynamic-programming", "greedy"],
    answers: 6,
    votes: 19,
    views: 182,
    time: "24 minutes ago",
    recent: 1,
    trending: 2,
    badges: [
      ["AI hint available", "warn"],
      ["Community active", "success"],
    ],
  },
  {
    id: 2,
    title:
      "What is the cleanest way to explain why Gaussian elimination changes the matrix but preserves the solution set?",
    preview:
      "I can do the row operations mechanically, but I struggle to explain the theory in a way that still feels intuitive. Looking for multiple explanation styles, not just the formal definition.",
    author: "Foundation maths mentor",
    subject: "Mathematics",
    tags: ["linear-algebra", "proof", "matrix"],
    answers: 4,
    votes: 15,
    views: 134,
    time: "52 minutes ago",
    recent: 2,
    trending: 3,
    badges: [
      ["Compared solutions", "success"],
      ["Concept heavy", "neutral"],
    ],
  },
  {
    id: 3,
    title:
      "Why does my SQL join duplicate rows when I only expect one record per student?",
    preview:
      "I am joining enrolment, marks, and course tables. The output looks correct structurally, but the same student appears multiple times. I need help spotting what relation is actually causing the duplication.",
    author: "Database lab group",
    subject: "Databases",
    tags: ["sql", "joins", "normalization"],
    answers: 9,
    votes: 23,
    views: 241,
    time: "1 hour ago",
    recent: 3,
    trending: 1,
    badges: [
      ["Community verified", "success"],
      ["AI answer available", "warn"],
    ],
  },
  {
    id: 4,
    title:
      "What makes an induction proof fail even when the base case and step both look correct?",
    preview:
      "I keep getting feedback that my induction proof has a hidden assumption. Are there common patterns that make a proof look complete while still being invalid?",
    author: "Discrete maths learner",
    subject: "Mathematics",
    tags: ["induction", "proof-writing", "discrete-math"],
    answers: 5,
    votes: 17,
    views: 127,
    time: "2 hours ago",
    recent: 4,
    trending: 4,
    badges: [["Multiple approaches", "success"]],
  },
  {
    id: 5,
    title:
      "How should I compare a Flask backend cache with Firebase data without creating stale answers?",
    preview:
      "For this forum project, I want fast local reads but still need synced cloud data. I need a simple strategy for cache freshness that is realistic for a student build.",
    author: "FYP implementation thread",
    subject: "System Design",
    tags: ["firebase", "cache", "backend", "architecture"],
    answers: 3,
    votes: 12,
    views: 93,
    time: "3 hours ago",
    recent: 5,
    trending: 6,
    badges: [
      ["Project planning", "neutral"],
      ["AI suggested", "warn"],
    ],
  },
  {
    id: 6,
    title:
      "Can someone explain recursion trees in a way that helps me choose the right recurrence method?",
    preview:
      "I know the master theorem exists, but I often cannot tell when it applies cleanly. A visual or side-by-side explanation would help more than a formula dump.",
    author: "Algorithms revision group",
    subject: "Programming",
    tags: ["recursion", "time-complexity", "master-theorem"],
    answers: 8,
    votes: 21,
    views: 214,
    time: "4 hours ago",
    recent: 6,
    trending: 5,
    badges: [["Highly discussed", "success"]],
  },
];

const subjects = [
  "All",
  "Programming",
  "Mathematics",
  "Databases",
  "System Design",
];
const state = { subject: "All", sort: "recent", query: "" };

const elements = {
  subjects: document.getElementById("subjects"),
  times: document.getElementById("times"),
  list: document.getElementById("list"),
  search: document.getElementById("searchInput"),
  title: document.getElementById("feedTitle"),
  summary: document.getElementById("feedSummary"),
  toast: document.getElementById("toast"),
  drawer: document.getElementById("drawer"),
  menu: document.getElementById("menuToggle"),
  infoModal: document.getElementById("infoModal"),
};

let timer = null;
let lastInfoTrigger = null;
let authState = { signedIn: false, user: null };
const PAGE_TRANSITION_MS = 180;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const toast = (title, message) => {
  elements.toast.innerHTML = `<strong>${title}</strong><span class="muted">${message}</span>`;
  elements.toast.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
};

const count = (subject) =>
  subject === "All"
    ? data.length
    : data.filter((item) => item.subject === subject).length;

function renderFilters() {
  elements.subjects.innerHTML = subjects
    .map(
      (subject) =>
        `<button class="sub-btn ${state.subject === subject ? "active" : ""}" type="button" data-subject="${subject}"><span>${subject === "All" ? "All topics" : subject}</span><span class="muted">${count(subject)}</span></button>`,
    )
    .join("");
  elements.times.innerHTML = ["recent", "trending"]
    .map(
      (sort) =>
        `<button class="time-btn ${state.sort === sort ? "active" : ""}" type="button" data-time="${sort}"><span>${sort[0].toUpperCase() + sort.slice(1)}</span></button>`,
    )
    .join("");
  document
    .querySelectorAll("[data-sort]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.sort === state.sort),
    );
}

function rows() {
  const query = state.query.trim().toLowerCase();
  return data
    .filter(
      (item) =>
        (state.subject === "All" || item.subject === state.subject) &&
        (!query ||
          [
            item.title,
            item.preview,
            item.subject,
            item.author,
            item.tags.join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    )
    .sort((left, right) => left[state.sort] - right[state.sort]);
}

function renderList() {
  const items = rows();
  const scope = state.subject === "All" ? "all study topics" : state.subject;

  elements.title.textContent =
    state.sort === "trending"
      ? "Trending study questions"
      : "Recent study questions";
  elements.summary.textContent = `Showing ${items.length} ${state.sort} threads across ${scope}${state.query ? ` matching "${state.query}".` : "."}`;

  if (!items.length) {
    elements.list.innerHTML = `<div class="empty"><h3>No questions match this view yet</h3><p class="muted">Try clearing the search or switching category filters. The feed is designed to stay readable even as subjects and search terms change.</p></div>`;
    return;
  }

  elements.list.innerHTML = items
    .map(
      (item) =>
        `<article class="q"><div class="topline"><div class="meta"><span>${item.subject}</span><span>|</span><span>${item.author}</span></div><span>${item.time}</span></div><div class="meta">${item.badges.map((badge) => `<span class="badge ${badge[1]}">${badge[0]}</span>`).join("")}</div><h3><button class="open-btn" type="button" data-open="${item.id}">${item.title}</button></h3><p>${item.preview}</p><div class="tags">${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div><div class="statbar"><div class="stats"><span class="chip">Ans ${item.answers}</span><span class="chip">Votes ${item.votes}</span><span class="chip">Views ${item.views}</span></div><div class="q-actions"><button class="ghost" type="button" data-gated="save">Save</button><button class="ghost" type="button" data-gated="vote">Vote</button><button class="btn" type="button" data-open="${item.id}">Open thread</button></div></div></article>`,
    )
    .join("");
}

function render() {
  renderFilters();
  renderList();
}

function playPageEnter() {
  document.body.classList.remove("is-page-leaving");
  document.body.classList.add("is-page-entering");
  window.setTimeout(() => {
    document.body.classList.remove("is-page-entering");
  }, 240);
}

function navigateWithTransition(url) {
  if (!url) {
    return;
  }

  if (reducedMotionQuery.matches) {
    window.location.href = url;
    return;
  }

  document.body.classList.add("is-page-leaving");
  window.setTimeout(() => {
    window.location.href = url;
  }, PAGE_TRANSITION_MS);
}

function openInfoPane(trigger) {
  lastInfoTrigger = trigger || null;
  elements.infoModal.classList.add("show");
  elements.infoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("info-open");
  elements.infoModal.querySelector("[data-info-close]").focus();
}

function closeInfoPane() {
  elements.infoModal.classList.remove("show");
  elements.infoModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("info-open");

  if (lastInfoTrigger) {
    lastInfoTrigger.focus();
  }
}

function updateProfileButton() {
  const profileButton = document.querySelector('[data-gated="profile"]');
  if (!profileButton) {
    return;
  }

  profileButton.textContent = authState.signedIn
    ? "Profile"
    : "Sign In / Sign Up";
}

async function hydrateAuthState() {
  try {
    const response = await fetch("/auth/session", {
      credentials: "same-origin",
    });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    authState = {
      signedIn: Boolean(payload && payload.signedIn),
      user: payload && payload.user ? payload.user : null,
    };
  } catch (error) {
    authState = { signedIn: false, user: null };
  }

  updateProfileButton();
}

document.addEventListener("click", (event) => {
  const infoOpenButton = event.target.closest("[data-info-open]");
  if (infoOpenButton) {
    openInfoPane(infoOpenButton);
    return;
  }

  const infoCloseButton = event.target.closest("[data-info-close]");
  if (infoCloseButton) {
    closeInfoPane();
    return;
  }

  if (
    elements.infoModal.classList.contains("show") &&
    event.target === elements.infoModal
  ) {
    closeInfoPane();
    return;
  }

  const subjectButton = event.target.closest("[data-subject]");
  if (subjectButton) {
    state.subject = subjectButton.dataset.subject;
    render();
    return;
  }

  const timeButton = event.target.closest("[data-time]");
  if (timeButton) {
    state.sort = timeButton.dataset.time;
    render();
    return;
  }

  const sortButton = event.target.closest("[data-sort]");
  if (sortButton) {
    state.sort = sortButton.dataset.sort;
    render();
    return;
  }

  const openButton = event.target.closest("[data-open]");
  if (openButton) {
    toast(
      "Thread preview",
      "Thread detail pages are the next build step. This homepage already supports card-based navigation.",
    );
    return;
  }

  const gatedButton = event.target.closest("[data-gated]");
  if (gatedButton) {
    if (gatedButton.dataset.gated === "profile") {
      navigateWithTransition(authState.signedIn ? "/profile" : "/login");
      return;
    }

    const messages = {
      create:
        "Create starts the ask-question flow, but posting is gated until sign-in.",
      insight:
        "Notifications and insight personalization will unlock after sign-in.",
      save: "Saving threads is disabled in signed-out mode.",
      vote: "Voting is disabled in signed-out mode.",
    };

    toast(
      "Sign in required",
      messages[gatedButton.dataset.gated] ||
        "This action is available after sign-in.",
    );
  }
});

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderList();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  state.subject = "All";
  state.sort = "recent";
  state.query = "";
  elements.search.value = "";
  render();
});

elements.menu.addEventListener("click", () => {
  elements.drawer.classList.toggle("show");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.infoModal.classList.contains("show")) {
    closeInfoPane();
  }
});

render();
hydrateAuthState();
playPageEnter();

window.addEventListener("pageshow", () => {
  document.body.classList.remove("is-page-leaving");
  playPageEnter();
});

window.addEventListener("pagehide", () => {
  document.body.classList.add("is-page-leaving");
});
