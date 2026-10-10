"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import "./dashboard.css";
import "./dashboard-fx.css";

const API_BASE = process.env.NEXT_PUBLIC_FADES_API || "https://api.fades.lol";
const GAMING_API = process.env.NEXT_PUBLIC_GAMING_API || `${API_BASE}/gaming`;
const SIGN_IN_URL =
  process.env.NEXT_PUBLIC_FADES_SIGNIN ||
  "https://fades.lol/acc/security/manage";
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "https://gaming.fades.lol";
const LOGO = process.env.NEXT_PUBLIC_LOGO || "/logo.png";

/* =========================================================
   API + SHARED HOOKS
========================================================= */

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${GAMING_API}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    /* Empty response body */
  }

  if (!response.ok) {
    throw Object.assign(
      new Error(data?.error || `Request failed (${response.status})`),
      { status: response.status }
    );
  }

  return data;
}

function useApi(path) {
  const [state, setState] = useState({
    data: null,
    loading: Boolean(path),
    error: "",
  });

  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return undefined;

    let stopped = false;

    setState((current) => ({ ...current, loading: true, error: "" }));

    api(path)
      .then((data) => {
        if (!stopped) setState({ data, loading: false, error: "" });
      })
      .catch((error) => {
        if (!stopped) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message,
          }));
        }
      });

    return () => {
      stopped = true;
    };
  }, [path, nonce]);

  return {
    ...state,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}

function useAct(done) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const act = useCallback(
    async (fn) => {
      setError("");
      setBusy(true);

      try {
        await fn();
        await done?.();
      } catch (error) {
        setError(error.message);
      } finally {
        setBusy(false);
      }
    },
    [done]
  );

  return { act, error, busy };
}

function useSession() {
  const [state, setState] = useState({ loading: true, me: null });

  const refresh = useCallback(async () => {
    try {
      setState({ loading: false, me: await api("/me") });
    } catch {
      setState({ loading: false, me: null });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, signedIn: Boolean(state.me?.user), refresh };
}

function useFields(initial) {
  const [values, setValues] = useState(initial);

  const bind = (key) => ({
    value: values[key],
    onChange: (event) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
  });

  return [values, bind, () => setValues(initial)];
}

/* =========================================================
   TOASTS
========================================================= */

const ToastCtx = createContext(() => {});
const useToast = () => useContext(ToastCtx);

/* =========================================================
   ICONS
========================================================= */

const ICONS = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  teams:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  parties:
    "M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7a4 4 0 0 0-3.9 3.1l-1.3 6A3 3 0 0 0 4.4 18c.9 0 1.7-.5 2.1-1.2L7.5 15h9l1 1.8c.4.7 1.2 1.2 2.1 1.2a3 3 0 0 0 2.9-3.9l-1.3-6A4 4 0 0 0 17.3 5z",
  tournaments:
    "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-1.97 1.5C7.2 18.85 6 20.24 6 22M14 14.66V17c0 .55.47.98 1.97 1.5.83.35 2.03 1.74 2.03 3.5M18 2H6v7a6 6 0 0 0 12 0V2z",
  posts:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  games: "M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z",
  follows:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  messages:
    "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z",
  predictions:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  profile: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  account: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  settings:
    "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  reports: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  reply: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v3",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash:
    "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  smile:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  clip: "M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  plus: "M12 5v14M5 12h14",
  x: "M18 6L6 18M6 6l12 12",
  search: "M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  more: "M12 12h.01M19 12h.01M5 12h.01",
  check: "M20 6L9 17l-5-5",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  image: "M21 15l-5-5L5 21M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3",
  back: "M19 12H5M12 19l-7-7 7-7",
  down: "M6 9l6 6 6-6",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      className="fx-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/* =========================================================
   SMALL PIECES
========================================================= */

const csv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const ago = (ms) => {
  if (!ms) return "";

  const minutes = Math.floor((Date.now() - ms) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;

  return `${Math.floor(minutes / 1440)}d ago`;
};

const Err = ({ e }) =>
  e ? (
    <p className="form-error" role="alert">
      {e}
    </p>
  ) : null;

const Btn = ({ primary, ...props }) => (
  <button
    type="button"
    className={`hub-button ${primary ? "primary" : ""}`}
    {...props}
  />
);

const Empty = ({ title, body }) => (
  <div className="systems-empty">
    <h3>{title}</h3>
    <p>{body}</p>
  </div>
);

const Card = ({ top, pill, title, sub, children, extra }) => (
  <div className="system-card community-card">
    <div className="match-top">
      <span className="match-game">{top}</span>
      {pill != null && pill !== "" && (
        <span className="status-pill">{pill}</span>
      )}
    </div>

    <strong className="card-title">{title}</strong>

    {sub && <span className="card-sub">{sub}</span>}

    {children && <div className="card-actions">{children}</div>}

    {extra}
  </div>
);

const GameSel = ({ games, value, ...props }) => (
  <select
    className="hub-input"
    value={value || games[0]?.id || ""}
    {...props}
  >
    {games.map((game) => (
      <option key={game.id} value={game.id}>
        {game.label}
      </option>
    ))}
  </select>
);

function Loading({ list }) {
  return list.loading && !list.data ? (
    <div className="skeleton-card" />
  ) : (
    <Err e={list.error} />
  );
}

/** counts up to a number when it first appears or changes */
function CountUp({ value }) {
  const n = Number(value);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(n)) return undefined;

    let raf;
    let start;

    const step = (time) => {
      if (start === undefined) start = time;
      const p = Math.min((time - start) / 700, 1);
      setShown(Math.round(n * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);

  if (value === undefined || value === null) return "-";
  return Number.isFinite(n) ? shown : value;
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fx-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fx-modal-scrim" onClick={onClose} />
      <div className="fx-modal-card">
        <div className="fx-modal-head">
          <strong>{title}</strong>
          <button type="button" className="msg-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   OVERVIEW
========================================================= */

function Overview({ session, setTab, prefs }) {
  const stats = useApi("/stats");
  const s = stats.data || {};

  const { user, profile, teams, follows, unread, admin } = session.me;

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = profile?.gamertag || user.username;

  const mine = [
    ["Teams", teams.length],
    ["Following", follows],
    ["Unread", unread],
    ["Role", admin ? "Mod" : "Player"],
  ];

  const actions = [
    ["teams", "Create a team", "Start a squad and invite players.", "teams"],
    ["tournaments", "Host a tournament", "Run a bracket and report the results.", "tournaments"],
    ["posts", "Post to the hub", "Share a clip, a guide or a thought.", "posts"],
    ["messages", "Catch up on chats", "Read your DMs, groups and team chats.", "messages"],
    ["profile", "Update your profile", "Gamertag, platforms and social links.", "profile"],
    ["account", "Review your account", "Your ID, linked profiles and data.", "account"],
  ];

  const hub = [
    ["Players", s.players],
    ["Open parties", s.openLfg],
    ["Tournaments", s.tournaments],
    ["Posts", s.posts],
  ];

  return (
    <>
      <div className="db-hero">
        <div>
          <span className="kicker">{greeting}</span>
          <h2>
            Welcome back, <span className="fx-grad">{name}</span>
          </h2>
          <p>
            {unread > 0
              ? `You have ${unread} unread ${unread === 1 ? "message" : "messages"} waiting.`
              : "You're all caught up. Time to find a squad."}
          </p>
        </div>

        {unread > 0 && (
          <Btn primary onClick={() => setTab("messages")}>
            <Icon name="messages" /> Open messages
          </Btn>
        )}
      </div>

      <div className="db-stats">
        {mine.map(([label, value]) => (
          <div className="db-stat" key={label}>
            <strong>
              <CountUp value={value} />
            </strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="system-grid">
        {actions.map(([icon, title, body, target]) => (
          <button
            type="button"
            className="system-card fx-action"
            key={title}
            onClick={() => setTab(target)}
          >
            <span className="fx-action-icon">
              <Icon name={icon} size={18} />
            </span>
            <strong className="card-title">{title}</strong>
            <span className="card-sub">{body}</span>
          </button>
        ))}
      </div>

      {prefs.hubStats === "on" && (
        <div className="db-banner">
          <div>
            <span className="kicker">Across the hub</span>
            <h2>Everyone&apos;s playing.</h2>
            <p>
              Live totals from the Fades gaming community. Jump in, find a
              squad and climb the board.
            </p>

            <div className="row">
              <a className="hub-button primary" href={HUB_URL}>
                Open the hub
              </a>

              <Btn onClick={() => setTab("tournaments")}>Host a tournament</Btn>
            </div>
          </div>

          <div
            className="db-stats"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {hub.map(([label, value]) => (
              <div className="db-stat" key={label}>
                <strong>
                  <CountUp value={value} />
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================
   PROFILE
========================================================= */

const LINK_KEYS = [
  "steam",
  "discord",
  "twitch",
  "youtube",
  "twitter",
  "riot",
  "battlenet",
  "xbox",
  "psn",
  "epic",
];

function ProfileTab({ onSaved }) {
  const d = useApi("/profiles/me");

  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(false);

  const { act, error, busy } = useAct(onSaved);

  useEffect(() => {
    const p = d.data?.profile;

    if (p) {
      setF({
        gamertag: p.gamertag || "",
        bio: p.bio || "",
        country: p.country || "",
        platforms: (p.platforms || []).join(", "),
        favoriteGames: (p.favoriteGames || []).join(", "),
        links: { ...(p.links || {}) },
      });
    }
  }, [d.data]);

  if (!f) return <Loading list={d} />;

  const set = (key) => (event) => {
    setSaved(false);
    setF((current) => ({ ...current, [key]: event.target.value }));
  };

  const save = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/profiles/me", {
        method: "PUT",
        body: {
          ...f,
          platforms: csv(f.platforms),
          favoriteGames: csv(f.favoriteGames),
        },
      });

      setSaved(true);
    });
  };

  return (
    <form className="form-card" onSubmit={save}>
      <input className="hub-input" placeholder="Gamertag" maxLength={32} value={f.gamertag} onChange={set("gamertag")} />
      <input className="hub-input" placeholder="Country" maxLength={40} value={f.country} onChange={set("country")} />
      <input className="hub-input" placeholder="Platforms (PC, PS5, ...)" value={f.platforms} onChange={set("platforms")} />
      <input className="hub-input" placeholder="Favourite game ids (cs2, valorant, ...)" value={f.favoriteGames} onChange={set("favoriteGames")} />

      <textarea className="hub-input wide" placeholder="Bio" maxLength={300} rows={3} value={f.bio} onChange={set("bio")} />

      {LINK_KEYS.map((key) => (
        <input
          key={key}
          className="hub-input"
          placeholder={key}
          maxLength={64}
          value={f.links[key] || ""}
          onChange={(event) =>
            setF((current) => ({
              ...current,
              links: { ...current.links, [key]: event.target.value },
            }))
          }
        />
      ))}

      <button type="submit" className="hub-button primary" disabled={busy}>
        Save profile
      </button>

      {saved && <small>Profile saved.</small>}

      <Err e={error} />
    </form>
  );
}

/* =========================================================
   TEAMS
========================================================= */

function TeamManage({ id, meId, onChange }) {
  const d = useApi(`/teams/${id}`);

  const { act, error, busy } = useAct(async () => {
    d.reload();
    onChange();
  });

  const t = d.data?.team;

  if (!t) return <Err e={d.error} />;

  const owner = t.ownerId === meId;
  const staff = owner || t.myRole === "admin";

  const call = (path, method, body) =>
    act(() => api(`/teams/${id}${path}`, { method, body }));

  return (
    <div className="comments">
      <Err e={error} />

      {(t.members || []).map((m) => (
        <p key={m.userId}>
          <b>{m.username}</b> {m.role}{" "}

          {owner && m.role !== "owner" && (
            <>
              <Btn
                disabled={busy}
                onClick={() =>
                  call(`/members/${m.userId}`, "PATCH", {
                    role: m.role === "admin" ? "member" : "admin",
                  })
                }
              >
                {m.role === "admin" ? "Demote" : "Make admin"}
              </Btn>

              <Btn
                disabled={busy}
                onClick={() => call(`/members/${m.userId}`, "PATCH", { role: "owner" })}
              >
                Make owner
              </Btn>
            </>
          )}

          {m.role !== "owner" &&
            m.userId !== meId &&
            (owner || (staff && m.role === "member")) && (
              <Btn disabled={busy} onClick={() => call(`/members/${m.userId}`, "DELETE")}>
                Remove
              </Btn>
            )}
        </p>
      ))}

      {(t.requests || []).map((r) => (
        <p key={r.userId}>
          <b>{r.username}</b> wants to join {r.message && `- ${r.message}`}{" "}

          <Btn primary disabled={busy} onClick={() => call(`/requests/${r.userId}/approve`, "POST")}>
            Approve
          </Btn>

          <Btn disabled={busy} onClick={() => call(`/requests/${r.userId}`, "DELETE")}>
            Decline
          </Btn>
        </p>
      ))}

      <div className="card-actions">
        {staff && (
          <Btn disabled={busy} onClick={() => call("", "PATCH", { open: !t.open })}>
            {t.open ? "Switch to invite only" : "Switch to open"}
          </Btn>
        )}

        {owner ? (
          <Btn disabled={busy} onClick={() => confirm("Delete this team?") && call("", "DELETE")}>
            Delete team
          </Btn>
        ) : (
          <Btn disabled={busy} onClick={() => call("/leave", "POST")}>
            Leave team
          </Btn>
        )}
      </div>
    </div>
  );
}

function TeamsTab({ games, session }) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(null);

  const [f, bind, reset] = useFields({
    name: "",
    tag: "",
    game: "",
    region: "",
    description: "",
  });

  const { act, error, busy } = useAct(session.refresh);

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/teams", {
        method: "POST",
        body: { ...f, game: f.game || games[0]?.id },
      });

      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "Create a team"}
        </Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Team name" maxLength={40} required {...bind("name")} />
          <input className="hub-input" placeholder="Tag (2-5)" maxLength={5} required {...bind("tag")} />

          <GameSel games={games} {...bind("game")} value={f.game} />

          <input className="hub-input" placeholder="Region" maxLength={30} {...bind("region")} />

          <textarea className="hub-input wide" placeholder="Description" maxLength={500} rows={2} {...bind("description")} />

          <button type="submit" className="hub-button primary" disabled={busy}>
            Create team
          </button>
        </form>
      )}

      <Err e={error} />

      {session.me.teams.length === 0 ? (
        <Empty title="No teams yet" body="Create one or join a team from the hub." />
      ) : (
        <div className="stack">
          {session.me.teams.map((t) => (
            <Card
              key={t.id}
              top={games.find((g) => g.id === t.game)?.label || t.game}
              pill={t.myRole}
              title={`${t.name} [${t.tag}]`}
              sub={`${t.memberCount} members · ${t.open ? "Open" : "Invite only"}`}
              extra={
                managing === t.id && (
                  <TeamManage id={t.id} meId={session.me.user.id} onChange={session.refresh} />
                )
              }
            >
              <Btn onClick={() => setManaging(managing === t.id ? null : t.id)}>
                {managing === t.id ? "Close" : "Manage"}
              </Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   PARTIES
========================================================= */

function PartiesTab({ games, meId }) {
  const list = useApi("/lfg?status=all&limit=100");
  const { act, error, busy } = useAct(list.reload);

  const mine = (list.data?.parties || []).filter(
    (party) =>
      party.authorId === meId ||
      (party.joined || []).some((member) => member.userId === meId)
  );

  return (
    <div className="community-panel">
      <Err e={error} />
      <Loading list={list} />

      {list.data && mine.length === 0 && (
        <Empty title="No parties" body="Post one from the Community section." />
      )}

      <div className="system-grid">
        {mine.map((party) => {
          const author = party.authorId === meId;
          const live = ["open", "full"].includes(party.status);

          return (
            <Card
              key={party.id}
              top={games.find((game) => game.id === party.game)?.label || party.game}
              pill={`${party.status} · ${party.joined.length}/${party.playersNeeded}`}
              title={party.title}
              sub={[party.platform, party.rank, party.region].filter(Boolean).join(" · ")}
            >
              {author && live && (
                <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${party.id}/close`, { method: "POST" }))}>
                  Close
                </Btn>
              )}

              {author && (
                <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${party.id}`, { method: "DELETE" }))}>
                  Delete
                </Btn>
              )}

              {!author && live && (
                <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${party.id}/leave`, { method: "POST" }))}>
                  Leave
                </Btn>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   TOURNAMENTS
========================================================= */

function ReportMatches({ id, onChange }) {
  const d = useApi(`/tournaments/${id}`);
  const [scores, setScores] = useState({});

  const { act, error, busy } = useAct(async () => {
    d.reload();
    onChange();
  });

  const t = d.data?.tournament;

  if (!t) return <Err e={d.error} />;

  const ready = (t.rounds || []).flat().filter((match) => match.status === "ready");

  const set = (matchId, side, value) =>
    setScores((current) => ({
      ...current,
      [matchId]: { ...current[matchId], [side]: value },
    }));

  return (
    <div className="comments">
      <Err e={error} />

      {t.status === "registration" && (
        <p>Entrants: {t.entrants.map((entrant) => entrant.name).join(", ") || "none yet"}</p>
      )}

      {t.status !== "registration" && ready.length === 0 && (
        <p>{t.winner ? `Winner: ${t.winner.name}` : "No matches waiting for a result."}</p>
      )}

      {ready.map((match) => (
        <div className="bracket-report" key={match.id}>
          <span>
            {match.a.name} vs {match.b.name}
          </span>

          <input
            className="hub-input"
            type="number"
            min="0"
            aria-label={`${match.a.name} score`}
            onChange={(event) => set(match.id, "a", event.target.value)}
          />

          <input
            className="hub-input"
            type="number"
            min="0"
            aria-label={`${match.b.name} score`}
            onChange={(event) => set(match.id, "b", event.target.value)}
          />

          <Btn
            disabled={busy}
            onClick={() =>
              act(() =>
                api(`/tournaments/${id}/matches/${match.id}/report`, {
                  method: "POST",
                  body: {
                    scoreA: Number(scores[match.id]?.a),
                    scoreB: Number(scores[match.id]?.b),
                  },
                })
              )
            }
          >
            Save result
          </Btn>
        </div>
      ))}
    </div>
  );
}

function TournamentsTab({ games, meId }) {
  const list = useApi("/tournaments?limit=100");
  const { act, error, busy } = useAct(list.reload);

  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(null);

  const [f, bind, reset] = useFields({
    name: "",
    game: "",
    mode: "solo",
    maxEntrants: "16",
    prize: "",
  });

  const mine = (list.data?.tournaments || []).filter(
    (tournament) => tournament.ownerId === meId
  );

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/tournaments", {
        method: "POST",
        body: {
          ...f,
          game: f.game || games[0]?.id,
          maxEntrants: Number(f.maxEntrants) || 16,
        },
      });

      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "Host a tournament"}
        </Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Tournament name" maxLength={80} required {...bind("name")} />

          <GameSel games={games} {...bind("game")} value={f.game} />

          <select className="hub-input" {...bind("mode")}>
            <option value="solo">Solo</option>
            <option value="team">Teams</option>
          </select>

          <input className="hub-input" type="number" min="2" max="64" placeholder="Max entrants" {...bind("maxEntrants")} />

          <input className="hub-input" placeholder="Prize" maxLength={100} {...bind("prize")} />

          <button type="submit" className="hub-button primary" disabled={busy}>
            Create
          </button>
        </form>
      )}

      <Err e={error} />
      <Loading list={list} />

      {list.data && mine.length === 0 && (
        <Empty title="No tournaments hosted" body="Host one and let players sign up." />
      )}

      <div className="stack">
        {mine.map((tournament) => (
          <Card
            key={tournament.id}
            top={games.find((game) => game.id === tournament.game)?.label || tournament.game}
            pill={tournament.status}
            title={tournament.name}
            sub={`${tournament.entrantCount}/${tournament.maxEntrants} entered · ${
              tournament.mode === "team" ? "Teams" : "Solo"
            }${tournament.winner ? ` · Winner: ${tournament.winner.name}` : ""}`}
            extra={
              managing === tournament.id && (
                <ReportMatches id={tournament.id} onChange={list.reload} />
              )
            }
          >
            {tournament.status === "registration" && tournament.entrantCount >= 2 && (
              <Btn
                primary
                disabled={busy}
                onClick={() => act(() => api(`/tournaments/${tournament.id}/start`, { method: "POST" }))}
              >
                Start
              </Btn>
            )}

            <Btn onClick={() => setManaging(managing === tournament.id ? null : tournament.id)}>
              {managing === tournament.id ? "Close" : "Entrants and results"}
            </Btn>

            <Btn
              disabled={busy}
              onClick={() =>
                confirm("Delete this tournament?") &&
                act(() => api(`/tournaments/${tournament.id}`, { method: "DELETE" }))
              }
            >
              Delete
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   POSTS
========================================================= */

function PostsTab({ games, meId }) {
  const list = useApi(`/posts?author=${encodeURIComponent(meId)}&limit=50`);

  const { act, error, busy } = useAct(list.reload);
  const [open, setOpen] = useState(false);

  const [f, bind, reset] = useFields({ title: "", body: "", game: "" });

  const posts = list.data?.posts || [];

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/posts", { method: "POST", body: f });
      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "New post"}
        </Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Title" maxLength={120} required {...bind("title")} />

          <select className="hub-input" {...bind("game")}>
            <option value="">No game</option>

            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.label}
              </option>
            ))}
          </select>

          <textarea className="hub-input wide" placeholder="Share a clip, a guide or a thought" maxLength={5000} rows={3} {...bind("body")} />

          <button type="submit" className="hub-button primary" disabled={busy}>
            Post
          </button>
        </form>
      )}

      <Err e={error} />
      <Loading list={list} />

      {list.data && posts.length === 0 && (
        <Empty title="No posts yet" body="Your posts will show up here." />
      )}

      <div className="stack">
        {posts.map((post) => (
          <Card
            key={post.id}
            top={games.find((game) => game.id === post.game)?.label || post.game || "General"}
            pill={ago(post.createdAt)}
            title={post.title}
            sub={`${post.likeCount} likes · ${post.commentCount} comments`}
          >
            <Btn
              disabled={busy}
              onClick={() =>
                confirm("Delete this post?") &&
                act(() => api(`/posts/${post.id}`, { method: "DELETE" }))
              }
            >
              Delete
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   GAMES
========================================================= */

function GamesTab({ allGames, meId, reloadGames }) {
  const { act, error, busy } = useAct(reloadGames);

  const [open, setOpen] = useState(false);

  const [f, bind, reset] = useFields({ label: "", genre: "", description: "" });

  const mine = allGames.filter((game) => game.custom && game.ownerId === meId);

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/games", { method: "POST", body: f });
      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "Add a game"}
        </Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Game name" maxLength={60} required {...bind("label")} />
          <input className="hub-input" placeholder="Genre" maxLength={40} {...bind("genre")} />
          <textarea className="hub-input wide" placeholder="Description" maxLength={500} rows={2} {...bind("description")} />

          <button type="submit" className="hub-button primary" disabled={busy}>
            Add game
          </button>
        </form>
      )}

      <Err e={error} />

      {mine.length === 0 ? (
        <Empty title="No community games" body="Add a game so players can find squads for it." />
      ) : (
        <div className="system-grid">
          {mine.map((game) => (
            <Card key={game.id} top={game.genre || "Game"} title={game.label} sub={game.description}>
              <Btn
                disabled={busy}
                onClick={() =>
                  confirm(`Delete ${game.label}?`) &&
                  act(() => api(`/games/${game.id}`, { method: "DELETE" }))
                }
              >
                Delete
              </Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   FOLLOWING
========================================================= */

function FollowsTab({ games, onChange }) {
  const list = useApi("/follows");

  const { act, error, busy } = useAct(async () => {
    list.reload();
    onChange();
  });

  const [f, bind, reset] = useFields({ kind: "game", targetId: "" });

  const groups = [
    ["game", "Games", list.data?.games || []],
    ["team", "Teams", list.data?.teams || []],
    ["user", "Players", list.data?.users || []],
  ];

  const follow = (event) => {
    event.preventDefault();

    act(async () => {
      const targetId = f.kind === "game" ? f.targetId || games[0]?.id : f.targetId;

      if (!targetId) throw new Error("Enter an ID to follow.");

      await api("/follows", {
        method: "POST",
        body: { kind: f.kind, targetId: targetId.trim() },
      });

      reset();
    });
  };

  return (
    <div className="community-panel">
      <form className="form-card" onSubmit={follow}>
        <select className="hub-input" {...bind("kind")}>
          <option value="game">Game</option>
          <option value="team">Team ID</option>
          <option value="user">Player ID</option>
        </select>

        {f.kind === "game" ? (
          <GameSel games={games} value={f.targetId} onChange={(event) => bind("targetId").onChange(event)} />
        ) : (
          <input className="hub-input" placeholder="ID" required {...bind("targetId")} />
        )}

        <button type="submit" className="hub-button primary" disabled={busy}>
          Follow
        </button>
      </form>

      <Err e={error || list.error} />

      {groups.map(([kind, label, ids]) => (
        <div key={kind}>
          <h3>{label}</h3>

          {ids.length === 0 ? (
            <p>Nothing followed yet.</p>
          ) : (
            <div className="hub-pills">
              {ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  title="Unfollow"
                  onClick={() =>
                    act(() =>
                      api(`/follows/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" })
                    )
                  }
                >
                  {kind === "game" ? games.find((game) => game.id === id)?.label || id : id} ×
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   MESSAGES: helpers
========================================================= */

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const VID_RE = /\.(mp4|webm|mov)(\?.*)?$/i;
const IMG_HOST_RE = /(i\.imgur\.com|cdn\.discordapp\.com|media\.discordapp\.net|media\.tenor\.com|media\d*\.giphy\.com|raw\.githubusercontent\.com)/i;
const URL_RE = /(https?:\/\/[^\s<]+)/g;
const HTTP_RE = /^https?:\/\//i;

const isImage = (url) => IMG_RE.test(url) || IMG_HOST_RE.test(url);
const isVideo = (url) => VID_RE.test(url);

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const initialOf = (name) => String(name || "?").trim().slice(0, 1).toUpperCase();

const hueOf = (seed) => {
  let h = 0;
  for (const c of String(seed || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

const clock = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const dayKey = (ms) => new Date(ms).toDateString();

const dayLabel = (ms) => {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

const isTemp = (m) => String(m.id).startsWith("tmp_");

const sortMsgs = (list) => [...list].sort((a, b) => a.createdAt - b.createdAt);

const mergeMsgs = (prev, incoming) => {
  const map = new Map(prev.map((m) => [m.id, m]));

  incoming.forEach((m) => {
    const old = map.get(m.id);
    map.set(m.id, old ? { ...old, ...m } : m);
  });

  return sortMsgs([...map.values()]);
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎮", "👏"];
const COMPOSER_EMOJI = ["😀", "😂", "😎", "🥳", "😭", "😡", "👍", "👎", "❤️", "🔥", "🎮", "🏆", "💀", "👀", "🙏", "✨"];
const REPORT_REASONS = ["Spam", "Harassment", "Hate or abuse", "Inappropriate content", "Something else"];

const channelSub = (c) =>
  ({
    group: `Group · ${c.members?.length || 0} members`,
    team: "Team chat",
    lfg: "Party chat",
    dm: "Direct message",
  }[c.type] || "Conversation");

function Face({ name, avatar, size = 36 }) {
  return (
    <span
      className="msg-face"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), "--h": hueOf(name) }}
    >
      {avatar ? <img src={avatar} alt="" /> : initialOf(name)}
    </span>
  );
}

function Linkified({ text }) {
  return text
    .split(URL_RE)
    .map((part, i) =>
      i % 2 ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      ) : (
        part
      )
    );
}

/* =========================================================
   MESSAGES: live message stream
   Uses the backend's Server-Sent Events stream and falls back
   to polling whenever the stream can't connect.
========================================================= */

function useLiveMessages(channelId, onEvent) {
  const [state, setState] = useState({
    messages: [],
    loading: true,
    error: "",
    hasMore: false,
  });

  const [live, setLive] = useState("connecting");
  const [nonce, setNonce] = useState(0);

  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;

  const messagesRef = useRef([]);
  messagesRef.current = state.messages;

  useEffect(() => {
    let stopped = false;
    let es = null;
    let timer = null;

    const cid = encodeURIComponent(channelId);

    setState({ messages: [], loading: true, error: "", hasMore: false });
    setLive("connecting");

    const load = async (initial) => {
      try {
        const data = await api(`/channels/${cid}/messages?limit=60`);
        if (stopped) return;

        setState((s) => ({
          messages: mergeMsgs(initial ? [] : s.messages, data?.messages || []),
          loading: false,
          error: "",
          hasMore: initial ? Boolean(data?.hasMore) : s.hasMore,
        }));
      } catch (error) {
        if (!stopped) {
          setState((s) => ({ ...s, loading: false, error: s.messages.length ? "" : error.message }));
        }
      }
    };

    const stopPoll = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const startPoll = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (!document.hidden) load(false);
      }, 3500);
    };

    load(true);

    if (typeof EventSource === "undefined") {
      setLive("polling");
      startPoll();
    } else {
      es = new EventSource(`${GAMING_API}/channels/${cid}/stream`, { withCredentials: true });

      es.onopen = () => {
        if (stopped) return;
        setLive("live");
        stopPoll();
        load(false);
      };

      es.onmessage = (event) => {
        try {
          const ev = JSON.parse(event.data);
          if (!ev?.message) return;

          setState((s) => ({ ...s, messages: mergeMsgs(s.messages, [ev.message]) }));
          eventRef.current?.(ev);
        } catch {
          /* ignore malformed event */
        }
      };

      es.onerror = () => {
        if (stopped) return;
        setLive("polling");
        startPoll();
      };
    }

    // slow safety refresh in case an event was missed
    const safety = setInterval(() => {
      if (!document.hidden) load(false);
    }, 20000);

    return () => {
      stopped = true;
      es?.close();
      stopPoll();
      clearInterval(safety);
    };
  }, [channelId, nonce]);

  const put = useCallback(
    (message) =>
      setState((s) => ({ ...s, messages: mergeMsgs(s.messages, [message]) })),
    []
  );

  const swap = useCallback(
    (tempId, real) =>
      setState((s) => ({
        ...s,
        messages: mergeMsgs(
          s.messages.filter((m) => m.id !== tempId),
          real ? [real] : []
        ),
      })),
    []
  );

  const loadEarlier = useCallback(async () => {
    const first = messagesRef.current.find((m) => !isTemp(m));
    if (!first) return;

    try {
      const data = await api(
        `/channels/${encodeURIComponent(channelId)}/messages?limit=60&before=${first.createdAt}`
      );

      setState((s) => ({
        ...s,
        messages: mergeMsgs(s.messages, data?.messages || []),
        hasMore: Boolean(data?.hasMore),
      }));
    } catch {
      /* leave the button available to retry */
    }
  }, [channelId]);

  return {
    ...state,
    live,
    put,
    swap,
    loadEarlier,
    reload: () => setNonce((n) => n + 1),
  };
}

/* =========================================================
   MESSAGES: pieces
========================================================= */

function Attachments({ urls, onImage, onMedia }) {
  if (!urls?.length) return null;

  return (
    <div className={`msg-atts n${Math.min(urls.length, 4)}`}>
      {urls.map((url) =>
        isImage(url) ? (
          <button
            key={url}
            type="button"
            className="msg-att img"
            onClick={() => onImage(url)}
            aria-label="Open image"
          >
            <img
              src={url}
              alt=""
              loading="lazy"
              onLoad={onMedia}
              onError={(event) => event.currentTarget.closest(".msg-att")?.classList.add("broken")}
            />
          </button>
        ) : isVideo(url) ? (
          <video key={url} className="msg-att vid" src={url} controls preload="metadata" onLoadedMetadata={onMedia} />
        ) : (
          <a key={url} className="msg-att link" href={url} target="_blank" rel="noopener noreferrer">
            <Icon name="link" size={16} />
            <span>
              <b>{hostOf(url)}</b>
              <small>{url}</small>
            </span>
          </a>
        )
      )}
    </div>
  );
}

function MessageItem({
  m,
  grouped,
  mine,
  showName,
  meId,
  replied,
  canDelete,
  editing,
  onReply,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReact,
  onReport,
  onImage,
  onMedia,
  onJump,
}) {
  const [picker, setPicker] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState(m.content || "");

  useEffect(() => {
    if (editing) setText(m.content || "");
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const reacts = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length);
  const canEdit = mine && !m.deleted && !m.pending;

  const submitEdit = () => {
    const next = text.trim();

    if (!next || next === m.content) return onCancelEdit();
    onSaveEdit(m, next);
  };

  return (
    <div
      id={`msg-${m.id}`}
      className={`msg-row ${mine ? "mine" : ""} ${grouped ? "grouped" : ""} ${m.pending ? "pending" : ""}`}
    >
      <div className="msg-gutter">
        {!grouped && !mine && <Face name={m.authorName} avatar={m.authorAvatar} size={34} />}
      </div>

      <div className="msg-body">
        {showName && !grouped && !mine && <span className="msg-author">{m.authorName}</span>}

        <div className="msg-bubble-wrap">
          <div className={`msg-bubble ${m.deleted ? "deleted" : ""}`}>
            {m.replyTo && !m.deleted && (
              <button type="button" className="msg-quote" onClick={() => replied && onJump(replied.id)}>
                <b>{replied ? replied.authorName : "Original message"}</b>
                <span>
                  {replied
                    ? replied.deleted
                      ? "Message deleted"
                      : replied.content || "Attachment"
                    : "Not loaded"}
                </span>
              </button>
            )}

            {m.deleted ? (
              <p className="msg-text muted">This message was deleted</p>
            ) : editing ? (
              <div className="msg-edit">
                <textarea
                  className="hub-input"
                  autoFocus
                  rows={2}
                  maxLength={2000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitEdit();
                    }
                    if (event.key === "Escape") onCancelEdit();
                  }}
                />
                <div className="msg-edit-actions">
                  <small>Enter to save · Esc to cancel</small>
                  <Btn onClick={onCancelEdit}>Cancel</Btn>
                  <Btn primary onClick={submitEdit}>Save</Btn>
                </div>
              </div>
            ) : (
              <>
                {m.content && (
                  <p className="msg-text">
                    <Linkified text={m.content} />
                  </p>
                )}

                <Attachments urls={m.attachments} onImage={onImage} onMedia={onMedia} />
              </>
            )}

            {!editing && (
              <span className="msg-foot">
                {m.editedAt && !m.deleted && <em>edited</em>}
                {m.pending ? "Sending…" : clock(m.createdAt)}
              </span>
            )}
          </div>

          {!m.deleted && !editing && !m.pending && (
            <div className={`msg-actions ${picker || confirming ? "open" : ""}`}>
              {confirming ? (
                <>
                  <span className="msg-confirm">Delete?</span>
                  <button type="button" className="danger" onClick={() => { setConfirming(false); onDelete(m); }}>
                    Yes
                  </button>
                  <button type="button" onClick={() => setConfirming(false)}>
                    No
                  </button>
                </>
              ) : (
                <>
                  <button type="button" title="React" onClick={() => setPicker((v) => !v)}>
                    <Icon name="smile" size={15} />
                  </button>
                  <button type="button" title="Reply" onClick={() => onReply(m)}>
                    <Icon name="reply" size={15} />
                  </button>
                  {canEdit && (
                    <button type="button" title="Edit" onClick={() => onStartEdit(m)}>
                      <Icon name="edit" size={15} />
                    </button>
                  )}
                  {!mine && (
                    <button type="button" title="Report" onClick={() => onReport(m)}>
                      <Icon name="flag" size={15} />
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" title="Delete" className="danger" onClick={() => setConfirming(true)}>
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </>
              )}

              {picker && (
                <div className="msg-picker">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setPicker(false);
                        onReact(m, emoji);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {reacts.length > 0 && !m.deleted && (
          <div className="msg-reacts">
            {reacts.map(([emoji, ids]) => (
              <button
                key={emoji}
                type="button"
                className={ids.includes(meId) ? "on" : ""}
                onClick={() => onReact(m, emoji)}
                title={`${ids.length} ${ids.length === 1 ? "reaction" : "reactions"}`}
              >
                {emoji}
                <span>{ids.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportModal({ message, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason.trim()) return setError("Tell us what's wrong.");

    setBusy(true);
    setError("");

    try {
      await onSubmit(message, reason.trim());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Report message" onClose={onClose}>
      <div className="msg-report-preview">
        <b>{message.authorName}</b>
        <span>{message.content || "Attachment"}</span>
      </div>

      <div className="hub-pills">
        {REPORT_REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>

      <textarea
        className="hub-input"
        rows={3}
        maxLength={500}
        placeholder="Add details for the moderators (optional)"
        value={REPORT_REASONS.includes(reason) ? "" : reason}
        onChange={(event) => setReason(event.target.value)}
      />

      <Err e={error} />

      <div className="fx-modal-actions">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send report"}
        </Btn>
      </div>
    </Modal>
  );
}

/** player search used for new chats and adding group members */
function PlayerSearch({ onPick, selected = [], exclude = [], placeholder = "Search players" }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const res = useApi(`/players?q=${encodeURIComponent(dq)}&limit=12`);
  const players = (res.data?.players || []).filter((p) => !exclude.includes(p.userId));

  return (
    <div className="msg-search-block">
      <div className="msg-search">
        <Icon name="search" size={15} />
        <input value={q} placeholder={placeholder} onChange={(event) => setQ(event.target.value)} />
      </div>

      <Err e={res.error} />

      <div className="msg-people">
        {res.loading && !res.data && <div className="skeleton-card" style={{ minHeight: 60 }} />}

        {res.data && players.length === 0 && <p className="msg-none">No players found.</p>}

        {players.map((p) => {
          const on = selected.includes(p.userId);

          return (
            <button
              key={p.userId}
              type="button"
              className={`msg-person ${on ? "on" : ""}`}
              onClick={() => onPick(p)}
            >
              <Face name={p.username} avatar={p.avatar} size={34} />
              <span>
                <b>{p.username}</b>
                {p.gamertag && <small>{p.gamertag}</small>}
              </span>
              {on && <Icon name="check" size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewChat({ meId, onCreated, onCancel }) {
  const [mode, setMode] = useState("dm");
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async (body) => {
    setBusy(true);
    setError("");

    try {
      const result = await api("/channels", { method: "POST", body });
      onCreated(result.channel);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const toggle = (p) =>
    setPicked((current) =>
      current.some((x) => x.userId === p.userId)
        ? current.filter((x) => x.userId !== p.userId)
        : [...current, p].slice(0, 19)
    );

  return (
    <div className="msg-new">
      <div className="msg-pane-head">
        <button type="button" className="msg-icon-btn msg-back" onClick={onCancel} aria-label="Back">
          <Icon name="back" />
        </button>

        <div className="msg-pane-title">
          <strong>New conversation</strong>
          <span>Message a player or start a group for your squad.</span>
        </div>

        <button type="button" className="msg-icon-btn desktop-only" onClick={onCancel} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>

      <div className="msg-new-body">
        <div className="hub-pills" role="group" aria-label="Conversation type">
          <button type="button" aria-pressed={mode === "dm"} onClick={() => setMode("dm")}>
            Direct message
          </button>
          <button type="button" aria-pressed={mode === "group"} onClick={() => setMode("group")}>
            Group chat
          </button>
        </div>

        {mode === "group" && (
          <>
            <input
              className="hub-input"
              placeholder="Group name"
              maxLength={50}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            {picked.length > 0 && (
              <div className="msg-chips">
                {picked.map((p) => (
                  <button key={p.userId} type="button" onClick={() => toggle(p)}>
                    {p.username} <Icon name="x" size={12} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <PlayerSearch
          exclude={[meId]}
          selected={picked.map((p) => p.userId)}
          placeholder={mode === "dm" ? "Find a player to message" : "Add players to the group"}
          onPick={(p) => {
            if (mode === "dm") create({ type: "dm", userId: p.userId });
            else toggle(p);
          }}
        />

        <Err e={error} />

        {mode === "group" && (
          <Btn
            primary
            disabled={busy || !name.trim() || picked.length === 0}
            onClick={() =>
              create({ type: "group", name: name.trim(), members: picked.map((p) => p.userId) })
            }
          >
            {busy ? "Creating…" : `Create group${picked.length ? ` (${picked.length + 1})` : ""}`}
          </Btn>
        )}
      </div>
    </div>
  );
}

function InfoPanel({ channel, meId, onClose, onChanged, onLeft }) {
  const cid = encodeURIComponent(channel.id);
  const isGroup = channel.type === "group";
  const owner = channel.ownerId === meId;

  const { act, error, busy } = useAct(onChanged);
  const [adding, setAdding] = useState(false);

  return (
    <aside className="msg-info">
      <div className="msg-pane-head">
        <div className="msg-pane-title">
          <strong>Details</strong>
          <span>{channelSub(channel)}</span>
        </div>

        <button type="button" className="msg-icon-btn" onClick={onClose} aria-label="Close details">
          <Icon name="x" />
        </button>
      </div>

      <div className="msg-info-body">
        <Err e={error} />

        <div className="msg-info-list">
          {channel.members.map((m) => (
            <div className="msg-person static" key={m.userId}>
              <Face name={m.username} avatar={m.avatar} size={34} />
              <span>
                <b>{m.userId === meId ? `${m.username} (you)` : m.username}</b>
                {channel.ownerId === m.userId && isGroup && <small>Owner</small>}
              </span>

              {isGroup && owner && m.userId !== meId && (
                <button
                  type="button"
                  className="msg-icon-btn"
                  disabled={busy}
                  title="Remove from group"
                  onClick={() => act(() => api(`/channels/${cid}/members/${m.userId}`, { method: "DELETE" }))}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}

          {channel.members.length === 0 && (
            <p className="msg-none">Everyone on the team or party can see this chat.</p>
          )}
        </div>

        {isGroup && owner && (
          <>
            <Btn onClick={() => setAdding((v) => !v)}>
              <Icon name="plus" size={14} /> {adding ? "Done" : "Add players"}
            </Btn>

            {adding && (
              <PlayerSearch
                exclude={channel.members.map((m) => m.userId)}
                placeholder="Search players to add"
                onPick={(p) =>
                  act(() => api(`/channels/${cid}/members`, { method: "POST", body: { userId: p.userId } }))
                }
              />
            )}
          </>
        )}

        {isGroup && (
          <Btn
            disabled={busy}
            onClick={() =>
              confirm(`Leave "${channel.name}"?`) &&
              act(async () => {
                await api(`/channels/${cid}/members/${meId}`, { method: "DELETE" });
                onLeft();
              })
            }
          >
            <Icon name="logout" size={14} /> Leave group
          </Btn>
        )}
      </div>
    </aside>
  );
}

/* =========================================================
   MESSAGES: chat pane
========================================================= */

function ChatPane({ channel, session, onBack, onChanged, onActivity, onLeft }) {
  const toast = useToast();
  const me = session.me.user;
  const meId = me.id;
  const cid = encodeURIComponent(channel.id);

  const live = useLiveMessages(channel.id, (event) => {
    if (event.type === "message") onActivity?.();
  });

  const messages = live.messages;
  const last = messages[messages.length - 1];

  const listRef = useRef(null);
  const taRef = useRef(null);
  const stick = useRef(true);
  const seenId = useRef(null);
  const readId = useRef(null);

  const [unseen, setUnseen] = useState(0);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [atts, setAtts] = useState([]);
  const [tray, setTray] = useState(null); // null | "attach" | "emoji"
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const byId = new Map(messages.map((m) => [m.id, m]));

  const staffOfTeam =
    channel.type === "team" &&
    ["owner", "admin"].includes(session.me.teams.find((t) => t.id === channel.refId)?.myRole);

  const canDelete = (m) =>
    m.authorId === meId ||
    session.me.admin ||
    staffOfTeam ||
    (channel.type === "group" && channel.ownerId === meId);

  /* scrolling */

  const toBottom = (smooth) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el || !last) return;

    const isNew = seenId.current !== last.id;

    if (stick.current) el.scrollTop = el.scrollHeight;
    else if (isNew && seenId.current && last.authorId !== meId && !isTemp(last)) setUnseen((n) => n + 1);

    seenId.current = last.id;
  }, [last?.id, live.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const keepBottom = useCallback(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = (event) => {
    const el = event.currentTarget;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 90;

    stick.current = near;
    if (near) setUnseen(0);
  };

  const earlier = async () => {
    const el = listRef.current;
    const before = el.scrollHeight;

    await live.loadEarlier();

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.scrollTop += el.scrollHeight - before;
      })
    );
  };

  const jumpTo = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;

    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1400);
  };

  /* read receipts */

  const markRead = useCallback(
    async (id) => {
      if (readId.current === id) return;
      readId.current = id;

      try {
        await api(`/channels/${cid}/read`, { method: "POST" });
        onChanged?.();
      } catch {
        /* not critical */
      }
    },
    [cid] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (last && !isTemp(last) && !document.hidden) markRead(last.id);
  }, [last?.id, markRead]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && last && !isTemp(last)) {
        readId.current = null;
        markRead(last.id);
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [last?.id, markRead]); // eslint-disable-line react-hooks/exhaustive-deps

  /* composer */

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;

    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [draft]);

  const addAttachment = (url) => {
    const clean = String(url || "").trim();

    if (!HTTP_RE.test(clean)) return false;

    setAtts((current) =>
      current.includes(clean) || current.length >= 4 ? current : [...current, clean]
    );

    return true;
  };

  const send = async () => {
    const content = draft.trim();

    if (!content && atts.length === 0) return;

    const tempId = `tmp_${Date.now()}`;
    const attachments = atts;
    const reply = replyTo;

    live.put({
      id: tempId,
      channelId: channel.id,
      authorId: meId,
      authorName: me.username,
      authorAvatar: me.avatar,
      content,
      attachments,
      replyTo: reply?.id || null,
      reactions: {},
      deleted: false,
      createdAt: Date.now(),
      editedAt: null,
      pending: true,
    });

    setDraft("");
    setAtts([]);
    setReplyTo(null);
    setTray(null);
    setError("");
    stick.current = true;

    try {
      const result = await api(`/channels/${cid}/messages`, {
        method: "POST",
        body: { content, attachments, replyTo: reply?.id },
      });

      live.swap(tempId, result.message);
      onChanged?.();
    } catch (e) {
      live.swap(tempId, null);
      setDraft(content);
      setAtts(attachments);
      setReplyTo(reply);
      setError(e.message);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
      return;
    }

    if (event.key === "ArrowUp" && !draft) {
      const mineLast = [...messages].reverse().find((m) => m.authorId === meId && !m.deleted && !isTemp(m));

      if (mineLast) {
        event.preventDefault();
        setEditingId(mineLast.id);
      }
    }

    if (event.key === "Escape") {
      setReplyTo(null);
      setTray(null);
    }
  };

  const onPaste = (event) => {
    const pasted = event.clipboardData?.getData("text")?.trim();

    if (pasted && !pasted.includes(" ") && HTTP_RE.test(pasted) && (isImage(pasted) || isVideo(pasted))) {
      event.preventDefault();
      addAttachment(pasted);
    }
  };

  /* message actions */

  const saveEdit = async (m, content) => {
    try {
      const result = await api(`/messages/${encodeURIComponent(m.id)}`, {
        method: "PATCH",
        body: { content },
      });

      live.put(result.message);
      setEditingId(null);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const remove = async (m) => {
    try {
      await api(`/messages/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      live.put({ ...m, deleted: true, content: "", attachments: [], reactions: {} });
      onChanged?.();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const react = async (m, emoji) => {
    const has = (m.reactions?.[emoji] || []).includes(meId);

    try {
      const result = has
        ? await api(`/messages/${encodeURIComponent(m.id)}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" })
        : await api(`/messages/${encodeURIComponent(m.id)}/reactions`, { method: "POST", body: { emoji } });

      live.put({ ...m, reactions: result.reactions });
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const report = async (m, reason) => {
    await api("/reports", {
      method: "POST",
      body: { kind: "message", targetId: m.id, reason },
    });

    setReporting(null);
    toast("Report sent. Thanks for keeping the hub safe.");
  };

  /* render list with day dividers and grouping */

  const rows = [];

  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);

    const grouped =
      !newDay &&
      prev.authorId === m.authorId &&
      !prev.deleted &&
      !m.deleted &&
      !m.replyTo &&
      m.createdAt - prev.createdAt < 5 * 60 * 1000;

    rows.push(
      <Fragment key={m.id}>
        {newDay && (
          <div className="msg-day">
            <span>{dayLabel(m.createdAt)}</span>
          </div>
        )}

        <MessageItem
          m={m}
          grouped={grouped}
          mine={m.authorId === meId}
          showName={channel.type !== "dm"}
          meId={meId}
          replied={m.replyTo ? byId.get(m.replyTo) : null}
          canDelete={canDelete(m)}
          editing={editingId === m.id}
          onReply={(msg) => {
            setReplyTo(msg);
            taRef.current?.focus();
          }}
          onStartEdit={(msg) => setEditingId(msg.id)}
          onCancelEdit={() => setEditingId(null)}
          onSaveEdit={saveEdit}
          onDelete={remove}
          onReact={react}
          onReport={setReporting}
          onImage={setLightbox}
          onMedia={keepBottom}
          onJump={jumpTo}
        />
      </Fragment>
    );
  });

  const sendable = (draft.trim() || atts.length) && draft.length <= 2000;

  return (
    <div className={`msg-chat ${info ? "with-info" : ""}`}>
      <div className="msg-pane-head">
        <button type="button" className="msg-icon-btn msg-back" onClick={onBack} aria-label="Back to conversations">
          <Icon name="back" />
        </button>

        <Face name={channel.name} size={40} />

        <div className="msg-pane-title">
          <strong>{channel.name || "Conversation"}</strong>
          <span>
            <i className={`msg-live ${live.live}`} />
            {live.live === "live" ? "Live" : live.live === "polling" ? "Refreshing" : "Connecting"} ·{" "}
            {channelSub(channel)}
          </span>
        </div>

        <button
          type="button"
          className={`msg-icon-btn ${info ? "on" : ""}`}
          onClick={() => setInfo((v) => !v)}
          aria-label="Conversation details"
          title="Details"
        >
          <Icon name="info" />
        </button>
      </div>

      <div className="msg-scroll" ref={listRef} onScroll={onScroll} aria-live="polite">
        {live.hasMore && (
          <div className="msg-earlier">
            <Btn onClick={earlier}>Load earlier messages</Btn>
          </div>
        )}

        {live.loading && messages.length === 0 && (
          <div className="msg-skeletons">
            {[60, 40, 72, 48].map((w, i) => (
              <div key={i} className={`skeleton-card ${i % 2 ? "r" : ""}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {live.error && messages.length === 0 && (
          <div className="msg-state">
            <p className="form-error">Couldn&apos;t load this conversation: {live.error}</p>
            <Btn onClick={live.reload}>Try again</Btn>
          </div>
        )}

        {!live.loading && !live.error && messages.length === 0 && (
          <div className="msg-state">
            <span className="msg-state-icon">
              <Icon name="messages" size={26} />
            </span>
            <strong>No messages yet</strong>
            <p>Say hello and get the conversation going.</p>
          </div>
        )}

        {rows}
      </div>

      {unseen > 0 && (
        <button
          type="button"
          className="msg-jump"
          onClick={() => {
            toBottom(true);
            setUnseen(0);
          }}
        >
          <Icon name="down" size={14} /> {unseen} new {unseen === 1 ? "message" : "messages"}
        </button>
      )}

      <div className="msg-composer">
        {replyTo && (
          <div className="msg-replying">
            <Icon name="reply" size={14} />
            <span>
              Replying to <b>{replyTo.authorName}</b>
              <em>{replyTo.content || "Attachment"}</em>
            </span>
            <button type="button" className="msg-icon-btn" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        {atts.length > 0 && (
          <div className="msg-tray-atts">
            {atts.map((url) => (
              <div className="msg-tray-att" key={url}>
                {isImage(url) ? <img src={url} alt="" /> : <Icon name={isVideo(url) ? "image" : "link"} size={18} />}
                <small>{hostOf(url)}</small>
                <button type="button" onClick={() => setAtts((c) => c.filter((x) => x !== url))} aria-label="Remove attachment">
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {tray === "attach" && (
          <AttachPanel
            meId={meId}
            count={atts.length}
            onAdd={addAttachment}
            onShare={(post) => {
              const room = 4 - atts.length;
              (post.media || []).slice(0, room).forEach(addAttachment);
              setDraft((d) => (d ? d : post.title));
            }}
            onClose={() => setTray(null)}
          />
        )}

        {tray === "emoji" && (
          <div className="msg-emoji-tray">
            {COMPOSER_EMOJI.map((emoji) => (
              <button key={emoji} type="button" onClick={() => setDraft((d) => d + emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        <Err e={error} />

        <div className="msg-input-row">
          <button
            type="button"
            className={`msg-icon-btn ${tray === "attach" ? "on" : ""}`}
            onClick={() => setTray((t) => (t === "attach" ? null : "attach"))}
            aria-label="Add attachment"
            title="Attach"
          >
            <Icon name="clip" size={18} />
          </button>

          <textarea
            ref={taRef}
            className="msg-input"
            rows={1}
            placeholder={`Message ${channel.name || "this chat"}`}
            aria-label="Write a message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />

          <button
            type="button"
            className={`msg-icon-btn ${tray === "emoji" ? "on" : ""}`}
            onClick={() => setTray((t) => (t === "emoji" ? null : "emoji"))}
            aria-label="Emoji"
            title="Emoji"
          >
            <Icon name="smile" size={18} />
          </button>

          <button type="button" className="msg-send" disabled={!sendable} onClick={send} aria-label="Send message">
            <Icon name="send" size={17} />
          </button>
        </div>

        <div className="msg-hint">
          <span>Enter to send · Shift + Enter for a new line · ↑ to edit your last message</span>
          {draft.length > 1700 && <b className={draft.length > 2000 ? "over" : ""}>{draft.length}/2000</b>}
        </div>
      </div>

      {info && (
        <InfoPanel
          channel={channel}
          meId={meId}
          onClose={() => setInfo(false)}
          onChanged={onChanged}
          onLeft={onLeft}
        />
      )}

      {reporting && <ReportModal message={reporting} onClose={() => setReporting(null)} onSubmit={report} />}

      {lightbox && (
        <div className="msg-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="Image preview">
          <img src={lightbox} alt="" />
          <a href={lightbox} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
            Open original
          </a>
        </div>
      )}
    </div>
  );
}

/** attach by link, or reuse media and titles from your own posts */
function AttachPanel({ meId, count, onAdd, onShare, onClose }) {
  const [tab, setTab] = useState("link");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const posts = useApi(tab === "posts" ? `/posts?author=${encodeURIComponent(meId)}&limit=30` : null);
  const list = posts.data?.posts || [];

  const full = count >= 4;

  const add = () => {
    if (full) return setError("You can attach up to 4 items.");

    if (!onAdd(url)) return setError("Paste a link that starts with http:// or https://");

    setUrl("");
    setError("");
  };

  return (
    <div className="msg-attach">
      <div className="msg-attach-head">
        <div className="hub-pills" role="group" aria-label="Attachment source">
          <button type="button" aria-pressed={tab === "link"} onClick={() => setTab("link")}>
            <Icon name="link" size={12} /> From a link
          </button>
          <button type="button" aria-pressed={tab === "posts"} onClick={() => setTab("posts")}>
            <Icon name="posts" size={12} /> From my posts
          </button>
        </div>

        <button type="button" className="msg-icon-btn" onClick={onClose} aria-label="Close attachments">
          <Icon name="x" size={14} />
        </button>
      </div>

      {tab === "link" ? (
        <>
          <div className="msg-attach-row">
            <input
              className="hub-input"
              placeholder="Paste an image, clip or link"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
            />
            <Btn primary onClick={add}>
              Attach
            </Btn>
          </div>
          <small>Direct image and video links show inline. Up to 4 per message.</small>
        </>
      ) : (
        <div className="msg-attach-posts">
          {posts.loading && !posts.data && <div className="skeleton-card" style={{ minHeight: 56 }} />}
          {posts.data && list.length === 0 && <p className="msg-none">You haven&apos;t posted anything yet.</p>}

          {list.map((post) => (
            <button
              key={post.id}
              type="button"
              className="msg-post"
              disabled={full && (post.media || []).length > 0}
              onClick={() => onShare(post)}
            >
              {post.media?.[0] && isImage(post.media[0]) ? <img src={post.media[0]} alt="" /> : <Icon name="posts" size={18} />}
              <span>
                <b>{post.title}</b>
                <small>
                  {(post.media || []).length
                    ? `${post.media.length} ${post.media.length === 1 ? "attachment" : "attachments"}`
                    : "Share title"}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}

      <Err e={error} />
    </div>
  );
}

/* =========================================================
   MESSAGES: tab
========================================================= */

function MessagesTab({ session, onChange }) {
  const meId = session.me.user.id;
  const list = useApi("/channels");

  const [activeId, setActiveId] = useState(null);
  const [created, setCreated] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("");

  const channels = list.data?.channels || [];

  const active =
    channels.find((c) => String(c.id) === String(activeId)) ||
    (created && String(created.id) === String(activeId) ? created : null);

  const refreshAll = useCallback(() => {
    list.reload();
    onChange?.();
  }, [list.reload, onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const debounce = useRef(null);

  const refreshSoon = useCallback(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(refreshAll, 700);
  }, [refreshAll]);

  useEffect(() => () => clearTimeout(debounce.current), []);

  // keep the conversation list fresh while the tab is open
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) list.reload();
    }, 8000);

    return () => clearInterval(t);
  }, [list.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) onChange?.();
    }, 30000);

    return () => clearInterval(t);
  }, [onChange]);

  const open = (channel) => {
    setActiveId(String(channel.id));
    setShowNew(false);
  };

  const q = filter.trim().toLowerCase();

  const shown = q
    ? channels.filter((c) => `${c.name} ${c.lastMessage?.content || ""}`.toLowerCase().includes(q))
    : channels;

  const totalUnread = channels.reduce((n, c) => n + (Number(c.unread) || 0), 0);

  return (
    <div className={`msg-shell ${active || showNew ? "has-chat" : ""}`}>
      <aside className="msg-list">
        <div className="msg-list-head">
          <div>
            <h2>Messages</h2>
            <span>
              {channels.length} {channels.length === 1 ? "conversation" : "conversations"}
              {totalUnread > 0 && ` · ${totalUnread} unread`}
            </span>
          </div>

          <button
            type="button"
            className="msg-compose"
            onClick={() => {
              setShowNew(true);
              setActiveId(null);
            }}
            aria-label="New conversation"
            title="New conversation"
          >
            <Icon name="plus" size={18} />
          </button>
        </div>

        <div className="msg-search">
          <Icon name="search" size={15} />
          <input value={filter} placeholder="Search conversations" onChange={(event) => setFilter(event.target.value)} />
        </div>

        <Err e={list.error} />

        <div className="msg-convs">
          {list.loading && !list.data && (
            <>
              <div className="skeleton-card" style={{ minHeight: 68 }} />
              <div className="skeleton-card" style={{ minHeight: 68 }} />
              <div className="skeleton-card" style={{ minHeight: 68 }} />
            </>
          )}

          {list.data && channels.length === 0 && (
            <div className="msg-none-card">
              <strong>No conversations yet</strong>
              <p>Start a direct message or a group chat. Team and party chats show up here automatically.</p>
              <Btn primary onClick={() => setShowNew(true)}>
                Start a chat
              </Btn>
            </div>
          )}

          {list.data && channels.length > 0 && shown.length === 0 && <p className="msg-none">Nothing matches that search.</p>}

          {shown.map((channel) => {
            const selected = String(activeId) === String(channel.id);
            const unread = Number(channel.unread) || 0;
            const lm = channel.lastMessage;

            const preview = lm
              ? lm.deleted
                ? "Message deleted"
                : `${lm.authorId === meId ? "You: " : channel.type === "dm" ? "" : `${lm.authorName}: `}${
                    lm.content || (lm.attachments?.length ? "Sent an attachment" : "")
                  }`
              : "No messages yet";

            return (
              <button
                key={channel.id}
                type="button"
                className={`msg-conv ${selected ? "active" : ""} ${unread && !selected ? "unread" : ""}`}
                onClick={() => open(channel)}
              >
                <Face name={channel.name} size={42} />

                <span className="msg-conv-main">
                  <span className="msg-conv-top">
                    <b>{channel.name || "Conversation"}</b>
                    <time>{ago(lm?.createdAt || channel.createdAt)}</time>
                  </span>

                  <span className="msg-conv-bottom">
                    <span className="msg-conv-preview">{preview}</span>
                    {unread > 0 && !selected && <span className="msg-badge">{unread > 99 ? "99+" : unread}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="msg-pane">
        {showNew ? (
          <NewChat
            meId={meId}
            onCancel={() => setShowNew(false)}
            onCreated={(channel) => {
              setCreated(channel);
              setActiveId(String(channel.id));
              setShowNew(false);
              refreshAll();
            }}
          />
        ) : active ? (
          <ChatPane
            key={String(active.id)}
            channel={active}
            session={session}
            onBack={() => setActiveId(null)}
            onChanged={refreshAll}
            onActivity={refreshSoon}
            onLeft={() => {
              setActiveId(null);
              setCreated(null);
              refreshAll();
            }}
          />
        ) : (
          <div className="msg-placeholder">
            <span className="msg-state-icon big">
              <Icon name="messages" size={34} />
            </span>
            <h3>Your messages</h3>
            <p>Pick a conversation on the left, or start a new one. Chats update live.</p>
            <Btn primary onClick={() => setShowNew(true)}>
              <Icon name="plus" size={14} /> New conversation
            </Btn>
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   PREDICTIONS
========================================================= */

function PredictionsTab({ games }) {
  const list = useApi("/predictions/me");
  const rows = list.data?.predictions || [];

  return (
    <div className="community-panel">
      <Loading list={list} />

      {list.data && rows.length === 0 && (
        <Empty title="No predictions yet" body="Pick winners on upcoming matches in the hub." />
      )}

      <div className="system-grid">
        {rows.map((prediction) => (
          <Card
            key={prediction.id}
            top={games.find((game) => game.id === prediction.game)?.label || prediction.game}
            pill={prediction.status}
            title={`Match ${prediction.matchId}`}
            sub={`Picked team ${prediction.teamId} · ${ago(prediction.at)}`}
          />
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN: REPORTS
========================================================= */

function ReportsTab() {
  const list = useApi("/admin/reports?resolved=0");
  const { act, error, busy } = useAct(list.reload);

  const reports = list.data?.reports || [];

  return (
    <div className="community-panel">
      <Err e={error} />
      <Loading list={list} />

      {list.data && reports.length === 0 && <Empty title="All clear" body="No open reports." />}

      <div className="stack">
        {reports.map((report) => (
          <Card
            key={report.id}
            top={report.kind}
            pill={ago(report.createdAt)}
            title={report.reason}
            sub={`Target ${report.targetId} · reported by ${report.reporterId}`}
          >
            <Btn
              primary
              disabled={busy}
              onClick={() => act(() => api(`/admin/reports/${report.id}/resolve`, { method: "POST" }))}
            >
              Resolve
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ACCOUNT
========================================================= */

function AccountTab({ session, setTab }) {
  const { user, profile, admin, teams } = session.me;

  const [copied, setCopied] = useState(false);
  const { act, error, busy } = useAct();

  const links = Object.entries(profile?.links || {});

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Clipboard blocked */
    }
  };

  const exportData = () =>
    act(async () => {
      const safe = (path) => api(path).catch(() => null);

      const [predictions, follows, posts] = await Promise.all([
        safe("/predictions/me"),
        safe("/follows"),
        safe(`/posts?author=${encodeURIComponent(user.id)}&limit=50`),
      ]);

      const blob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              account: user,
              profile,
              teams,
              predictions: predictions?.predictions,
              follows,
              posts: posts?.posts,
            },
            null,
            2
          ),
        ],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "fades-gaming-data.json";
      link.click();

      URL.revokeObjectURL(url);
    });

  const rows = [
    ["Gamertag", profile?.gamertag || "Not set"],
    ["Country", profile?.country || "Not set"],
    ["Platforms", profile?.platforms?.join(", ") || "None"],
    ["Role", admin ? "Moderator" : "Player"],
    ["Joined", profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Recently"],
  ];

  return (
    <div className="account-grid">
      <div className="system-card">
        <div className="account-id">
          <Avatar user={user} sm />

          <div>
            <strong className="card-title">{user.username}</strong>

            <span className="card-sub">
              {teams.length} {teams.length === 1 ? "team" : "teams"} · {session.me.follows} following
            </span>
          </div>
        </div>

        <dl className="kv">
          <div>
            <dt>User ID</dt>
            <dd>
              {user.id}{" "}
              <button type="button" className="chip" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </dd>
          </div>

          {rows.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="card-actions">
          <Btn onClick={() => setTab("profile")}>Edit profile</Btn>
        </div>
      </div>

      <div className="system-card">
        <strong className="card-title">Fades account</strong>

        <span className="card-sub">
          Your email, password and sign-in security are managed on your main Fades account.
        </span>

        <div className="card-actions">
          <a className="hub-button primary" href={SIGN_IN_URL}>
            Manage Fades account
          </a>
        </div>
      </div>

      <div className="system-card">
        <strong className="card-title">Linked profiles</strong>

        {links.length === 0 ? (
          <span className="card-sub">Add Steam, Discord, Twitch and more so teammates can find you.</span>
        ) : (
          <dl className="kv">
            {links.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="card-actions">
          <Btn onClick={() => setTab("profile")}>{links.length ? "Edit links" : "Add links"}</Btn>
        </div>
      </div>

      <div className="system-card">
        <strong className="card-title">Your data</strong>

        <span className="card-sub">
          Download your profile, teams, follows, predictions and posts as a JSON file.
        </span>

        <Err e={error} />

        <div className="card-actions">
          <Btn disabled={busy} onClick={exportData}>
            {busy ? "Preparing..." : "Export my data"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SETTINGS
========================================================= */

const PREFS_KEY = "fades-dashboard-prefs";

const DEFAULT_PREFS = {
  density: "comfortable",
  start: "overview",
  hubStats: "on",
  effects: "on",
};

function Seg({ label, value, options, onChange }) {
  return (
    <div className="hub-pills" role="group" aria-label={label}>
      {options.map(([optionValue, text]) => (
        <button
          key={optionValue}
          type="button"
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SettingsTab({ prefs, setPrefs, tabs }) {
  const set = (key) => (value) => setPrefs((current) => ({ ...current, [key]: value }));

  return (
    <div className="system-card">
      <div className="pref-row">
        <div>
          <strong>Density</strong>
          <span>How much space cards and forms take up.</span>
        </div>

        <Seg
          label="Density"
          value={prefs.density}
          onChange={set("density")}
          options={[
            ["comfortable", "Comfortable"],
            ["compact", "Compact"],
          ]}
        />
      </div>

      <div className="pref-row">
        <div>
          <strong>Effects</strong>
          <span>Ambient glow, card spotlights and motion across the dashboard.</span>
        </div>

        <Seg
          label="Effects"
          value={prefs.effects}
          onChange={set("effects")}
          options={[
            ["on", "On"],
            ["off", "Off"],
          ]}
        />
      </div>

      <div className="pref-row">
        <div>
          <strong>Open on</strong>
          <span>The section you land on when you open the dashboard.</span>
        </div>

        <select
          className="hub-input"
          style={{ width: "auto" }}
          value={prefs.start}
          onChange={(event) => set("start")(event.target.value)}
        >
          {tabs
            .filter((id) => id !== "reports")
            .map((id) => (
              <option key={id} value={id}>
                {COPY[id][0]}
              </option>
            ))}
        </select>
      </div>

      <div className="pref-row">
        <div>
          <strong>Hub stats</strong>
          <span>Show player, party, tournament and post totals on the overview.</span>
        </div>

        <Seg
          label="Hub stats"
          value={prefs.hubStats}
          onChange={set("hubStats")}
          options={[
            ["on", "Show"],
            ["off", "Hide"],
          ]}
        />
      </div>

      <div className="pref-row">
        <div>
          <strong>Reset</strong>
          <span>These settings are saved in this browser only.</span>
        </div>

        <Btn onClick={() => setPrefs(DEFAULT_PREFS)}>Reset to defaults</Btn>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE CONFIGURATION
========================================================= */

const COPY = {
  overview: ["Overview", "Your activity and shortcuts."],
  teams: ["Teams", "Create squads and manage who's in them."],
  parties: ["Parties", "Groups you're looking for or have joined."],
  tournaments: ["Tournaments", "Host brackets and report results."],
  posts: ["Posts", "Clips, guides and thoughts you've shared."],
  games: ["Games", "Community games you've added."],
  follows: ["Following", "Games, teams and players you follow."],
  messages: ["Messages", "Direct messages and group chats."],
  predictions: ["Predictions", "Your match picks and how they went."],
  profile: ["Profile", "How other players see you."],
  account: ["Account", "Your identity, linked profiles and data."],
  settings: ["Settings", "Make the dashboard work your way."],
  reports: ["Reports", "Open reports waiting on a moderator."],
};

const GROUPS = [
  ["Dashboard", ["overview"]],
  ["Community", ["teams", "parties", "tournaments", "posts", "games", "follows", "messages", "predictions"]],
  ["Account", ["profile", "account", "settings"]],
];

/* =========================================================
   AVATAR + BRAND
========================================================= */

function Avatar({ user, sm }) {
  return (
    <span className={`db-avatar ${sm ? "sm" : ""}`}>
      {user?.avatar ? <img src={user.avatar} alt="" /> : (user?.username || "F").slice(0, 1).toUpperCase()}
    </span>
  );
}

function Brand() {
  const [bad, setBad] = useState(false);

  return (
    <a className="db-brand" href={HUB_URL}>
      <span className="db-logo">
        {bad ? <b>F</b> : <img src={LOGO} alt="" onError={() => setBad(true)} />}
      </span>

      <span>
        <strong>Fades</strong>
        <em>Dashboard</em>
      </span>
    </a>
  );
}

/* =========================================================
   MAIN DASHBOARD
========================================================= */

export default function DashboardPage() {
  const session = useSession();

  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [toasts, setToasts] = useState([]);

  const searchRef = useRef(null);
  const gameList = useApi("/games");

  const toast = useCallback((text, kind = "ok") => {
    const id = Math.random().toString(36).slice(2);

    setToasts((current) => [...current, { id, text, kind }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3600);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");

      if (saved) {
        setPrefs({ ...DEFAULT_PREFS, ...saved });

        if (COPY[saved.start] && saved.start !== "reports") setTab(saved.start);
      }
    } catch {
      /* Storage unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* Storage unavailable */
    }
  }, [prefs]);

  // Ctrl/Cmd + K jumps to section search
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allGames = gameList.data?.games || [];

  const games = allGames.map((game) => ({ id: game.id, label: game.label }));

  // cursor spotlight on cards + ambient glow that follows the pointer
  const onPointerMove = (event) => {
    if (prefs.effects !== "on") return;

    const root = event.currentTarget;
    root.style.setProperty("--gx", `${event.clientX}px`);
    root.style.setProperty("--gy", `${event.clientY}px`);

    const el = event.target.closest?.(".system-card, .db-stat, .db-banner, .db-hero, .msg-conv");

    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - r.left}px`);
      el.style.setProperty("--my", `${event.clientY - r.top}px`);
    }
  };

  if (session.loading || !session.signedIn) {
    return (
      <div className="db" data-density={prefs.density} data-fx={prefs.effects}>
        <div className="fx-aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <div className="db-center">
          <Brand />

          {session.loading ? (
            <div className="skeleton-card" style={{ width: "min(420px, 100%)" }} />
          ) : (
            <div className="systems-empty" style={{ width: "min(420px, 100%)" }}>
              <h3>Sign in to see your dashboard</h3>

              <p>Your teams, parties, tournaments and posts live here.</p>

              <a className="hub-button primary" href={SIGN_IN_URL}>
                Sign in
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { user, profile, admin, unread } = session.me;

  const meId = user.id;

  const groups = [...GROUPS, ...(admin ? [["Moderation", ["reports"]]] : [])];

  const allTabs = groups.flatMap(([, ids]) => ids);

  const [title, blurb] = COPY[tab] || COPY.overview;

  const go = (id) => {
    setTab(id);
    setQuery("");
    setMenu(false);
    window.scrollTo({ top: 0 });
  };

  const q = query.trim().toLowerCase();

  const matches = q
    ? allTabs.filter((id) => `${COPY[id][0]} ${COPY[id][1]}`.toLowerCase().includes(q))
    : [];

  return (
    <ToastCtx.Provider value={toast}>
      <div
        className="db"
        data-density={prefs.density}
        data-fx={prefs.effects}
        data-tab={tab}
        onPointerMove={onPointerMove}
      >
        <div className="fx-aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <aside className={`db-side ${menu ? "open" : ""}`}>
          <Brand />

          <nav className="db-nav" aria-label="Dashboard sections">
            {groups.map(([label, ids]) => (
              <div className="db-group" key={label}>
                <p>{label}</p>

                {ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="db-item"
                    aria-current={tab === id ? "page" : undefined}
                    onClick={() => go(id)}
                  >
                    <span className="db-item-label">
                      <Icon name={id} size={16} />
                      {COPY[id][0]}
                    </span>

                    {id === "messages" && unread > 0 && <span className="db-badge">{unread}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="db-user">
            <Avatar user={user} />

            <div>
              <strong>{profile?.gamertag || user.username}</strong>
              <span>{admin ? "Moderator" : "Player"}</span>
            </div>
          </div>
        </aside>

        {menu && <div className="db-scrim" onClick={() => setMenu(false)} />}

        <div className="db-main">
          <header className="db-top">
            <button type="button" className="db-menu" aria-label="Open menu" onClick={() => setMenu(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <div className="db-search">
              <Icon name="search" />

              <input
                ref={searchRef}
                value={query}
                placeholder="Search sections..."
                aria-label="Search dashboard sections"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && matches[0]) go(matches[0]);
                  if (event.key === "Escape") {
                    setQuery("");
                    event.currentTarget.blur();
                  }
                }}
              />

              {!q && <kbd className="db-kbd">Ctrl K</kbd>}

              {q && (
                <div className="db-results">
                  {matches.length ? (
                    matches.map((id) => (
                      <button key={id} type="button" onClick={() => go(id)}>
                        {COPY[id][0]}
                        <small>{COPY[id][1]}</small>
                      </button>
                    ))
                  ) : (
                    <p>No sections match that.</p>
                  )}
                </div>
              )}
            </div>

            <div className="db-top-right">
              <a className="hub-button" href={HUB_URL}>
                Back to hub
              </a>
            </div>
          </header>

          <main className="db-content">
            <div className="db-head" key={`head-${tab}`}>
              <span>{groups.find(([, ids]) => ids.includes(tab))?.[0]}</span>

              <h1>{title}</h1>
              <p>{blurb}</p>
            </div>

            <div className="db-section fx-in" key={tab}>
              {tab === "overview" && <Overview session={session} setTab={go} prefs={prefs} />}

              {tab === "teams" && <TeamsTab games={games} session={session} />}

              {tab === "parties" && <PartiesTab games={games} meId={meId} />}

              {tab === "tournaments" && <TournamentsTab games={games} meId={meId} />}

              {tab === "posts" && <PostsTab games={games} meId={meId} />}

              {tab === "games" && (
                <GamesTab allGames={allGames} meId={meId} reloadGames={gameList.reload} />
              )}

              {tab === "follows" && <FollowsTab games={games} onChange={session.refresh} />}

              {tab === "messages" && <MessagesTab session={session} onChange={session.refresh} />}

              {tab === "predictions" && <PredictionsTab games={games} />}

              {tab === "profile" && <ProfileTab onSaved={session.refresh} />}

              {tab === "account" && <AccountTab session={session} setTab={go} />}

              {tab === "settings" && <SettingsTab prefs={prefs} setPrefs={setPrefs} tabs={allTabs} />}

              {tab === "reports" && admin && <ReportsTab />}
            </div>
          </main>
        </div>

        <div className="fx-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`fx-toast ${t.kind}`}>
              <Icon name={t.kind === "error" ? "info" : "check"} size={16} />
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import "./dashboard.css";
import "./dashboard-fx.css";

const API_BASE = process.env.NEXT_PUBLIC_FADES_API || "https://api.fades.lol";
const GAMING_API = process.env.NEXT_PUBLIC_GAMING_API || `${API_BASE}/gaming`;
const SIGN_IN_URL =
  process.env.NEXT_PUBLIC_FADES_SIGNIN ||
  "https://fades.lol/acc/security/manage";
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "https://gaming.fades.lol";
const LOGO = process.env.NEXT_PUBLIC_LOGO || "/logo.png";

/* =========================================================
   API + SHARED HOOKS
========================================================= */

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${GAMING_API}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    /* Empty response body */
  }

  if (!response.ok) {
    throw Object.assign(
      new Error(data?.error || `Request failed (${response.status})`),
      { status: response.status }
    );
  }

  return data;
}

function useApi(path) {
  const [state, setState] = useState({
    data: null,
    loading: Boolean(path),
    error: "",
  });

  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return undefined;

    let stopped = false;

    setState((current) => ({ ...current, loading: true, error: "" }));

    api(path)
      .then((data) => {
        if (!stopped) setState({ data, loading: false, error: "" });
      })
      .catch((error) => {
        if (!stopped) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message,
          }));
        }
      });

    return () => {
      stopped = true;
    };
  }, [path, nonce]);

  return {
    ...state,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}

function useAct(done) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const act = useCallback(
    async (fn) => {
      setError("");
      setBusy(true);

      try {
        await fn();
        await done?.();
      } catch (error) {
        setError(error.message);
      } finally {
        setBusy(false);
      }
    },
    [done]
  );

  return { act, error, busy };
}

function useSession() {
  const [state, setState] = useState({ loading: true, me: null });

  const refresh = useCallback(async () => {
    try {
      setState({ loading: false, me: await api("/me") });
    } catch {
      setState({ loading: false, me: null });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, signedIn: Boolean(state.me?.user), refresh };
}

function useFields(initial) {
  const [values, setValues] = useState(initial);

  const bind = (key) => ({
    value: values[key],
    onChange: (event) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
  });

  return [values, bind, () => setValues(initial)];
}

/* =========================================================
   TOASTS
========================================================= */

const ToastCtx = createContext(() => {});
const useToast = () => useContext(ToastCtx);

/* =========================================================
   ICONS
========================================================= */

const ICONS = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  teams:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  parties:
    "M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7a4 4 0 0 0-3.9 3.1l-1.3 6A3 3 0 0 0 4.4 18c.9 0 1.7-.5 2.1-1.2L7.5 15h9l1 1.8c.4.7 1.2 1.2 2.1 1.2a3 3 0 0 0 2.9-3.9l-1.3-6A4 4 0 0 0 17.3 5z",
  tournaments:
    "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-1.97 1.5C7.2 18.85 6 20.24 6 22M14 14.66V17c0 .55.47.98 1.97 1.5.83.35 2.03 1.74 2.03 3.5M18 2H6v7a6 6 0 0 0 12 0V2z",
  posts:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  games: "M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z",
  follows:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  messages:
    "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z",
  predictions:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  profile: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  account: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  settings:
    "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  reports: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  reply: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v3",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash:
    "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  smile:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  clip: "M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  plus: "M12 5v14M5 12h14",
  x: "M18 6L6 18M6 6l12 12",
  search: "M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  more: "M12 12h.01M19 12h.01M5 12h.01",
  check: "M20 6L9 17l-5-5",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  image: "M21 15l-5-5L5 21M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3",
  back: "M19 12H5M12 19l-7-7 7-7",
  down: "M6 9l6 6 6-6",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      className="fx-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/* =========================================================
   SMALL PIECES
========================================================= */

const csv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const ago = (ms) => {
  if (!ms) return "";

  const minutes = Math.floor((Date.now() - ms) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;

  return `${Math.floor(minutes / 1440)}d ago`;
};

const Err = ({ e }) =>
  e ? (
    <p className="form-error" role="alert">
      {e}
    </p>
  ) : null;

const Btn = ({ primary, ...props }) => (
  <button
    type="button"
    className={`hub-button ${primary ? "primary" : ""}`}
    {...props}
  />
);

const Empty = ({ title, body }) => (
  <div className="systems-empty">
    <h3>{title}</h3>
    <p>{body}</p>
  </div>
);

const Card = ({ top, pill, title, sub, children, extra }) => (
  <div className="system-card community-card">
    <div className="match-top">
      <span className="match-game">{top}</span>
      {pill != null && pill !== "" && (
        <span className="status-pill">{pill}</span>
      )}
    </div>

    <strong className="card-title">{title}</strong>

    {sub && <span className="card-sub">{sub}</span>}

    {children && <div className="card-actions">{children}</div>}

    {extra}
  </div>
);

const GameSel = ({ games, value, ...props }) => (
  <select
    className="hub-input"
    value={value || games[0]?.id || ""}
    {...props}
  >
    {games.map((game) => (
      <option key={game.id} value={game.id}>
        {game.label}
      </option>
    ))}
  </select>
);

function Loading({ list }) {
  return list.loading && !list.data ? (
    <div className="skeleton-card" />
  ) : (
    <Err e={list.error} />
  );
}

/** counts up to a number when it first appears or changes */
function CountUp({ value }) {
  const n = Number(value);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(n)) return undefined;

    let raf;
    let start;

    const step = (time) => {
      if (start === undefined) start = time;
      const p = Math.min((time - start) / 700, 1);
      setShown(Math.round(n * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);

  if (value === undefined || value === null) return "-";
  return Number.isFinite(n) ? shown : value;
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fx-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fx-modal-scrim" onClick={onClose} />
      <div className="fx-modal-card">
        <div className="fx-modal-head">
          <strong>{title}</strong>
          <button type="button" className="msg-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   OVERVIEW
========================================================= */

function Overview({ session, setTab, prefs }) {
  const stats = useApi("/stats");
  const s = stats.data || {};

  const { user, profile, teams, follows, unread, admin } = session.me;

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = profile?.gamertag || user.username;

  const mine = [
    ["Teams", teams.length],
    ["Following", follows],
    ["Unread", unread],
    ["Role", admin ? "Mod" : "Player"],
  ];

  const actions = [
    ["teams", "Create a team", "Start a squad and invite players.", "teams"],
    ["tournaments", "Host a tournament", "Run a bracket and report the results.", "tournaments"],
    ["posts", "Post to the hub", "Share a clip, a guide or a thought.", "posts"],
    ["messages", "Catch up on chats", "Read your DMs, groups and team chats.", "messages"],
    ["profile", "Update your profile", "Gamertag, platforms and social links.", "profile"],
    ["account", "Review your account", "Your ID, linked profiles and data.", "account"],
  ];

  const hub = [
    ["Players", s.players],
    ["Open parties", s.openLfg],
    ["Tournaments", s.tournaments],
    ["Posts", s.posts],
  ];

  return (
    <>
      <div className="db-hero">
        <div>
          <span className="kicker">{greeting}</span>
          <h2>
            Welcome back, <span className="fx-grad">{name}</span>
          </h2>
          <p>
            {unread > 0
              ? `You have ${unread} unread ${unread === 1 ? "message" : "messages"} waiting.`
              : "You're all caught up. Time to find a squad."}
          </p>
        </div>

        {unread > 0 && (
          <Btn primary onClick={() => setTab("messages")}>
            <Icon name="messages" /> Open messages
          </Btn>
        )}
      </div>

      <div className="db-stats">
        {mine.map(([label, value]) => (
          <div className="db-stat" key={label}>
            <strong>
              <CountUp value={value} />
            </strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="system-grid">
        {actions.map(([icon, title, body, target]) => (
          <button
            type="button"
            className="system-card fx-action"
            key={title}
            onClick={() => setTab(target)}
          >
            <span className="fx-action-icon">
              <Icon name={icon} size={18} />
            </span>
            <strong className="card-title">{title}</strong>
            <span className="card-sub">{body}</span>
          </button>
        ))}
      </div>

      {prefs.hubStats === "on" && (
        <div className="db-banner">
          <div>
            <span className="kicker">Across the hub</span>
            <h2>Everyone&apos;s playing.</h2>
            <p>
              Live totals from the Fades gaming community. Jump in, find a
              squad and climb the board.
            </p>

            <div className="row">
              <a className="hub-button primary" href={HUB_URL}>
                Open the hub
              </a>

              <Btn onClick={() => setTab("tournaments")}>Host a tournament</Btn>
            </div>
          </div>

          <div
            className="db-stats"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {hub.map(([label, value]) => (
              <div className="db-stat" key={label}>
                <strong>
                  <CountUp value={value} />
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================
   PROFILE
========================================================= */

const LINK_KEYS = [
  "steam",
  "discord",
  "twitch",
  "youtube",
  "twitter",
  "riot",
  "battlenet",
  "xbox",
  "psn",
  "epic",
];

function ProfileTab({ onSaved }) {
  const d = useApi("/profiles/me");

  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(false);

  const { act, error, busy } = useAct(onSaved);

  useEffect(() => {
    const p = d.data?.profile;

    if (p) {
      setF({
        gamertag: p.gamertag || "",
        bio: p.bio || "",
        country: p.country || "",
        platforms: (p.platforms || []).join(", "),
        favoriteGames: (p.favoriteGames || []).join(", "),
        links: { ...(p.links || {}) },
      });
    }
  }, [d.data]);

  if (!f) return <Loading list={d} />;

  const set = (key) => (event) => {
    setSaved(false);
    setF((current) => ({ ...current, [key]: event.target.value }));
  };

  const save = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/profiles/me", {
        method: "PUT",
        body: {
          ...f,
          platforms: csv(f.platforms),
          favoriteGames: csv(f.favoriteGames),
        },
      });

      setSaved(true);
    });
  };

  return (
    <form className="form-card" onSubmit={save}>
      <input className="hub-input" placeholder="Gamertag" maxLength={32} value={f.gamertag} onChange={set("gamertag")} />
      <input className="hub-input" placeholder="Country" maxLength={40} value={f.country} onChange={set("country")} />
      <input className="hub-input" placeholder="Platforms (PC, PS5, ...)" value={f.platforms} onChange={set("platforms")} />
      <input className="hub-input" placeholder="Favourite game ids (cs2, valorant, ...)" value={f.favoriteGames} onChange={set("favoriteGames")} />

      <textarea className="hub-input wide" placeholder="Bio" maxLength={300} rows={3} value={f.bio} onChange={set("bio")} />

      {LINK_KEYS.map((key) => (
        <input
          key={key}
          className="hub-input"
          placeholder={key}
          maxLength={64}
          value={f.links[key] || ""}
          onChange={(event) =>
            setF((current) => ({
              ...current,
              links: { ...current.links, [key]: event.target.value },
            }))
          }
        />
      ))}

      <button type="submit" className="hub-button primary" disabled={busy}>
        Save profile
      </button>

      {saved && <small>Profile saved.</small>}

      <Err e={error} />
    </form>
  );
}

/* =========================================================
   TEAMS
========================================================= */

function TeamManage({ id, meId, onChange }) {
  const d = useApi(`/teams/${id}`);

  const { act, error, busy } = useAct(async () => {
    d.reload();
    onChange();
  });

  const t = d.data?.team;

  if (!t) return <Err e={d.error} />;

  const owner = t.ownerId === meId;
  const staff = owner || t.myRole === "admin";

  const call = (path, method, body) =>
    act(() => api(`/teams/${id}${path}`, { method, body }));

  return (
    <div className="comments">
      <Err e={error} />

      {(t.members || []).map((m) => (
        <p key={m.userId}>
          <b>{m.username}</b> {m.role}{" "}

          {owner && m.role !== "owner" && (
            <>
              <Btn
                disabled={busy}
                onClick={() =>
                  call(`/members/${m.userId}`, "PATCH", {
                    role: m.role === "admin" ? "member" : "admin",
                  })
                }
              >
                {m.role === "admin" ? "Demote" : "Make admin"}
              </Btn>

              <Btn
                disabled={busy}
                onClick={() => call(`/members/${m.userId}`, "PATCH", { role: "owner" })}
              >
                Make owner
              </Btn>
            </>
          )}

          {m.role !== "owner" &&
            m.userId !== meId &&
            (owner || (staff && m.role === "member")) && (
              <Btn disabled={busy} onClick={() => call(`/members/${m.userId}`, "DELETE")}>
                Remove
              </Btn>
            )}
        </p>
      ))}

      {(t.requests || []).map((r) => (
        <p key={r.userId}>
          <b>{r.username}</b> wants to join {r.message && `- ${r.message}`}{" "}

          <Btn primary disabled={busy} onClick={() => call(`/requests/${r.userId}/approve`, "POST")}>
            Approve
          </Btn>

          <Btn disabled={busy} onClick={() => call(`/requests/${r.userId}`, "DELETE")}>
            Decline
          </Btn>
        </p>
      ))}

      <div className="card-actions">
        {staff && (
          <Btn disabled={busy} onClick={() => call("", "PATCH", { open: !t.open })}>
            {t.open ? "Switch to invite only" : "Switch to open"}
          </Btn>
        )}

        {owner ? (
          <Btn disabled={busy} onClick={() => confirm("Delete this team?") && call("", "DELETE")}>
            Delete team
          </Btn>
        ) : (
          <Btn disabled={busy} onClick={() => call("/leave", "POST")}>
            Leave team
          </Btn>
        )}
      </div>
    </div>
  );
}

function TeamsTab({ games, session }) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(null);

  const [f, bind, reset] = useFields({
    name: "",
    tag: "",
    game: "",
    region: "",
    description: "",
  });

  const { act, error, busy } = useAct(session.refresh);

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/teams", {
        method: "POST",
        body: { ...f, game: f.game || games[0]?.id },
      });

      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "Create a team"}
        </Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Team name" maxLength={40} required {...bind("name")} />
          <input className="hub-input" placeholder="Tag (2-5)" maxLength={5} required {...bind("tag")} />

          <GameSel games={games} {...bind("game")} value={f.game} />

          <input className="hub-input" placeholder="Region" maxLength={30} {...bind("region")} />

          <textarea className="hub-input wide" placeholder="Description" maxLength={500} rows={2} {...bind("description")} />

          <button type="submit" className="hub-button primary" disabled={busy}>
            Create team
          </button>
        </form>
      )}

      <Err e={error} />

      {session.me.teams.length === 0 ? (
        <Empty title="No teams yet" body="Create one or join a team from the hub." />
      ) : (
        <div className="stack">
          {session.me.teams.map((t) => (
            <Card
              key={t.id}
              top={games.find((g) => g.id === t.game)?.label || t.game}
              pill={t.myRole}
              title={`${t.name} [${t.tag}]`}
              sub={`${t.memberCount} members · ${t.open ? "Open" : "Invite only"}`}
              extra={
                managing === t.id && (
                  <TeamManage id={t.id} meId={session.me.user.id} onChange={session.refresh} />
                )
              }
            >
              <Btn onClick={() => setManaging(managing === t.id ? null : t.id)}>
                {managing === t.id ? "Close" : "Manage"}
              </Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   PARTIES
========================================================= */

function PartiesTab({ games, meId }) {
  const list = useApi("/lfg?status=all&limit=100");
  const { act, error, busy } = useAct(list.reload);

  const mine = (list.data?.parties || []).filter(
    (party) =>
      party.authorId === meId ||
      (party.joined || []).some((member) => member.userId === meId)
  );

  return (
    <div className="community-panel">
      <Err e={error} />
      <Loading list={list} />

      {list.data && mine.length === 0 && (
        <Empty title="No parties" body="Post one from the Community section." />
      )}

      <div className="system-grid">
        {mine.map((party) => {
          const author = party.authorId === meId;
          const live = ["open", "full"].includes(party.status);

          return (
            <Card
              key={party.id}
              top={games.find((game) => game.id === party.game)?.label || party.game}
              pill={`${party.status} · ${party.joined.length}/${party.playersNeeded}`}
              title={party.title}
              sub={[party.platform, party.rank, party.region].filter(Boolean).join(" · ")}
            >
              {author && live && (
                <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${party.id}/close`, { method: "POST" }))}>
                  Close
                </Btn>
              )}

              {author && (
                <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${party.id}`, { method: "DELETE" }))}>
                  Delete
                </Btn>
              )}

              {!author && live && (
                <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${party.id}/leave`, { method: "POST" }))}>
                  Leave
                </Btn>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   TOURNAMENTS
========================================================= */

function ReportMatches({ id, onChange }) {
  const d = useApi(`/tournaments/${id}`);
  const [scores, setScores] = useState({});

  const { act, error, busy } = useAct(async () => {
    d.reload();
    onChange();
  });

  const t = d.data?.tournament;

  if (!t) return <Err e={d.error} />;

  const ready = (t.rounds || []).flat().filter((match) => match.status === "ready");

  const set = (matchId, side, value) =>
    setScores((current) => ({
      ...current,
      [matchId]: { ...current[matchId], [side]: value },
    }));

  return (
    <div className="comments">
      <Err e={error} />

      {t.status === "registration" && (
        <p>Entrants: {t.entrants.map((entrant) => entrant.name).join(", ") || "none yet"}</p>
      )}

      {t.status !== "registration" && ready.length === 0 && (
        <p>{t.winner ? `Winner: ${t.winner.name}` : "No matches waiting for a result."}</p>
      )}

      {ready.map((match) => (
        <div className="bracket-report" key={match.id}>
          <span>
            {match.a.name} vs {match.b.name}
          </span>

          <input
            className="hub-input"
            type="number"
            min="0"
            aria-label={`${match.a.name} score`}
            onChange={(event) => set(match.id, "a", event.target.value)}
          />

          <input
            className="hub-input"
            type="number"
            min="0"
            aria-label={`${match.b.name} score`}
            onChange={(event) => set(match.id, "b", event.target.value)}
          />

          <Btn
            disabled={busy}
            onClick={() =>
              act(() =>
                api(`/tournaments/${id}/matches/${match.id}/report`, {
                  method: "POST",
                  body: {
                    scoreA: Number(scores[match.id]?.a),
                    scoreB: Number(scores[match.id]?.b),
                  },
                })
              )
            }
          >
            Save result
          </Btn>
        </div>
      ))}
    </div>
  );
}

function TournamentsTab({ games, meId }) {
  const list = useApi("/tournaments?limit=100");
  const { act, error, busy } = useAct(list.reload);

  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(null);

  const [f, bind, reset] = useFields({
    name: "",
    game: "",
    mode: "solo",
    maxEntrants: "16",
    prize: "",
  });

  const mine = (list.data?.tournaments || []).filter(
    (tournament) => tournament.ownerId === meId
  );

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/tournaments", {
        method: "POST",
        body: {
          ...f,
          game: f.game || games[0]?.id,
          maxEntrants: Number(f.maxEntrants) || 16,
        },
      });

      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "Host a tournament"}
        </Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Tournament name" maxLength={80} required {...bind("name")} />

          <GameSel games={games} {...bind("game")} value={f.game} />

          <select className="hub-input" {...bind("mode")}>
            <option value="solo">Solo</option>
            <option value="team">Teams</option>
          </select>

          <input className="hub-input" type="number" min="2" max="64" placeholder="Max entrants" {...bind("maxEntrants")} />

          <input className="hub-input" placeholder="Prize" maxLength={100} {...bind("prize")} />

          <button type="submit" className="hub-button primary" disabled={busy}>
            Create
          </button>
        </form>
      )}

      <Err e={error} />
      <Loading list={list} />

      {list.data && mine.length === 0 && (
        <Empty title="No tournaments hosted" body="Host one and let players sign up." />
      )}

      <div className="stack">
        {mine.map((tournament) => (
          <Card
            key={tournament.id}
            top={games.find((game) => game.id === tournament.game)?.label || tournament.game}
            pill={tournament.status}
            title={tournament.name}
            sub={`${tournament.entrantCount}/${tournament.maxEntrants} entered · ${
              tournament.mode === "team" ? "Teams" : "Solo"
            }${tournament.winner ? ` · Winner: ${tournament.winner.name}` : ""}`}
            extra={
              managing === tournament.id && (
                <ReportMatches id={tournament.id} onChange={list.reload} />
              )
            }
          >
            {tournament.status === "registration" && tournament.entrantCount >= 2 && (
              <Btn
                primary
                disabled={busy}
                onClick={() => act(() => api(`/tournaments/${tournament.id}/start`, { method: "POST" }))}
              >
                Start
              </Btn>
            )}

            <Btn onClick={() => setManaging(managing === tournament.id ? null : tournament.id)}>
              {managing === tournament.id ? "Close" : "Entrants and results"}
            </Btn>

            <Btn
              disabled={busy}
              onClick={() =>
                confirm("Delete this tournament?") &&
                act(() => api(`/tournaments/${tournament.id}`, { method: "DELETE" }))
              }
            >
              Delete
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   POSTS
========================================================= */

function PostsTab({ games, meId }) {
  const list = useApi(`/posts?author=${encodeURIComponent(meId)}&limit=50`);

  const { act, error, busy } = useAct(list.reload);
  const [open, setOpen] = useState(false);

  const [f, bind, reset] = useFields({ title: "", body: "", game: "" });

  const posts = list.data?.posts || [];

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/posts", { method: "POST", body: f });
      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "New post"}
        </Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Title" maxLength={120} required {...bind("title")} />

          <select className="hub-input" {...bind("game")}>
            <option value="">No game</option>

            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.label}
              </option>
            ))}
          </select>

          <textarea className="hub-input wide" placeholder="Share a clip, a guide or a thought" maxLength={5000} rows={3} {...bind("body")} />

          <button type="submit" className="hub-button primary" disabled={busy}>
            Post
          </button>
        </form>
      )}

      <Err e={error} />
      <Loading list={list} />

      {list.data && posts.length === 0 && (
        <Empty title="No posts yet" body="Your posts will show up here." />
      )}

      <div className="stack">
        {posts.map((post) => (
          <Card
            key={post.id}
            top={games.find((game) => game.id === post.game)?.label || post.game || "General"}
            pill={ago(post.createdAt)}
            title={post.title}
            sub={`${post.likeCount} likes · ${post.commentCount} comments`}
          >
            <Btn
              disabled={busy}
              onClick={() =>
                confirm("Delete this post?") &&
                act(() => api(`/posts/${post.id}`, { method: "DELETE" }))
              }
            >
              Delete
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   GAMES
========================================================= */

function GamesTab({ allGames, meId, reloadGames }) {
  const { act, error, busy } = useAct(reloadGames);

  const [open, setOpen] = useState(false);

  const [f, bind, reset] = useFields({ label: "", genre: "", description: "" });

  const mine = allGames.filter((game) => game.custom && game.ownerId === meId);

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/games", { method: "POST", body: f });
      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "Add a game"}
        </Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Game name" maxLength={60} required {...bind("label")} />
          <input className="hub-input" placeholder="Genre" maxLength={40} {...bind("genre")} />
          <textarea className="hub-input wide" placeholder="Description" maxLength={500} rows={2} {...bind("description")} />

          <button type="submit" className="hub-button primary" disabled={busy}>
            Add game
          </button>
        </form>
      )}

      <Err e={error} />

      {mine.length === 0 ? (
        <Empty title="No community games" body="Add a game so players can find squads for it." />
      ) : (
        <div className="system-grid">
          {mine.map((game) => (
            <Card key={game.id} top={game.genre || "Game"} title={game.label} sub={game.description}>
              <Btn
                disabled={busy}
                onClick={() =>
                  confirm(`Delete ${game.label}?`) &&
                  act(() => api(`/games/${game.id}`, { method: "DELETE" }))
                }
              >
                Delete
              </Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   FOLLOWING
========================================================= */

function FollowsTab({ games, onChange }) {
  const list = useApi("/follows");

  const { act, error, busy } = useAct(async () => {
    list.reload();
    onChange();
  });

  const [f, bind, reset] = useFields({ kind: "game", targetId: "" });

  const groups = [
    ["game", "Games", list.data?.games || []],
    ["team", "Teams", list.data?.teams || []],
    ["user", "Players", list.data?.users || []],
  ];

  const follow = (event) => {
    event.preventDefault();

    act(async () => {
      const targetId = f.kind === "game" ? f.targetId || games[0]?.id : f.targetId;

      if (!targetId) throw new Error("Enter an ID to follow.");

      await api("/follows", {
        method: "POST",
        body: { kind: f.kind, targetId: targetId.trim() },
      });

      reset();
    });
  };

  return (
    <div className="community-panel">
      <form className="form-card" onSubmit={follow}>
        <select className="hub-input" {...bind("kind")}>
          <option value="game">Game</option>
          <option value="team">Team ID</option>
          <option value="user">Player ID</option>
        </select>

        {f.kind === "game" ? (
          <GameSel games={games} value={f.targetId} onChange={(event) => bind("targetId").onChange(event)} />
        ) : (
          <input className="hub-input" placeholder="ID" required {...bind("targetId")} />
        )}

        <button type="submit" className="hub-button primary" disabled={busy}>
          Follow
        </button>
      </form>

      <Err e={error || list.error} />

      {groups.map(([kind, label, ids]) => (
        <div key={kind}>
          <h3>{label}</h3>

          {ids.length === 0 ? (
            <p>Nothing followed yet.</p>
          ) : (
            <div className="hub-pills">
              {ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  title="Unfollow"
                  onClick={() =>
                    act(() =>
                      api(`/follows/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" })
                    )
                  }
                >
                  {kind === "game" ? games.find((game) => game.id === id)?.label || id : id} ×
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   MESSAGES: helpers
========================================================= */

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const VID_RE = /\.(mp4|webm|mov)(\?.*)?$/i;
const IMG_HOST_RE = /(i\.imgur\.com|cdn\.discordapp\.com|media\.discordapp\.net|media\.tenor\.com|media\d*\.giphy\.com|raw\.githubusercontent\.com)/i;
const URL_RE = /(https?:\/\/[^\s<]+)/g;
const HTTP_RE = /^https?:\/\//i;

const isImage = (url) => IMG_RE.test(url) || IMG_HOST_RE.test(url);
const isVideo = (url) => VID_RE.test(url);

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const initialOf = (name) => String(name || "?").trim().slice(0, 1).toUpperCase();

const hueOf = (seed) => {
  let h = 0;
  for (const c of String(seed || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

const clock = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const dayKey = (ms) => new Date(ms).toDateString();

const dayLabel = (ms) => {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

const isTemp = (m) => String(m.id).startsWith("tmp_");

const sortMsgs = (list) => [...list].sort((a, b) => a.createdAt - b.createdAt);

const mergeMsgs = (prev, incoming) => {
  const map = new Map(prev.map((m) => [m.id, m]));

  incoming.forEach((m) => {
    const old = map.get(m.id);
    map.set(m.id, old ? { ...old, ...m } : m);
  });

  return sortMsgs([...map.values()]);
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎮", "👏"];
const COMPOSER_EMOJI = ["😀", "😂", "😎", "🥳", "😭", "😡", "👍", "👎", "❤️", "🔥", "🎮", "🏆", "💀", "👀", "🙏", "✨"];
const REPORT_REASONS = ["Spam", "Harassment", "Hate or abuse", "Inappropriate content", "Something else"];

const channelSub = (c) =>
  ({
    group: `Group · ${c.members?.length || 0} members`,
    team: "Team chat",
    lfg: "Party chat",
    dm: "Direct message",
  }[c.type] || "Conversation");

function Face({ name, avatar, size = 36 }) {
  return (
    <span
      className="msg-face"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), "--h": hueOf(name) }}
    >
      {avatar ? <img src={avatar} alt="" /> : initialOf(name)}
    </span>
  );
}

function Linkified({ text }) {
  return text
    .split(URL_RE)
    .map((part, i) =>
      i % 2 ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      ) : (
        part
      )
    );
}

/* =========================================================
   MESSAGES: live message stream
   Uses the backend's Server-Sent Events stream and falls back
   to polling whenever the stream can't connect.
========================================================= */

function useLiveMessages(channelId, onEvent) {
  const [state, setState] = useState({
    messages: [],
    loading: true,
    error: "",
    hasMore: false,
  });

  const [live, setLive] = useState("connecting");
  const [nonce, setNonce] = useState(0);

  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;

  const messagesRef = useRef([]);
  messagesRef.current = state.messages;

  useEffect(() => {
    let stopped = false;
    let es = null;
    let timer = null;

    const cid = encodeURIComponent(channelId);

    setState({ messages: [], loading: true, error: "", hasMore: false });
    setLive("connecting");

    const load = async (initial) => {
      try {
        const data = await api(`/channels/${cid}/messages?limit=60`);
        if (stopped) return;

        setState((s) => ({
          messages: mergeMsgs(initial ? [] : s.messages, data?.messages || []),
          loading: false,
          error: "",
          hasMore: initial ? Boolean(data?.hasMore) : s.hasMore,
        }));
      } catch (error) {
        if (!stopped) {
          setState((s) => ({ ...s, loading: false, error: s.messages.length ? "" : error.message }));
        }
      }
    };

    const stopPoll = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const startPoll = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (!document.hidden) load(false);
      }, 3500);
    };

    load(true);

    if (typeof EventSource === "undefined") {
      setLive("polling");
      startPoll();
    } else {
      es = new EventSource(`${GAMING_API}/channels/${cid}/stream`, { withCredentials: true });

      es.onopen = () => {
        if (stopped) return;
        setLive("live");
        stopPoll();
        load(false);
      };

      es.onmessage = (event) => {
        try {
          const ev = JSON.parse(event.data);
          if (!ev?.message) return;

          setState((s) => ({ ...s, messages: mergeMsgs(s.messages, [ev.message]) }));
          eventRef.current?.(ev);
        } catch {
          /* ignore malformed event */
        }
      };

      es.onerror = () => {
        if (stopped) return;
        setLive("polling");
        startPoll();
      };
    }

    // slow safety refresh in case an event was missed
    const safety = setInterval(() => {
      if (!document.hidden) load(false);
    }, 20000);

    return () => {
      stopped = true;
      es?.close();
      stopPoll();
      clearInterval(safety);
    };
  }, [channelId, nonce]);

  const put = useCallback(
    (message) =>
      setState((s) => ({ ...s, messages: mergeMsgs(s.messages, [message]) })),
    []
  );

  const swap = useCallback(
    (tempId, real) =>
      setState((s) => ({
        ...s,
        messages: mergeMsgs(
          s.messages.filter((m) => m.id !== tempId),
          real ? [real] : []
        ),
      })),
    []
  );

  const loadEarlier = useCallback(async () => {
    const first = messagesRef.current.find((m) => !isTemp(m));
    if (!first) return;

    try {
      const data = await api(
        `/channels/${encodeURIComponent(channelId)}/messages?limit=60&before=${first.createdAt}`
      );

      setState((s) => ({
        ...s,
        messages: mergeMsgs(s.messages, data?.messages || []),
        hasMore: Boolean(data?.hasMore),
      }));
    } catch {
      /* leave the button available to retry */
    }
  }, [channelId]);

  return {
    ...state,
    live,
    put,
    swap,
    loadEarlier,
    reload: () => setNonce((n) => n + 1),
  };
}

/* =========================================================
   MESSAGES: pieces
========================================================= */

function Attachments({ urls, onImage, onMedia }) {
  if (!urls?.length) return null;

  return (
    <div className={`msg-atts n${Math.min(urls.length, 4)}`}>
      {urls.map((url) =>
        isImage(url) ? (
          <button
            key={url}
            type="button"
            className="msg-att img"
            onClick={() => onImage(url)}
            aria-label="Open image"
          >
            <img
              src={url}
              alt=""
              loading="lazy"
              onLoad={onMedia}
              onError={(event) => event.currentTarget.closest(".msg-att")?.classList.add("broken")}
            />
          </button>
        ) : isVideo(url) ? (
          <video key={url} className="msg-att vid" src={url} controls preload="metadata" onLoadedMetadata={onMedia} />
        ) : (
          <a key={url} className="msg-att link" href={url} target="_blank" rel="noopener noreferrer">
            <Icon name="link" size={16} />
            <span>
              <b>{hostOf(url)}</b>
              <small>{url}</small>
            </span>
          </a>
        )
      )}
    </div>
  );
}

function MessageItem({
  m,
  grouped,
  mine,
  showName,
  meId,
  replied,
  canDelete,
  editing,
  onReply,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReact,
  onReport,
  onImage,
  onMedia,
  onJump,
}) {
  const [picker, setPicker] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState(m.content || "");

  useEffect(() => {
    if (editing) setText(m.content || "");
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const reacts = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length);
  const canEdit = mine && !m.deleted && !m.pending;

  const submitEdit = () => {
    const next = text.trim();

    if (!next || next === m.content) return onCancelEdit();
    onSaveEdit(m, next);
  };

  return (
    <div
      id={`msg-${m.id}`}
      className={`msg-row ${mine ? "mine" : ""} ${grouped ? "grouped" : ""} ${m.pending ? "pending" : ""}`}
    >
      <div className="msg-gutter">
        {!grouped && !mine && <Face name={m.authorName} avatar={m.authorAvatar} size={34} />}
      </div>

      <div className="msg-body">
        {showName && !grouped && !mine && <span className="msg-author">{m.authorName}</span>}

        <div className="msg-bubble-wrap">
          <div className={`msg-bubble ${m.deleted ? "deleted" : ""}`}>
            {m.replyTo && !m.deleted && (
              <button type="button" className="msg-quote" onClick={() => replied && onJump(replied.id)}>
                <b>{replied ? replied.authorName : "Original message"}</b>
                <span>
                  {replied
                    ? replied.deleted
                      ? "Message deleted"
                      : replied.content || "Attachment"
                    : "Not loaded"}
                </span>
              </button>
            )}

            {m.deleted ? (
              <p className="msg-text muted">This message was deleted</p>
            ) : editing ? (
              <div className="msg-edit">
                <textarea
                  className="hub-input"
                  autoFocus
                  rows={2}
                  maxLength={2000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitEdit();
                    }
                    if (event.key === "Escape") onCancelEdit();
                  }}
                />
                <div className="msg-edit-actions">
                  <small>Enter to save · Esc to cancel</small>
                  <Btn onClick={onCancelEdit}>Cancel</Btn>
                  <Btn primary onClick={submitEdit}>Save</Btn>
                </div>
              </div>
            ) : (
              <>
                {m.content && (
                  <p className="msg-text">
                    <Linkified text={m.content} />
                  </p>
                )}

                <Attachments urls={m.attachments} onImage={onImage} onMedia={onMedia} />
              </>
            )}

            {!editing && (
              <span className="msg-foot">
                {m.editedAt && !m.deleted && <em>edited</em>}
                {m.pending ? "Sending…" : clock(m.createdAt)}
              </span>
            )}
          </div>

          {!m.deleted && !editing && !m.pending && (
            <div className={`msg-actions ${picker || confirming ? "open" : ""}`}>
              {confirming ? (
                <>
                  <span className="msg-confirm">Delete?</span>
                  <button type="button" className="danger" onClick={() => { setConfirming(false); onDelete(m); }}>
                    Yes
                  </button>
                  <button type="button" onClick={() => setConfirming(false)}>
                    No
                  </button>
                </>
              ) : (
                <>
                  <button type="button" title="React" onClick={() => setPicker((v) => !v)}>
                    <Icon name="smile" size={15} />
                  </button>
                  <button type="button" title="Reply" onClick={() => onReply(m)}>
                    <Icon name="reply" size={15} />
                  </button>
                  {canEdit && (
                    <button type="button" title="Edit" onClick={() => onStartEdit(m)}>
                      <Icon name="edit" size={15} />
                    </button>
                  )}
                  {!mine && (
                    <button type="button" title="Report" onClick={() => onReport(m)}>
                      <Icon name="flag" size={15} />
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" title="Delete" className="danger" onClick={() => setConfirming(true)}>
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </>
              )}

              {picker && (
                <div className="msg-picker">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setPicker(false);
                        onReact(m, emoji);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {reacts.length > 0 && !m.deleted && (
          <div className="msg-reacts">
            {reacts.map(([emoji, ids]) => (
              <button
                key={emoji}
                type="button"
                className={ids.includes(meId) ? "on" : ""}
                onClick={() => onReact(m, emoji)}
                title={`${ids.length} ${ids.length === 1 ? "reaction" : "reactions"}`}
              >
                {emoji}
                <span>{ids.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportModal({ message, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason.trim()) return setError("Tell us what's wrong.");

    setBusy(true);
    setError("");

    try {
      await onSubmit(message, reason.trim());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Report message" onClose={onClose}>
      <div className="msg-report-preview">
        <b>{message.authorName}</b>
        <span>{message.content || "Attachment"}</span>
      </div>

      <div className="hub-pills">
        {REPORT_REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>

      <textarea
        className="hub-input"
        rows={3}
        maxLength={500}
        placeholder="Add details for the moderators (optional)"
        value={REPORT_REASONS.includes(reason) ? "" : reason}
        onChange={(event) => setReason(event.target.value)}
      />

      <Err e={error} />

      <div className="fx-modal-actions">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send report"}
        </Btn>
      </div>
    </Modal>
  );
}

/** player search used for new chats and adding group members */
function PlayerSearch({ onPick, selected = [], exclude = [], placeholder = "Search players" }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const res = useApi(`/players?q=${encodeURIComponent(dq)}&limit=12`);
  const players = (res.data?.players || []).filter((p) => !exclude.includes(p.userId));

  return (
    <div className="msg-search-block">
      <div className="msg-search">
        <Icon name="search" size={15} />
        <input value={q} placeholder={placeholder} onChange={(event) => setQ(event.target.value)} />
      </div>

      <Err e={res.error} />

      <div className="msg-people">
        {res.loading && !res.data && <div className="skeleton-card" style={{ minHeight: 60 }} />}

        {res.data && players.length === 0 && <p className="msg-none">No players found.</p>}

        {players.map((p) => {
          const on = selected.includes(p.userId);

          return (
            <button
              key={p.userId}
              type="button"
              className={`msg-person ${on ? "on" : ""}`}
              onClick={() => onPick(p)}
            >
              <Face name={p.username} avatar={p.avatar} size={34} />
              <span>
                <b>{p.username}</b>
                {p.gamertag && <small>{p.gamertag}</small>}
              </span>
              {on && <Icon name="check" size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewChat({ meId, onCreated, onCancel }) {
  const [mode, setMode] = useState("dm");
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async (body) => {
    setBusy(true);
    setError("");

    try {
      const result = await api("/channels", { method: "POST", body });
      onCreated(result.channel);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const toggle = (p) =>
    setPicked((current) =>
      current.some((x) => x.userId === p.userId)
        ? current.filter((x) => x.userId !== p.userId)
        : [...current, p].slice(0, 19)
    );

  return (
    <div className="msg-new">
      <div className="msg-pane-head">
        <button type="button" className="msg-icon-btn msg-back" onClick={onCancel} aria-label="Back">
          <Icon name="back" />
        </button>

        <div className="msg-pane-title">
          <strong>New conversation</strong>
          <span>Message a player or start a group for your squad.</span>
        </div>

        <button type="button" className="msg-icon-btn desktop-only" onClick={onCancel} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>

      <div className="msg-new-body">
        <div className="hub-pills" role="group" aria-label="Conversation type">
          <button type="button" aria-pressed={mode === "dm"} onClick={() => setMode("dm")}>
            Direct message
          </button>
          <button type="button" aria-pressed={mode === "group"} onClick={() => setMode("group")}>
            Group chat
          </button>
        </div>

        {mode === "group" && (
          <>
            <input
              className="hub-input"
              placeholder="Group name"
              maxLength={50}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            {picked.length > 0 && (
              <div className="msg-chips">
                {picked.map((p) => (
                  <button key={p.userId} type="button" onClick={() => toggle(p)}>
                    {p.username} <Icon name="x" size={12} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <PlayerSearch
          exclude={[meId]}
          selected={picked.map((p) => p.userId)}
          placeholder={mode === "dm" ? "Find a player to message" : "Add players to the group"}
          onPick={(p) => {
            if (mode === "dm") create({ type: "dm", userId: p.userId });
            else toggle(p);
          }}
        />

        <Err e={error} />

        {mode === "group" && (
          <Btn
            primary
            disabled={busy || !name.trim() || picked.length === 0}
            onClick={() =>
              create({ type: "group", name: name.trim(), members: picked.map((p) => p.userId) })
            }
          >
            {busy ? "Creating…" : `Create group${picked.length ? ` (${picked.length + 1})` : ""}`}
          </Btn>
        )}
      </div>
    </div>
  );
}

function InfoPanel({ channel, meId, onClose, onChanged, onLeft }) {
  const cid = encodeURIComponent(channel.id);
  const isGroup = channel.type === "group";
  const owner = channel.ownerId === meId;

  const { act, error, busy } = useAct(onChanged);
  const [adding, setAdding] = useState(false);

  return (
    <aside className="msg-info">
      <div className="msg-pane-head">
        <div className="msg-pane-title">
          <strong>Details</strong>
          <span>{channelSub(channel)}</span>
        </div>

        <button type="button" className="msg-icon-btn" onClick={onClose} aria-label="Close details">
          <Icon name="x" />
        </button>
      </div>

      <div className="msg-info-body">
        <Err e={error} />

        <div className="msg-info-list">
          {channel.members.map((m) => (
            <div className="msg-person static" key={m.userId}>
              <Face name={m.username} avatar={m.avatar} size={34} />
              <span>
                <b>{m.userId === meId ? `${m.username} (you)` : m.username}</b>
                {channel.ownerId === m.userId && isGroup && <small>Owner</small>}
              </span>

              {isGroup && owner && m.userId !== meId && (
                <button
                  type="button"
                  className="msg-icon-btn"
                  disabled={busy}
                  title="Remove from group"
                  onClick={() => act(() => api(`/channels/${cid}/members/${m.userId}`, { method: "DELETE" }))}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}

          {channel.members.length === 0 && (
            <p className="msg-none">Everyone on the team or party can see this chat.</p>
          )}
        </div>

        {isGroup && owner && (
          <>
            <Btn onClick={() => setAdding((v) => !v)}>
              <Icon name="plus" size={14} /> {adding ? "Done" : "Add players"}
            </Btn>

            {adding && (
              <PlayerSearch
                exclude={channel.members.map((m) => m.userId)}
                placeholder="Search players to add"
                onPick={(p) =>
                  act(() => api(`/channels/${cid}/members`, { method: "POST", body: { userId: p.userId } }))
                }
              />
            )}
          </>
        )}

        {isGroup && (
          <Btn
            disabled={busy}
            onClick={() =>
              confirm(`Leave "${channel.name}"?`) &&
              act(async () => {
                await api(`/channels/${cid}/members/${meId}`, { method: "DELETE" });
                onLeft();
              })
            }
          >
            <Icon name="logout" size={14} /> Leave group
          </Btn>
        )}
      </div>
    </aside>
  );
}

/* =========================================================
   MESSAGES: chat pane
========================================================= */

function ChatPane({ channel, session, onBack, onChanged, onActivity, onLeft }) {
  const toast = useToast();
  const me = session.me.user;
  const meId = me.id;
  const cid = encodeURIComponent(channel.id);

  const live = useLiveMessages(channel.id, (event) => {
    if (event.type === "message") onActivity?.();
  });

  const messages = live.messages;
  const last = messages[messages.length - 1];

  const listRef = useRef(null);
  const taRef = useRef(null);
  const stick = useRef(true);
  const seenId = useRef(null);
  const readId = useRef(null);

  const [unseen, setUnseen] = useState(0);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [atts, setAtts] = useState([]);
  const [tray, setTray] = useState(null); // null | "attach" | "emoji"
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const byId = new Map(messages.map((m) => [m.id, m]));

  const staffOfTeam =
    channel.type === "team" &&
    ["owner", "admin"].includes(session.me.teams.find((t) => t.id === channel.refId)?.myRole);

  const canDelete = (m) =>
    m.authorId === meId ||
    session.me.admin ||
    staffOfTeam ||
    (channel.type === "group" && channel.ownerId === meId);

  /* scrolling */

  const toBottom = (smooth) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el || !last) return;

    const isNew = seenId.current !== last.id;

    if (stick.current) el.scrollTop = el.scrollHeight;
    else if (isNew && seenId.current && last.authorId !== meId && !isTemp(last)) setUnseen((n) => n + 1);

    seenId.current = last.id;
  }, [last?.id, live.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const keepBottom = useCallback(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = (event) => {
    const el = event.currentTarget;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 90;

    stick.current = near;
    if (near) setUnseen(0);
  };

  const earlier = async () => {
    const el = listRef.current;
    const before = el.scrollHeight;

    await live.loadEarlier();

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.scrollTop += el.scrollHeight - before;
      })
    );
  };

  const jumpTo = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;

    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1400);
  };

  /* read receipts */

  const markRead = useCallback(
    async (id) => {
      if (readId.current === id) return;
      readId.current = id;

      try {
        await api(`/channels/${cid}/read`, { method: "POST" });
        onChanged?.();
      } catch {
        /* not critical */
      }
    },
    [cid] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (last && !isTemp(last) && !document.hidden) markRead(last.id);
  }, [last?.id, markRead]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && last && !isTemp(last)) {
        readId.current = null;
        markRead(last.id);
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [last?.id, markRead]); // eslint-disable-line react-hooks/exhaustive-deps

  /* composer */

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;

    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [draft]);

  const addAttachment = (url) => {
    const clean = String(url || "").trim();

    if (!HTTP_RE.test(clean)) return false;

    setAtts((current) =>
      current.includes(clean) || current.length >= 4 ? current : [...current, clean]
    );

    return true;
  };

  const send = async () => {
    const content = draft.trim();

    if (!content && atts.length === 0) return;

    const tempId = `tmp_${Date.now()}`;
    const attachments = atts;
    const reply = replyTo;

    live.put({
      id: tempId,
      channelId: channel.id,
      authorId: meId,
      authorName: me.username,
      authorAvatar: me.avatar,
      content,
      attachments,
      replyTo: reply?.id || null,
      reactions: {},
      deleted: false,
      createdAt: Date.now(),
      editedAt: null,
      pending: true,
    });

    setDraft("");
    setAtts([]);
    setReplyTo(null);
    setTray(null);
    setError("");
    stick.current = true;

    try {
      const result = await api(`/channels/${cid}/messages`, {
        method: "POST",
        body: { content, attachments, replyTo: reply?.id },
      });

      live.swap(tempId, result.message);
      onChanged?.();
    } catch (e) {
      live.swap(tempId, null);
      setDraft(content);
      setAtts(attachments);
      setReplyTo(reply);
      setError(e.message);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
      return;
    }

    if (event.key === "ArrowUp" && !draft) {
      const mineLast = [...messages].reverse().find((m) => m.authorId === meId && !m.deleted && !isTemp(m));

      if (mineLast) {
        event.preventDefault();
        setEditingId(mineLast.id);
      }
    }

    if (event.key === "Escape") {
      setReplyTo(null);
      setTray(null);
    }
  };

  const onPaste = (event) => {
    const pasted = event.clipboardData?.getData("text")?.trim();

    if (pasted && !pasted.includes(" ") && HTTP_RE.test(pasted) && (isImage(pasted) || isVideo(pasted))) {
      event.preventDefault();
      addAttachment(pasted);
    }
  };

  /* message actions */

  const saveEdit = async (m, content) => {
    try {
      const result = await api(`/messages/${encodeURIComponent(m.id)}`, {
        method: "PATCH",
        body: { content },
      });

      live.put(result.message);
      setEditingId(null);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const remove = async (m) => {
    try {
      await api(`/messages/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      live.put({ ...m, deleted: true, content: "", attachments: [], reactions: {} });
      onChanged?.();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const react = async (m, emoji) => {
    const has = (m.reactions?.[emoji] || []).includes(meId);

    try {
      const result = has
        ? await api(`/messages/${encodeURIComponent(m.id)}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" })
        : await api(`/messages/${encodeURIComponent(m.id)}/reactions`, { method: "POST", body: { emoji } });

      live.put({ ...m, reactions: result.reactions });
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const report = async (m, reason) => {
    await api("/reports", {
      method: "POST",
      body: { kind: "message", targetId: m.id, reason },
    });

    setReporting(null);
    toast("Report sent. Thanks for keeping the hub safe.");
  };

  /* render list with day dividers and grouping */

  const rows = [];

  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);

    const grouped =
      !newDay &&
      prev.authorId === m.authorId &&
      !prev.deleted &&
      !m.deleted &&
      !m.replyTo &&
      m.createdAt - prev.createdAt < 5 * 60 * 1000;

    rows.push(
      <Fragment key={m.id}>
        {newDay && (
          <div className="msg-day">
            <span>{dayLabel(m.createdAt)}</span>
          </div>
        )}

        <MessageItem
          m={m}
          grouped={grouped}
          mine={m.authorId === meId}
          showName={channel.type !== "dm"}
          meId={meId}
          replied={m.replyTo ? byId.get(m.replyTo) : null}
          canDelete={canDelete(m)}
          editing={editingId === m.id}
          onReply={(msg) => {
            setReplyTo(msg);
            taRef.current?.focus();
          }}
          onStartEdit={(msg) => setEditingId(msg.id)}
          onCancelEdit={() => setEditingId(null)}
          onSaveEdit={saveEdit}
          onDelete={remove}
          onReact={react}
          onReport={setReporting}
          onImage={setLightbox}
          onMedia={keepBottom}
          onJump={jumpTo}
        />
      </Fragment>
    );
  });

  const sendable = (draft.trim() || atts.length) && draft.length <= 2000;

  return (
    <div className={`msg-chat ${info ? "with-info" : ""}`}>
      <div className="msg-pane-head">
        <button type="button" className="msg-icon-btn msg-back" onClick={onBack} aria-label="Back to conversations">
          <Icon name="back" />
        </button>

        <Face name={channel.name} size={40} />

        <div className="msg-pane-title">
          <strong>{channel.name || "Conversation"}</strong>
          <span>
            <i className={`msg-live ${live.live}`} />
            {live.live === "live" ? "Live" : live.live === "polling" ? "Refreshing" : "Connecting"} ·{" "}
            {channelSub(channel)}
          </span>
        </div>

        <button
          type="button"
          className={`msg-icon-btn ${info ? "on" : ""}`}
          onClick={() => setInfo((v) => !v)}
          aria-label="Conversation details"
          title="Details"
        >
          <Icon name="info" />
        </button>
      </div>

      <div className="msg-scroll" ref={listRef} onScroll={onScroll} aria-live="polite">
        {live.hasMore && (
          <div className="msg-earlier">
            <Btn onClick={earlier}>Load earlier messages</Btn>
          </div>
        )}

        {live.loading && messages.length === 0 && (
          <div className="msg-skeletons">
            {[60, 40, 72, 48].map((w, i) => (
              <div key={i} className={`skeleton-card ${i % 2 ? "r" : ""}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {live.error && messages.length === 0 && (
          <div className="msg-state">
            <p className="form-error">Couldn&apos;t load this conversation: {live.error}</p>
            <Btn onClick={live.reload}>Try again</Btn>
          </div>
        )}

        {!live.loading && !live.error && messages.length === 0 && (
          <div className="msg-state">
            <span className="msg-state-icon">
              <Icon name="messages" size={26} />
            </span>
            <strong>No messages yet</strong>
            <p>Say hello and get the conversation going.</p>
          </div>
        )}

        {rows}
      </div>

      {unseen > 0 && (
        <button
          type="button"
          className="msg-jump"
          onClick={() => {
            toBottom(true);
            setUnseen(0);
          }}
        >
          <Icon name="down" size={14} /> {unseen} new {unseen === 1 ? "message" : "messages"}
        </button>
      )}

      <div className="msg-composer">
        {replyTo && (
          <div className="msg-replying">
            <Icon name="reply" size={14} />
            <span>
              Replying to <b>{replyTo.authorName}</b>
              <em>{replyTo.content || "Attachment"}</em>
            </span>
            <button type="button" className="msg-icon-btn" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        {atts.length > 0 && (
          <div className="msg-tray-atts">
            {atts.map((url) => (
              <div className="msg-tray-att" key={url}>
                {isImage(url) ? <img src={url} alt="" /> : <Icon name={isVideo(url) ? "image" : "link"} size={18} />}
                <small>{hostOf(url)}</small>
                <button type="button" onClick={() => setAtts((c) => c.filter((x) => x !== url))} aria-label="Remove attachment">
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {tray === "attach" && (
          <AttachPanel
            meId={meId}
            count={atts.length}
            onAdd={addAttachment}
            onShare={(post) => {
              const room = 4 - atts.length;
              (post.media || []).slice(0, room).forEach(addAttachment);
              setDraft((d) => (d ? d : post.title));
            }}
            onClose={() => setTray(null)}
          />
        )}

        {tray === "emoji" && (
          <div className="msg-emoji-tray">
            {COMPOSER_EMOJI.map((emoji) => (
              <button key={emoji} type="button" onClick={() => setDraft((d) => d + emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        <Err e={error} />

        <div className="msg-input-row">
          <button
            type="button"
            className={`msg-icon-btn ${tray === "attach" ? "on" : ""}`}
            onClick={() => setTray((t) => (t === "attach" ? null : "attach"))}
            aria-label="Add attachment"
            title="Attach"
          >
            <Icon name="clip" size={18} />
          </button>

          <textarea
            ref={taRef}
            className="msg-input"
            rows={1}
            placeholder={`Message ${channel.name || "this chat"}`}
            aria-label="Write a message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />

          <button
            type="button"
            className={`msg-icon-btn ${tray === "emoji" ? "on" : ""}`}
            onClick={() => setTray((t) => (t === "emoji" ? null : "emoji"))}
            aria-label="Emoji"
            title="Emoji"
          >
            <Icon name="smile" size={18} />
          </button>

          <button type="button" className="msg-send" disabled={!sendable} onClick={send} aria-label="Send message">
            <Icon name="send" size={17} />
          </button>
        </div>

        <div className="msg-hint">
          <span>Enter to send · Shift + Enter for a new line · ↑ to edit your last message</span>
          {draft.length > 1700 && <b className={draft.length > 2000 ? "over" : ""}>{draft.length}/2000</b>}
        </div>
      </div>

      {info && (
        <InfoPanel
          channel={channel}
          meId={meId}
          onClose={() => setInfo(false)}
          onChanged={onChanged}
          onLeft={onLeft}
        />
      )}

      {reporting && <ReportModal message={reporting} onClose={() => setReporting(null)} onSubmit={report} />}

      {lightbox && (
        <div className="msg-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="Image preview">
          <img src={lightbox} alt="" />
          <a href={lightbox} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
            Open original
          </a>
        </div>
      )}
    </div>
  );
}

/** attach by link, or reuse media and titles from your own posts */
function AttachPanel({ meId, count, onAdd, onShare, onClose }) {
  const [tab, setTab] = useState("link");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const posts = useApi(tab === "posts" ? `/posts?author=${encodeURIComponent(meId)}&limit=30` : null);
  const list = posts.data?.posts || [];

  const full = count >= 4;

  const add = () => {
    if (full) return setError("You can attach up to 4 items.");

    if (!onAdd(url)) return setError("Paste a link that starts with http:// or https://");

    setUrl("");
    setError("");
  };

  return (
    <div className="msg-attach">
      <div className="msg-attach-head">
        <div className="hub-pills" role="group" aria-label="Attachment source">
          <button type="button" aria-pressed={tab === "link"} onClick={() => setTab("link")}>
            <Icon name="link" size={12} /> From a link
          </button>
          <button type="button" aria-pressed={tab === "posts"} onClick={() => setTab("posts")}>
            <Icon name="posts" size={12} /> From my posts
          </button>
        </div>

        <button type="button" className="msg-icon-btn" onClick={onClose} aria-label="Close attachments">
          <Icon name="x" size={14} />
        </button>
      </div>

      {tab === "link" ? (
        <>
          <div className="msg-attach-row">
            <input
              className="hub-input"
              placeholder="Paste an image, clip or link"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
            />
            <Btn primary onClick={add}>
              Attach
            </Btn>
          </div>
          <small>Direct image and video links show inline. Up to 4 per message.</small>
        </>
      ) : (
        <div className="msg-attach-posts">
          {posts.loading && !posts.data && <div className="skeleton-card" style={{ minHeight: 56 }} />}
          {posts.data && list.length === 0 && <p className="msg-none">You haven&apos;t posted anything yet.</p>}

          {list.map((post) => (
            <button
              key={post.id}
              type="button"
              className="msg-post"
              disabled={full && (post.media || []).length > 0}
              onClick={() => onShare(post)}
            >
              {post.media?.[0] && isImage(post.media[0]) ? <img src={post.media[0]} alt="" /> : <Icon name="posts" size={18} />}
              <span>
                <b>{post.title}</b>
                <small>
                  {(post.media || []).length
                    ? `${post.media.length} ${post.media.length === 1 ? "attachment" : "attachments"}`
                    : "Share title"}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}

      <Err e={error} />
    </div>
  );
}

/* =========================================================
   MESSAGES: tab
========================================================= */

function MessagesTab({ session, onChange }) {
  const meId = session.me.user.id;
  const list = useApi("/channels");

  const [activeId, setActiveId] = useState(null);
  const [created, setCreated] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("");

  const channels = list.data?.channels || [];

  const active =
    channels.find((c) => String(c.id) === String(activeId)) ||
    (created && String(created.id) === String(activeId) ? created : null);

  const refreshAll = useCallback(() => {
    list.reload();
    onChange?.();
  }, [list.reload, onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const debounce = useRef(null);

  const refreshSoon = useCallback(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(refreshAll, 700);
  }, [refreshAll]);

  useEffect(() => () => clearTimeout(debounce.current), []);

  // keep the conversation list fresh while the tab is open
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) list.reload();
    }, 8000);

    return () => clearInterval(t);
  }, [list.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) onChange?.();
    }, 30000);

    return () => clearInterval(t);
  }, [onChange]);

  const open = (channel) => {
    setActiveId(String(channel.id));
    setShowNew(false);
  };

  const q = filter.trim().toLowerCase();

  const shown = q
    ? channels.filter((c) => `${c.name} ${c.lastMessage?.content || ""}`.toLowerCase().includes(q))
    : channels;

  const totalUnread = channels.reduce((n, c) => n + (Number(c.unread) || 0), 0);

  return (
    <div className={`msg-shell ${active || showNew ? "has-chat" : ""}`}>
      <aside className="msg-list">
        <div className="msg-list-head">
          <div>
            <h2>Messages</h2>
            <span>
              {channels.length} {channels.length === 1 ? "conversation" : "conversations"}
              {totalUnread > 0 && ` · ${totalUnread} unread`}
            </span>
          </div>

          <button
            type="button"
            className="msg-compose"
            onClick={() => {
              setShowNew(true);
              setActiveId(null);
            }}
            aria-label="New conversation"
            title="New conversation"
          >
            <Icon name="plus" size={18} />
          </button>
        </div>

        <div className="msg-search">
          <Icon name="search" size={15} />
          <input value={filter} placeholder="Search conversations" onChange={(event) => setFilter(event.target.value)} />
        </div>

        <Err e={list.error} />

        <div className="msg-convs">
          {list.loading && !list.data && (
            <>
              <div className="skeleton-card" style={{ minHeight: 68 }} />
              <div className="skeleton-card" style={{ minHeight: 68 }} />
              <div className="skeleton-card" style={{ minHeight: 68 }} />
            </>
          )}

          {list.data && channels.length === 0 && (
            <div className="msg-none-card">
              <strong>No conversations yet</strong>
              <p>Start a direct message or a group chat. Team and party chats show up here automatically.</p>
              <Btn primary onClick={() => setShowNew(true)}>
                Start a chat
              </Btn>
            </div>
          )}

          {list.data && channels.length > 0 && shown.length === 0 && <p className="msg-none">Nothing matches that search.</p>}

          {shown.map((channel) => {
            const selected = String(activeId) === String(channel.id);
            const unread = Number(channel.unread) || 0;
            const lm = channel.lastMessage;

            const preview = lm
              ? lm.deleted
                ? "Message deleted"
                : `${lm.authorId === meId ? "You: " : channel.type === "dm" ? "" : `${lm.authorName}: `}${
                    lm.content || (lm.attachments?.length ? "Sent an attachment" : "")
                  }`
              : "No messages yet";

            return (
              <button
                key={channel.id}
                type="button"
                className={`msg-conv ${selected ? "active" : ""} ${unread && !selected ? "unread" : ""}`}
                onClick={() => open(channel)}
              >
                <Face name={channel.name} size={42} />

                <span className="msg-conv-main">
                  <span className="msg-conv-top">
                    <b>{channel.name || "Conversation"}</b>
                    <time>{ago(lm?.createdAt || channel.createdAt)}</time>
                  </span>

                  <span className="msg-conv-bottom">
                    <span className="msg-conv-preview">{preview}</span>
                    {unread > 0 && !selected && <span className="msg-badge">{unread > 99 ? "99+" : unread}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="msg-pane">
        {showNew ? (
          <NewChat
            meId={meId}
            onCancel={() => setShowNew(false)}
            onCreated={(channel) => {
              setCreated(channel);
              setActiveId(String(channel.id));
              setShowNew(false);
              refreshAll();
            }}
          />
        ) : active ? (
          <ChatPane
            key={String(active.id)}
            channel={active}
            session={session}
            onBack={() => setActiveId(null)}
            onChanged={refreshAll}
            onActivity={refreshSoon}
            onLeft={() => {
              setActiveId(null);
              setCreated(null);
              refreshAll();
            }}
          />
        ) : (
          <div className="msg-placeholder">
            <span className="msg-state-icon big">
              <Icon name="messages" size={34} />
            </span>
            <h3>Your messages</h3>
            <p>Pick a conversation on the left, or start a new one. Chats update live.</p>
            <Btn primary onClick={() => setShowNew(true)}>
              <Icon name="plus" size={14} /> New conversation
            </Btn>
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   PREDICTIONS
========================================================= */

function PredictionsTab({ games }) {
  const list = useApi("/predictions/me");
  const rows = list.data?.predictions || [];

  return (
    <div className="community-panel">
      <Loading list={list} />

      {list.data && rows.length === 0 && (
        <Empty title="No predictions yet" body="Pick winners on upcoming matches in the hub." />
      )}

      <div className="system-grid">
        {rows.map((prediction) => (
          <Card
            key={prediction.id}
            top={games.find((game) => game.id === prediction.game)?.label || prediction.game}
            pill={prediction.status}
            title={`Match ${prediction.matchId}`}
            sub={`Picked team ${prediction.teamId} · ${ago(prediction.at)}`}
          />
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN: REPORTS
========================================================= */

function ReportsTab() {
  const list = useApi("/admin/reports?resolved=0");
  const { act, error, busy } = useAct(list.reload);

  const reports = list.data?.reports || [];

  return (
    <div className="community-panel">
      <Err e={error} />
      <Loading list={list} />

      {list.data && reports.length === 0 && <Empty title="All clear" body="No open reports." />}

      <div className="stack">
        {reports.map((report) => (
          <Card
            key={report.id}
            top={report.kind}
            pill={ago(report.createdAt)}
            title={report.reason}
            sub={`Target ${report.targetId} · reported by ${report.reporterId}`}
          >
            <Btn
              primary
              disabled={busy}
              onClick={() => act(() => api(`/admin/reports/${report.id}/resolve`, { method: "POST" }))}
            >
              Resolve
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ACCOUNT
========================================================= */

function AccountTab({ session, setTab }) {
  const { user, profile, admin, teams } = session.me;

  const [copied, setCopied] = useState(false);
  const { act, error, busy } = useAct();

  const links = Object.entries(profile?.links || {});

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Clipboard blocked */
    }
  };

  const exportData = () =>
    act(async () => {
      const safe = (path) => api(path).catch(() => null);

      const [predictions, follows, posts] = await Promise.all([
        safe("/predictions/me"),
        safe("/follows"),
        safe(`/posts?author=${encodeURIComponent(user.id)}&limit=50`),
      ]);

      const blob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              account: user,
              profile,
              teams,
              predictions: predictions?.predictions,
              follows,
              posts: posts?.posts,
            },
            null,
            2
          ),
        ],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "fades-gaming-data.json";
      link.click();

      URL.revokeObjectURL(url);
    });

  const rows = [
    ["Gamertag", profile?.gamertag || "Not set"],
    ["Country", profile?.country || "Not set"],
    ["Platforms", profile?.platforms?.join(", ") || "None"],
    ["Role", admin ? "Moderator" : "Player"],
    ["Joined", profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Recently"],
  ];

  return (
    <div className="account-grid">
      <div className="system-card">
        <div className="account-id">
          <Avatar user={user} sm />

          <div>
            <strong className="card-title">{user.username}</strong>

            <span className="card-sub">
              {teams.length} {teams.length === 1 ? "team" : "teams"} · {session.me.follows} following
            </span>
          </div>
        </div>

        <dl className="kv">
          <div>
            <dt>User ID</dt>
            <dd>
              {user.id}{" "}
              <button type="button" className="chip" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </dd>
          </div>

          {rows.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="card-actions">
          <Btn onClick={() => setTab("profile")}>Edit profile</Btn>
        </div>
      </div>

      <div className="system-card">
        <strong className="card-title">Fades account</strong>

        <span className="card-sub">
          Your email, password and sign-in security are managed on your main Fades account.
        </span>

        <div className="card-actions">
          <a className="hub-button primary" href={SIGN_IN_URL}>
            Manage Fades account
          </a>
        </div>
      </div>

      <div className="system-card">
        <strong className="card-title">Linked profiles</strong>

        {links.length === 0 ? (
          <span className="card-sub">Add Steam, Discord, Twitch and more so teammates can find you.</span>
        ) : (
          <dl className="kv">
            {links.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="card-actions">
          <Btn onClick={() => setTab("profile")}>{links.length ? "Edit links" : "Add links"}</Btn>
        </div>
      </div>

      <div className="system-card">
        <strong className="card-title">Your data</strong>

        <span className="card-sub">
          Download your profile, teams, follows, predictions and posts as a JSON file.
        </span>

        <Err e={error} />

        <div className="card-actions">
          <Btn disabled={busy} onClick={exportData}>
            {busy ? "Preparing..." : "Export my data"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SETTINGS
========================================================= */

const PREFS_KEY = "fades-dashboard-prefs";

const DEFAULT_PREFS = {
  density: "comfortable",
  start: "overview",
  hubStats: "on",
  effects: "on",
};

function Seg({ label, value, options, onChange }) {
  return (
    <div className="hub-pills" role="group" aria-label={label}>
      {options.map(([optionValue, text]) => (
        <button
          key={optionValue}
          type="button"
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SettingsTab({ prefs, setPrefs, tabs }) {
  const set = (key) => (value) => setPrefs((current) => ({ ...current, [key]: value }));

  return (
    <div className="system-card">
      <div className="pref-row">
        <div>
          <strong>Density</strong>
          <span>How much space cards and forms take up.</span>
        </div>

        <Seg
          label="Density"
          value={prefs.density}
          onChange={set("density")}
          options={[
            ["comfortable", "Comfortable"],
            ["compact", "Compact"],
          ]}
        />
      </div>

      <div className="pref-row">
        <div>
          <strong>Effects</strong>
          <span>Ambient glow, card spotlights and motion across the dashboard.</span>
        </div>

        <Seg
          label="Effects"
          value={prefs.effects}
          onChange={set("effects")}
          options={[
            ["on", "On"],
            ["off", "Off"],
          ]}
        />
      </div>

      <div className="pref-row">
        <div>
          <strong>Open on</strong>
          <span>The section you land on when you open the dashboard.</span>
        </div>

        <select
          className="hub-input"
          style={{ width: "auto" }}
          value={prefs.start}
          onChange={(event) => set("start")(event.target.value)}
        >
          {tabs
            .filter((id) => id !== "reports")
            .map((id) => (
              <option key={id} value={id}>
                {COPY[id][0]}
              </option>
            ))}
        </select>
      </div>

      <div className="pref-row">
        <div>
          <strong>Hub stats</strong>
          <span>Show player, party, tournament and post totals on the overview.</span>
        </div>

        <Seg
          label="Hub stats"
          value={prefs.hubStats}
          onChange={set("hubStats")}
          options={[
            ["on", "Show"],
            ["off", "Hide"],
          ]}
        />
      </div>

      <div className="pref-row">
        <div>
          <strong>Reset</strong>
          <span>These settings are saved in this browser only.</span>
        </div>

        <Btn onClick={() => setPrefs(DEFAULT_PREFS)}>Reset to defaults</Btn>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE CONFIGURATION
========================================================= */

const COPY = {
  overview: ["Overview", "Your activity and shortcuts."],
  teams: ["Teams", "Create squads and manage who's in them."],
  parties: ["Parties", "Groups you're looking for or have joined."],
  tournaments: ["Tournaments", "Host brackets and report results."],
  posts: ["Posts", "Clips, guides and thoughts you've shared."],
  games: ["Games", "Community games you've added."],
  follows: ["Following", "Games, teams and players you follow."],
  messages: ["Messages", "Direct messages and group chats."],
  predictions: ["Predictions", "Your match picks and how they went."],
  profile: ["Profile", "How other players see you."],
  account: ["Account", "Your identity, linked profiles and data."],
  settings: ["Settings", "Make the dashboard work your way."],
  reports: ["Reports", "Open reports waiting on a moderator."],
};

const GROUPS = [
  ["Dashboard", ["overview"]],
  ["Community", ["teams", "parties", "tournaments", "posts", "games", "follows", "messages", "predictions"]],
  ["Account", ["profile", "account", "settings"]],
];

/* =========================================================
   AVATAR + BRAND
========================================================= */

function Avatar({ user, sm }) {
  return (
    <span className={`db-avatar ${sm ? "sm" : ""}`}>
      {user?.avatar ? <img src={user.avatar} alt="" /> : (user?.username || "F").slice(0, 1).toUpperCase()}
    </span>
  );
}

function Brand() {
  const [bad, setBad] = useState(false);

  return (
    <a className="db-brand" href={HUB_URL}>
      <span className="db-logo">
        {bad ? <b>F</b> : <img src={LOGO} alt="" onError={() => setBad(true)} />}
      </span>

      <span>
        <strong>Fades</strong>
        <em>Dashboard</em>
      </span>
    </a>
  );
}

/* =========================================================
   MAIN DASHBOARD
========================================================= */

export default function DashboardPage() {
  const session = useSession();

  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [toasts, setToasts] = useState([]);

  const searchRef = useRef(null);
  const gameList = useApi("/games");

  const toast = useCallback((text, kind = "ok") => {
    const id = Math.random().toString(36).slice(2);

    setToasts((current) => [...current, { id, text, kind }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3600);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");

      if (saved) {
        setPrefs({ ...DEFAULT_PREFS, ...saved });

        if (COPY[saved.start] && saved.start !== "reports") setTab(saved.start);
      }
    } catch {
      /* Storage unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* Storage unavailable */
    }
  }, [prefs]);

  // Ctrl/Cmd + K jumps to section search
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allGames = gameList.data?.games || [];

  const games = allGames.map((game) => ({ id: game.id, label: game.label }));

  // cursor spotlight on cards + ambient glow that follows the pointer
  const onPointerMove = (event) => {
    if (prefs.effects !== "on") return;

    const root = event.currentTarget;
    root.style.setProperty("--gx", `${event.clientX}px`);
    root.style.setProperty("--gy", `${event.clientY}px`);

    const el = event.target.closest?.(".system-card, .db-stat, .db-banner, .db-hero, .msg-conv");

    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - r.left}px`);
      el.style.setProperty("--my", `${event.clientY - r.top}px`);
    }
  };

  if (session.loading || !session.signedIn) {
    return (
      <div className="db" data-density={prefs.density} data-fx={prefs.effects}>
        <div className="fx-aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <div className="db-center">
          <Brand />

          {session.loading ? (
            <div className="skeleton-card" style={{ width: "min(420px, 100%)" }} />
          ) : (
            <div className="systems-empty" style={{ width: "min(420px, 100%)" }}>
              <h3>Sign in to see your dashboard</h3>

              <p>Your teams, parties, tournaments and posts live here.</p>

              <a className="hub-button primary" href={SIGN_IN_URL}>
                Sign in
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { user, profile, admin, unread } = session.me;

  const meId = user.id;

  const groups = [...GROUPS, ...(admin ? [["Moderation", ["reports"]]] : [])];

  const allTabs = groups.flatMap(([, ids]) => ids);

  const [title, blurb] = COPY[tab] || COPY.overview;

  const go = (id) => {
    setTab(id);
    setQuery("");
    setMenu(false);
    window.scrollTo({ top: 0 });
  };

  const q = query.trim().toLowerCase();

  const matches = q
    ? allTabs.filter((id) => `${COPY[id][0]} ${COPY[id][1]}`.toLowerCase().includes(q))
    : [];

  return (
    <ToastCtx.Provider value={toast}>
      <div
        className="db"
        data-density={prefs.density}
        data-fx={prefs.effects}
        data-tab={tab}
        onPointerMove={onPointerMove}
      >
        <div className="fx-aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <aside className={`db-side ${menu ? "open" : ""}`}>
          <Brand />

          <nav className="db-nav" aria-label="Dashboard sections">
            {groups.map(([label, ids]) => (
              <div className="db-group" key={label}>
                <p>{label}</p>

                {ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="db-item"
                    aria-current={tab === id ? "page" : undefined}
                    onClick={() => go(id)}
                  >
                    <span className="db-item-label">
                      <Icon name={id} size={16} />
                      {COPY[id][0]}
                    </span>

                    {id === "messages" && unread > 0 && <span className="db-badge">{unread}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="db-user">
            <Avatar user={user} />

            <div>
              <strong>{profile?.gamertag || user.username}</strong>
              <span>{admin ? "Moderator" : "Player"}</span>
            </div>
          </div>
        </aside>

        {menu && <div className="db-scrim" onClick={() => setMenu(false)} />}

        <div className="db-main">
          <header className="db-top">
            <button type="button" className="db-menu" aria-label="Open menu" onClick={() => setMenu(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <div className="db-search">
              <Icon name="search" />

              <input
                ref={searchRef}
                value={query}
                placeholder="Search sections..."
                aria-label="Search dashboard sections"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && matches[0]) go(matches[0]);
                  if (event.key === "Escape") {
                    setQuery("");
                    event.currentTarget.blur();
                  }
                }}
              />

              {!q && <kbd className="db-kbd">Ctrl K</kbd>}

              {q && (
                <div className="db-results">
                  {matches.length ? (
                    matches.map((id) => (
                      <button key={id} type="button" onClick={() => go(id)}>
                        {COPY[id][0]}
                        <small>{COPY[id][1]}</small>
                      </button>
                    ))
                  ) : (
                    <p>No sections match that.</p>
                  )}
                </div>
              )}
            </div>

            <div className="db-top-right">
              <a className="hub-button" href={HUB_URL}>
                Back to hub
              </a>
            </div>
          </header>

          <main className="db-content">
            <div className="db-head" key={`head-${tab}`}>
              <span>{groups.find(([, ids]) => ids.includes(tab))?.[0]}</span>

              <h1>{title}</h1>
              <p>{blurb}</p>
            </div>

            <div className="db-section fx-in" key={tab}>
              {tab === "overview" && <Overview session={session} setTab={go} prefs={prefs} />}

              {tab === "teams" && <TeamsTab games={games} session={session} />}

              {tab === "parties" && <PartiesTab games={games} meId={meId} />}

              {tab === "tournaments" && <TournamentsTab games={games} meId={meId} />}

              {tab === "posts" && <PostsTab games={games} meId={meId} />}

              {tab === "games" && (
                <GamesTab allGames={allGames} meId={meId} reloadGames={gameList.reload} />
              )}

              {tab === "follows" && <FollowsTab games={games} onChange={session.refresh} />}

              {tab === "messages" && <MessagesTab session={session} onChange={session.refresh} />}

              {tab === "predictions" && <PredictionsTab games={games} />}

              {tab === "profile" && <ProfileTab onSaved={session.refresh} />}

              {tab === "account" && <AccountTab session={session} setTab={go} />}

              {tab === "settings" && <SettingsTab prefs={prefs} setPrefs={setPrefs} tabs={allTabs} />}

              {tab === "reports" && admin && <ReportsTab />}
            </div>
          </main>
        </div>

        <div className="fx-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`fx-toast ${t.kind}`}>
              <Icon name={t.kind === "error" ? "info" : "check"} size={16} />
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}
