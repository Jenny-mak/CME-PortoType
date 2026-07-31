"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Play,
  Search,
} from "lucide-react";

export type TrainingCategory =
  | "All"
  | "Getting started"
  | "Clients & KYC"
  | "Loans"
  | "Campaigns"
  | "Compliance";

export type TrainingVideo = {
  id: string;
  title: string;
  description: string;
  category: Exclude<TrainingCategory, "All">;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  progress: number;
  accent: string;
  /** Optional demo stream; UI works without it. */
  src?: string;
};

const CATEGORIES: TrainingCategory[] = [
  "All",
  "Getting started",
  "Clients & KYC",
  "Loans",
  "Campaigns",
  "Compliance",
];

export const trainingVideos: TrainingVideo[] = [
  {
    id: "tv-01",
    title: "Welcome to the CRM workspace",
    description:
      "Tour Home, navigation, and how modules connect across clients, loans, and activities.",
    category: "Getting started",
    duration: "6:20",
    level: "Beginner",
    progress: 100,
    accent: "#a31d31",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: "tv-02",
    title: "Create and qualify a lead",
    description:
      "Capture inbound interest, set status, and convert a lead into a client record.",
    category: "Getting started",
    duration: "8:15",
    level: "Beginner",
    progress: 40,
    accent: "#3B7DD8",
  },
  {
    id: "tv-03",
    title: "Client onboarding & KYC checklist",
    description:
      "Walk through KYC statuses, pending reviews, and what Needs attention surfaces on Home.",
    category: "Clients & KYC",
    duration: "11:40",
    level: "Intermediate",
    progress: 0,
    accent: "#2FB5A8",
  },
  {
    id: "tv-04",
    title: "Managing contacts under a client",
    description:
      "Link decision makers, keep roles current, and open related lists from the client record.",
    category: "Clients & KYC",
    duration: "7:05",
    level: "Beginner",
    progress: 70,
    accent: "#F0A202",
  },
  {
    id: "tv-05",
    title: "Loan pipeline stages explained",
    description:
      "From Identification to Completion — stage meaning, probability, and kanban best practices.",
    category: "Loans",
    duration: "12:30",
    level: "Intermediate",
    progress: 15,
    accent: "#8B5CF6",
  },
  {
    id: "tv-06",
    title: "Closing loans this month",
    description:
      "Use Home Loans closing and Reports to prioritize facilities nearing completion.",
    category: "Loans",
    duration: "9:50",
    level: "Intermediate",
    progress: 0,
    accent: "#E85D4C",
  },
  {
    id: "tv-07",
    title: "Running a campaign end to end",
    description:
      "Plan spend, track leads generated, and hand off responses into the CRM pipeline.",
    category: "Campaigns",
    duration: "10:25",
    level: "Intermediate",
    progress: 0,
    accent: "#14B8A6",
  },
  {
    id: "tv-08",
    title: "Compliance essentials for relationship managers",
    description:
      "Audit-friendly notes, data handling basics, and when to escalate KYC or credit issues.",
    category: "Compliance",
    duration: "14:10",
    level: "Advanced",
    progress: 0,
    accent: "#6366F1",
  },
];

export function TrainingVideos({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState<TrainingCategory>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(trainingVideos[0]?.id ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trainingVideos.filter((video) => {
      if (category !== "All" && video.category !== category) return false;
      if (!q) return true;
      return (
        video.title.toLowerCase().includes(q) ||
        video.description.toLowerCase().includes(q) ||
        video.category.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  const selected =
    filtered.find((video) => video.id === selectedId) ??
    filtered[0] ??
    trainingVideos[0];

  const completedCount = trainingVideos.filter((v) => v.progress >= 100).length;
  const inProgressCount = trainingVideos.filter(
    (v) => v.progress > 0 && v.progress < 100,
  ).length;

  return (
    <div className="training-page">
      <header className="training-header">
        <div className="training-header-main">
          <button type="button" className="training-back" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.8} />
            <span>Home</span>
          </button>
          <div>
            <h2>Training videos</h2>
            <p className="muted">
              Short product walkthroughs for CRM workflows — clients, loans, campaigns, and compliance.
            </p>
          </div>
        </div>
        <div className="training-stats" aria-label="Training progress summary">
          <div className="training-stat">
            <BookOpen size={15} strokeWidth={1.7} />
            <div>
              <strong>{trainingVideos.length}</strong>
              <span>Courses</span>
            </div>
          </div>
          <div className="training-stat">
            <Play size={15} strokeWidth={1.7} />
            <div>
              <strong>{inProgressCount}</strong>
              <span>In progress</span>
            </div>
          </div>
          <div className="training-stat is-done">
            <CheckCircle2 size={15} strokeWidth={1.7} />
            <div>
              <strong>{completedCount}</strong>
              <span>Completed</span>
            </div>
          </div>
        </div>
      </header>

      <div className="training-toolbar">
        <div className="training-cats" role="tablist" aria-label="Video categories">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              className={`training-cat ${category === item ? "is-active" : ""}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="training-search">
          <Search size={15} strokeWidth={1.7} />
          <input
            type="search"
            placeholder="Search videos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="training-layout">
        <section className="training-player-panel" aria-label="Video player">
          {selected ? (
            <>
              <div
                className="training-player-stage"
                style={{ ["--training-accent" as string]: selected.accent }}
              >
                {selected.src ? (
                  <video
                    key={selected.id}
                    className="training-video"
                    controls
                    playsInline
                    poster=""
                    src={selected.src}
                  >
                    Your browser does not support embedded video.
                  </video>
                ) : (
                  <div className="training-player-placeholder">
                    <button
                      type="button"
                      className="training-play-btn"
                      aria-label={`Play ${selected.title}`}
                    >
                      <Play size={28} strokeWidth={1.6} fill="currentColor" />
                    </button>
                    <span className="training-player-hint">Preview available soon</span>
                  </div>
                )}
              </div>
              <div className="training-player-meta">
                <div className="training-player-meta-top">
                  <span className="training-chip">{selected.category}</span>
                  <span className="training-chip is-muted">{selected.level}</span>
                  <span className="training-chip is-muted">
                    <Clock3 size={12} strokeWidth={1.8} />
                    {selected.duration}
                  </span>
                </div>
                <h3>{selected.title}</h3>
                <p className="muted">{selected.description}</p>
                <div className="training-progress-block">
                  <div className="training-progress-head">
                    <span>Your progress</span>
                    <strong>
                      {selected.progress >= 100 ? "Completed" : `${selected.progress}%`}
                    </strong>
                  </div>
                  <div
                    className="training-progress-track"
                    role="progressbar"
                    aria-valuenow={selected.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${selected.progress}%` }} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="training-empty">
              <p className="muted">No videos match your filters.</p>
            </div>
          )}
        </section>

        <aside className="training-list-panel" aria-label="Video catalog">
          <div className="training-list-head">
            <strong>
              {filtered.length} video{filtered.length === 1 ? "" : "s"}
            </strong>
            <span className="muted">{category === "All" ? "All categories" : category}</span>
          </div>
          <div className="training-list">
            {filtered.length === 0 ? (
              <p className="muted training-list-empty">Try another category or search term.</p>
            ) : (
              filtered.map((video, index) => {
                const active = selected?.id === video.id;
                return (
                  <button
                    key={video.id}
                    type="button"
                    className={`training-list-item ${active ? "is-active" : ""}`}
                    onClick={() => setSelectedId(video.id)}
                    style={{ ["--training-accent" as string]: video.accent }}
                  >
                    <span className="training-thumb" aria-hidden>
                      <span className="training-thumb-index">{String(index + 1).padStart(2, "0")}</span>
                      <Play size={14} strokeWidth={1.8} className="training-thumb-play" />
                    </span>
                    <span className="training-list-copy">
                      <strong>{video.title}</strong>
                      <span className="training-list-meta">
                        {video.duration} · {video.level}
                        {video.progress >= 100
                          ? " · Done"
                          : video.progress > 0
                            ? ` · ${video.progress}%`
                            : ""}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
