"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { SocialHub } from "@/server/social-hub";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { communityAction } from "./social-interactions";
import { useRouter } from "next/navigation";
import { MakeCardOffer } from "./private-card-offers";
import { FantasySheet } from "./fantasy-player-sheet";
import type { AwardedCard } from "@/core/pack-opening";
import { boundedFetch } from "@/core/bounded-request";

export function useSocialHub(handle?: string) {
  const [data, setData] = useState<SocialHub | null>(null),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    boundedFetch(
      `/api/community?view=hub${handle ? `&handle=${encodeURIComponent(handle)}` : ""}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok)
          throw Error("Collection and community details could not be loaded.");
        const v = await r.json();
        if (!controller.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [handle, attempt]);
  return { data, error, reload: () => setAttempt((value) => value + 1) };
}
export function ProfileCollection({ handle }: { handle?: string }) {
  const { data, error, reload } = useSocialHub(handle);
  return (
    <section className="social-collection">
      {error ? (
        <p role="alert">
          {error} <button onClick={reload}>Retry</button>
        </p>
      ) : data ? (
        <Collection data={data} />
      ) : (
        <p role="status">Loading collection…</p>
      )}
    </section>
  );
}
function Collection({ data }: { data: SocialHub }) {
  const [inspected, setInspected] = useState<AwardedCard | null>(null),
    [sort, setSort] = useState("name"),
    [offerOnly, setOfferOnly] = useState(false);
  const [search, setSearch] = useState(""),
    [rarity, setRarity] = useState(""),
    [team, setTeam] = useState(""),
    [position, setPosition] = useState(""),
    [sport, setSport] = useState(""),
    [page, setPage] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const [settings, setSettings] = useState(data.settings);
  const savedCards = useRef(data.settings?.cards ?? {});
  const filtered = data.cards
    .filter(
      ({ card: c, offers }) =>
        (!offerOnly || offers) &&
        (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
        (!rarity || c.tier === rarity) &&
        (!team || c.team === team) &&
        (!position || c.position === position) &&
        (!sport || c.sport === sport),
    )
    .sort((a, b) =>
      sort === "serial"
        ? a.card.serial - b.card.serial
        : a.card.name.localeCompare(b.card.name),
    );
  const pageCount = Math.ceil(filtered.length / 12),
    safePage = Math.min(page, Math.max(0, pageCount - 1));
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings || busy) return;
    setBusy(true);
    try {
      const changes = Object.fromEntries(
        Object.entries(settings.cards).filter(
          ([id, pref]) =>
            JSON.stringify(pref) !== JSON.stringify(savedCards.current[id]),
        ),
      );
      if (Object.keys(changes).length > 100)
        throw Error("Save up to 100 changed card preferences at a time.");
      await communityAction({
        action: "collection_preferences",
        ...settings,
        cards: changes,
      });
      savedCards.current = settings.cards;
      setMessage("Collection preferences saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save not confirmed");
    } finally {
      setBusy(false);
    }
  }
  function bulk(enabled: boolean) {
    if (!settings) return;
    setSettings({
      ...settings,
      cards: {
        ...settings.cards,
        ...Object.fromEntries(
          selected.map((id) => [
            id,
            {
              enabled,
              minimum: settings.cards[id]?.minimum ?? null,
              asking: settings.cards[id]?.asking ?? null,
            },
          ]),
        ),
      },
    });
  }
  return (
    <>
      <div className="section-row">
        <h2>Collection {data.visible && <small>{data.cards.length}</small>}</h2>
        <span>
          {data.visibility === "members"
            ? "Admitted members"
            : data.visibility === "followers"
              ? "Followers"
              : "Private"}
        </span>
      </div>
      {data.own && settings && (
        <details className="social-settings">
          <summary>Collection privacy & offers</summary>
          <form className="app-form" onSubmit={save}>
            <div className="form-split">
              <label>
                Who can see my collection
                <select
                  value={settings.visibility}
                  onChange={(e) =>
                    setSettings({ ...settings, visibility: e.target.value })
                  }
                >
                  <option value="private">Only me</option>
                  <option value="followers">My followers</option>
                  <option value="members">Admitted members</option>
                </select>
              </label>
              <label>
                Who can make offers
                <select
                  value={settings.offers}
                  onChange={(e) =>
                    setSettings({ ...settings, offers: e.target.value })
                  }
                >
                  <option value="nobody">Nobody</option>
                  <option value="followers">My followers</option>
                  <option value="everyone">Admitted members</option>
                </select>
              </label>
            </div>
            <label>
              Private minimum offer (whole test credits)
              <input
                type="number"
                min={1}
                max={1000000000}
                value={settings.minimum ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minimum: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <p className="form-help">
              Visibility does not enable trading. Private-offer settlement is
              not activated. Minimum amounts are visible only to you.
            </p>
            {!!selected.length && (
              <div className="actions">
                <span>{selected.length} selected</span>
                <button type="button" onClick={() => bulk(true)}>
                  Accept offers for selected
                </button>
                <button type="button" onClick={() => bulk(false)}>
                  Disable selected
                </button>
              </div>
            )}
            <button className="button" disabled={busy}>
              Save preferences
            </button>
            <p role="status">{message}</p>
          </form>
        </details>
      )}
      {!data.visible ? (
        <p>This member’s collection is private.</p>
      ) : (
        <>
          <div className="social-filterbar">
            <label>
              Search players
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
          <details className="social-advanced-filters">
            <summary>
              Filters & sort
              {sport || team || position || rarity || offerOnly
                ? " · active"
                : ""}
            </summary>
            <div className="social-filter-fields">
              {[
                {
                  label: "Sport",
                  value: sport,
                  set: setSport,
                  values: data.cards.map((x) => x.card.sport),
                },
                {
                  label: "Team",
                  value: team,
                  set: setTeam,
                  values: data.cards.map((x) => x.card.team),
                },
                {
                  label: "Position",
                  value: position,
                  set: setPosition,
                  values: data.cards.map((x) => x.card.position),
                },
                {
                  label: "Rarity",
                  value: rarity,
                  set: setRarity,
                  values: data.cards.map((x) => x.card.tier),
                },
              ].map((f) => (
                <label key={f.label}>
                  {f.label}
                  <select
                    value={f.value}
                    onChange={(e) => {
                      f.set(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">All</option>
                    {[...new Set(f.values)].sort().map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="actions">
              <label>
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="name">Player name</option>
                  <option value="serial">Serial number</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={offerOnly}
                  onChange={(e) => setOfferOnly(e.target.checked)}
                />
                Available for offers
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                setSport("");
                setTeam("");
                setPosition("");
                setRarity("");
                setOfferOnly(false);
                setSort("name");
                setPage(0);
              }}
            >
              Reset filters
            </button>
          </details>
          {!filtered.length && (
            <p>
              {data.cards.length
                ? "No cards match these filters."
                : "No opened cards to show yet."}
            </p>
          )}
          <div className="social-card-grid">
            {filtered
              .slice(safePage * 12, safePage * 12 + 12)
              .map(({ card, asking, offers }) => (
                <article key={card.id}>
                  <FantasyCardArtwork
                    card={card}
                    faceOnly
                    onInspect={() => setInspected(card)}
                  />
                  <div className="social-card-meta">
                    <span>
                      {card.tier === "CORE"
                        ? "Unlimited Core"
                        : `#${card.serial.toLocaleString()} / ${card.max_supply.toLocaleString()}`}
                    </span>
                    <button onClick={() => setInspected(card)}>
                      View card →
                    </button>
                  </div>
                  {offers && asking !== null && (
                    <small>
                      Asking {Number(asking).toLocaleString()} test credits
                    </small>
                  )}
                  {!data.own && offers && (
                    <MakeCardOffer
                      card={card.id}
                      member={data.viewer}
                      enabled={data.offersLive}
                    />
                  )}
                  {data.own && settings && card.tier !== "CORE" && (
                    <details>
                      <summary>Offer settings</summary>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={selected.includes(card.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, card.id]
                                : selected.filter((id) => id !== card.id),
                            )
                          }
                        />
                        Select for bulk settings
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={settings.cards[card.id]?.enabled ?? false}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              cards: {
                                ...settings.cards,
                                [card.id]: {
                                  ...(settings.cards[card.id] ?? {
                                    minimum: null,
                                    asking: null,
                                    enabled: false,
                                  }),
                                  enabled: e.target.checked,
                                },
                              },
                            })
                          }
                        />
                        Accept offers
                      </label>
                      {(["minimum", "asking"] as const).map((key) => (
                        <label key={key}>
                          {key === "minimum"
                            ? "Private minimum"
                            : "Public asking price"}
                          <input
                            type="number"
                            min={1}
                            max={1000000000}
                            value={settings.cards[card.id]?.[key] ?? ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                cards: {
                                  ...settings.cards,
                                  [card.id]: {
                                    ...(settings.cards[card.id] ?? {
                                      enabled: false,
                                      minimum: null,
                                      asking: null,
                                    }),
                                    [key]: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </details>
                  )}
                </article>
              ))}
          </div>
          {pageCount > 1 && (
            <nav className="actions" aria-label="Collection pages">
              <button
                disabled={!safePage}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </button>
              <span>
                {safePage + 1} / {pageCount}
              </span>
              <button
                disabled={safePage + 1 >= pageCount}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
      {inspected && (
        <FantasySheet title={inspected.name} onClose={() => setInspected(null)}>
          <div className="social-offer-card">
            <FantasyCardArtwork card={inspected} />
          </div>
          <p>
            Current team: {inspected.team} · {inspected.status}
          </p>
          <p>Card reference: {inspected.id}</p>
          <Link
            href={`/fantasy/social?player=${encodeURIComponent(inspected.player_id)}`}
          >
            Discuss this player →
          </Link>
          {data.own && (
            <Link
              href={`/fantasy/cards?card=${encodeURIComponent(inspected.id)}`}
            >
              Manage your card →
            </Link>
          )}
        </FantasySheet>
      )}
    </>
  );
}
export function CommunityDirectory() {
  const { data, error } = useSocialHub();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function act(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await communityAction(body);
      setMessage("Saved. Refreshing communities…");
      router.refresh();
      location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Not confirmed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="social-communities">
      <h2>Communities</h2>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading communities…</p>}
      {data?.communities.length === 0 && (
        <p>No communities have been created yet.</p>
      )}
      {data?.communities.map((c) => (
        <article className="app-panel" key={String(c.id)}>
          <h3>
            <Link href={`/fantasy/social?community=${c.id}`}>
              {String(c.name)}
            </Link>
          </h3>
          <p>{String(c.description)}</p>
          <small>{Number(c.members)} members</small>
          <details>
            <summary>Community rules</summary>
            <p>{String(c.rules)}</p>
          </details>
          <button
            className="button ghost"
            disabled={busy}
            onClick={() =>
              act({
                action: "community_join",
                community: c.id,
                enabled: !c.joined,
              })
            }
          >
            {c.joined ? "Leave" : "Join"}
          </button>
          {data.canManage && (
            <details>
              <summary>Manage community</summary>
              <form
                className="app-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = new FormData(e.currentTarget);
                  void act({
                    action: "community_manage",
                    id: c.id,
                    name: values.get("name"),
                    description: values.get("description"),
                    rules: values.get("rules"),
                    sport: c.sport,
                    status: "active",
                  });
                }}
              >
                <label>
                  Name
                  <input
                    name="name"
                    defaultValue={String(c.name)}
                    required
                    minLength={3}
                    maxLength={80}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    defaultValue={String(c.description)}
                    maxLength={500}
                  />
                </label>
                <label>
                  Rules
                  <textarea
                    name="rules"
                    defaultValue={String(c.rules)}
                    required
                    minLength={10}
                    maxLength={4000}
                  />
                </label>
                <button disabled={busy}>Save community</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Close this community? Its posts will be retained but hidden from members.",
                      )
                    )
                      void act({
                        action: "community_manage",
                        id: c.id,
                        name: c.name,
                        description: c.description,
                        rules: c.rules,
                        sport: c.sport,
                        status: "closed",
                      });
                  }}
                >
                  Close community
                </button>
              </form>
            </details>
          )}
        </article>
      ))}
      {data?.canManage && (
        <details>
          <summary>Create community · owner/admin</summary>
          <form
            className="app-form"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void act({
                action: "community_manage",
                id: crypto.randomUUID(),
                name: d.get("name"),
                description: d.get("description"),
                rules: d.get("rules"),
                sport: d.get("sport") || null,
                status: "active",
              });
            }}
          >
            <label>
              Name
              <input name="name" required minLength={3} maxLength={80} />
            </label>
            <label>
              Description
              <textarea name="description" maxLength={500} />
            </label>
            <label>
              Rules
              <textarea name="rules" required minLength={10} maxLength={4000} />
            </label>
            <label>
              Sport
              <select name="sport">
                <option value="">All sports</option>
                <option value="nfl">NFL</option>
                <option value="football">Football</option>
              </select>
            </label>
            <button className="button" disabled={busy}>
              Create community
            </button>
          </form>
        </details>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
