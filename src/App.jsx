import { useState, useEffect, useCallback } from "react";

// ============================================================
//  🔧 SUPABASE SETUP — 3 steps to go live:
//
//  1. Create a free project at https://supabase.com
//  2. Go to SQL Editor and run the schema in the comments below
//  3. Replace SUPABASE_URL and SUPABASE_ANON_KEY with your
//     values from Project Settings → API
// ============================================================

const SUPABASE_URL = "https://ldkhkaegucsgowkicrnc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CiAPRR1pxbqqksrvbz7HwQ_X9t207wm";

// ============================================================
//  📋 SQL SCHEMA — paste into Supabase SQL Editor and Run
//
//  create table venues (
//    id uuid primary key default gen_random_uuid(),
//    name text not null,
//    type text not null,
//    neighborhood text not null,
//    address text,
//    created_at timestamptz default now()
//  );
//
//  create table wait_reports (
//    id uuid primary key default gen_random_uuid(),
//    venue_id uuid references venues(id) on delete cascade,
//    wait_minutes int not null,
//    reported_at timestamptz default now()
//  );
//
//  create or replace view venue_wait_times as
//  select
//    v.id, v.name, v.type, v.neighborhood,
//    (select wait_minutes from wait_reports w
//     where w.venue_id = v.id
//       and w.reported_at > now() - interval '30 minutes'
//     order by w.reported_at desc limit 1
//    ) as current_wait,
//    (select count(*) from wait_reports w
//     where w.venue_id = v.id
//       and w.reported_at > now() - interval '30 minutes'
//    ) as recent_reports,
//    (select reported_at from wait_reports w
//     where w.venue_id = v.id
//     order by w.reported_at desc limit 1
//    ) as last_reported_at
//  from venues v;
//
//  insert into venues (name, type, neighborhood) values
//    ('BerryLine', 'Dessert', 'Cambridge'),
//    ('Felipe''s Taqueria', 'Bar', 'Cambridge'),
//    ('The Dubliner', 'Bar', 'Downtown'),
//    ('The Beehive', 'Bar', 'South End'),
//    ('Kartal', 'Bar', 'South End'),
//    ('Lucky''s Lounge', 'Bar', 'Seaport'),
//    ('Borrachito', 'Bar', 'Seaport'),
//    ('Cisco Brewers', 'Bar', 'Seaport'),
//    ('Layla''s American Tavern', 'Bar', 'South Boston'),
//    ('Clock Tavern', 'Bar', 'South Boston'),
//    ('Lincoln Tavern', 'Bar', 'South Boston'),
//    ('Capo', 'Bar', 'South Boston'),
//    ('Loco Taqueria', 'Bar', 'South Boston'),
//    ('Hunter''s Kitchen', 'Bar', 'South Boston'),
//    ('The Broadway', 'Bar', 'South Boston'),
//    ('The Playwright', 'Bar', 'South Boston'),
//    ('Park City Southie', 'Bar', 'South Boston'),
//    ('Tom''s English Cottage', 'Bar', 'South Boston');
//
//  alter table venues enable row level security;
//  alter table wait_reports enable row level security;
//  create policy "Public read venues" on venues for select using (true);
//  create policy "Public read reports" on wait_reports for select using (true);
//  create policy "Public insert reports" on wait_reports for insert with check (true);
//  alter publication supabase_realtime add table wait_reports;
// ============================================================

const isConfigured = !SUPABASE_URL.includes("YOUR_PROJECT");

// Lightweight Supabase client
const supabase = (() => {
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const from = (table) => ({
    select: async (columns = "*", opts = {}) => {
      let url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns}`;
      if (opts.order) url += `&order=${opts.order}`;
      const res = await fetch(url, { headers });
      return res.json();
    },
    insert: async (data) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
  });
  const channel = () => ({
    on: (_e, _f, cb) => ({
      subscribe: () => {
        try {
          const ws = new WebSocket(
            SUPABASE_URL.replace("https://", "wss://") +
            "/realtime/v1/websocket?apikey=" + SUPABASE_ANON_KEY
          );
          ws.onopen = () => ws.send(JSON.stringify({
            topic: "realtime:public:wait_reports",
            event: "phx_join",
            payload: { config: { postgres_changes: [{ event: "*", schema: "public", table: "wait_reports" }] } },
            ref: "1"
          }));
          ws.onmessage = (msg) => {
            try { const p = JSON.parse(msg.data); if (p.event === "postgres_changes") cb(p); } catch {}
          };
          return { unsubscribe: () => ws.close() };
        } catch { return { unsubscribe: () => {} }; }
      }
    })
  });
  return { from, channel };
})();

// Fallback demo data
const FALLBACK = [
  { id: "1", name: "Layla's American Tavern", type: "Bar", neighborhood: "South Boston", current_wait: 25, recent_reports: 8, last_reported_at: new Date(Date.now() - 4 * 60000).toISOString() },
  { id: "2", name: "BerryLine", type: "Dessert", neighborhood: "Cambridge", current_wait: 0, recent_reports: 14, last_reported_at: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: "3", name: "Lucky's Lounge", type: "Bar", neighborhood: "Seaport", current_wait: 40, recent_reports: 5, last_reported_at: new Date(Date.now() - 8 * 60000).toISOString() },
  { id: "4", name: "Lincoln Tavern", type: "Bar", neighborhood: "South Boston", current_wait: 55, recent_reports: 22, last_reported_at: new Date(Date.now() - 1 * 60000).toISOString() },
  { id: "5", name: "The Beehive", type: "Bar", neighborhood: "South End", current_wait: 15, recent_reports: 9, last_reported_at: new Date(Date.now() - 6 * 60000).toISOString() },
  { id: "6", name: "Cisco Brewers", type: "Bar", neighborhood: "Seaport", current_wait: 30, recent_reports: 18, last_reported_at: new Date(Date.now() - 3 * 60000).toISOString() },
  { id: "7", name: "Capo", type: "Bar", neighborhood: "South Boston", current_wait: 10, recent_reports: 6, last_reported_at: new Date(Date.now() - 11 * 60000).toISOString() },
  { id: "8", name: "Felipe's Taqueria", type: "Bar", neighborhood: "Cambridge", current_wait: 5, recent_reports: 4, last_reported_at: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: "9", name: "The Dubliner", type: "Bar", neighborhood: "Downtown", current_wait: 20, recent_reports: 7, last_reported_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: "10", name: "Borrachito", type: "Bar", neighborhood: "Seaport", current_wait: null, recent_reports: 0, last_reported_at: null },
  { id: "11", name: "Clock Tavern", type: "Bar", neighborhood: "South Boston", current_wait: 15, recent_reports: 5, last_reported_at: new Date(Date.now() - 9 * 60000).toISOString() },
  { id: "12", name: "Loco Taqueria", type: "Bar", neighborhood: "South Boston", current_wait: 35, recent_reports: 11, last_reported_at: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: "13", name: "Kartal", type: "Bar", neighborhood: "South End", current_wait: null, recent_reports: 0, last_reported_at: null },
  { id: "14", name: "The Broadway", type: "Bar", neighborhood: "South Boston", current_wait: 20, recent_reports: 8, last_reported_at: new Date(Date.now() - 7 * 60000).toISOString() },
  { id: "15", name: "Hunter's Kitchen", type: "Bar", neighborhood: "South Boston", current_wait: 0, recent_reports: 3, last_reported_at: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: "16", name: "Tom's English Cottage", type: "Bar", neighborhood: "South Boston", current_wait: 0, recent_reports: 2, last_reported_at: new Date(Date.now() - 20 * 60000).toISOString() },
  { id: "17", name: "The Playwright", type: "Bar", neighborhood: "South Boston", current_wait: 10, recent_reports: 4, last_reported_at: new Date(Date.now() - 14 * 60000).toISOString() },
  { id: "18", name: "Park City Southie", type: "Bar", neighborhood: "South Boston", current_wait: 45, recent_reports: 13, last_reported_at: new Date(Date.now() - 3 * 60000).toISOString() },
];

// Helpers
const waitColor = (w) => w == null ? "#c4bfb8" : w === 0 ? "#16a34a" : w <= 15 ? "#ca8a04" : w <= 30 ? "#ea580c" : "#dc2626";
const waitBg   = (w) => w == null ? "#f0ede9" : w === 0 ? "#dcfce7" : w <= 15 ? "#fef9c3" : w <= 30 ? "#ffedd5" : "#fee2e2";
const waitText = (w) => w == null ? "No data" : w === 0 ? "No wait" : `~${w} min`;

const timeAgo = (ts) => {
  if (!ts) return null;
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

const NEIGHBORHOODS = ["All", "South Boston", "South End", "Cambridge", "Seaport", "Downtown"];
const CATEGORIES    = ["All", "Bars", "Dessert"];

// ── Report Modal ─────────────────────────────────────────────
function ReportModal({ venue, onClose, onSubmit, submitting }) {
  const [selected, setSelected] = useState(null);
  const opts = [
  { label: "No wait", value: 0 },
  { label: "~5 min",  value: 5 },
  { label: "~10 min", value: 10 },
  { label: "~15 min", value: 15 },
  { label: "~20 min", value: 20 },
  { label: "~25 min", value: 25 },
  { label: "~30 min", value: 30 },
  { label: "~35 min", value: 35 },
  { label: "~40 min", value: 40 },
  { label: "45+ min", value: 45 },
];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#faf9f7", borderRadius: "24px 24px 0 0",
        padding: "10px 22px 44px", width: "100%", maxWidth: 460,
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
        animation: "slideUp 0.25s ease"
      }}>
        <div style={{ width: 36, height: 4, background: "#dedad4", borderRadius: 2, margin: "10px auto 22px" }} />
        <div style={{ fontSize: 12, color: "#b5b0a8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
          Report wait time
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>{venue.name}</div>
        {venue.current_wait != null && (
          <div style={{ fontSize: 13, color: "#8a8680", background: "#f0ede9", borderRadius: 10, padding: "8px 12px", marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
            <span>Current estimate:</span>
            <strong style={{ color: waitColor(venue.current_wait) }}>
              {waitText(venue.current_wait)}
              {venue.last_reported_at && <span style={{ fontWeight: 400, color: "#b5b0a8" }}> · {timeAgo(venue.last_reported_at)}</span>}
            </strong>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          {opts.map(o => (
            <button key={o.value} onClick={() => setSelected(o.value)} style={{
              padding: "14px", borderRadius: 14,
              border: selected === o.value ? "2px solid #1a1a1a" : "1.5px solid #dedad4",
              background: selected === o.value ? "#1a1a1a" : "#fff",
              color: selected === o.value ? "#fff" : "#4a4642",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "all 0.12s"
            }}>{o.label}</button>
          ))}
        </div>
        <button
          onClick={() => selected !== null && !submitting && onSubmit(venue.id, selected)}
          style={{
            width: "100%", padding: "16px", borderRadius: 16, border: "none",
            background: selected !== null ? "#1a1a1a" : "#ebe8e3",
            color: selected !== null ? "#fff" : "#b5b0a8",
            fontSize: 15, fontWeight: 700,
            cursor: selected !== null && !submitting ? "pointer" : "default",
            fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s"
          }}>
          {submitting ? "Submitting..." : "Submit Report"}
        </button>
        <button onClick={onClose} style={{
          width: "100%", marginTop: 10, padding: "12px", border: "none",
          background: "transparent", color: "#b5b0a8", fontSize: 14,
          cursor: "pointer", fontFamily: "'DM Sans', sans-serif"
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Venue Card ───────────────────────────────────────────────
function VenueCard({ venue, onReport, index }) {
  const w = venue.current_wait;
  return (
    <div className="dark-card" style={{
      background: "#fff", borderRadius: 18, padding: "16px 18px",
      marginBottom: 10, border: "1.5px solid #ebe8e3",
      animation: `fadeUp 0.25s ease ${index * 0.035}s both`,
      transition: "all 0.15s ease", cursor: "default",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    ><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      
        {/* Left */}
        <div style={{ flex: 1, paddingRight: 12, textAlign: "left" }}>
          <div style={{ fontSize: 10, color: "#b5b0a8", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 }}>
            {venue.neighborhood} · {venue.type}
            </div>
            <div className="dark-name" style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 5, lineHeight: 1.2 }}>
              {venue.name}
</div>
          <div style={{ fontSize: 12, color: "#c4bfb8", display: "flex", alignItems: "center", gap: 5 }}>
            {venue.recent_reports > 0
              ? <><span>{venue.recent_reports} report{venue.recent_reports !== 1 ? "s" : ""}</span><span>·</span><span>{timeAgo(venue.last_reported_at)}</span></>
              : <span>No recent reports</span>
            }
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{
            background: waitBg(w), color: waitColor(w),
            padding: "6px 14px", borderRadius: 10,
            fontSize: 14, fontWeight: 800, minWidth: 86, textAlign: "center"
          }}>
            {waitText(w)}
          </div>
          <button
            onClick={() => onReport(venue)}
            style={{
              padding: "5px 12px", borderRadius: 8,
              border: "1.5px solid #ebe8e3", background: "#fff",
              color: "#8a8680", fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.12s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#faf9f7"; e.currentTarget.style.borderColor = "#dedad4"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#ebe8e3"; }}
          >
            + Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Setup Banner ─────────────────────────────────────────────
function SetupBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, padding: "11px 16px", margin: "12px 0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>⚡ Demo mode — Supabase not connected</span>
        <button onClick={() => setOpen(!open)} style={{ fontSize: 12, color: "#d97706", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
          {open ? "Hide" : "How to connect →"}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#78350f", lineHeight: 1.8 }}>
          1. Create a free project at <b>supabase.com</b><br />
          2. Run the SQL schema in the code comments<br />
          3. Replace <b>SUPABASE_URL</b> + <b>SUPABASE_ANON_KEY</b> at the top of this file
        </div>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [venues, setVenues]     = useState(FALLBACK);
  const [loading, setLoading]   = useState(isConfigured);
  const [hood, setHood]         = useState("All");
  const [cat, setCat]           = useState("All");
  const [q, setQ]               = useState("");
  const [reporting, setReporting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]       = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Fetch from Supabase
  const fetchVenues = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const data = await supabase.from("venue_wait_times").select("*", { order: "name.asc" });
      if (Array.isArray(data) && data.length > 0) setVenues(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchVenues(); }, [fetchVenues]);

  // Realtime
  useEffect(() => {
    if (!isConfigured) return;
    const sub = supabase.channel().on("*", { table: "wait_reports" }, () => fetchVenues()).subscribe();
    return () => sub.unsubscribe();
  }, [fetchVenues]);

  // Submit report
  const handleSubmit = async (venueId, waitMinutes) => {
    setSubmitting(true);
    if (isConfigured) {
      try {
        await supabase.from("wait_reports").insert({ venue_id: venueId, wait_minutes: waitMinutes });
        await fetchVenues();
      } catch (e) { console.error(e); }
    } else {
      setVenues(prev => prev.map(v => v.id === venueId
        ? { ...v, current_wait: waitMinutes, recent_reports: (v.recent_reports || 0) + 1, last_reported_at: new Date().toISOString() }
        : v
      ));
    }
    setSubmitting(false);
    setReporting(null);
    showToast("Thanks! Wait time updated 🙌");
  };

  // Filter + sort
  const filtered = venues
    .filter(v => !q || v.name.toLowerCase().includes(q.toLowerCase()) || v.neighborhood.toLowerCase().includes(q.toLowerCase()))
    .filter(v => hood === "All" || v.neighborhood === hood)
    .filter(v => cat === "All" || (cat === "Bars" ? v.type === "Bar" : v.type === "Dessert"))
    .sort((a, b) => {
      if (a.current_wait == null && b.current_wait == null) return 0;
      if (a.current_wait == null) return 1;
      if (b.current_wait == null) return -1;
      return a.current_wait - b.current_wait;
    });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #faf9f7; margin: 0; min-height: 100vh; }
        html { background: #faf9f7; }
        ::-webkit-scrollbar { display: none; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(6px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input:focus { outline: none; }
        @media (prefers-color-scheme: dark) {
        body, html { background: #1a1814 !important; }
        .dark-header { background: #1a1814 !important; border-bottom-color: #2e2b26 !important; }
        .dark-card { background: #232018 !important; border-color: #2e2b26 !important; }
        .dark-input { background: #232018 !important; border-color: #2e2b26 !important; color: #f0ede9 !important; }
        .dark-pill-inactive { background: #232018 !important; border-color: #2e2b26 !important; color: #8a8680 !important; }
        .dark-name { color: #f0ede9 !important; }
        .dark-logo { color: #f0ede9 !important; }
      }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#faf9f7", fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Sticky Header ── */}
        <div className="dark-header" style={{
          background: "#faf9f7", borderBottom: "1.5px solid #ebe8e3",
          padding: "20px 22px 0", position: "sticky", top: 0, zIndex: 50,
          }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>

            {/* Logo row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span className="dark-logo" style={{ fontSize: 30, fontWeight: 800, color: "#1a1a1a", letterSpacing: -1 }}>Line</span>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#e63939", letterSpacing: -1 }}>UP</span>
                <span className="dark-logo" style={{ fontSize: 30, fontWeight: 800, color: "#1a1a1a", letterSpacing: -1 }}>&nbsp;Boston</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {loading
                  ? <div style={{ width: 13, height: 13, border: "2px solid #dedad4", borderTop: "2px solid #8a8680", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  : <>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e63939", animation: "pulse 2s infinite" }} />
                      <span style={{ fontSize: 12, color: "#e63939", fontWeight: 600, letterSpacing: 0.3 }}>live</span>
                    </>
                }
              </div>
            </div>

            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>🔍</span>
              <input
              className="dark-input"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search a bar or neighborhood..."
                style={{
                  width: "100%", padding: "11px 36px 11px 38px",
                  border: "1.5px solid #ebe8e3", borderRadius: 14,
                  fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                  background: "#fff", color: "#1a1a1a",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "border-color 0.15s"
                }}
                onFocus={e => e.target.style.borderColor = "#c4bfb8"}
                onBlur={e => e.target.style.borderColor = "#ebe8e3"}
              />
              {q && (
                <button onClick={() => setQ("")} style={{
                  position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)",
                  background: "#dedad4", border: "none", borderRadius: "50%",
                  width: 20, height: 20, cursor: "pointer", fontSize: 10, color: "#8a8680",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>✕</button>
              )}
            </div>

            {/* Neighborhood pills */}
            <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10 }}>
              {NEIGHBORHOODS.map(n => (
                <button key={n} onClick={() => setHood(n)} style={{
                  whiteSpace: "nowrap", padding: "7px 15px", borderRadius: 999,
                  border: "1.5px solid", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                  borderColor: hood === n ? "#1a1a1a" : "#ebe8e3",
                  background: hood === n ? "#1a1a1a" : "#fff",
                  color: hood === n ? "#fff" : "#8a8680",
                }}>{n}</button>
              ))}
            </div>

            {/* Category pills */}
            <div style={{ display: "flex", gap: 7, paddingBottom: 14 }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCat(c)} style={{
                  whiteSpace: "nowrap", padding: "6px 15px", borderRadius: 999,
                  border: "1.5px solid", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                  borderColor: cat === c ? "#e63939" : "#ebe8e3",
                  background: cat === c ? "#fef2f2" : "#fff",
                  color: cat === c ? "#e63939" : "#8a8680",
                }}>{c}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "12px 22px 100px" }}>

          {/* Setup banner */}
          {!isConfigured && <SetupBanner />}

          {/* Results count */}
          {!loading && (
            <div style={{ fontSize: 12, color: "#c4bfb8", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", margin: "10px 0 12px" }}>
              {filtered.length} spot{filtered.length !== 1 ? "s" : ""}
              {q && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}> for "{q}"</span>}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#c4bfb8", fontSize: 14 }}>Loading...</div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#c4bfb8", fontSize: 14 }}>No spots found</div>
          )}

          {/* Venue cards */}
          {!loading && filtered.map((v, i) => (
            <VenueCard key={v.id} venue={v} onReport={setReporting} index={i} />
          ))}
        </div>

        {/* ── FAB ── */}
        <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 40 }}>
          <button
            onClick={() => alert("GPS auto-detect coming soon!")}
            style={{
              padding: "13px 30px", borderRadius: 999,
              background: "#1a1a1a", border: "none",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)", whiteSpace: "nowrap",
              transition: "transform 0.15s"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            📍 I'm in line
          </button>
        </div>

        {/* ── Report Modal ── */}
        {reporting && (
          <ReportModal
            venue={reporting}
            onClose={() => setReporting(null)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}

        {/* ── Toast ── */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 86, left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a1a", color: "#fff",
            padding: "10px 20px", borderRadius: 12,
            fontSize: 13, fontWeight: 600,
            animation: "toastIn 0.2s ease",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)"
          }}>{toast}</div>
        )}
      </div>
    </>
  );
}