export type BadgeTone = "success" | "warn" | "neutral";

export type Question = {
  id: string | number;
  title: string;
  preview: string;
  author: string;
  subject: string;
  tags: string[];
  answers: number;
  votes: number;
  views: number;
  time: string;
  recent: number;
  trending: number;
  badges: Array<[string, BadgeTone]>;
};

export const questions: Question[] = [
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

export const subjects = [
  "All",
  "Programming",
  "Mathematics",
  "Databases",
  "System Design",
];
