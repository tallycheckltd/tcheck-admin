#!/usr/bin/env node
/**
 * Tcheck ⇄ BioStar 2 connector (2026-11-13; 1.2.0 gate access 2026-11-20).
 *
 * Runs inside the school's network, next to the BioStar 2 server, and only ever calls OUT:
 *   - to Tcheck (HTTPS): heartbeat + inventory, claim jobs, report results, forward barrier events;
 *   - to BioStar 2 (its local API): make each Tcheck person's BioStar user match what Tcheck wants
 *     (cards, access group, enabled, expiry), open a door on request, enrol and delete fingerprints,
 *     report doors, readers and door states, and listen to the live event stream (WebSocket /wsapi),
 *     with a catch-up search after any gap.
 *
 * Fingerprints: the template goes from the reader into BioStar and nowhere else. It is never sent to
 * Tcheck, never logged and never kept in memory after the user record is written.
 * The school opens no inbound port. Node 22+ only (global fetch and WebSocket); no npm packages.
 *
 * Configuration (environment):
 *   TCHECK_URL            e.g. https://app.tcheck.co.ke/api
 *   TCHECK_TOKEN          the tcbs_… token from Tcheck → Visitors → Barrier (BioStar)
 *   BIOSTAR_URL           e.g. https://10.0.0.20  (the BioStar 2 server, HTTPS)
 *   BIOSTAR_LOGIN_ID      a BioStar operator account with user + card + access-group rights
 *   BIOSTAR_PASSWORD
 *   BIOSTAR_INSECURE_TLS  "1" to accept BioStar's self-signed certificate (prefer installing it instead)
 *
 * BioStar 2 API calls used (Suprema "New Local API"): POST /api/login (bs-session-id header),
 * GET/POST/PUT /api/users, POST /api/cards, PUT /api/access_groups/:id, GET /api/access_groups,
 * /api/user_groups, /api/devices, POST /api/events/start, POST /api/events/search, WS /wsapi.
 * Where Suprema's documents disagree on a body shape (the card wrapper), the connector tries the
 * documented shapes in order, remembers the one this server accepts, and reports it in the self-test.
 *
 * Checked against Suprema's published API collection (bs2api.biostar2.com, 2026-11-20):
 *   - card_type.type is a per-server "allocation" read from GET /api/cards/types, not always equal
 *     to card_type.id (the CSN example is id 0 / type 1), so it is looked up, not assumed;
 *   - POST /api/cards refuses a card_id that already exists, so a retried grant first looks the card
 *     up (GET /api/cards?query=) and reuses it;
 *   - PUT /api/access_groups/:id REPLACES the group (a missing user_groups list empties it), so the
 *     connector never writes to an access group: access is given and taken on the user record;
 *   - every user it makes carries department "Tcheck", and it refuses to change a user without it,
 *     so a clash with a real BioStar user_id can never overwrite a member of staff;
 *   - a BioStar 2 QR (type 7) card names its user_id in the card row.
 *
 * 1.3.0 (2026-11-21) — the connector reads what kind of BioStar it is talking to and adapts:
 *   - server check (every inventory, and in the self-test): version (GET /js/info.json), BioStar 2 or
 *     BioStar X, the server's time zone (GET /api/preferences/1), and for every QR reader whether QR
 *     reading is switched on (GET /api/devices/:id/config → barcode.use_barcode); Tcheck turns these
 *     facts into plain warnings on the setup page;
 *   - time handling: Suprema documents start/expiry as UTC ("…Z"), but BioStar's own default period
 *     (2030-12-31T23:59:00.00Z) reads as wall-clock time. The event clock (the newest event's time
 *     against now) shows which; Tcheck confirms it with the lane test and sends timeShiftMinutes, and
 *     the connector then writes, reads and searches every BioStar time shifted by it.
 *
 * 1.4.0 (2026-11-22) — checked against a REAL BioStar 2.9.12.31 server (Windows, Nairobi time):
 *   - BioStar reads "…Z" times as the server's wall-clock time: a visitor sent "until 15:26Z" at 13:26Z
 *     was already `expired: true` on a Nairobi server. The self-test now asks BioStar directly
 *     (timeProbe): it gives its test user an expiry half the school's UTC offset ahead and reads
 *     BioStar's own `expired` verdict, so Tcheck knows the shift before any reader exists;
 *   - GET /js/info.json answers { "biostar2": "2.9.12.31", "acb": …, "ta": …, "ve": … };
 *   - the preference time_zone index is the admin's DISPLAY zone (a fresh install says "26" = UTC+9,
 *     Suprema's Korean default) and follows Suprema's table, not a simple sequence; it is reported
 *     for information only;
 *   - user list rows count QR codes in qr_count, not card_count;
 *   - BioStar accepts an empty card_id and makes a blank card: the connector refuses one;
 *   - a card taken off a user stays in BioStar's card list for ever. The connector now deletes the
 *     Tcheck codes it releases (TCQ/TCD/TCV prefixes only; a school's own cards and reusable walk-in
 *     tags are never deleted). DELETE /api/cards?id= takes ONE id per call on a real server.
 */

const VERSION = '1.4.0';
const MARKER = 'Tcheck'; // department on every BioStar user the connector creates
const env = (k, d) => (process.env[k] ?? d);
const CFG = {
  tcheck: String(env('TCHECK_URL', '')).replace(/\/+$/, ''),
  token: env('TCHECK_TOKEN', ''),
  biostar: String(env('BIOSTAR_URL', '')).replace(/\/+$/, ''),
  login: env('BIOSTAR_LOGIN_ID', ''),
  password: env('BIOSTAR_PASSWORD', ''),
  jobEveryMs: Number(env('JOB_POLL_MS', 3000)),
  /** Long-poll: Tcheck holds the claim open until work arrives (at most this long). 0 = plain polling. */
  jobWaitMs: Number(env('JOB_WAIT_MS', 25000)),
  doorStateEveryMs: Number(env('DOOR_STATE_MS', 15000)),
  heartbeatEveryMs: Number(env('HEARTBEAT_MS', 60000)),
  inventoryEveryMs: Number(env('INVENTORY_MS', 600000)),
  catchUpEveryMs: Number(env('CATCHUP_MS', 60000)),
};
if (env('BIOSTAR_INSECURE_TLS') === '1') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const log = (level, msg, extra) => console[level === 'error' ? 'error' : 'log'](`${new Date().toISOString()} [${level}] ${msg}${extra ? ` ${JSON.stringify(extra)}` : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Tcheck ──────────────────────────────────────────────────────────────────────────────────────

async function tcheck(path, body) {
  const r = await fetch(`${CFG.tcheck}/integrations/biostar/agent${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CFG.token}` }, body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Tcheck ${path} → ${r.status} ${data.error ?? ''}`.trim());
  return data;
}

// ─── BioStar 2 ───────────────────────────────────────────────────────────────────────────────────

class BioStarError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}

const BS = {
  session: null,
  cardShape: null, // 'collection' | 'flat', learned from the first card this server accepts
  typeMap: null,   // card_type.id → card_type.type on this server (GET /api/cards/types)
  /** How far BioStar's clock strings run ahead of UTC (0 = they are UTC; Nairobi wall time = +3 h). From Tcheck. */
  shiftMs: 0,

  async login() {
    const r = await fetch(`${CFG.biostar}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ User: { login_id: CFG.login, password: CFG.password } }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new BioStarError(`BioStar login failed (${r.status}) ${body?.Response?.message ?? ''}`.trim(), r.status, body);
    const sid = r.headers.get('bs-session-id');
    if (!sid) throw new BioStarError('BioStar did not return a bs-session-id header', r.status, body);
    this.session = sid;
    return sid;
  },

  async call(method, path, body, { retry = true } = {}) {
    if (!this.session) await this.login();
    const r = await fetch(`${CFG.biostar}${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'bs-session-id': this.session },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 401 && retry) { this.session = null; return this.call(method, path, body, { retry: false }); }
    const text = await r.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    const code = data?.Response?.code;
    if (!r.ok || (code !== undefined && String(code) !== '0')) {
      throw new BioStarError(`${method} ${path} → ${r.status} ${data?.Response?.message ?? ''}`.trim(), r.status, data);
    }
    return data ?? {};
  },

  /** BioStar wraps lists as { XxxCollection: { rows: [...] } } — take the rows whatever the name. */
  rows(data) {
    for (const [k, v] of Object.entries(data ?? {})) if (/Collection$/.test(k) && Array.isArray(v?.rows)) return v.rows;
    return [];
  },

  /** BioStar's documented datetime form: 2030-12-31T23:59:00.00Z (shifted when this server reads wall-clock time). */
  dt(iso) { return `${new Date(Date.parse(iso) + this.shiftMs).toISOString().slice(0, 19)}.00Z`; },
  /** A BioStar datetime string → the real instant (ISO, UTC). */
  fromBs(s) { const t = Date.parse(s); return Number.isNaN(t) ? null : new Date(t - this.shiftMs).toISOString(); },
  setShiftMinutes(m) { const v = Number(m); if (Number.isFinite(v) && Math.abs(v) <= 14 * 60) this.shiftMs = v * 60_000; },

  async getUser(userId) {
    try { return (await this.call('GET', `/api/users/${encodeURIComponent(userId)}`)).User ?? null; } catch (e) { if (e.status === 404 || e.status === 400) return null; throw e; }
  },

  /** True when this BioStar user was made by the connector (never touch anyone else). */
  ours(user) { return String(user?.department ?? '') === MARKER; },

  async upsertUser(p) {
    const fields = {
      name: p.name, department: MARKER, disabled: 'false', start_datetime: this.dt(p.startAt), expiry_datetime: this.dt(p.endAt),
      ...(p.email ? { email: p.email } : {}), ...(p.accessGroupId ? { access_groups: [{ id: Number(p.accessGroupId) || p.accessGroupId }] } : {}),
    };
    const existing = await this.getUser(p.userId);
    if (existing) {
      if (!this.ours(existing)) throw new BioStarError(`BioStar user_id ${p.userId} already belongs to someone not made by Tcheck; refusing to change it`, 409, null);
      await this.call('PUT', `/api/users/${encodeURIComponent(p.userId)}`, { User: fields });
      return 'updated';
    }
    await this.call('POST', '/api/users', { User: { user_id: String(p.userId), ...(p.userGroupId ? { user_group_id: { id: Number(p.userGroupId) || p.userGroupId } } : { user_group_id: { id: 1 } }), ...fields } });
    return 'created';
  },

  /** card_type.type for a card_type.id on this server; Suprema's examples as the fallback. */
  async cardTypeFor(id) {
    if (!this.typeMap) {
      this.typeMap = {};
      const data = await this.call('GET', '/api/cards/types').catch(() => null);
      for (const r of this.rows(data)) if (r?.id != null && r?.type != null && this.typeMap[String(r.id)] === undefined) this.typeMap[String(r.id)] = String(r.type);
    }
    const fallback = { 0: '1', 6: '6', 7: '7' };
    return this.typeMap[String(id)] ?? fallback[Number(id)] ?? String(id);
  },

  /** BioStar's database id of a card already registered with this card_id, or null. */
  async findCard(cardId) {
    const data = await this.call('GET', `/api/cards?query=${encodeURIComponent(cardId)}`).catch(() => null);
    const hit = this.rows(data).find((r) => String(r?.card_id ?? r?.display_card_id) === String(cardId));
    return hit?.id != null ? String(hit.id) : null;
  },

  /** Registers a card (or finds the one already there) and returns BioStar's database id for it. */
  async createCard(card, userId) {
    // A real BioStar accepts an empty card_id and makes a blank card; never send one.
    if (!card?.id || String(card.id).trim() === '' || String(card.id).length > 32) throw new BioStarError(`Refusing card value of length ${String(card?.id ?? '').length} (must be 1–32 characters)`, 400, null);
    const existing = await this.findCard(card.id);
    if (existing) return existing;
    const type = await this.cardTypeFor(card.type);
    const row = {
      card_id: String(card.id), card_type: { id: String(card.type), type },
      ...(Number(card.type) === 7 ? { display_card_id: String(card.id), user_id: { user_id: String(userId) } } : {}),
    };
    const shapes = this.cardShape ? [this.cardShape] : ['collection', 'flat'];
    let lastErr = null;
    for (const shape of shapes) {
      try {
        const data = await this.call('POST', '/api/cards', shape === 'collection' ? { CardCollection: { rows: [row] } } : row);
        const id = this.rows(data)[0]?.id ?? data?.Card?.id ?? data?.id ?? await this.findCard(card.id);
        if (id === undefined || id === null) throw new BioStarError('POST /api/cards answered without a card id', 200, data);
        this.cardShape = shape;
        return String(id);
      } catch (e) {
        lastErr = e;
        // Registered by an earlier try whose answer was lost: reuse it.
        const again = await this.findCard(card.id).catch(() => null);
        if (again) { this.cardShape = this.cardShape ?? shape; return again; }
        if (e.status && e.status >= 500) break;
      }
    }
    throw lastErr;
  },

  /**
   * Deletes the card records a user just lost, when they are Tcheck's own codes (never a school's cards
   * or a reusable walk-in tag). Best effort: a failure leaves an unused record, never blocks a sync.
   */
  async deleteReleasedCards(before, keepIds) {
    const keep = new Set((keepIds ?? []).map(String));
    let deleted = 0;
    for (const c of before ?? []) {
      const id = String(c?.id ?? ''); const value = String(c?.card_id ?? c?.display_card_id ?? '');
      if (!id || keep.has(id) || !/^TC[QDV][0-9A-Z]{6,}$/.test(value)) continue;
      try { await this.call('DELETE', `/api/cards?id=${encodeURIComponent(id)}`); deleted += 1; } catch { /* leave it */ }
    }
    return deleted;
  },

  async assignCard(userId, cardDbId) {
    await this.call('PUT', `/api/users/${encodeURIComponent(userId)}`, { User: { cards: [{ id: cardDbId }] } });
  },

  async grant(p) {
    const user = await this.upsertUser(p);
    const cardDbId = await this.createCard(p.card, p.userId);
    await this.assignCard(p.userId, cardDbId);
    return { user, cardDbId, cardShape: this.cardShape };
  },

  /**
   * Disable + expire now, leave every access group and release the card, all on the user record.
   * The access group itself is never written (PUT /api/access_groups/:id replaces the whole group).
   * Gone already counts as revoked; a user not made by Tcheck is left alone.
   */
  async revoke(p) {
    const existing = await this.getUser(p.userId);
    if (!existing) return { user: 'absent' };
    if (!this.ours(existing)) return { user: 'not-ours-left-alone' };
    await this.call('PUT', `/api/users/${encodeURIComponent(p.userId)}`, {
      User: { disabled: 'true', expiry_datetime: this.dt(new Date().toISOString()), access_groups: [], cards: [] },
    });
    const cleaned = await this.deleteReleasedCards(existing.cards, []);
    return { user: 'disabled', cardsDeleted: cleaned };
  },

  async inventory() {
    const take = async (path) => this.rows(await this.call('GET', path).catch(() => ({}))).map((r) => ({ id: String(r.id), name: String(r.name ?? r.id) }));
    const deviceRows = this.rows(await this.call('GET', '/api/devices').catch(() => ({})));
    const doorRows = this.rows(await this.call('GET', '/api/doors').catch(() => ({})));
    return {
      accessGroups: await take('/api/access_groups'), userGroups: await take('/api/user_groups'),
      devices: deviceRows.map(deviceInfo),
      doors: doorRows.map((d) => ({
        id: String(d.id), name: String(d.name ?? d.id),
        entryDeviceId: d.entry_device_id?.id != null ? String(d.entry_device_id.id) : null, exitDeviceId: d.exit_device_id?.id != null ? String(d.exit_device_id.id) : null,
      })),
    };
  },

  /** BioStar door status → LOCKED | UNLOCKED | OPEN | HELD_OPEN | FORCED_OPEN, online or not. */
  async doorStates() {
    const data = await this.call('POST', '/api/doors/status', {});
    return this.rows(data).map((r) => {
      const t = (k) => r[k] === true || r[k] === 'true' || r[k] === 1 || r[k] === '1';
      const state = t('forced_opened') || t('forced_open') ? 'FORCED_OPEN' : t('held_opened') || t('held_open') ? 'HELD_OPEN' : t('opened') || t('open') ? 'OPEN' : t('unlocked') ? 'UNLOCKED' : 'LOCKED';
      return { doorId: String(r.door_id?.id ?? r.id), state, alarm: r.alarm_flags ? String(r.alarm_flags) : null, online: !t('disconnected') };
    });
  },

  /**
   * Makes one BioStar user exactly what Tcheck wants: enabled or not, its access group, start and
   * expiry, and the cards on it. Idempotent — the same job twice leaves BioStar the same. A disabled
   * user keeps nothing: no cards, no groups, expiry now. Never touches a user not made by Tcheck,
   * and never touches fingerprints (only ENROLL_FINGERPRINT / DELETE_BIOMETRIC do).
   */
  async applyState(p) {
    const existing = await this.getUser(p.userId);
    if (existing && !this.ours(existing)) throw new BioStarError(`BioStar user_id ${p.userId} already belongs to someone not made by Tcheck; refusing to change it`, 409, null);
    const enabled = !!p.enabled && !!p.accessGroupId;
    const fields = {
      name: String(p.name ?? p.userId).slice(0, 48), department: MARKER, disabled: enabled ? 'false' : 'true',
      start_datetime: this.dt(p.startAt ?? new Date().toISOString()), expiry_datetime: this.dt(enabled ? p.endAt : new Date().toISOString()),
      ...(p.email ? { email: p.email } : {}),
    };
    if (!existing) {
      await this.call('POST', '/api/users', { User: { user_id: String(p.userId), user_group_id: { id: p.userGroupId ? (Number(p.userGroupId) || p.userGroupId) : 1 }, ...fields } });
    }
    const cardIds = [];
    if (enabled) for (const c of p.cards ?? []) cardIds.push({ id: await this.createCard({ type: c.type, id: c.id }, p.userId) });
    await this.call('PUT', `/api/users/${encodeURIComponent(p.userId)}`, {
      User: { ...fields, access_groups: enabled ? [{ id: Number(p.accessGroupId) || p.accessGroupId }] : [], cards: cardIds },
    });
    // Codes this user just lost (scanned out, rotated, expired) leave BioStar's card list too.
    const cardsDeleted = existing ? await this.deleteReleasedCards(existing.cards, cardIds.map((c) => c.id)) : 0;
    return { user: existing ? 'updated' : 'created', enabled, cards: cardIds.length, cardsDeleted };
  },

  /** Ask BioStar to open a door once (it re-locks on its own timer). Tries the documented body shapes. */
  async openDoor(doorId) {
    const id = Number(doorId) || doorId;
    const shapes = this.doorShape ? [this.doorShape] : ['collection', 'flat'];
    let lastErr = null;
    for (const shape of shapes) {
      try {
        await this.call('POST', '/api/doors/open', shape === 'collection' ? { DoorCollection: { rows: [{ id }] } } : { id });
        this.doorShape = shape;
        return { opened: true, shape };
      } catch (e) { lastErr = e; if (e.status && e.status >= 500) break; }
    }
    throw lastErr;
  },

  /** Every BioStar user marked Tcheck: id, disabled, expiry, card and fingerprint counts (for the BioStar check). */
  async tcheckUsers(maxPages = 100) {
    const out = [];
    for (let page = 0; page < maxPages; page += 1) {
      const data = await this.call('GET', `/api/users?limit=500&offset=${page * 500}`);
      const rows = this.rows(data);
      for (const u of rows) {
        if (!this.ours(u)) continue;
        out.push({
          userId: String(u.user_id), disabled: String(u.disabled) === 'true', expiry: u.expiry_datetime ? this.fromBs(u.expiry_datetime) : null,
          // A real BioStar counts QR codes in qr_count, not card_count (checked on 2.9.12.31).
          cards: u.card_count != null || u.qr_count != null || u.mobile_count != null
            ? (Number(u.card_count) || 0) + (Number(u.qr_count) || 0) + (Number(u.mobile_count) || 0)
            : (Array.isArray(u.cards) ? u.cards.length : 0),
          fingers: Number(u.fingerprint_template_count ?? (Array.isArray(u.fingerprint_templates) ? u.fingerprint_templates.length : 0)) || 0,
          groups: (u.access_groups ?? []).map((g) => String(g.id ?? g)),
        });
      }
      if (rows.length < 500) break;
    }
    return out;
  },

  /** Events between two times, oldest first, 200 a page (a busy gate can pass 200 a minute). */
  async searchEvents(fromIso, toIso, maxPages = 20) {
    const out = []; const seen = new Set();
    const shift = (iso) => new Date(Date.parse(iso) + this.shiftMs).toISOString();
    let from = shift(fromIso); toIso = shift(toIso);
    for (let page = 0; page < maxPages; page += 1) {
      const data = await this.call('POST', '/api/events/search', {
        Query: { limit: 200, conditions: [{ column: 'datetime', operator: 3, values: [from, toIso] }], orders: [{ column: 'datetime', descending: false }] },
      });
      const rows = this.rows(data);
      for (const r of rows) { const k = String(r.id ?? `${r.device_id?.id}-${r.index}-${r.datetime}`); if (!seen.has(k)) { seen.add(k); out.push(r); } }
      if (rows.length < 200) break;
      const last = rows.at(-1)?.datetime;
      if (!last || last === from) break;
      from = last; // the next page starts at the last time seen; duplicates are dropped above
    }
    return out;
  },

  async nextUserId() {
    const data = await this.call('GET', '/api/users/next_user_id').catch(() => null);
    return data?.User?.user_id != null ? Number(data.User.user_id) : null;
  },

  /**
   * What kind of BioStar this is — facts only; Tcheck decides what they mean. Never throws: a fact
   * this server won't give comes back null.
   *   version, platform ('BioStar 2' | 'BioStar X'), timeZoneOffsetMinutes (from the preference's
   *   time_zone index, whole hours), readers: [{ id, qrOn }] for QR-capable readers, and
   *   eventClockOffsetMinutes: how far the newest event's raw time runs ahead of now (≈0 → UTC,
   *   ≈ +180 → Nairobi wall time), null when there is no recent event to judge by.
   */
  async serverCheck(devices = null) {
    const out = { version: null, platform: null, timeZoneOffsetMinutes: null, eventClockOffsetMinutes: null, readers: [], checkedAt: new Date().toISOString() };
    try {
      const r = await fetch(`${CFG.biostar}/js/info.json`, { headers: this.session ? { 'bs-session-id': this.session } : {} });
      const m = (await r.text()).match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
      if (m) out.version = m[1];
    } catch { /* older servers: try the settings below */ }
    if (!out.version) {
      const m = JSON.stringify(await this.call('GET', '/api/setting/biostar').catch(() => ({}))).match(/"(?:version|server_version|biostar_version)"\s*:\s*"(\d+\.\d+\.\d+(?:\.\d+)?)"/i);
      if (m) out.version = m[1];
    }
    if (out.version) out.platform = Number(out.version.split('.')[0]) >= 2 ? 'BioStar 2' : 'BioStar X';
    // The admin's DISPLAY time zone (information only: it is not how BioStar reads the times we send).
    const idx = findKey(await this.call('GET', '/api/preferences/1').catch(() => null), 'time_zone');
    if (idx != null && BS_TIME_ZONES[String(idx)] !== undefined) out.timeZoneOffsetMinutes = BS_TIME_ZONES[String(idx)];
    const list = devices ?? this.rows(await this.call('GET', '/api/devices').catch(() => ({}))).map(deviceInfo);
    for (const d of list.filter((x) => x.readsQr).slice(0, 50)) {
      const v = findKey(await this.call('GET', `/api/devices/${encodeURIComponent(d.id)}/config`).catch(() => null), 'use_barcode');
      out.readers.push({ id: String(d.id), qrOn: v == null ? null : String(v) === 'true' || v === true });
    }
    // The newest event in the last day (raw, unshifted): its time against now shows how this server writes times.
    try {
      const now = Date.now();
      const data = await this.call('POST', '/api/events/search', { Query: { limit: 1, conditions: [{ column: 'datetime', operator: 3, values: [new Date(now - 26 * 3_600_000).toISOString(), new Date(now + 15 * 3_600_000).toISOString()] }], orders: [{ column: 'datetime', descending: true }] } });
      const raw = this.rows(data)[0]?.datetime ?? this.rows(data)[0]?.server_datetime;
      const t = raw ? Date.parse(raw) : NaN;
      if (Number.isFinite(t) && now - t < 30 * 60_000) out.eventClockOffsetMinutes = Math.round((t - now) / (15 * 60_000)) * 15;
    } catch { /* no events API rights: Tcheck relies on the lane test */ }
    return out;
  },
};

/** BioStar's preference time_zone index → minutes from UTC (Suprema's table; not a simple sequence). */
const BS_TIME_ZONES = {
  0: -720, 1: -660, 2: -600, '3-1': -570, 3: -540, 4: -480, 5: -420, 6: -360, 7: -300, '8-1': -270, 8: -240, 9: -210, 10: -180, 11: -120, 12: -60,
  13: 0, 14: 60, 15: 120, 16: 180, 17: 210, 18: 240, 19: 270, 20: 300, 21: 330, 22: 345, 23: 360, '23+1': 390, 24: 420, 25: 480, '25+1': 510, '25+2': 525,
  26: 540, 27: 570, 28: 600, '28+1': 630, 29: 660, 30: 720, '30+1': 765, 31: 780, 32: 840,
};

/** The first value under `key` anywhere in a BioStar answer (wrappers differ between versions). */
function findKey(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null;
  if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] !== 'object') return obj[key];
  for (const v of Object.values(obj)) { const hit = findKey(v, key, depth + 1); if (hit != null) return hit; }
  return null;
}

/** A BioStar device as Tcheck shows it: model, firmware, IP, online, and what it can read (by model). */
function deviceInfo(d) {
  const model = String(d.device_type_id?.name ?? d.device_type?.name ?? d.model ?? '');
  const m = model.toUpperCase();
  const qr = /XS2-Q|X-?STATION 2.*Q|XPASS Q2|BIOSTATION 3|QR/.test(m) || d.qr_supported === true;
  const finger = /BIOSTATION 2|BIOSTATION A2|BIOSTATION L2|BIOLITE N2|BIOENTRY W2|BIOENTRY P2|BIOMINI|FINGER/.test(m) || d.fingerprint_supported === true;
  const face = /FACESTATION|BIOSTATION 3|BIOENTRY W3|FACE/.test(m) || d.face_supported === true;
  const status = d.status ?? d.connection_status;
  return {
    id: String(d.id), name: String(d.name ?? d.id), model: model || null,
    firmware: d.version ?? d.firmware_version ?? d.system?.firmware_version ?? null, ip: d.lan?.ip ?? d.ip ?? null,
    online: status == null ? true : ['1', 'true', 'online', 'connected'].includes(String(status).toLowerCase()),
    readsQr: qr, readsFinger: finger, readsFace: face,
  };
}

/**
 * Fingerprint enrolment, Suprema's documented steps: scan, check it is not already someone's, scan
 * again, check both scans are the same finger, save on the user. Steps go to Tcheck as they happen
 * (so the screen can say "Place the same finger again"); the templates never do.
 */
async function enrolFingerprint(job) {
  const p = job.payload ?? {};
  const say = (step, ok = true, detail) => tcheck(`/jobs/${job.id}/progress`, { step, ok, detail }).catch(() => null);
  await BS.applyState({ userId: p.userId, name: p.name, email: p.email, ...(p.user ?? {}), cards: [] });
  const scan = async () => {
    const data = await BS.call('POST', `/api/devices/${encodeURIComponent(p.deviceId)}/scan_fingerprint`, { enroll_quality: Number(p.enrollQuality) || 80, raw_image: false });
    const fp = data?.FingerprintTemplate ?? data;
    if (!fp?.template0) throw new BioStarError('The reader did not return a fingerprint (no finger, or it timed out)', 408, null);
    return { template: fp.template0, quality: fp.enroll_quality ?? fp.quality ?? null };
  };
  await say('Place a finger on the reader');
  const first = await scan();
  await say('Checking this finger is not already registered');
  let duplicate = null;
  try {
    const hit = await BS.call('POST', '/api/server_matching/identify_finger', { template: first.template });
    duplicate = hit?.User?.user_id ?? hit?.user_id?.user_id ?? hit?.user_id ?? 'unknown';
  } catch { duplicate = null; } // Suprema: "Failed to identify fingerprint" means it is free.
  if (duplicate) {
    await say('This finger is already registered', false);
    return { ok: false, error: 'This finger is already registered to another BioStar user', result: { code: 'DUPLICATE', duplicateUserId: String(duplicate) } };
  }
  await say('Place the same finger again');
  const second = await scan();
  await say('Checking both scans match');
  const match = await BS.call('POST', `/api/devices/${encodeURIComponent(p.deviceId)}/verify_fingerprint`, { template0: first.template, template1: second.template, security_level: 0 });
  const r = match?.result;
  const same = r === true || r === 'true' || (r === undefined && String(match?.Response?.code ?? '') === '0');
  if (!same) {
    await say('The two scans did not match', false);
    return { ok: false, error: 'The two scans did not match. Try again with the same finger.', result: { code: 'NO_MATCH' } };
  }
  await BS.call('PUT', `/api/users/${encodeURIComponent(p.userId)}`, { User: { fingerprint_templates: [{ template0: first.template, template1: second.template, finger_mask: false, isNew: true }] } });
  await say('Fingerprint saved');
  const q = [first.quality, second.quality].map(Number).filter(Number.isFinite);
  return { ok: true, result: { fingers: 1, quality: q.length ? Math.min(...q) : null } };
}

async function deleteFingerprints(p) {
  const u = await BS.getUser(p.userId);
  if (!u) return { user: 'absent' };
  if (!BS.ours(u)) throw new BioStarError(`BioStar user_id ${p.userId} was not made by Tcheck; refusing to change it`, 409, null);
  await BS.call('PUT', `/api/users/${encodeURIComponent(p.userId)}`, { User: { fingerprint_templates: [] } });
  return { fingers: 0 };
}

// ─── Jobs ────────────────────────────────────────────────────────────────────────────────────────

async function selfTest(p) {
  const steps = [];
  const step = async (name, fn) => {
    try { const detail = await fn(); steps.push({ step: name, ok: true, detail: detail ?? null }); return true; } catch (e) { steps.push({ step: name, ok: false, detail: e.message }); return false; }
  };
  await step('Sign in to BioStar', async () => { await BS.login(); return 'bs-session-id received'; });
  await step('Check the BioStar server', async () => {
    const c = await BS.serverCheck();
    const off = c.readers.filter((r) => r.qrOn === false).length;
    const time = c.eventClockOffsetMinutes == null ? 'no recent scans to judge times by (checked below)' : c.eventClockOffsetMinutes === 0 ? 'scan times are UTC' : `scan times run ${c.eventClockOffsetMinutes} min ahead of UTC (Tcheck adjusts)`;
    return `${c.platform ?? 'BioStar'} ${c.version ?? '(version not reported)'}; ${c.readers.length} QR reader(s)${off ? `, ${off} with QR reading OFF` : ''}; ${time}`;
  });
  await step('Read access groups', async () => {
    const inv = await BS.inventory();
    const found = p.accessGroupId ? inv.accessGroups.find((g) => g.id === String(p.accessGroupId)) : null;
    if (p.accessGroupId && !found) throw new Error(`Visitor access group ${p.accessGroupId} not found (${inv.accessGroups.length} groups visible)`);
    return `${inv.accessGroups.length} access groups, ${inv.devices.length} devices${found ? `; visitor group "${found.name}"` : ''}`;
  });
  await step('Check Tcheck\'s user_id range is free', async () => {
    const next = await BS.nextUserId();
    if (next === null) return 'next_user_id not available on this BioStar version; relying on the department guard';
    if (next > Number(p.userId)) throw new Error(`BioStar already uses user_ids up to ${next - 1}; Tcheck's range starts at ${p.userId}. Ask Tcheck to move the range.`);
    return `BioStar's next free id is ${next}; Tcheck uses ${p.userId} and up`;
  });
  await step('Read doors and their readers', async () => {
    const inv = await BS.inventory();
    const qr = inv.devices.filter((d) => d.readsQr).length; const finger = inv.devices.filter((d) => d.readsFinger).length;
    return `${inv.doors.length} door(s); ${inv.devices.length} device(s): ${qr} read QR, ${finger} read fingerprints`;
  });
  await step('Read door status', async () => `${(await BS.doorStates()).length} door(s) reported`);
  await step('Read card types', async () => `QR type ${p.card.type} → allocation ${await BS.cardTypeFor(p.card.type)}; CSN → ${await BS.cardTypeFor(0)}`);
  const created = await step('Create a test visitor user', () => BS.upsertUser(p));
  let cardId = null;
  if (created) await step(`Register a QR card (type ${p.card.type})`, async () => { cardId = await BS.createCard(p.card, p.userId); return `card ${cardId}, body shape "${BS.cardShape}"`; });
  if (cardId) await step('Assign the QR to the user', () => BS.assignCard(p.userId, cardId).then(() => 'assigned'));
  if (created) await step('Read the user back', async () => {
    const u = await BS.getUser(p.userId);
    if (!u) throw new Error('user not found after creating it');
    const cards = Array.isArray(u.cards) ? u.cards.length : 0;
    return `${u.name ?? p.userId}, ${cards} card(s)`;
  });
  // How does this BioStar read the times Tcheck sends? Ask BioStar itself: give the test user an expiry
  // half the school's UTC offset away and read BioStar's own `expired` verdict.
  let timeProbe = null;
  const off = Number(p.probeOffsetMinutes);
  if (created && Number.isFinite(off) && off !== 0) await step('Check how BioStar reads times', async () => {
    const raw = (ms) => `${new Date(ms).toISOString().slice(0, 19)}.00Z`; // unshifted on purpose
    const now = Date.now();
    const expiry = off > 0 ? now + (off / 2) * 60_000 : now - (Math.abs(off) / 2) * 60_000;
    await BS.call('PUT', `/api/users/${encodeURIComponent(p.userId)}`, { User: { start_datetime: raw(now - 2 * 86_400_000), expiry_datetime: raw(expiry) } });
    const u = await BS.getUser(p.userId);
    if (u?.expired == null) { timeProbe = { offsetMinutes: off, interpretsAsLocal: null }; return 'this BioStar does not report "expired"; the lane test will settle it'; }
    const expired = String(u.expired) === 'true';
    const local = off > 0 ? expired : !expired;
    timeProbe = { offsetMinutes: off, interpretsAsLocal: local };
    return local ? `BioStar reads times as local time (UTC${off > 0 ? '+' : '−'}${Math.abs(off) / 60}); Tcheck will adjust every time it sends` : 'BioStar reads times as UTC';
  });
  if (created) await step('Revoke (disable, expire, leave groups, release card)', () => BS.revoke({ userId: p.userId }).then((r) => r.user));
  if (created) await step('Remove the test user', async () => {
    await BS.call('DELETE', `/api/users?id=${encodeURIComponent(p.userId)}`).catch(async () => BS.call('DELETE', `/api/users/${encodeURIComponent(p.userId)}`));
    return 'removed';
  }).catch(() => null);
  const failed = steps.filter((s) => !s.ok && s.step !== 'Remove the test user');
  return { ok: failed.length === 0, steps, cardShape: BS.cardShape, timeProbe, error: failed[0] ? `${failed[0].step}: ${failed[0].detail}` : undefined };
}

async function runJob(job) {
  const p = job.payload ?? {};
  // Tcheck puts the time shift on every job, so a change reaches BioStar before the next heartbeat.
  if (p.timeShiftMinutes != null) BS.setShiftMinutes(p.timeShiftMinutes);
  const t0 = Date.now();
  const timed = (r) => ({ ...r, result: { ...(r.result ?? {}), biostarMs: Date.now() - t0 } });
  switch (job.kind) {
    case 'SYNC_IDENTITY': return timed({ ok: true, result: await BS.applyState(p) });
    case 'OPEN_DOOR': return timed({ ok: true, result: await BS.openDoor(p.doorId) });
    case 'ENROLL_FINGERPRINT': return timed(await enrolFingerprint(job));
    case 'DELETE_BIOMETRIC': return timed({ ok: true, result: await deleteFingerprints(p) });
    case 'RECONCILE': return { ok: true, result: { users: await BS.tcheckUsers() } };
    case 'GRANT_VISITOR': case 'GRANT_WALKIN': case 'GRANT_DELEGATE': return { ok: true, result: await BS.grant(p) };
    case 'REVOKE': return { ok: true, result: await BS.revoke(p) };
    case 'SELF_TEST': { const r = await selfTest(p); return { ok: r.ok, error: r.error, result: { steps: r.steps, cardShape: r.cardShape, timeProbe: r.timeProbe } }; }
    default: return { ok: false, error: `Unknown job kind ${job.kind}` };
  }
}

async function pollJobs(waitMs = 0) {
  const { jobs } = await tcheck('/jobs/claim', { limit: 20, waitMs });
  for (const job of jobs) {
    let outcome;
    try { outcome = await runJob(job); } catch (e) { outcome = { ok: false, error: e.message, result: e.body ? { biostar: e.body } : undefined }; }
    log(outcome.ok ? 'info' : 'warn', `job ${job.kind} ${outcome.ok ? 'done' : 'failed'}`, { id: job.id, error: outcome.error });
    await tcheck(`/jobs/${job.id}/result`, outcome).catch((e) => log('error', 'could not report job result', { id: job.id, error: e.message }));
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────────────────────────

const pending = [];
const toEvent = (ev) => ({
  id: String(ev.id ?? `${ev.device_id?.id}-${ev.index}-${ev.datetime}`), datetime: BS.fromBs(ev.datetime ?? ev.server_datetime) ?? ev.datetime ?? ev.server_datetime,
  deviceId: ev.device_id?.id != null ? String(ev.device_id.id) : null,
  userId: ev.user_id?.user_id != null ? String(ev.user_id.user_id) : (ev.user_id?.id != null ? String(ev.user_id.id) : null),
  eventCode: ev.event_type_id?.code != null ? String(ev.event_type_id.code) : null, eventName: ev.event_type_id?.name ?? null,
  doorId: ev.door_id?.id != null ? String(ev.door_id.id) : (Array.isArray(ev.door_id) && ev.door_id[0]?.id != null ? String(ev.door_id[0].id) : null),
  cardId: ev.card_id != null ? String(ev.card_id?.card_id ?? ev.card_id) : null,
});

async function flushEvents() {
  while (pending.length) {
    const batch = pending.splice(0, 200);
    try { const r = await tcheck('/events', { events: batch }); log('info', `forwarded ${batch.length} event(s)`, r.counts); } catch (e) { pending.unshift(...batch); throw e; }
  }
}

// A scan at a flap barrier reaches Tcheck within ~150 ms (several scans at once go in one batch).
let flushTimer = null;
function flushSoon() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flushEvents().catch((e) => log('warn', 'event forward failed; will retry', { error: e.message })); }, 150);
}

let lastEventAt = null;
async function catchUp() {
  // From the last event Tcheck has (minus a minute of overlap; Tcheck drops duplicates) to now.
  const from = new Date((lastEventAt ? new Date(lastEventAt).getTime() : Date.now() - 10 * 60_000) - 60_000).toISOString();
  const rows = await BS.searchEvents(from, new Date().toISOString());
  for (const r of rows) pending.push(toEvent(r));
}

let socket = null;
async function connectEvents() {
  if (socket && socket.readyState <= 1) return;
  await BS.login();
  const url = `${CFG.biostar.replace(/^http/, 'ws')}/wsapi`;
  socket = new WebSocket(url);
  socket.addEventListener('open', async () => {
    socket.send(`bs-session-id=${BS.session}`);
    try { await BS.call('POST', '/api/events/start', {}); log('info', 'live BioStar events on'); } catch (e) { log('error', 'events/start failed', { error: e.message }); socket.close(); }
  });
  socket.addEventListener('message', (m) => {
    let data; try { data = JSON.parse(String(m.data)); } catch { return; }
    if (data?.Event) { pending.push(toEvent(data.Event)); flushSoon(); }
  });
  socket.addEventListener('close', () => { log('warn', 'BioStar event stream closed; reconnecting'); socket = null; });
  socket.addEventListener('error', (e) => log('error', 'BioStar event stream error', { error: e.message ?? 'socket error' }));
}

// ─── Main loop ───────────────────────────────────────────────────────────────────────────────────

async function heartbeat(withInventory) {
  const inventory = withInventory ? await BS.inventory().catch((e) => { log('warn', 'inventory failed', { error: e.message }); return undefined; }) : undefined;
  let biostarVersion;
  if (inventory) {
    const server = await BS.serverCheck(inventory.devices).catch(() => null);
    if (server) {
      inventory.server = server;
      biostarVersion = server.version ?? undefined;
      const qr = new Map(server.readers.map((r) => [r.id, r.qrOn]));
      inventory.devices = inventory.devices.map((d) => (qr.has(d.id) ? { ...d, qrEnabled: qr.get(d.id) } : d));
    }
  }
  const cfg = await tcheck('/heartbeat', { agentVersion: VERSION, biostarVersion, inventory, clock: new Date().toISOString() });
  if (cfg.timeShiftMinutes != null) BS.setShiftMinutes(cfg.timeShiftMinutes);
  if (cfg.updateRequired) log('warn', `Tcheck needs connector ${cfg.minConnectorVersion} or newer; this is ${VERSION}`);
  lastEventAt = cfg.lastEventAt ?? lastEventAt;
  return cfg;
}

async function main() {
  for (const k of ['tcheck', 'token', 'biostar', 'login', 'password']) if (!CFG[k]) { log('error', `missing configuration: ${k}`); process.exit(2); }
  log('info', `Tcheck BioStar connector ${VERSION} starting`, { tcheck: CFG.tcheck, biostar: CFG.biostar });
  if (process.argv.includes('--once')) {
    await heartbeat(true); await connectEvents(); await catchUp(); await pollJobs(0); await flushEvents(); socket?.close(); return;
  }
  // Independent loops, so a long-poll for jobs never holds up forwarding a scan.
  const loop = async (name, everyMs, fn) => {
    let backoff = 1000;
    for (;;) {
      try { await fn(); backoff = 1000; await sleep(everyMs); } catch (e) { log('error', `${name}: ${e.message}`); await sleep(backoff); backoff = Math.min(backoff * 2, 60_000); }
    }
  };
  let lastInventory = 0;
  await heartbeat(true).catch((e) => log('error', `first heartbeat: ${e.message}`));
  lastInventory = Date.now();
  loop('heartbeat', CFG.heartbeatEveryMs, async () => { const inv = Date.now() - lastInventory > CFG.inventoryEveryMs; await heartbeat(inv); if (inv) lastInventory = Date.now(); });
  loop('jobs', CFG.jobWaitMs > 0 ? 0 : CFG.jobEveryMs, () => pollJobs(CFG.jobWaitMs));
  loop('events', 1000, async () => { await connectEvents(); await flushEvents(); });
  loop('catch-up', CFG.catchUpEveryMs, catchUp);
  loop('door-states', CFG.doorStateEveryMs, async () => {
    const states = await BS.doorStates();
    const changed = states.filter((st) => lastDoorStates.get(st.doorId) !== `${st.state}|${st.online}`);
    if (!changed.length) return;
    await tcheck('/door-states', { states: changed });
    for (const st of changed) lastDoorStates.set(st.doorId, `${st.state}|${st.online}`);
  });
}
const lastDoorStates = new Map();

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
export { BS, toEvent, runJob, selfTest, CFG, deviceInfo, enrolFingerprint };
