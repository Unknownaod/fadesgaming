"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_FADES_API || "https://api.fades.lol";

export const GAMING_API =
  process.env.NEXT_PUBLIC_GAMING_API || `${API_BASE}/gaming`;

export const SIGN_IN_URL =
  process.env.NEXT_PUBLIC_FADES_SIGNIN || "https://fades.lol";

/* =========================================================
   API
   Sends the Fades session cookie, so the API must answer
   with CORS credentials enabled for this origin.
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
    /* empty body */
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);

    error.status = response.status;

    throw error;
  }

  return data;
}

/* =========================================================
   HOOKS
   ========================================================= */

export function useSession() {
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

export function usePicks(signedIn) {
  const [picks, setPicks] = useState({});

  useEffect(() => {
    if (!signedIn) {
      setPicks({});

      return;
    }

    api("/predictions/me")
      .then((data) =>
        setPicks(
          Object.fromEntries(
            (data.predictions || []).map((p) => [String(p.matchId), p.teamId])
          )
        )
      )
      .catch(() => {});
  }, [signedIn]);

  const pick = useCallback(async (matchId, teamId) => {
    await api("/predictions", { method: "POST", body: { matchId, teamId } });
    setPicks((current) => ({ ...current, [String(matchId)]: teamId }));
  }, []);

  return { picks, pick };
}

function useApi(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: "" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // a null path means "don't fetch yet"
    if (!path) return undefined;

    let stopped = false;

    setState((current) => ({ ...current, loading: true }));

    api(path)
      .then((data) => !stopped && setState({ data, loading: false, error: "" }))
      .catch(
        (error) =>
          !stopped &&
          setState((current) => ({ ...current, loading: false, error: error.message }))
      );

    return () => {
      stopped = true;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { ...state, reload };
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

function useForm(initial) {
  const [values, setValues] = useState(initial);

  const bind = (key) => ({
    value: values[key],
    onChange: (event) => setValues((current) => ({ ...current, [key]: event.target.value })),
  });

  return [values, bind, setValues];
}

/* =========================================================
   SMALL PIECES
   ========================================================= */

const ago = (ms) => {
  if (!ms) return "";

  const minutes = Math.floor((Date.now() - ms) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;

  return `${Math.floor(minutes / 1440)}d ago`;
};

function ErrorLine({ error }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}

function EmptyLine({ title, body }) {
  return (
    <div className="systems-empty">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function GameSelect({ games, ...props }) {
  return (
    <select className="hub-input" {...props}>
      {games.map((g) => (
        <option key={g.id} value={g.id}>
          {g.label}
        </option>
      ))}
    </select>
  );
}

/* =========================================================
   PREDICTIONS (shown under upcoming match cards)
   ========================================================= */

export function PredictBar({ match, session, picks, onPick }) {
  const [error, setError] = useState("");
  const [a, b] = match.teams;

  if (!session.signedIn || match.status !== "upcoming" || !a.id || !b.id) {
    return null;
  }

  const picked = picks[match.id];

  const choose = async (team) => {
    setError("");

    try {
      await onPick(match.id, team.id);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="predict-bar">
      <span>Your pick</span>

      {[a, b].map((team) => (
        <button
          key={team.id}
          type="button"
          className={`predict-btn ${picked === team.id ? "on" : ""}`}
          aria-pressed={picked === team.id}
          onClick={() => choose(team)}
        >
          {team.name}
        </button>
      ))}

      {error && <small className="form-error">{error}</small>}
    </div>
  );
}

/* =========================================================
   LOOKING FOR GROUP
   ========================================================= */

function LfgPanel({ games, game, session }) {
  const path = `/lfg?status=open${game !== "all" ? `&game=${encodeURIComponent(game)}` : ""}`;
  const list = useApi(path);
  const { act, error, busy } = useAct(list.reload);
  const [open, setOpen] = useState(false);
  const [form, bind, setForm] = useForm({ game: "", title: "", platform: "", rank: "", playersNeeded: "4" });

  const me = session.me?.user?.id;
  const parties = list.data?.parties || [];

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/lfg", {
        method: "POST",
        body: {
          ...form,
          game: form.game || (game !== "all" ? game : games[0]?.id),
          playersNeeded: Number(form.playersNeeded) || 4,
        },
      });

      setForm((current) => ({ ...current, title: "" }));
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      {session.signedIn && (
        <div className="panel-actions">
          <button type="button" className="hub-button" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Find players"}
          </button>
        </div>
      )}

      {open && (
        <form className="form-card" onSubmit={create}>
          <GameSelect games={games} {...bind("game")} value={form.game || (game !== "all" ? game : games[0]?.id)} />
          <input className="hub-input" placeholder="What are you playing?" maxLength={80} required {...bind("title")} />
          <input className="hub-input" placeholder="Platform (PC, PS5...)" maxLength={20} {...bind("platform")} />
          <input className="hub-input" placeholder="Rank" maxLength={30} {...bind("rank")} />
          <input className="hub-input" type="number" min="1" max="99" placeholder="Players needed" {...bind("playersNeeded")} />
          <button type="submit" className="hub-button primary" disabled={busy}>
            Post party
          </button>
        </form>
      )}

      <ErrorLine error={error || list.error} />

      {list.loading && !list.data ? (
        <div className="skeleton-card" />
      ) : parties.length === 0 ? (
        <EmptyLine title="No open parties" body="Be the first to post one." />
      ) : (
        <div className="system-grid">
          {parties.map((p) => {
            const mine = p.joined.some((j) => j.userId === me);
            const author = p.authorId === me;
            const gameName = games.find((g) => g.id === p.game)?.label || p.game;

            return (
              <div className="system-card community-card" key={p.id}>
                <div className="match-top">
                  <span className="match-game">{gameName}</span>
                  <span className="status-pill">
                    {p.joined.length}/{p.playersNeeded}
                  </span>
                </div>

                <strong className="card-title">{p.title}</strong>

                <span className="card-sub">
                  {[p.platform, p.rank, p.region].filter(Boolean).join(" · ") || "Any platform"}
                </span>

                <div className="avatar-row">
                  {p.joined.slice(0, 6).map((j) => (
                    <span key={j.userId} className="avatar" title={j.username}>
                      {j.avatar ? <img src={j.avatar} alt="" /> : j.username.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </div>

                {session.signedIn && (
                  <div className="card-actions">
                    {author ? (
                      <button type="button" className="hub-button" disabled={busy} onClick={() => act(() => api(`/lfg/${p.id}/close`, { method: "POST" }))}>
                        Close party
                      </button>
                    ) : mine ? (
                      <button type="button" className="hub-button" disabled={busy} onClick={() => act(() => api(`/lfg/${p.id}/leave`, { method: "POST" }))}>
                        Leave
                      </button>
                    ) : (
                      <button type="button" className="hub-button primary" disabled={busy} onClick={() => act(() => api(`/lfg/${p.id}/join`, { method: "POST" }))}>
                        Join
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   TOURNAMENTS
   ========================================================= */

function Bracket({ id, isOwner, onChange }) {
  const detail = useApi(`/tournaments/${id}`);
  const { act, error, busy } = useAct(async () => {
    detail.reload();
    onChange?.();
  });
  const [scores, setScores] = useState({});

  const t = detail.data?.tournament;

  if (!t) return <ErrorLine error={detail.error} />;

  if (t.rounds.length === 0) {
    return (
      <div className="bracket-note">
        {t.entrants.length === 0 ? "No entrants yet." : `Entrants: ${t.entrants.map((e) => e.name).join(", ")}`}
      </div>
    );
  }

  const report = (m) =>
    act(() =>
      api(`/tournaments/${id}/matches/${m.id}/report`, {
        method: "POST",
        body: { scoreA: Number(scores[m.id]?.a), scoreB: Number(scores[m.id]?.b) },
      })
    );

  const setScore = (matchId, side, value) =>
    setScores((current) => ({ ...current, [matchId]: { ...current[matchId], [side]: value } }));

  return (
    <div className="bracket">
      {t.rounds.map((round, r) => (
        <div className="bracket-round" key={r}>
          <small>{r === t.rounds.length - 1 ? "Final" : `Round ${r + 1}`}</small>

          {round.map((m) => (
            <div className={`bracket-match ${m.status}`} key={m.id}>
              {[
                [m.a, m.scoreA, "a"],
                [m.b, m.scoreB, "b"],
              ].map(([side, score, key]) => (
                <div className={`bracket-side ${m.winner && side && m.winner === side.id ? "won" : ""}`} key={key}>
                  <span>{side?.name || (m.bye ? "Bye" : "TBD")}</span>
                  <b>{score ?? ""}</b>
                </div>
              ))}

              {isOwner && m.status === "ready" && (
                <div className="bracket-report">
                  <input className="hub-input" type="number" min="0" aria-label="Score A" onChange={(e) => setScore(m.id, "a", e.target.value)} />
                  <input className="hub-input" type="number" min="0" aria-label="Score B" onChange={(e) => setScore(m.id, "b", e.target.value)} />
                  <button type="button" className="hub-button" disabled={busy} onClick={() => report(m)}>
                    Save
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <ErrorLine error={error} />
    </div>
  );
}

function TournamentsPanel({ games, game, session }) {
  const path = `/tournaments${game !== "all" ? `?game=${encodeURIComponent(game)}` : ""}`;
  const list = useApi(path);
  const { act, error, busy } = useAct(list.reload);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, bind, setForm] = useForm({ name: "", game: "", mode: "solo", maxEntrants: "16" });

  const me = session.me?.user?.id;
  const myTeams = session.me?.teams || [];
  const tournaments = list.data?.tournaments || [];

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/tournaments", {
        method: "POST",
        body: {
          ...form,
          game: form.game || (game !== "all" ? game : games[0]?.id),
          maxEntrants: Number(form.maxEntrants) || 16,
        },
      });

      setForm((current) => ({ ...current, name: "" }));
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      {session.signedIn && (
        <div className="panel-actions">
          <button type="button" className="hub-button" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Host a tournament"}
          </button>
        </div>
      )}

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Tournament name" maxLength={80} required {...bind("name")} />
          <GameSelect games={games} {...bind("game")} value={form.game || (game !== "all" ? game : games[0]?.id)} />
          <select className="hub-input" {...bind("mode")}>
            <option value="solo">Solo</option>
            <option value="team">Teams</option>
          </select>
          <input className="hub-input" type="number" min="2" max="64" placeholder="Max entrants" {...bind("maxEntrants")} />
          <button type="submit" className="hub-button primary" disabled={busy}>
            Create
          </button>
        </form>
      )}

      <ErrorLine error={error || list.error} />

      {list.loading && !list.data ? (
        <div className="skeleton-card" />
      ) : tournaments.length === 0 ? (
        <EmptyLine title="No tournaments yet" body="Host one and let players sign up." />
      ) : (
        <div className="stack">
          {tournaments.map((t) => {
            const owner = t.ownerId === me;
            const eligibleTeams = myTeams.filter((team) => team.game === t.game && ["owner", "admin"].includes(team.myRole));
            const gameName = games.find((g) => g.id === t.game)?.label || t.game;

            return (
              <div className="system-card community-card" key={t.id}>
                <div className="match-top">
                  <span className="match-game">{gameName}</span>
                  <span className="status-pill">{t.status}</span>
                </div>

                <strong className="card-title">{t.name}</strong>

                <span className="card-sub">
                  {t.entrantCount}/{t.maxEntrants} entered · {t.mode === "team" ? "Teams" : "Solo"}
                  {t.winner ? ` · Winner: ${t.winner.name}` : ""}
                </span>

                <div className="card-actions">
                  {session.signedIn && t.status === "registration" && t.mode === "solo" && (
                    <button type="button" className="hub-button primary" disabled={busy} onClick={() => act(() => api(`/tournaments/${t.id}/join`, { method: "POST", body: {} }))}>
                      Join
                    </button>
                  )}

                  {session.signedIn &&
                    t.status === "registration" &&
                    t.mode === "team" &&
                    eligibleTeams.map((team) => (
                      <button key={team.id} type="button" className="hub-button primary" disabled={busy} onClick={() => act(() => api(`/tournaments/${t.id}/join`, { method: "POST", body: { teamId: team.id } }))}>
                        Join as {team.name}
                      </button>
                    ))}

                  {owner && t.status === "registration" && t.entrantCount >= 2 && (
                    <button type="button" className="hub-button" disabled={busy} onClick={() => act(() => api(`/tournaments/${t.id}/start`, { method: "POST" }))}>
                      Start
                    </button>
                  )}

                  {owner && (
                    <button type="button" className="hub-button" disabled={busy} onClick={() => act(() => api(`/tournaments/${t.id}`, { method: "DELETE" }))}>
                      Delete
                    </button>
                  )}

                  <button type="button" className="hub-button" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                    {expanded === t.id ? "Hide bracket" : "Bracket"}
                  </button>
                </div>

                {expanded === t.id && <Bracket id={t.id} isOwner={owner} onChange={list.reload} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   POSTS
   ========================================================= */

function PostCard({ post, games, session, onChange }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const detail = useApi(open ? `/posts/${post.id}` : null);
  const { act, error, busy } = useAct(async () => {
    onChange();
    if (open) detail.reload();
  });

  const gameName = games.find((g) => g.id === post.game)?.label || post.game;
  const comments = open ? detail.data?.comments || [] : [];

  const comment = (event) => {
    event.preventDefault();

    act(async () => {
      await api(`/posts/${post.id}/comments`, { method: "POST", body: { body } });
      setBody("");
    });
  };

  return (
    <div className="system-card community-card">
      <div className="match-top">
        <span className="match-game">{[gameName, post.authorName].filter(Boolean).join(" · ")}</span>
        <span className="status-pill">{ago(post.createdAt)}</span>
      </div>

      <strong className="card-title">{post.title}</strong>
      {post.body && <p className="card-body">{post.body}</p>}

      <div className="card-actions">
        <button
          type="button"
          className={`hub-button ${post.liked ? "primary" : ""}`}
          disabled={busy || !session.signedIn}
          onClick={() => act(() => api(`/posts/${post.id}/like`, { method: post.liked ? "DELETE" : "POST" }))}
        >
          {post.liked ? "Liked" : "Like"} · {post.likeCount}
        </button>

        <button type="button" className="hub-button" onClick={() => setOpen((v) => !v)}>
          Comments · {post.commentCount}
        </button>
      </div>

      {open && (
        <div className="comments">
          {comments.map((c) => (
            <p key={c.id}>
              <b>{c.authorName}</b> {c.body}
            </p>
          ))}

          {session.signedIn && (
            <form className="comment-form" onSubmit={comment}>
              <input className="hub-input" placeholder="Add a comment" maxLength={1500} required value={body} onChange={(e) => setBody(e.target.value)} />
              <button type="submit" className="hub-button" disabled={busy}>
                Send
              </button>
            </form>
          )}
        </div>
      )}

      <ErrorLine error={error} />
    </div>
  );
}

function PostsPanel({ games, game, session }) {
  const [sort, setSort] = useState("new");
  const path = `/posts?sort=${sort}${game !== "all" ? `&game=${encodeURIComponent(game)}` : ""}`;
  const list = useApi(path);
  const { act, error, busy } = useAct(list.reload);
  const [open, setOpen] = useState(false);
  const [form, bind, setForm] = useForm({ title: "", body: "", game: "" });

  const posts = list.data?.posts || [];

  const create = (event) => {
    event.preventDefault();

    act(async () => {
      await api("/posts", {
        method: "POST",
        body: { ...form, game: form.game || (game !== "all" ? game : "") },
      });

      setForm({ title: "", body: "", game: "" });
      setOpen(false);
    });
  };

  return (
    <div className="community-panel">
      <div className="panel-actions">
        <div className="hub-pills" role="group" aria-label="Sort posts">
          {["new", "top"].map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>
              {s === "new" ? "Newest" : "Top"}
            </button>
          ))}
        </div>

        {session.signedIn && (
          <button type="button" className="hub-button" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "New post"}
          </button>
        )}
      </div>

      {open && (
        <form className="form-card" onSubmit={create}>
          <input className="hub-input" placeholder="Title" maxLength={120} required {...bind("title")} />
          <select className="hub-input" {...bind("game")} value={form.game || (game !== "all" ? game : "")}>
            <option value="">No game</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <textarea className="hub-input wide" placeholder="Share a clip, a guide or a thought" maxLength={5000} rows={3} {...bind("body")} />
          <button type="submit" className="hub-button primary" disabled={busy}>
            Post
          </button>
        </form>
      )}

      <ErrorLine error={error || list.error} />

      {list.loading && !list.data ? (
        <div className="skeleton-card" />
      ) : posts.length === 0 ? (
        <EmptyLine title="No posts yet" body="Start the conversation." />
      ) : (
        <div className="stack">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} games={games} session={session} onChange={list.reload} />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   LEADERBOARD
   ========================================================= */

function LeaderboardPanel({ game }) {
  const list = useApi(`/leaderboard${game !== "all" ? `?game=${encodeURIComponent(game)}` : ""}`);
  const rows = list.data?.leaderboard || [];

  if (list.loading && !list.data) return <div className="skeleton-card" />;

  if (rows.length === 0) {
    return <EmptyLine title="No ranked predictions yet" body="Pick winners on upcoming matches to get on the board." />;
  }

  return (
    <div className="leaderboard">
      {rows.map((row, index) => (
        <div className="leader-row" key={row.userId}>
          <b>{index + 1}</b>

          <span className="avatar">{row.avatar ? <img src={row.avatar} alt="" /> : row.username.slice(0, 1).toUpperCase()}</span>

          <span className="leader-name">{row.username}</span>

          <span className="leader-stat">
            {row.wins}/{row.played} correct
          </span>

          <span className="status-pill">{row.accuracy}%</span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   COMMUNITY SECTION
   ========================================================= */

const TABS = [
  { id: "lfg", label: "Find players" },
  { id: "tournaments", label: "Tournaments" },
  { id: "posts", label: "Posts" },
  { id: "leaderboard", label: "Leaderboard" },
];

export function Community({ games: builtIn, session }) {
  const [tab, setTab] = useState("lfg");
  const [game, setGame] = useState("all");
  const gameList = useApi("/games");

  // built-in games first, then any community-created ones from the API
  const games = gameList.data?.games?.length
    ? gameList.data.games.map((g) => ({ id: g.id, label: g.label }))
    : builtIn.map((g) => ({ id: g.id, label: g.label }));

  return (
    <section className="systems-section hub-section" id="community">
      <div className="section-heading">
        <div className="section-heading-copy">
          <span>Community</span>
          <h2>Play together</h2>
          <p>Find a squad, enter a bracket, share clips and call the winners.</p>
        </div>

        {!session.loading && !session.signedIn && (
          <a className="hub-button primary" href={SIGN_IN_URL}>
            Sign in to take part
          </a>
        )}
      </div>

      <div className="hub-toolbar">
        <div className="hub-pills" role="group" aria-label="Community section">
          {TABS.map((item) => (
            <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="hub-pills scroll" role="group" aria-label="Game">
          <button type="button" aria-pressed={game === "all"} onClick={() => setGame("all")}>
            All games
          </button>

          {games.map((g) => (
            <button key={g.id} type="button" aria-pressed={game === g.id} onClick={() => setGame(g.id)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "lfg" && <LfgPanel games={games} game={game} session={session} />}
      {tab === "tournaments" && <TournamentsPanel games={games} game={game} session={session} />}
      {tab === "posts" && <PostsPanel games={games} game={game} session={session} />}
      {tab === "leaderboard" && <LeaderboardPanel game={game} />}
    </section>
  );
}
