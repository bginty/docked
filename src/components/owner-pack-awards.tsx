"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AdminSearchResponse } from "@/core/admin-navigation";
import { boundedFetch } from "@/core/bounded-request";
import {
  maximumOwnerAwardPacks,
  ownerPackAwardCommand,
  type OwnerPackAwardCommand,
  type OwnerPackAwardProduct,
  type OwnerPackAwardReceipt,
  type OwnerPackAwardView,
} from "@/core/owner-pack-awards";
import styles from "./owner-pack-awards.module.css";

export type AwardRecipient = { id: string; title: string; detail: string };
type BasketLine = { product: OwnerPackAwardProduct; quantity: number };
type Review = {
  lastRequest: string | null;
  recipient: AwardRecipient;
  reason: OwnerPackAwardCommand["reason"];
  reference: string;
  lines: OwnerPackAwardCommand["lines"];
};
type Pending = {
  version: 1;
  owner: string;
  recipient: AwardRecipient;
  command: OwnerPackAwardCommand;
};
type AwardSlot = { pending: Pending | null; lastRequest: string | null };
/** IndexedDB serializes conflicting read/write transactions across renderer processes.
 * localStorage is a notification and recovery mirror; a second tab can briefly
 * see an older localStorage value even after a Web Lock changes hands. */
async function awardSlot(
  key: string,
  owner: string,
  update?: (current: AwardSlot) => AwardSlot,
): Promise<AwardSlot> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("docked-owner-pack-awards", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("requests");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result);
  });
  try {
    return await new Promise<AwardSlot>((resolve, reject) => {
      const tx = db.transaction("requests", "readwrite");
      const store = tx.objectStore("requests");
      const read = store.get(key);
      let result: AwardSlot;
      read.onsuccess = () => {
        try {
          const mirror = read.result === undefined ? localStorage.getItem(key) : null;
          const current: AwardSlot = read.result ?? {
            pending: mirror ? readPending(mirror, owner) : null,
            lastRequest: null,
          };
          if (current.pending) readPending(JSON.stringify(current.pending), owner);
          result = update ? update(current) : current;
          if (result !== current || read.result === undefined) store.put(result, key);
        } catch {
          tx.abort();
        }
      };
      tx.onabort = () => reject(tx.error ?? Error("Award storage unavailable"));
      tx.oncomplete = () => resolve(result);
    });
  } finally {
    db.close();
  }
}
const endpoint = "/api/admin/pack-awards";
const reasonLabel = (reason: "PROMOTION" | "PRIZE") =>
  reason === "PROMOTION" ? "Promotion" : "Prize";
function packLabel(p: {
  sport: string;
  family: "STANDARD" | "PREMIUM";
  size: number;
}) {
  return `${p.sport.toUpperCase()} · ${p.family === "PREMIUM" ? "Premium" : "Standard"} ${p.size}-card pack`;
}
function counts(lines: OwnerPackAwardCommand["lines"]) {
  return lines.reduce(
    (n, line) => ({
      packs: n.packs + line.quantity,
      cards: n.cards + line.quantity * line.size,
    }),
    { packs: 0, cards: 0 },
  );
}
function totalLabel(lines: OwnerPackAwardCommand["lines"]) {
  const n = counts(lines);
  return `${n.packs} ${n.packs === 1 ? "pack" : "packs"} · ${n.cards} ${n.cards === 1 ? "card" : "cards"}`;
}
function readPending(raw: string, owner: string): Pending {
  const saved = JSON.parse(raw) as Pending;
  const command = ownerPackAwardCommand.parse(saved.command);
  if (
    saved.version !== 1 ||
    saved.owner !== owner ||
    saved.recipient?.id !== command.member ||
    typeof saved.recipient.title !== "string" ||
    typeof saved.recipient.detail !== "string"
  )
    throw Error("Saved award identity does not match this Owner.");
  return { version: 1, owner, recipient: saved.recipient, command };
}
function matchesReceipt(
  value: OwnerPackAwardReceipt,
  pending: Pending,
): boolean {
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.recipientName !== "string" ||
    typeof value.createdAt !== "string" ||
    value.actor !== pending.owner ||
    value.request !== pending.command.request ||
    value.member !== pending.command.member ||
    value.reason !== pending.command.reason ||
    value.reference !== pending.command.reference ||
    !Array.isArray(value.packs) ||
    value.packs.length !== counts(pending.command.lines).packs
  )
    return false;
  return pending.command.lines.every(
    (line) =>
      value.packs.filter(
        (pack) =>
          typeof pack.id === "string" &&
          pack.sport === line.sport &&
          pack.family === line.family &&
          pack.size === line.size,
      ).length === line.quantity,
  );
}

function AwardReceipt({ receipt }: { receipt: OwnerPackAwardReceipt }) {
  const cards = receipt.packs.reduce((n, pack) => n + pack.size, 0);
  return (
    <article className={styles.receipt}>
      <div className={styles.heading}>
        <h3>{receipt.recipientName}</h3>
        <span>{reasonLabel(receipt.reason)}</span>
      </div>
      <p>
        {receipt.packs.length} {receipt.packs.length === 1 ? "pack" : "packs"}
        {" · "}
        {cards} {cards === 1 ? "card" : "cards"} · Free
      </p>
      <p>
        <time dateTime={receipt.createdAt}>
          {new Date(receipt.createdAt).toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
          })}
        </time>{" "}
        Sydney
      </p>
      <p>Reference: {receipt.reference}</p>
      <details>
        <summary>Award receipt and pack records</summary>
        <dl className={styles.facts}>
          <div>
            <dt>Award</dt>
            <dd>{receipt.id}</dd>
          </div>
          <div>
            <dt>Customer</dt>
            <dd>
              <Link href={`/admin/workspace/users?record=${receipt.member}`}>
                {receipt.member}
              </Link>
            </dd>
          </div>
          <div>
            <dt>Issued by Owner</dt>
            <dd>{receipt.actor}</dd>
          </div>
          <div>
            <dt>Request</dt>
            <dd>{receipt.request}</dd>
          </div>
        </dl>
        <ul>
          {receipt.packs.map((pack) => (
            <li key={pack.id}>
              <Link href={`/admin/workspace/packs?record=${pack.id}`}>
                {packLabel(pack)}
              </Link>
              <small className={styles.identifier}>{pack.id}</small>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

export function OwnerPackAwards({
  ownerId,
  initialView,
  initialRecipient = null,
}: {
  ownerId: string;
  initialView: OwnerPackAwardView | null;
  initialRecipient?: AwardRecipient | null;
}) {
  const [view, setView] = useState(initialView);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<AdminSearchResponse | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [reason, setReason] =
    useState<OwnerPackAwardCommand["reason"]>("PROMOTION");
  const [reference, setReference] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accessProblem, setAccessProblem] = useState(false);
  const [reportError, setReportError] = useState("");
  const [receipt, setReceipt] = useState<OwnerPackAwardReceipt | null>(null);
  const flight = useRef(false);
  const confirmationFlight = useRef(false);
  const reportFlight = useRef(false);
  const searchRequest = useRef(0);
  const alive = useRef(true);
  const lastRequest = useRef<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const storageKey = `docked:owner-pack-award:pending:${ownerId}`;
  const headers = { "x-docked-owner": ownerId };

  function replacePending(value: Pending | null) {
    pendingRef.current = value;
    setPending(value);
  }
  useEffect(() => {
    alive.current = true;
    let active = true;
    let revision = 0;
    const restore = async () => {
      const current = ++revision;
      try {
        const slot = await awardSlot(storageKey, ownerId);
        if (!active || current !== revision) return;
        lastRequest.current = slot.lastRequest;
        const saved = slot.pending;
        pendingRef.current = saved;
        setPending(saved);
        setReview(null);
        setStorageError("");
      } catch {
        setStorageError(
          "The saved award request could not be read. Check award history before continuing on another device.",
        );
      }
      setReady(true);
    };
    restore();
    const changed = (event: StorageEvent) => {
      if (event.storageArea === localStorage && event.key === storageKey)
        restore();
    };
    window.addEventListener("storage", changed);
    return () => {
      active = false;
      alive.current = false;
      searchRequest.current++;
      window.removeEventListener("storage", changed);
    };
  }, [ownerId, storageKey]);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);

  async function refresh(append = false) {
    if (reportFlight.current) return;
    reportFlight.current = true;
    setLoading(true);
    setReportError("");
    try {
      const r = await boundedFetch(
        `${endpoint}?offset=${append ? (view?.next ?? 0) : 0}`,
        { cache: "no-store", headers },
      );
      if (!r.ok)
        throw Error("Pack awards could not be loaded. Refresh to retry.");
      const next = (await r.json()) as OwnerPackAwardView;
      if (
        typeof next.enabled !== "boolean" ||
        !Array.isArray(next.products) ||
        !Array.isArray(next.awards)
      )
        throw Error("Pack awards could not be loaded. Refresh to retry.");
      if (!alive.current) return;
      setView((current) => ({
        ...next,
        awards:
          append && current
            ? [...current.awards, ...next.awards].filter(
                (award, index, all) =>
                  all.findIndex((item) => item.id === award.id) === index,
              )
            : next.awards,
      }));
    } catch {
      if (alive.current)
        setReportError("Pack awards could not be loaded. Refresh to retry.");
    } finally {
      reportFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }

  async function findCustomers(page = 1) {
    if (query.trim().length < 2) return;
    const request = ++searchRequest.current;
    setSearchBusy(true);
    setSearchError("");
    try {
      const r = await boundedFetch(
        `/api/admin/search?category=members&q=${encodeURIComponent(query.trim())}&page=${page}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw Error("Customer search is unavailable. Try again.");
      const found = (await r.json()) as AdminSearchResponse;
      if (!Array.isArray(found.results))
        throw Error("Customer search is unavailable. Try again.");
      if (alive.current && request === searchRequest.current) setSearch(found);
    } catch {
      if (alive.current && request === searchRequest.current)
        setSearchError("Customer search is unavailable. Try again.");
    } finally {
      if (alive.current && request === searchRequest.current)
        setSearchBusy(false);
    }
  }

  function addPack() {
    const product = view?.products.find((p) => p.id === chosenProduct);
    const n = Number(quantity);
    if (!product?.available || !Number.isInteger(n) || n < 1) return;
    if (packCount + n > maximumOwnerAwardPacks) {
      setError(`Choose up to ${maximumOwnerAwardPacks} packs in one award.`);
      return;
    }
    setError("");
    setBasket((current) => {
      if (
        current.reduce((sum, line) => sum + line.quantity, 0) + n >
        maximumOwnerAwardPacks
      )
        return current;
      const existing = current.find((line) => line.product.id === product.id);
      return existing
        ? current.map((line) =>
            line.product.id === product.id
              ? { product, quantity: line.quantity + n }
              : line,
          )
        : [...current, { product, quantity: n }];
    });
  }

  function prepareReview() {
    if (!recipient || !basket.length || !view?.enabled || pendingRef.current)
      return;
    if (
      basket.some(
        (line) =>
          !view.products.some(
            (p) =>
              p.id === line.product.id &&
              p.available &&
              p.configurationHash === line.product.configurationHash,
          ),
      )
    ) {
      setError(
        "A selected pack has changed or is unavailable. Update the selection.",
      );
      return;
    }
    const lines = basket.map(({ product, quantity }) => ({
      sport: product.sport,
      family: product.family,
      size: product.size,
      quantity,
      configurationHash: product.configurationHash,
    }));
    const checked = ownerPackAwardCommand.safeParse({
      request: crypto.randomUUID(),
      member: recipient.id,
      reason,
      reference: reference.trim(),
      lines,
      confirmed: true,
    });
    if (!checked.success) {
      setError("Choose 1–20 packs and enter a reference of 3–200 characters.");
      return;
    }
    setError("");
    setReceipt(null);
    setReview({
      lastRequest: lastRequest.current,
      recipient,
      reason,
      reference: checked.data.reference,
      lines: checked.data.lines,
    });
  }

  async function clearSaved(saved: Pending) {
    // Another tab may have started its next award after resolving this request.
    // Never remove a different saved command.
    await navigator.locks.request(storageKey, async () => {
      const current = await awardSlot(storageKey, ownerId, (slot) =>
        slot.pending?.command.request === saved.command.request
          ? { pending: null, lastRequest: saved.command.request }
          : slot,
      );
      lastRequest.current = current.lastRequest;
      replacePending(current.pending);
      if (!current.pending) localStorage.removeItem(storageKey);
    });
  }

  async function issue(saved: Pending) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    setAccessProblem(false);
    try {
      const r = await boundedFetch(endpoint, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(saved.command),
      });
      const result = await r.json();
      if (!r.ok) {
        if (result?.outcome === "rejected") {
          await clearSaved(saved);
          setReview(null);
          setError(
            typeof result.error === "string"
              ? result.error
              : "This award was rejected. Refresh availability and review again.",
          );
          void refresh();
          return;
        }
        if (r.status === 403) {
          setAccessProblem(true);
          setError(
            "Verify your Owner access, then return to check the saved award. Its request is retained for recovery.",
          );
          return;
        }
        throw Error("Award outcome is unconfirmed.");
      }
      if (!matchesReceipt(result as OwnerPackAwardReceipt, saved))
        throw Error("Award receipt could not be confirmed.");
      if (!alive.current) return;
      // The confirmed receipt remains visible if report loading or local cleanup fails.
      setReceipt(result as OwnerPackAwardReceipt);
      setReview(null);
      setBasket([]);
      setReference("");
      setView((current) =>
        current
          ? {
              ...current,
              awards: [
                result as OwnerPackAwardReceipt,
                ...current.awards,
              ].filter(
                (award, index, all) =>
                  all.findIndex((item) => item.id === award.id) === index,
              ),
            }
          : current,
      );
      await clearSaved(saved);
      void refresh();
    } catch {
      if (alive.current)
        setError(
          "Check the saved award below before starting another. Retrying it uses the same request and recovers an award already issued.",
        );
    } finally {
      flight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function confirmAward() {
    if (
      !review ||
      flight.current ||
      confirmationFlight.current ||
      pendingRef.current ||
      !ready
    )
      return;
    if (!navigator.locks) {
      setStorageError(
        "This browser cannot safely coordinate award requests across tabs. Open this page in an up-to-date Chrome, Edge, Safari or Firefox browser.",
      );
      return;
    }
    confirmationFlight.current = true;
    setBusy(true);
    try {
      const saved = await navigator.locks.request(storageKey, async () => {
        if (!alive.current) return null;
        const next: Pending = {
          version: 1,
          owner: ownerId,
          recipient: review.recipient,
          command: ownerPackAwardCommand.parse({
            request: crypto.randomUUID(),
            member: review.recipient.id,
            reason: review.reason,
            reference: review.reference,
            lines: review.lines,
            confirmed: true,
          }),
        };
        const slot = await awardSlot(storageKey, ownerId, (current) =>
          current.pending || current.lastRequest !== review.lastRequest
            ? current
            : { ...current, pending: next },
        );
        lastRequest.current = slot.lastRequest;
        if (slot.pending?.command.request !== next.command.request) {
          replacePending(slot.pending);
          setReview(null);
          setError("Another tab handled this review. Check the saved request or award history.");
          return null;
        }
        replacePending(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
        setReview(null);
        return next;
      });
      // The cross-tab lock protects request creation, not the network wait.
      if (saved && alive.current) await issue(saved);
    } catch {
      setStorageError(
        "Device storage is required to save an award request safely. Enable it and reload this page.",
      );
    } finally {
      confirmationFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const packCount = basket.reduce((n, line) => n + line.quantity, 0);
  const cardCount = basket.reduce(
    (n, line) => n + line.quantity * line.product.size,
    0,
  );
  const chosenProduct =
    productId || view?.products.find((p) => p.available)?.id || "";
  const locked = busy || !!pending || !ready || !!storageError || !!review;
  return (
    <div className={styles.root}>
      <header className={styles.heading}>
        <div>
          <p className="eyebrow">DOCKED OPERATIONS</p>
          <h1>Award packs</h1>
          <p>Send free packs to a customer for a promotion or prize.</p>
        </div>
        <Link href="/admin/operations">Commercial operations</Link>
      </header>
      {error && <p role="alert">{error}</p>}
      {accessProblem && (
        <Link href="/app/login?next=%2Fadmin%2Fpack-awards">
          Sign in to verify Owner access
        </Link>
      )}
      {storageError && <p role="alert">{storageError}</p>}
      {receipt && (
        <section className={styles.success} aria-labelledby="award-success">
          <h2 id="award-success">Packs awarded</h2>
          <p role="status">
            The packs are ready in {receipt.recipientName}’s My Packs. Their
            credit balance is unchanged.
          </p>
          <AwardReceipt receipt={receipt} />
        </section>
      )}
      {pending && (
        <section
          className={styles.pending}
          aria-labelledby="award-pending"
          aria-busy={busy}
        >
          <h2 id="award-pending">Saved award request</h2>
          <p>
            {pending.recipient.title} · {reasonLabel(pending.command.reason)}
          </p>
          <p className={styles.identifier}>
            Customer: {pending.command.member}
          </p>
          <p>{totalLabel(pending.command.lines)}</p>
          <ul>
            {pending.command.lines.map((line) => (
              <li key={`${line.sport}:${line.family}:${line.size}`}>
                {line.quantity} × {packLabel(line)}
              </li>
            ))}
          </ul>
          <p>Reference: {pending.command.reference}</p>
          <p className={styles.identifier}>
            Request: {pending.command.request}
          </p>
          <p>
            Resolve this request before starting another award. Checking it
            recovers the original result if the packs have already been issued.
          </p>
          <button
            className="button"
            disabled={busy || !ready || !!storageError}
            onClick={() => void issue(pending)}
          >
            {busy ? "Checking award…" : "Check and retry saved award"}
          </button>
        </section>
      )}
      {!view && (
        <section className={styles.panel}>
          <p role="alert">
            Pack availability and award history are unavailable.
          </p>
          <button
            className="button"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "Loading…" : "Load pack awards"}
          </button>
        </section>
      )}
      {view && !view.enabled && (
        <p role="status">
          New pack awards are currently paused. Existing awards remain in the
          history.
        </p>
      )}
      {view && (
        <fieldset className={styles.form} disabled={locked || !view.enabled}>
          <legend className={styles.srOnly}>New pack award</legend>
          <section className={styles.panel} aria-labelledby="award-customer">
            <h2 id="award-customer">1. Choose a customer</h2>
            <form
              className={styles.row}
              onSubmit={(event) => {
                event.preventDefault();
                void findCustomers();
              }}
            >
              <label className={styles.grow}>
                Customer name or member ID
                <input
                  value={query}
                  minLength={2}
                  maxLength={120}
                  required
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSearch(null);
                    searchRequest.current++;
                    setSearchBusy(false);
                  }}
                />
              </label>
              <button
                className="button ghost"
                disabled={searchBusy || query.trim().length < 2}
              >
                {searchBusy ? "Searching…" : "Find customer"}
              </button>
            </form>
            {searchError && <p role="alert">{searchError}</p>}
            {search && (
              <div>
                {!search.results.length && <p>No matching customers.</p>}
                <ul className={styles.results}>
                  {search.results
                    .filter((r) => r.category === "members")
                    .map((result) => (
                      <li key={result.id}>
                        <div>
                          <strong>{result.title}</strong>
                          <span>{result.detail}</span>
                          <small className={styles.identifier}>
                            {result.id}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="button ghost"
                          aria-label={`Select ${result.title}, ${result.id}`}
                          onClick={() => {
                            setRecipient(result);
                            setSearch(null);
                            setError("");
                          }}
                        >
                          Select
                        </button>
                      </li>
                    ))}
                </ul>
                <div className="actions">
                  {search.page > 1 && (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={searchBusy}
                      onClick={() => void findCustomers(search.page - 1)}
                    >
                      Previous customers
                    </button>
                  )}
                  {search.hasMore && (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={searchBusy}
                      onClick={() => void findCustomers(search.page + 1)}
                    >
                      Next customers
                    </button>
                  )}
                </div>
              </div>
            )}
            {recipient && (
              <div className={styles.selected}>
                <strong>{recipient.title}</strong>
                <span>{recipient.detail}</span>
                <small className={styles.identifier}>
                  Member ID: {recipient.id}
                </small>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setRecipient(null)}
                >
                  Change customer
                </button>
              </div>
            )}
          </section>
          <section className={styles.panel} aria-labelledby="award-packs">
            <h2 id="award-packs">2. Choose packs</h2>
            <p>
              Mix Standard and Premium packs, with 1, 3 or 9 cards per pack. Up
              to {maximumOwnerAwardPacks} packs per award.
            </p>
            <div className={styles.row}>
              <label className={styles.grow}>
                Pack option
                <select
                  value={chosenProduct}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  {!chosenProduct && (
                    <option value="">No packs currently available</option>
                  )}
                  {view.products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                      disabled={!product.available}
                    >
                      {packLabel(product)}
                      {!product.available ? " · Unavailable" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.quantity}>
                Quantity
                <input
                  type="number"
                  min={1}
                  max={maximumOwnerAwardPacks}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="button ghost"
                disabled={
                  !chosenProduct ||
                  !Number.isInteger(Number(quantity)) ||
                  Number(quantity) < 1 ||
                  packCount + Number(quantity) > maximumOwnerAwardPacks
                }
                onClick={addPack}
              >
                Add pack
              </button>
            </div>
            {basket.length > 0 && (
              <>
                <ul className={styles.results}>
                  {basket.map((line) => (
                    <li key={line.product.id}>
                      <div>
                        <strong>
                          {line.quantity} × {packLabel(line.product)}
                        </strong>
                        <span>{line.quantity * line.product.size} cards</span>
                      </div>
                      <button
                        type="button"
                        className="button ghost"
                        aria-label={`Remove ${packLabel(line.product)}`}
                        onClick={() =>
                          setBasket((current) =>
                            current.filter(
                              (item) => item.product.id !== line.product.id,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <p className={styles.total}>
                  {packCount} {packCount === 1 ? "pack" : "packs"} · {cardCount}{" "}
                  {cardCount === 1 ? "card" : "cards"} · Free
                </p>
              </>
            )}
          </section>
          <section className={styles.panel} aria-labelledby="award-purpose">
            <h2 id="award-purpose">3. Record the purpose</h2>
            <div className={styles.row}>
              <label>
                Reason
                <select
                  value={reason}
                  onChange={(event) =>
                    setReason(
                      event.target.value as OwnerPackAwardCommand["reason"],
                    )
                  }
                >
                  <option value="PROMOTION">Promotion</option>
                  <option value="PRIZE">Prize</option>
                </select>
              </label>
              <label className={styles.grow}>
                Internal reference
                <input
                  value={reference}
                  minLength={3}
                  maxLength={200}
                  placeholder="e.g. Launch promotion · winner 01"
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
            </div>
            <p className={styles.note}>
              The reference is saved in the Owner audit history. Customers see
              Promotion or Prize.
            </p>
            <button
              type="button"
              className="button"
              disabled={
                !recipient || !basket.length || reference.trim().length < 3
              }
              onClick={prepareReview}
            >
              Review award
            </button>
          </section>
        </fieldset>
      )}
      {review && (
        <section className={styles.review} aria-labelledby="award-review">
          <h2 id="award-review" ref={reviewHeading} tabIndex={-1}>
            Review free pack award
          </h2>
          <p>
            <strong>{review.recipient.title}</strong>
          </p>
          <p className={styles.identifier}>Customer: {review.recipient.id}</p>
          <ul>
            {review.lines.map((line) => (
              <li key={`${line.sport}:${line.family}:${line.size}`}>
                {line.quantity} × {packLabel(line)}
              </li>
            ))}
          </ul>
          <p className={styles.total}>{totalLabel(review.lines)} · Free</p>
          <p>
            {reasonLabel(review.reason)} · {review.reference}
          </p>
          <p>
            The customer receives unopened packs in My Packs. Their credit
            balance stays unchanged.
          </p>
          <div className="actions">
            <button
              className="button"
              disabled={
                busy || !ready || !!storageError || !!pending || !view?.enabled
              }
              onClick={confirmAward}
            >
              Award {counts(review.lines).packs}{" "}
              {counts(review.lines).packs === 1 ? "pack" : "packs"}
            </button>
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Edit award
            </button>
          </div>
        </section>
      )}
      <section className={styles.panel} aria-labelledby="award-history">
        <div className={styles.heading}>
          <h2 id="award-history">Award history</h2>
          <button
            className="button ghost"
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            {loading ? "Refreshing…" : "Refresh history and availability"}
          </button>
        </div>
        {reportError && <p role="alert">{reportError}</p>}
        {view?.awards.length === 0 && <p>No pack awards have been recorded.</p>}
        <div className={styles.history}>
          {view?.awards.map((award) => (
            <AwardReceipt key={award.id} receipt={award} />
          ))}
        </div>
        {view?.next != null && (
          <button
            className="button ghost"
            disabled={loading || busy}
            onClick={() => void refresh(true)}
          >
            {loading ? "Loading…" : "Load earlier awards"}
          </button>
        )}
      </section>
    </div>
  );
}
