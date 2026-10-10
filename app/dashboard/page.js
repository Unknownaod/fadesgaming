"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_FADES_API || "https://api.fades.lol";
const GAMING_API = process.env.NEXT_PUBLIC_GAMING_API || `${API_BASE}/gaming`;
const SIGN_IN_URL = process.env.NEXT_PUBLIC_FADES_SIGNIN || "https://fades.lol";

/* =========================================================
   API + SHARED HOOKS (same credentialed fetch as GamingHub)
   ========================================================= */

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${GAMING_API}${path}`, {
    method,
    credentials: "include",
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* empty body */
  }

  if (!response.ok) throw Object.assign(new Error(data?.error || `Request failed (${response.status})`), { status: response.status });

  return data;
}

function useApi(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: "" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    let stopped = false;

    api(path)
      .then((data) => !stopped && setState({ data, loading: false, error: "" }))
      .catch((e) => !stopped && setState((c) => ({ ...c, loading: false, error: e.message })));

    return () => {
      stopped = true;
    };
  }, [path, nonce]);

  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) };
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
      } catch (e) {
        setError(e.message);
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
  const bind = (key) => ({ value: values[key], onChange: (e) => setValues((c) => ({ ...c, [key]: e.target.value })) });
  return [values, bind, () => setValues(initial)];
}

/* =========================================================
   SMALL PIECES
   ========================================================= */

const csv = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

const ago = (ms) => {
  if (!ms) return "";
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

const Err = ({ e }) => (e ? <p className="form-error" role="alert">{e}</p> : null);

const Btn = ({ primary, ...props }) => <button type="button" className={`hub-button ${primary ? "primary" : ""}`} {...props} />;

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
      {pill != null && pill !== "" && <span className="status-pill">{pill}</span>}
    </div>
    <strong className="card-title">{title}</strong>
    {sub && <span className="card-sub">{sub}</span>}
    {children && <div className="card-actions">{children}</div>}
    {extra}
  </div>
);

const GameSel = ({ games, value, ...props }) => (
  <select className="hub-input" value={value || games[0]?.id || ""} {...props}>
    {games.map((g) => (
      <option key={g.id} value={g.id}>{g.label}</option>
    ))}
  </select>
);

function Loading({ list }) {
  return list.loading && !list.data ? <div className="skeleton-card" /> : <Err e={list.error} />;
}

/* =========================================================
   OVERVIEW
   ========================================================= */

function Overview({ session, setTab }) {
  const stats = useApi("/stats");
  const { me } = session;
  const s = stats.data || {};

  const cards = [
    ["Your teams", me.teams.length, "teams"],
    ["Following", me.follows, "follows"],
    ["Unread messages", me.unread, "messages"],
    ["Open parties (all)", s.openLfg ?? "-", "parties"],
    ["Players on the hub", s.players ?? "-", "profile"],
    ["Tournaments (all)", s.tournaments ?? "-", "tournaments"],
  ];

  return (
    <div className="system-grid">
      {cards.map(([label, value, tab]) => (
        <Card key={label} top={label} title={String(value)}>
          <Btn onClick={() => setTab(tab)}>Open</Btn>
        </Card>
      ))}
    </div>
  );
}

/* =========================================================
   PROFILE
   ========================================================= */

const LINK_KEYS = ["steam", "discord", "twitch", "youtube", "twitter", "riot", "battlenet", "xbox", "psn", "epic"];

function ProfileTab() {
  const d = useApi("/profiles/me");
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(false);
  const { act, error, busy } = useAct();

  useEffect(() => {
    const p = d.data?.profile;
    if (p) {
      setF({
        gamertag: p.gamertag,
        bio: p.bio,
        country: p.country,
        platforms: p.platforms.join(", "),
        favoriteGames: p.favoriteGames.join(", "),
        links: { ...p.links },
      });
    }
  }, [d.data]);

  if (!f) return <Loading list={d} />;

  const set = (k) => (e) => {
    setSaved(false);
    setF((c) => ({ ...c, [k]: e.target.value }));
  };

  const save = (event) => {
    event.preventDefault();
    act(async () => {
      await api("/profiles/me", { method: "PUT", body: { ...f, platforms: csv(f.platforms), favoriteGames: csv(f.favoriteGames) } });
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

      {LINK_KEYS.map((k) => (
        <input
          key={k}
          className="hub-input"
          placeholder={k}
          maxLength={64}
          value={f.links[k] || ""}
          onChange={(e) => setF((c) => ({ ...c, links: { ...c.links, [k]: e.target.value } }))}
        />
      ))}

      <button type="submit" className="hub-button primary" disabled={busy}>Save profile</button>
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
  const call = (path, method, body) => act(() => api(`/teams/${id}${path}`, { method, body }));

  return (
    <div className="comments">
      <Err e={error} />

      {t.members.map((m) => (
        <p key={m.userId}>
          <b>{m.username}</b> {m.role}{" "}
          {owner && m.role !== "owner" && (
            <>
              <Btn disabled={busy} onClick={() => call(`/members/${m.userId}`, "PATCH", { role: m.role === "admin" ? "member" : "admin" })}>
                {m.role === "admin" ? "Demote" : "Make admin"}
              </Btn>
              <Btn disabled={busy} onClick={() => call(`/members/${m.userId}`, "PATCH", { role: "owner" })}>Make owner</Btn>
            </>
          )}
          {m.role !== "owner" && m.userId !== meId && (owner || (staff && m.role === "member")) && (
            <Btn disabled={busy} onClick={() => call(`/members/${m.userId}`, "DELETE")}>Remove</Btn>
          )}
        </p>
      ))}

      {(t.requests || []).map((r) => (
        <p key={r.userId}>
          <b>{r.username}</b> wants to join {r.message && `- ${r.message}`}{" "}
          <Btn primary disabled={busy} onClick={() => call(`/requests/${r.userId}/approve`, "POST")}>Approve</Btn>
          <Btn disabled={busy} onClick={() => call(`/requests/${r.userId}`, "DELETE")}>Decline</Btn>
        </p>
      ))}

      <div className="card-actions">
        {staff && (
          <Btn disabled={busy} onClick={() => call("", "PATCH", { open: !t.open })}>
            {t.open ? "Switch to invite only" : "Switch to open"}
          </Btn>
        )}
        {owner ? (
          <Btn disabled={busy} onClick={() => confirm("Delete this team?") && call("", "DELETE")}>Delete team</Btn>
        ) : (
          <Btn disabled={busy} onClick={() => call("/leave", "POST")}>Leave team</Btn>
        )}
      </div>
    </div>
  );
}

function TeamsTab({ games, session }) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(null);
  const [f, bind, reset] = useFields({ name: "", tag: "", game: "", region: "", description: "" });
  const { act, error, busy } = useAct(session.refresh);

  const create = (event) => {
    event.preventDefault();
    act(async () => {
      await api("/teams", { method: "POST", body: { ...f, game: f.game || games[0]?.id } });
      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Create a team"}</Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Team name" maxLength={40} required {...bind("name")} />
          <input className="hub-input" placeholder="Tag (2-5)" maxLength={5} required {...bind("tag")} />
          <GameSel games={games} {...bind("game")} value={f.game} />
          <input className="hub-input" placeholder="Region" maxLength={30} {...bind("region")} />
          <textarea className="hub-input wide" placeholder="Description" maxLength={500} rows={2} {...bind("description")} />
          <button type="submit" className="hub-button primary" disabled={busy}>Create team</button>
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
              extra={managing === t.id && <TeamManage id={t.id} meId={session.me.user.id} onChange={session.refresh} />}
            >
              <Btn onClick={() => setManaging(managing === t.id ? null : t.id)}>{managing === t.id ? "Close" : "Manage"}</Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   PARTIES (looking for group)
   ========================================================= */

function PartiesTab({ games, meId }) {
  const list = useApi("/lfg?status=all&limit=100");
  const { act, error, busy } = useAct(list.reload);
  const mine = (list.data?.parties || []).filter((p) => p.authorId === meId || p.joined.some((j) => j.userId === meId));

  return (
    <div className="community-panel">
      <Err e={error} />
      <Loading list={list} />

      {list.data && mine.length === 0 && <Empty title="No parties" body="Post one from the Community section." />}

      <div className="system-grid">
        {mine.map((p) => {
          const author = p.authorId === meId;
          const live = ["open", "full"].includes(p.status);

          return (
            <Card
              key={p.id}
              top={games.find((g) => g.id === p.game)?.label || p.game}
              pill={`${p.status} · ${p.joined.length}/${p.playersNeeded}`}
              title={p.title}
              sub={[p.platform, p.rank, p.region].filter(Boolean).join(" · ")}
            >
              {author && live && <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${p.id}/close`, { method: "POST" }))}>Close</Btn>}
              {author && <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${p.id}`, { method: "DELETE" }))}>Delete</Btn>}
              {!author && live && <Btn disabled={busy} onClick={() => act(() => api(`/lfg/${p.id}/leave`, { method: "POST" }))}>Leave</Btn>}
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

  const ready = t.rounds.flat().filter((m) => m.status === "ready");
  const set = (mid, side, value) => setScores((c) => ({ ...c, [mid]: { ...c[mid], [side]: value } }));

  return (
    <div className="comments">
      <Err e={error} />
      {t.status === "registration" && <p>Entrants: {t.entrants.map((e) => e.name).join(", ") || "none yet"}</p>}
      {t.status !== "registration" && ready.length === 0 && <p>{t.winner ? `Winner: ${t.winner.name}` : "No matches waiting for a result."}</p>}

      {ready.map((m) => (
        <div className="bracket-report" key={m.id}>
          <span>{m.a.name} vs {m.b.name}</span>
          <input className="hub-input" type="number" min="0" aria-label={`${m.a.name} score`} onChange={(e) => set(m.id, "a", e.target.value)} />
          <input className="hub-input" type="number" min="0" aria-label={`${m.b.name} score`} onChange={(e) => set(m.id, "b", e.target.value)} />
          <Btn
            disabled={busy}
            onClick={() =>
              act(() =>
                api(`/tournaments/${id}/matches/${m.id}/report`, {
                  method: "POST",
                  body: { scoreA: Number(scores[m.id]?.a), scoreB: Number(scores[m.id]?.b) },
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
  const [f, bind, reset] = useFields({ name: "", game: "", mode: "solo", maxEntrants: "16", prize: "" });

  const mine = (list.data?.tournaments || []).filter((t) => t.ownerId === meId);

  const create = (event) => {
    event.preventDefault();
    act(async () => {
      await api("/tournaments", { method: "POST", body: { ...f, game: f.game || games[0]?.id, maxEntrants: Number(f.maxEntrants) || 16 } });
      reset();
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <Btn onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Host a tournament"}</Btn>
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
          <button type="submit" className="hub-button primary" disabled={busy}>Create</button>
        </form>
      )}

      <Err e={error} />
      <Loading list={list} />

      {list.data && mine.length === 0 && <Empty title="No tournaments hosted" body="Host one and let players sign up." />}

      <div className="stack">
        {mine.map((t) => (
          <Card
            key={t.id}
            top={games.find((g) => g.id === t.game)?.label || t.game}
            pill={t.status}
            title={t.name}
            sub={`${t.entrantCount}/${t.maxEntrants} entered · ${t.mode === "team" ? "Teams" : "Solo"}${t.winner ? ` · Winner: ${t.winner.name}` : ""}`}
            extra={managing === t.id && <ReportMatches id={t.id} onChange={list.reload} />}
          >
            {t.status === "registration" && t.entrantCount >= 2 && (
              <Btn primary disabled={busy} onClick={() => act(() => api(`/tournaments/${t.id}/start`, { method: "POST" }))}>Start</Btn>
            )}
            <Btn onClick={() => setManaging(managing === t.id ? null : t.id)}>{managing === t.id ? "Close" : "Entrants and results"}</Btn>
            <Btn disabled={busy} onClick={() => confirm("Delete this tournament?") && act(() => api(`/tournaments/${t.id}`, { method: "DELETE" }))}>Delete</Btn>
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
        <Btn onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "New post"}</Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Title" maxLength={120} required {...bind("title")} />
          <select className="hub-input" {...bind("game")}>
            <option value="">No game</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
          <textarea className="hub-input wide" placeholder="Share a clip, a guide or a thought" maxLength={5000} rows={3} {...bind("body")} />
          <button type="submit" className="hub-button primary" disabled={busy}>Post</button>
        </form>
      )}

      <Err e={error} />
      <Loading list={list} />

      {list.data && posts.length === 0 && <Empty title="No posts yet" body="Your posts will show up here." />}

      <div className="stack">
        {posts.map((p) => (
          <Card
            key={p.id}
            top={games.find((g) => g.id === p.game)?.label || p.game || "General"}
            pill={ago(p.createdAt)}
            title={p.title}
            sub={`${p.likeCount} likes · ${p.commentCount} comments`}
          >
            <Btn disabled={busy} onClick={() => confirm("Delete this post?") && act(() => api(`/posts/${p.id}`, { method: "DELETE" }))}>Delete</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   GAMES (community-created)
   ========================================================= */

function GamesTab({ allGames, meId, reloadGames }) {
  const { act, error, busy } = useAct(reloadGames);
  const [open, setOpen] = useState(false);
  const [f, bind, reset] = useFields({ label: "", genre: "", description: "" });
  const mine = allGames.filter((g) => g.custom && g.ownerId === meId);

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
        <Btn onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Add a game"}</Btn>
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Game name" maxLength={60} required {...bind("label")} />
          <input className="hub-input" placeholder="Genre" maxLength={40} {...bind("genre")} />
          <textarea className="hub-input wide" placeholder="Description" maxLength={500} rows={2} {...bind("description")} />
          <button type="submit" className="hub-button primary" disabled={busy}>Add game</button>
        </form>
      )}

      <Err e={error} />

      {mine.length === 0 ? (
        <Empty title="No community games" body="Add a game so players can find squads for it." />
      ) : (
        <div className="system-grid">
          {mine.map((g) => (
            <Card key={g.id} top={g.genre || "Game"} title={g.label} sub={g.description}>
              <Btn disabled={busy} onClick={() => confirm(`Delete ${g.label}?`) && act(() => api(`/games/${g.id}`, { method: "DELETE" }))}>Delete</Btn>
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
      await api("/follows", { method: "POST", body: { kind: f.kind, targetId: (f.kind === "game" ? f.targetId || games[0]?.id : f.targetId).trim() } });
      reset();
    });
  };

  return (
    <div className="community-panel">
      <form className="form-card" onSubmit={follow}>
        <select className="hub-input" {...bind("kind")}>
          <option value="game">Game</option>
          <option value="team">Team id</option>
          <option value="user">Player id</option>
        </select>
        {f.kind === "game" ? (
          <GameSel games={games} value={f.targetId} onChange={(e) => bind("targetId").onChange(e)} />
        ) : (
          <input className="hub-input" placeholder="ID" required {...bind("targetId")} />
        )}
        <button type="submit" className="hub-button primary" disabled={busy}>Follow</button>
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
                <button key={id} type="button" disabled={busy} title="Unfollow" onClick={() => act(() => api(`/follows/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" }))}>
                  {kind === "game" ? games.find((g) => g.id === id)?.label || id : id} ×
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
   MESSAGES
   ========================================================= */

function MessagesTab({ meId, onChange }) {
  const list = useApi("/channels");
  const { act, error, busy } = useAct(async () => {
    list.reload();
    onChange();
  });
  const [f, bind, reset] = useFields({ type: "dm", userId: "", name: "", members: "" });

  const channels = list.data?.channels || [];

  const start = (event) => {
    event.preventDefault();
    act(async () => {
      await api("/channels", {
        method: "POST",
        body: f.type === "dm" ? { type: "dm", userId: f.userId.trim() } : { type: "group", name: f.name, members: csv(f.members) },
      });
      reset();
    });
  };

  return (
    <div className="community-panel">
      <form className="form-card" onSubmit={start}>
        <select className="hub-input" {...bind("type")}>
          <option value="dm">Direct message</option>
          <option value="group">Group chat</option>
        </select>
        {f.type === "dm" ? (
          <input className="hub-input" placeholder="Player id" required {...bind("userId")} />
        ) : (
          <>
            <input className="hub-input" placeholder="Group name" maxLength={50} required {...bind("name")} />
            <input className="hub-input" placeholder="Player ids, comma separated" required {...bind("members")} />
          </>
        )}
        <button type="submit" className="hub-button primary" disabled={busy}>Start chat</button>
      </form>

      <Err e={error} />
      <Loading list={list} />

      {list.data && channels.length === 0 && <Empty title="No conversations" body="Start a chat above, or join a team." />}

      <div className="system-grid">
        {channels.map((c) => (
          <Card
            key={c.id}
            top={c.type}
            pill={c.unread ? `${c.unread} unread` : ""}
            title={c.name}
            sub={c.lastMessage ? `${c.lastMessage.authorName}: ${c.lastMessage.content || "(attachment)"}` : "No messages yet"}
          >
            {c.unread > 0 && <Btn disabled={busy} onClick={() => act(() => api(`/channels/${encodeURIComponent(c.id)}/read`, { method: "POST" }))}>Mark read</Btn>}
            {c.type === "group" && <Btn disabled={busy} onClick={() => act(() => api(`/channels/${encodeURIComponent(c.id)}/members/${meId}`, { method: "DELETE" }))}>Leave</Btn>}
          </Card>
        ))}
      </div>
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
      {list.data && rows.length === 0 && <Empty title="No predictions yet" body="Pick winners on upcoming matches in the hub." />}

      <div className="system-grid">
        {rows.map((p) => (
          <Card
            key={p.id}
            top={games.find((g) => g.id === p.game)?.label || p.game}
            pill={p.status}
            title={`Match ${p.matchId}`}
            sub={`Picked team ${p.teamId} · ${ago(p.at)}`}
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
        {reports.map((r) => (
          <Card key={r.id} top={r.kind} pill={ago(r.createdAt)} title={r.reason} sub={`Target ${r.targetId} · reported by ${r.reporterId}`}>
            <Btn primary disabled={busy} onClick={() => act(() => api(`/admin/reports/${r.id}/resolve`, { method: "POST" }))}>Resolve</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function DashboardPage() {
  const session = useSession();
  const [tab, setTab] = useState("overview");
  const gameList = useApi("/games");

  const allGames = gameList.data?.games || [];
  const games = allGames.map((g) => ({ id: g.id, label: g.label }));

  if (session.loading) {
    return (
      <main className="systems-section hub-section">
        <div className="skeleton-card" />
      </main>
    );
  }

  if (!session.signedIn) {
    return (
      <main className="systems-section hub-section">
        <Empty title="Sign in to see your dashboard" body="Your teams, parties, tournaments and posts live here." />
        <a className="hub-button primary" href={SIGN_IN_URL}>Sign in</a>
      </main>
    );
  }

  const meId = session.me.user.id;

  const tabs = [
    ["overview", "Overview"],
    ["profile", "Profile"],
    ["teams", "Teams"],
    ["parties", "Parties"],
    ["tournaments", "Tournaments"],
    ["posts", "Posts"],
    ["games", "Games"],
    ["follows", "Following"],
    ["messages", "Messages"],
    ["predictions", "Predictions"],
    ...(session.me.admin ? [["reports", "Reports"]] : []),
  ];

  return (
    <main className="systems-section hub-section" id="dashboard">
      <div className="section-heading">
        <div className="section-heading-copy">
          <h2>Your dashboard</h2>
          <p>Manage your profile, squads, tournaments and posts in one place.</p>
        </div>
      </div>

      <div className="hub-toolbar">
        <div className="hub-pills scroll" role="group" aria-label="Dashboard sections">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <Overview session={session} setTab={setTab} />}
      {tab === "profile" && <ProfileTab />}
      {tab === "teams" && <TeamsTab games={games} session={session} />}
      {tab === "parties" && <PartiesTab games={games} meId={meId} />}
      {tab === "tournaments" && <TournamentsTab games={games} meId={meId} />}
      {tab === "posts" && <PostsTab games={games} meId={meId} />}
      {tab === "games" && <GamesTab allGames={allGames} meId={meId} reloadGames={gameList.reload} />}
      {tab === "follows" && <FollowsTab games={games} onChange={session.refresh} />}
      {tab === "messages" && <MessagesTab meId={meId} onChange={session.refresh} />}
      {tab === "predictions" && <PredictionsTab games={games} />}
      {tab === "reports" && session.me.admin && <ReportsTab />}
    </main>
  );
}
