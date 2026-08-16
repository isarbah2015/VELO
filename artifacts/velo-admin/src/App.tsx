import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import {
  collection, doc, getDoc, onSnapshot, query, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from './firebase';

// ─── Types (loose — Firestore docs) ──────────────────────────────────────────
type AnyDoc = Record<string, any> & { id: string };
type Section = 'dashboard' | 'drivers' | 'trips' | 'disputes';

// ─── Auth gate ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (u) {
      try {
        const snap = await getDoc(doc(db, 'admins', u.uid));
        setIsAdmin(snap.exists());
      } catch { setIsAdmin(false); }
    } else {
      setIsAdmin(null);
    }
    setChecking(false);
  }), []);

  if (checking) return <div className="center"><span className="hint">Loading…</span></div>;
  if (!user) return <Login />;
  if (!isAdmin) return <NotAuthorized email={user.email ?? ''} />;
  return <Shell />;
}

function Brand() {
  return (
    <div className="brand-row">
      <div className="brand-mark">V</div>
      <div className="brand-name"><span>VELO</span> Admin</div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), pass); }
    catch { setErr('Wrong email or password.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="center">
      <form className="login-card" onSubmit={submit}>
        <Brand />
        <input className="input" type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy || !email || !pass}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="hint">Admin access only. Your account must be listed in the <code>admins</code> collection.</div>
      </form>
    </div>
  );
}

function NotAuthorized({ email }: { email: string }) {
  return (
    <div className="center">
      <div className="login-card">
        <Brand />
        <div className="err">This account isn’t an admin.</div>
        <div className="hint">{email} is signed in but not in the <code>admins</code> collection. Add a doc at <code>admins/&lt;your-uid&gt;</code> to grant access.</div>
        <button className="btn btn-ghost" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </div>
  );
}

// ─── Shell + navigation ──────────────────────────────────────────────────────
function Shell() {
  const [section, setSection] = useState<Section>('dashboard');
  const drivers = useCollection('drivers');
  const disputes = useQueryDocs(query(collection(db, 'disputes'), where('status', '==', 'open')));
  const pendingCount = drivers.filter((d) => d.verification?.status === 'pending').length;

  const nav: { id: Section; label: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'drivers', label: 'Drivers', badge: pendingCount || undefined },
    { id: 'trips', label: 'Live trips' },
    { id: 'disputes', label: 'Disputes', badge: disputes.length || undefined },
  ];

  return (
    <div className="shell">
      <aside className="side">
        <Brand />
        {nav.map((n) => (
          <button key={n.id} className={`nav-item ${section === n.id ? 'active' : ''}`} onClick={() => setSection(n.id)}>
            {n.label}{n.badge ? <span className="badge">{n.badge}</span> : null}
          </button>
        ))}
        <div className="side-foot">
          <button className="nav-item" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        {section === 'dashboard' && <Dashboard drivers={drivers} />}
        {section === 'drivers' && <Drivers drivers={drivers} />}
        {section === 'trips' && <Trips />}
        {section === 'disputes' && <Disputes />}
      </main>
    </div>
  );
}

// ─── Live Firestore hooks ────────────────────────────────────────────────────
function useCollection(name: string): AnyDoc[] {
  const [docs, setDocs] = useState<AnyDoc[]>([]);
  useEffect(() => onSnapshot(collection(db, name),
    (s) => setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => setDocs([])), [name]);
  return docs;
}
function useQueryDocs(q: any): AnyDoc[] {
  const [docs, setDocs] = useState<AnyDoc[]>([]);
  useEffect(() => onSnapshot(q,
    (s: any) => setDocs(s.docs.map((d: any) => ({ id: d.id, ...d.data() }))),
    () => setDocs([])), []); // eslint-disable-line react-hooks/exhaustive-deps
  return docs;
}
// Names live on users/{uid}; cache them so tables can show a driver/rider name.
function useNames(): Record<string, string> {
  const users = useCollection('users');
  return useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name ?? '—'])), [users]);
}

// ─── Sections ────────────────────────────────────────────────────────────────
function Dashboard({ drivers }: { drivers: AnyDoc[] }) {
  const rides = useCollection('rides');
  const disputes = useCollection('disputes');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ridesToday = rides.filter((r) => new Date(r.date ?? 0).getTime() >= today.getTime());
  // VELO's flat service fee — keep in sync with services/pricing.ts COMMISSION_RATE.
  const COMMISSION_RATE = 0.10;
  const grossToday = ridesToday.filter((r) => r.status === 'completed').reduce((s, r) => s + (r.price ?? 0), 0);
  // Platform revenue is the commission, NOT the full fare (drivers keep 90%).
  const revenueToday = grossToday * COMMISSION_RATE;
  const live = rides.filter((r) => ['accepted', 'arrived', 'in_progress'].includes(r.status)).length;
  const stats = [
    { label: 'Drivers', value: drivers.length },
    { label: 'Pending approval', value: drivers.filter((d) => d.verification?.status === 'pending').length },
    { label: 'Live trips', value: live },
    { label: 'Open disputes', value: disputes.filter((d) => d.status === 'open').length },
    { label: 'Rides today', value: ridesToday.length },
    { label: 'Revenue today (10% fee)', value: `₵${revenueToday.toFixed(0)}` },
    { label: 'Ride value today (gross)', value: `₵${grossToday.toFixed(0)}` },
    { label: 'Online drivers', value: drivers.filter((d) => d.online).length },
    { label: 'Verified drivers', value: drivers.filter((d) => d.verification?.status === 'verified').length },
  ];
  return (
    <>
      <h1 className="h1">Dashboard</h1>
      <p className="sub">Platform overview · live</p>
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Drivers({ drivers }: { drivers: AnyDoc[] }) {
  const names = useNames();
  const setStatus = async (id: string, status: 'verified' | 'rejected') => {
    await updateDoc(doc(db, 'drivers', id), { 'verification.status': status });
  };
  const order = { pending: 0, verified: 1, rejected: 2, unverified: 3 } as Record<string, number>;
  const sorted = [...drivers].sort((a, b) => (order[a.verification?.status ?? 'unverified'] ?? 9) - (order[b.verification?.status ?? 'unverified'] ?? 9));
  return (
    <>
      <h1 className="h1">Drivers</h1>
      <p className="sub">Approve verifications, review documents</p>
      <div className="panel">
        <table>
          <thead><tr><th>Driver</th><th>Vehicle</th><th>Docs</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={5}><div className="empty">No drivers yet.</div></td></tr>}
            {sorted.map((d) => {
              const v = d.verification ?? {};
              const st = v.status ?? 'unverified';
              const docs: string[] = v.docs ? Object.values(v.docs) : [];
              return (
                <tr key={d.id}>
                  <td>{names[d.id] ?? d.id.slice(0, 6)}<div className="hint">★ {(d.rating ?? 5).toFixed(1)} · {d.totalRides ?? 0} rides</div></td>
                  <td>{v.vehicle ? `${v.vehicle.plate} · ${v.vehicle.color} ${v.vehicle.model}` : <span className="hint">—</span>}</td>
                  <td><div className="thumbs">{docs.slice(0, 5).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="doc" /></a>)}{docs.length === 0 && <span className="hint">none</span>}</div></td>
                  <td><span className={`pill ${st}`}>{st}</span></td>
                  <td>
                    <div className="row-actions">
                      {st !== 'verified' && <button className="mini btn btn-green" onClick={() => setStatus(d.id, 'verified')}>Approve</button>}
                      {st !== 'rejected' && <button className="mini btn btn-red" onClick={() => setStatus(d.id, 'rejected')}>Reject</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Trips() {
  const rides = useCollection('rides');
  const names = useNames();
  const live = rides
    .filter((r) => ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status))
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
  return (
    <>
      <h1 className="h1">Live trips</h1>
      <p className="sub">Active and pending rides · live</p>
      <div className="panel">
        <table>
          <thead><tr><th>Route</th><th>Rider</th><th>Driver</th><th>Tier</th><th>Fare</th><th>Status</th></tr></thead>
          <tbody>
            {live.length === 0 && <tr><td colSpan={6}><div className="empty">No active trips right now.</div></td></tr>}
            {live.map((r) => (
              <tr key={r.id}>
                <td>{r.from} → {r.to}</td>
                <td>{names[r.riderId] ?? '—'}</td>
                <td>{r.driverId ? (names[r.driverId] ?? r.driverName ?? '—') : <span className="hint">unassigned</span>}</td>
                <td>{r.type}</td>
                <td>₵{(r.price ?? 0).toFixed(2)}</td>
                <td><span className="pill live">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Disputes() {
  const disputes = useCollection('disputes');
  const names = useNames();
  const resolve = async (id: string) => { await updateDoc(doc(db, 'disputes', id), { status: 'resolved' }); };
  const sorted = [...disputes].sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1));
  return (
    <>
      <h1 className="h1">Disputes</h1>
      <p className="sub">Rider & driver reports</p>
      <div className="panel">
        <table>
          <thead><tr><th>Reporter</th><th>Category</th><th>Note</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={5}><div className="empty">No disputes filed.</div></td></tr>}
            {sorted.map((d) => (
              <tr key={d.id}>
                <td>{names[d.reporterId] ?? '—'}<div className="hint">{d.reporterRole}</div></td>
                <td>{String(d.category ?? '').replace(/_/g, ' ')}</td>
                <td style={{ maxWidth: 380 }}>{d.note}</td>
                <td><span className={`pill ${d.status}`}>{d.status}</span></td>
                <td>{d.status === 'open' && <button className="mini btn btn-green" onClick={() => resolve(d.id)}>Resolve</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
