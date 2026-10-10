"use client";
/* eslint-disable @next/next/no-img-element */

/*
 * Fades Gaming Hub: home page (gaming.fades.lol)
 *
 * Data sources
 *   News:    GET https://api.fades.lol/browser/gaming-news
 *   Esports: GET /api/gaming/esports  (your PandaScore / OpenDota route)
 *
 * Override either one in .env.local:
 *   NEXT_PUBLIC_GAMING_NEWS_API=https://api.fades.lol/browser/gaming-news
 *   NEXT_PUBLIC_ESPORTS_API=/api/gaming/esports
 *
 * Styles: keep your existing globals.css, and add hub.css next to this file.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./globals.css";

const LOGO_SRC = "/logo.png";

const NEWS_API =
  process.env.NEXT_PUBLIC_GAMING_NEWS_API ||
  "https://api.fades.lol/browser/gaming-news";

const ESPORTS_API =
  process.env.NEXT_PUBLIC_ESPORTS_API || "/api/gaming/esports";

const MATCH_REFRESH_MS = 30 * 1000;
const NEWS_REFRESH_MS = 5 * 60 * 1000;

const MATCH_PAGE_SIZE = 9;
const NEWS_FIRST_PAGE = 7;
const NEWS_PAGE_SIZE = 6;

const GAMES = [
  { id: "all", label: "All games" },
  { id: "cs2", label: "CS2" },
  { id: "valorant", label: "Valorant" },
  { id: "dota2", label: "Dota 2" },
  { id: "lol", label: "League of Legends" },
];

const SHORT_GAME = {
  cs2: "CS2",
  valorant: "Valorant",
  dota2: "Dota 2",
  lol: "LoL",
};

const MATCH_TABS = [
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "finished", label: "Results" },
];

const EMPTY_COPY = {
  live: ["No live matches", "Check Upcoming to see what starts next."],
  upcoming: ["No upcoming matches", "Nothing is scheduled for this filter."],
  finished: ["No recent results", "Results appear here after matches end."],
};

const ROADMAP = [
  {
    name: "Teams",
    description: "Create a team, build a roster and invite players.",
    path: "/teams",
  },
  {
    name: "Tournaments",
    description: "Run brackets and report results.",
    path: "/tournaments",
  },
  {
    name: "Rankings",
    description: "Ratings for every team, game by game.",
    path: "/rankings",
  },
];

/* =========================================================
   SMALL HELPERS
   ========================================================= */

const text = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return String(value.name || value.title || "");

  return String(value);
};

function safeUrl(value) {
  const url = text(value).trim();

  return /^https?:\/\//i.test(url) ? url : "";
}

function toMs(value) {
  if (value === undefined || value === null || value === "") return 0;

  if (typeof value === "number") {
    return value < 1e12 ? value * 1000 : value;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? 0 : parsed;
}

function initials(name) {
  const words = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function canonicalGame(value) {
  const key = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!key) return "";
  if (key.includes("counterstrike") || ["cs", "cs2", "csgo"].includes(key)) {
    return "cs2";
  }
  if (key.includes("valorant")) return "valorant";
  if (key.includes("dota")) return "dota2";
  if (key.includes("leagueoflegends") || key === "lol") return "lol";

  return key;
}

function gameLabel(id) {
  return SHORT_GAME[id] || (id ? id.toUpperCase() : "Esports");
}

const timeFormat = new Intl.DateTimeFormat([], {
  hour: "numeric",
  minute: "2-digit",
});

const dayFormat = new Intl.DateTimeFormat([], {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function kickoffLabel(ms) {
  if (!ms) return "Time TBD";

  const date = new Date(ms);
  const now = new Date();
  const tomorrow = new Date(now);

  tomorrow.setDate(now.getDate() + 1);

  const time = timeFormat.format(date);

  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;

  return `${dayFormat.format(date)}, ${time}`;
}

function countdown(ms) {
  const diff = ms - Date.now();

  if (!ms || diff <= 0 || diff > 3 * 60 * 60 * 1000) return "";

  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) return `In ${minutes} min`;

  return `In ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/* =========================================================
   MATCH NORMALIZING
   Accepts raw PandaScore objects, OpenDota-style objects,
   or a flat shape like { teams: [{ name, logo, score }] }.
   ========================================================= */

const BUCKETS = {
  running: "live",
  live: "live",
  upcoming: "upcoming",
  not_started: "upcoming",
  scheduled: "upcoming",
  past: "finished",
  finished: "finished",
  completed: "finished",
  results: "finished",
  recent: "finished",
};

function makeTeam(team, score) {
  const logo = safeUrl(
    team?.logo || team?.image_url || team?.image || team?.logo_url || team?.icon
  );

  return {
    name: text(team?.name || team?.acronym || team?.tag || team) || "TBD",
    logo,
    score:
      score === undefined || score === null || score === ""
        ? null
        : Number(score),
  };
}

function pickTeams(raw) {
  // PandaScore
  if (Array.isArray(raw.opponents) && raw.opponents.length > 0) {
    return raw.opponents.slice(0, 2).map((entry) => {
      const team = entry.opponent || entry;
      const result = Array.isArray(raw.results)
        ? raw.results.find((item) => item.team_id === team.id)
        : null;

      return makeTeam(team, result ? result.score : team.score ?? entry.score);
    });
  }

  // Flat list
  if (Array.isArray(raw.teams) && raw.teams.length > 0) {
    return raw.teams.slice(0, 2).map((team) => makeTeam(team, team.score));
  }

  // Named sides (including OpenDota radiant / dire)
  const first =
    raw.teamA ||
    raw.team1 ||
    raw.home ||
    (raw.radiant_name || raw.radiant_team
      ? {
          name: raw.radiant_name || raw.radiant_team?.name,
          logo: raw.radiant_team?.logo_url,
        }
      : null);

  const second =
    raw.teamB ||
    raw.team2 ||
    raw.away ||
    (raw.dire_name || raw.dire_team
      ? {
          name: raw.dire_name || raw.dire_team?.name,
          logo: raw.dire_team?.logo_url,
        }
      : null);

  if (first || second) {
    return [
      makeTeam(first, raw.scoreA ?? raw.score1 ?? raw.radiant_score ?? first?.score),
      makeTeam(second, raw.scoreB ?? raw.score2 ?? raw.dire_score ?? second?.score),
    ];
  }

  // "Team A vs Team B"
  const parts = text(raw.name || raw.title).split(/\s+vs\.?\s+/i);

  if (parts.length === 2) {
    return parts.map((name) => makeTeam({ name }, null));
  }

  return [];
}

function normalizeMatch(raw, hint) {
  if (!raw || typeof raw !== "object") return null;

  const rawStatus = String(raw.status || raw.state || "").toLowerCase();

  if (["canceled", "cancelled"].includes(rawStatus)) return null;

  let teams = pickTeams(raw);

  while (teams.length < 2) teams.push({ name: "TBD", logo: "", score: null });

  teams = teams.slice(0, 2);

  let status = hint || "";

  if (
    ["running", "live", "in_progress", "inprogress", "ongoing"].includes(
      rawStatus
    ) ||
    raw.live === true
  ) {
    status = "live";
  } else if (
    ["finished", "completed", "past", "ended", "closed"].includes(rawStatus) ||
    raw.winner_id ||
    raw.winner
  ) {
    status = "finished";
  } else if (
    ["not_started", "upcoming", "scheduled", "pending", "postponed"].includes(
      rawStatus
    )
  ) {
    status = "upcoming";
  }

  if (!status) status = "upcoming";

  const startsAt = toMs(
    raw.begin_at ||
      raw.scheduled_at ||
      raw.startsAt ||
      raw.start_time ||
      raw.startTime ||
      raw.date ||
      raw.time
  );

  const game =
    canonicalGame(
      raw.videogame?.slug ||
        raw.videogame?.name ||
        raw.game?.slug ||
        raw.game?.name ||
        raw.game ||
        raw.gameSlug
    ) || (raw.radiant_name || raw.radiant_team ? "dota2" : "");

  const league = text(raw.league?.name || raw.league || raw.league_name);
  const series = text(
    raw.serie?.full_name ||
      raw.serie?.name ||
      raw.tournament?.name ||
      raw.tournament ||
      raw.event
  );

  const games = Number(raw.number_of_games || raw.bestOf || raw.best_of);

  const stream =
    raw.streams_list?.find?.((item) => item.main)?.raw_url ||
    raw.streams_list?.[0]?.raw_url ||
    raw.stream ||
    raw.streamUrl ||
    raw.official_stream_url;

  return {
    id: String(raw.id ?? `${teams[0].name}-${teams[1].name}-${startsAt}`),
    status,
    note: rawStatus === "postponed" ? "Postponed" : "",
    teams,
    startsAt,
    game,
    event: [league, series].filter(Boolean).join(" "),
    bestOf: games > 0 ? `Bo${games}` : "",
    url: safeUrl(stream) || safeUrl(raw.url || raw.link),
  };
}

function parseMatches(data) {
  const found = new Map();

  const add = (list, hint) => {
    if (!Array.isArray(list)) return;

    list.forEach((raw) => {
      const match = normalizeMatch(raw, hint);

      if (match) found.set(`${match.game}-${match.id}`, match);
    });
  };

  if (Array.isArray(data)) {
    add(data, "");
  } else if (data && typeof data === "object") {
    const inner =
      data.data && typeof data.data === "object" && !Array.isArray(data.data)
        ? data.data
        : data;

    if (Array.isArray(data.data)) add(data.data, "");

    Object.entries(inner).forEach(([key, value]) => {
      if (Array.isArray(value)) add(value, BUCKETS[key] || "");
    });
  }

  return [...found.values()];
}

function parseNews(data) {
  const list = Array.isArray(data) ? data : data?.items || data?.articles || [];

  return list
    .map((item) => ({
      title: text(item.title),
      url: safeUrl(item.url || item.link),
      image: safeUrl(item.image || item.thumbnail),
      source: text(item.source),
      age: text(item.age),
    }))
    .filter((item) => item.title && item.url);
}

/* =========================================================
   DATA HOOK (polling, pauses while the tab is hidden)
   ========================================================= */

function useFeed(url, parse, intervalMs) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: false,
    updatedAt: 0,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer = null;
    let controller = null;

    const schedule = () => {
      if (!stopped) timer = setTimeout(load, intervalMs);
    };

    const load = async () => {
      if (document.hidden) {
        schedule();

        return;
      }

      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) throw new Error(`Request failed (${response.status})`);

        const data = parse(await response.json());

        if (!stopped) {
          setState({ data, loading: false, error: false, updatedAt: Date.now() });
        }
      } catch (error) {
        if (stopped || error?.name === "AbortError") return;

        // Keep showing the last good data if a refresh fails.
        setState((current) => ({ ...current, loading: false, error: true }));
      }

      schedule();
    };

    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        load();
      }
    };

    load();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, parse, intervalMs, nonce]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: false }));
    setNonce((value) => value + 1);
  }, []);

  return { ...state, reload };
}

/* =========================================================
   ICONS
   ========================================================= */

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 5h5v5" />
      <path d="m19 5-8 8" />
      <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

/* =========================================================
   MATCH PIECES
   ========================================================= */

function TeamLogo({ team }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [team.logo]);

  return (
    <span className="team-logo">
      {team.logo && !failed ? (
        <img
          src={team.logo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        initials(team.name)
      )}
    </span>
  );
}

function StatusPill({ match }) {
  if (match.status === "live") {
    return (
      <span className="status-pill live">
        <i className="live-dot" />
        Live
      </span>
    );
  }

  if (match.status === "finished") {
    return <span className="status-pill">Final</span>;
  }

  if (match.note) {
    return <span className="status-pill">{match.note}</span>;
  }

  return (
    <span className="status-pill">
      {countdown(match.startsAt) || kickoffLabel(match.startsAt)}
    </span>
  );
}

function MatchCard({ match }) {
  const [a, b] = match.teams;
  const decided =
    match.status === "finished" &&
    a.score !== null &&
    b.score !== null &&
    a.score !== b.score;
  const showScore = match.status !== "upcoming";

  const Tag = match.url ? "a" : "div";
  const linkProps = match.url
    ? { href: match.url, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Tag className="system-card match-card" {...linkProps}>
      <div className="match-top">
        <span className="match-game">
          {gameLabel(match.game)}
          {match.bestOf ? ` ${match.bestOf}` : ""}
        </span>

        <StatusPill match={match} />
      </div>

      <div className="match-teams">
        {[a, b].map((team, index) => {
          const other = index === 0 ? b : a;
          const lost = decided && team.score < other.score;

          return (
            <div className={`team-row ${lost ? "lost" : ""}`} key={index}>
              <TeamLogo team={team} />

              <span className="team-name">{team.name}</span>

              {showScore && (
                <span className="team-score">{team.score ?? "-"}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="match-foot">
        <span className="match-event">{match.event || "Esports"}</span>

        {match.status === "live" && match.url && <span>Watch live</span>}
      </div>
    </Tag>
  );
}

function StripItem({ match }) {
  const [a, b] = match.teams;
  const live = match.status === "live";

  const Tag = match.url ? "a" : "div";
  const linkProps = match.url
    ? { href: match.url, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Tag className="strip-item" {...linkProps}>
      {live ? (
        <i className="live-dot" />
      ) : (
        <span className="strip-time">
          {countdown(match.startsAt) || kickoffLabel(match.startsAt)}
        </span>
      )}

      <span>{a.name}</span>

      {live ? (
        <b className="strip-score">
          {a.score ?? 0} : {b.score ?? 0}
        </b>
      ) : (
        <span className="strip-vs">vs</span>
      )}

      <span>{b.name}</span>

      <span className="strip-game">{gameLabel(match.game)}</span>
    </Tag>
  );
}

function NewsCard({ item, featured }) {
  const [failed, setFailed] = useState(false);

  return (
    <a
      className={`system-card news-card ${featured ? "featured" : ""}`}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {item.image && !failed && (
        <span className="news-thumb">
          <img
            src={item.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setFailed(true)}
          />
        </span>
      )}

      <span className="news-body">
        <span className="news-title">{item.title}</span>

        <span className="news-meta">
          {[item.source, item.age].filter(Boolean).join(", ")}
        </span>
      </span>
    </a>
  );
}

function Skeletons({ count = 6 }) {
  return (
    <div className="system-grid">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index} />
      ))}
    </div>
  );
}

function EmptyState({ title, body, onAction, actionLabel }) {
  return (
    <div className="systems-empty">
      <div className="systems-empty-icon">
        <SearchIcon />
      </div>

      <h3>{title}</h3>

      <p>{body}</p>

      {onAction && (
        <button type="button" className="hub-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ErrorNote({ message, onRetry }) {
  return (
    <div className="hub-note" role="alert">
      <span>{message}</span>

      <button type="button" className="hub-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function Home() {
  const matchesFeed = useFeed(ESPORTS_API, parseMatches, MATCH_REFRESH_MS);
  const newsFeed = useFeed(NEWS_API, parseNews, NEWS_REFRESH_MS);

  const [query, setQuery] = useState("");
  const [game, setGame] = useState("all");
  const [userTab, setUserTab] = useState(null);
  const [matchLimit, setMatchLimit] = useState(MATCH_PAGE_SIZE);
  const [newsLimit, setNewsLimit] = useState(NEWS_FIRST_PAGE);

  const searchRef = useRef(null);

  const allMatches = useMemo(() => matchesFeed.data || [], [matchesFeed.data]);
  const allNews = useMemo(() => newsFeed.data || [], [newsFeed.data]);
  const q = query.trim().toLowerCase();

  const liveCount = useMemo(
    () => allMatches.filter((match) => match.status === "live").length,
    [allMatches]
  );

  const activeTab = userTab || (liveCount > 0 ? "live" : "upcoming");

  /* ---------- filtering ---------- */

  const groups = useMemo(() => {
    const visible = allMatches.filter((match) => {
      if (game !== "all" && match.game !== game) return false;
      if (!q) return true;

      return `${match.teams[0].name} ${match.teams[1].name} ${match.event} ${gameLabel(
        match.game
      )}`
        .toLowerCase()
        .includes(q);
    });

    const soonest = (a, b) =>
      (a.startsAt || Infinity) - (b.startsAt || Infinity);

    return {
      live: visible.filter((m) => m.status === "live").sort(soonest),
      upcoming: visible.filter((m) => m.status === "upcoming").sort(soonest),
      finished: visible
        .filter((m) => m.status === "finished")
        .sort((a, b) => b.startsAt - a.startsAt),
    };
  }, [allMatches, game, q]);

  const news = useMemo(
    () =>
      allNews.filter(
        (item) =>
          !q || `${item.title} ${item.source}`.toLowerCase().includes(q)
      ),
    [allNews, q]
  );

  const strip = useMemo(() => {
    const live = allMatches.filter((match) => match.status === "live");
    const soon = allMatches
      .filter(
        (match) =>
          match.status === "upcoming" &&
          match.startsAt &&
          match.startsAt - Date.now() < 24 * 60 * 60 * 1000
      )
      .sort((a, b) => a.startsAt - b.startsAt);

    return [...live, ...soon].slice(0, 10);
  }, [allMatches]);

  useEffect(() => {
    setMatchLimit(MATCH_PAGE_SIZE);
  }, [game, activeTab, q]);

  useEffect(() => {
    setNewsLimit(NEWS_FIRST_PAGE);
  }, [q]);

  /* ---------- "/" focuses search, Esc clears it ---------- */

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;

      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (
        event.key === "Escape" &&
        document.activeElement === searchRef.current
      ) {
        setQuery("");
        searchRef.current?.blur();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- derived view data ---------- */

  const tabMatches = groups[activeTab];
  const shownMatches = tabMatches.slice(0, matchLimit);

  const featuredIndex = Math.max(
    0,
    news.findIndex((item) => item.image)
  );
  const orderedNews = news.length
    ? [news[featuredIndex], ...news.filter((_, index) => index !== featuredIndex)]
    : [];
  const shownNews = orderedNews.slice(0, newsLimit);

  const matchesNote = matchesFeed.error
    ? allMatches.length > 0
      ? "Could not refresh, showing the last update"
      : ""
    : matchesFeed.updatedAt
    ? `Updated ${timeFormat.format(matchesFeed.updatedAt)}`
    : "";

  return (
    <main className="explorer">
      {/* ================= NAV ================= */}

      <nav className="explorer-nav">
        <a href="/" className="explorer-brand">
          <span className="explorer-brand-logo">
            <img src={LOGO_SRC} alt="" draggable={false} />
          </span>

          <span className="explorer-brand-copy">
            <strong>Fades</strong>
            <span>Gaming</span>
          </span>
        </a>

        <div className="explorer-nav-links">
          <a className="explorer-nav-link" href="#matches">
            Matches
          </a>
          <a className="explorer-nav-link" href="#news">
            News
          </a>
          <a className="explorer-nav-link" href="#soon">
            Coming soon
          </a>
          <a className="explorer-nav-link" href="https://fades.lol">
            Fades
          </a>
        </div>
      </nav>

      <div className="explorer-main">
        {/* ================= HERO ================= */}

        <section className="explorer-hero">
          <span className="explorer-eyebrow">
            {liveCount > 0 ? (
              <>
                <i className="live-dot" />
                {liveCount} {liveCount === 1 ? "match" : "matches"} live now
              </>
            ) : (
              <>
                <span className="explorer-eyebrow-dot" />
                Esports hub
              </>
            )}
          </span>

          <h1>
            Every match.
            <br />
            <span>Every story.</span>
          </h1>

          <p>
            Live scores, upcoming matches and the latest news from CS2,
            Valorant, Dota 2 and League of Legends.
          </p>

          <div className="explorer-search" role="search">
            <span className="explorer-search-icon">
              <SearchIcon />
            </span>

            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teams, events and news"
              aria-label="Search teams, events and news"
              autoComplete="off"
              spellCheck={false}
            />

            {query ? (
              <button
                type="button"
                className="explorer-search-kbd"
                onClick={() => setQuery("")}
              >
                Clear
              </button>
            ) : (
              <span className="explorer-search-kbd" aria-hidden="true">
                /
              </span>
            )}
          </div>
        </section>

        {/* ================= LIVE STRIP ================= */}

        {strip.length > 0 && (
          <div className="hub-strip" aria-label="Live and starting soon">
            <div className="hub-strip-track">
              {strip.map((match) => (
                <StripItem key={`${match.game}-${match.id}`} match={match} />
              ))}
            </div>
          </div>
        )}

        {/* ================= MATCHES ================= */}

        <section className="systems-section hub-section" id="matches">
          <div className="section-heading">
            <div className="section-heading-copy">
              <span>Esports</span>
              <h2>Matches</h2>
              <p>Scores refresh every 30 seconds.</p>
            </div>

            {matchesNote && <span className="hub-updated">{matchesNote}</span>}
          </div>

          <div className="hub-toolbar">
            <div className="hub-pills" role="group" aria-label="Match status">
              {MATCH_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => setUserTab(tab.id)}
                >
                  {tab.label}
                  <span className="hub-count">{groups[tab.id].length}</span>
                </button>
              ))}
            </div>

            <div className="hub-pills" role="group" aria-label="Game">
              {GAMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={game === item.id}
                  onClick={() => setGame(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {matchesFeed.loading && !matchesFeed.data ? (
            <Skeletons />
          ) : matchesFeed.error && !matchesFeed.data ? (
            <ErrorNote
              message="Matches are unavailable right now."
              onRetry={matchesFeed.reload}
            />
          ) : tabMatches.length === 0 ? (
            q ? (
              <EmptyState
                title="No matches found"
                body={`Nothing matches "${query.trim()}" for this filter.`}
                onAction={() => setQuery("")}
                actionLabel="Clear search"
              />
            ) : (
              <EmptyState
                title={EMPTY_COPY[activeTab][0]}
                body={EMPTY_COPY[activeTab][1]}
              />
            )
          ) : (
            <>
              <div className="system-grid">
                {shownMatches.map((match) => (
                  <MatchCard key={`${match.game}-${match.id}`} match={match} />
                ))}
              </div>

              {tabMatches.length > shownMatches.length && (
                <button
                  type="button"
                  className="hub-button hub-more"
                  onClick={() => setMatchLimit((value) => value + MATCH_PAGE_SIZE)}
                >
                  Show more matches
                </button>
              )}
            </>
          )}
        </section>

        {/* ================= NEWS ================= */}

        <section className="systems-section hub-section" id="news">
          <div className="section-heading">
            <div className="section-heading-copy">
              <span>Headlines</span>
              <h2>Gaming news</h2>
              <p>From IGN, PC Gamer, Eurogamer and Rock Paper Shotgun.</p>
            </div>
          </div>

          {newsFeed.loading && !newsFeed.data ? (
            <Skeletons />
          ) : newsFeed.error && !newsFeed.data ? (
            <ErrorNote
              message="News is unavailable right now."
              onRetry={newsFeed.reload}
            />
          ) : shownNews.length === 0 ? (
            <EmptyState
              title="No headlines found"
              body={
                q
                  ? `Nothing matches "${query.trim()}".`
                  : "New headlines will show up here."
              }
              onAction={q ? () => setQuery("") : undefined}
              actionLabel="Clear search"
            />
          ) : (
            <>
              <div className="system-grid">
                {shownNews.map((item, index) => (
                  <NewsCard key={item.url} item={item} featured={index === 0} />
                ))}
              </div>

              {orderedNews.length > shownNews.length && (
                <button
                  type="button"
                  className="hub-button hub-more"
                  onClick={() => setNewsLimit((value) => value + NEWS_PAGE_SIZE)}
                >
                  More headlines
                </button>
              )}
            </>
          )}
        </section>

        {/* ================= COMING SOON ================= */}

        <section className="systems-section hub-section" id="soon">
          <div className="section-heading">
            <div className="section-heading-copy">
              <span>Next up</span>
              <h2>Coming soon</h2>
              <p>Built on your Fades account.</p>
            </div>
          </div>

          <div className="system-grid">
            {ROADMAP.map((item) => (
              <div className="system-card" key={item.name}>
                <div className="system-card-top">
                  <div className="system-icon">
                    <img src={LOGO_SRC} alt="" draggable={false} />
                  </div>

                  <span className="system-status">
                    <span className="system-status-dot" />
                    Coming soon
                  </span>
                </div>

                <h3>{item.name}</h3>
                <p>{item.description}</p>

                <div className="system-card-footer">
                  <span className="system-domain">gaming.fades.lol{item.path}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================= ABOUT ================= */}

        <section className="about-section" id="about">
          <div className="about-card">
            <div>
              <span className="about-kicker">About</span>

              <h2>Esports data, in one place.</h2>

              <p>
                Fades Gaming brings live scores, schedules and news together.
                Teams, tournaments and rankings are on the way, all tied to your
                Fades account.
              </p>
            </div>

            <div className="about-stats">
              <div className="about-stat">
                <strong>{liveCount}</strong>
                <span>Live now</span>
              </div>

              <div className="about-stat">
                <strong>{allMatches.length}</strong>
                <span>Matches tracked</span>
              </div>

              <div className="about-stat">
                <strong>{allNews.length}</strong>
                <span>Headlines</span>
              </div>

              <div className="about-stat">
                <strong>{GAMES.length - 1}</strong>
                <span>Games covered</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ================= FOOTER ================= */}

      <footer className="explorer-footer">
        <div className="explorer-footer-brand">
          <img src={LOGO_SRC} alt="" draggable={false} />
          <strong>Fades Gaming</strong>
          <span>&copy; {new Date().getFullYear()} Fades</span>
        </div>

        <div className="explorer-footer-links">
          <a href="https://fades.lol">
            Fades <ExternalIcon />
          </a>
          <a href="https://browse.fades.lol">
            Fades Browser <ExternalIcon />
          </a>
        </div>
      </footer>
    </main>
  );
}
