import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Truck, Plus, Search, LogOut, RotateCcw,
  AlertTriangle, Trash2, Gauge, DollarSign,
  TrendingUp, TrendingDown, Loader2, CheckCircle2, AlertCircle,
  Users, Shield, Clock, Eye, EyeOff,
  Building, ChevronDown, ChevronUp, Ban,
  AlertCircle as AlertIcon, Edit2, History,
  Fuel, Zap, Activity, BarChart2, ArrowUp, ArrowDown, Minus,
  Upload, X, FileText, Image as ImageIcon, Hash, Calendar,
  Wrench, Camera, ChevronRight, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc, query, orderBy, getDoc
} from 'firebase/firestore';
import {
  getAuth, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAAtd98TuFph3d16lKXGIh_3vmJwwxesKk",
  authDomain: "distribuidora-camionescostos.firebaseapp.com",
  projectId: "distribuidora-camionescostos",
  storageBucket: "distribuidora-camionescostos.firebasestorage.app",
  messagingSenderId: "715110102460",
  appId: "1:715110102460:web:71b5a61fb34f45ee9ca7b9",
  measurementId: "G-9D1MDPZ22H"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'veracruz-fleet-pro-v2';

// ─── Constants & Enums ────────────────────────────────────────────────────────

const ROLES = { ADMIN: 'admin', USER: 'user', DRIVER: 'driver' };
const TODAY = new Date();

const FUEL_TYPES   = ['diesel','nafta','gnc'];
const TRUCK_STATUS = ['disponible','en_viaje','en_taller','inactivo'];

const ALERT_THRESHOLDS = {
  DOCS_WARNING_DAYS:   15,
  SERVICE_WARNING_KM:  1000,
  SERVICE_CRITICAL_KM: 500,
  EFFICIENCY_DROP_PCT: 15,
};

const EFFICIENCY_THRESHOLDS = { OPTIMO: 4, REGULAR: 3 };

const STATUS_META = {
  disponible: { label:'Disponible', color:'var(--success)', bg:'#f0fdf4', border:'#bbf7d0' },
  en_viaje:   { label:'En Viaje',   color:'var(--accent)',  bg:'#eff6ff', border:'#bfdbfe' },
  en_taller:  { label:'En Taller',  color:'var(--warn)',     bg:'#fffbeb', border:'#fde68a' },
  inactivo:   { label:'Inactivo',   color:'var(--oxford)',  bg:'var(--ice)', border:'var(--mist)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr, today = TODAY) {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr + 'T00:00:00');
  const base   = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((target.getTime() - base.getTime()) / 86400000);
}

function isFuel(label) { return (label || '').toLowerCase().startsWith('combustible'); }

function calcRendimiento(prevKm, currKm, litros) {
  if (currKm <= prevKm || litros <= 0) return null;
  return (currKm - prevKm) / litros;
}

function classifyRend(v) {
  if (v >= EFFICIENCY_THRESHOLDS.OPTIMO)  return 'optimo';
  if (v >= EFFICIENCY_THRESHOLDS.REGULAR) return 'regular';
  return 'deficiente';
}

// ─── Alert engine (pure) ──────────────────────────────────────────────────────

function generateAlerts(trucks, history) {
  const alerts = [];

  for (const truck of trucks) {
    const base = { truckId: truck.id, patente: truck.patente, chofer: truck.chofer };

    // 1. Seguro
    if (truck.seguro_venc) {
      const d = daysUntil(truck.seguro_venc);
      if (d < 0)
        alerts.push({ ...base, key:`${truck.id}-seg-v`, type:'seguro_vencido',   severity:'critical', message:`Seguro VENCIDO hace ${Math.abs(d)} día${Math.abs(d)!==1?'s':''}`, daysRemaining:d, rawValue:truck.seguro_venc });
      else if (d <= ALERT_THRESHOLDS.DOCS_WARNING_DAYS)
        alerts.push({ ...base, key:`${truck.id}-seg-p`, type:'seguro_proximo',   severity:'warning',  message:`Seguro vence en ${d} día${d!==1?'s':''}`,                       daysRemaining:d, rawValue:truck.seguro_venc });
    }

    // 2. VTV
    if (truck.vtv_venc) {
      const d = daysUntil(truck.vtv_venc);
      if (d < 0)
        alerts.push({ ...base, key:`${truck.id}-vtv-v`, type:'vtv_vencido',       severity:'critical', message:`VTV VENCIDA hace ${Math.abs(d)} día${Math.abs(d)!==1?'s':''}`,     daysRemaining:d, rawValue:truck.vtv_venc });
      else if (d <= ALERT_THRESHOLDS.DOCS_WARNING_DAYS)
        alerts.push({ ...base, key:`${truck.id}-vtv-p`, type:'vtv_proximo',       severity:'warning',  message:`VTV vence en ${d} día${d!==1?'s':''}`,                               daysRemaining:d, rawValue:truck.vtv_venc });
    }

    // 3. Service preventivo por KM
    if (truck.kmProximoService && truck.kmProximoService > 0) {
      const kmRem = truck.kmProximoService - (truck.kmActual || 0);
      if (kmRem <= 0)
        alerts.push({ ...base, key:`${truck.id}-svc-v`, type:'service_vencido',  severity:'critical', message:`Service VENCIDO — exceso ${Math.abs(kmRem).toLocaleString('es-AR')} km`, kmRemaining:kmRem, rawValue:truck.kmProximoService });
      else if (kmRem <= ALERT_THRESHOLDS.SERVICE_CRITICAL_KM)
        alerts.push({ ...base, key:`${truck.id}-svc-c`, type:'service_proximo',  severity:'critical', message:`Service en ${kmRem.toLocaleString('es-AR')} km — ¡URGENTE!`,            kmRemaining:kmRem, rawValue:truck.kmProximoService });
      else if (kmRem <= ALERT_THRESHOLDS.SERVICE_WARNING_KM)
        alerts.push({ ...base, key:`${truck.id}-svc-w`, type:'service_proximo',  severity:'warning',  message:`Service próximo — restan ${kmRem.toLocaleString('es-AR')} km`,           kmRemaining:kmRem, rawValue:truck.kmProximoService });
    }

    // 4. Rendimiento combustible
    const loads = history
      .filter(h => h.truckId===truck.id && h.status!=='baja' && isFuel(h.categoryLabel) && (h.litros||0)>0 && (h.km_registro||0)>0)
      .sort((a,b) => a.timestamp - b.timestamp);
    if (loads.length >= 2) {
      const last = loads[loads.length - 1];
      const prev = loads[loads.length - 2];
      const rend = calcRendimiento(prev.km_registro, last.km_registro, last.litros);
      if (rend !== null && rend < EFFICIENCY_THRESHOLDS.REGULAR)
        alerts.push({ ...base, key:`${truck.id}-rend`, type:'rendimiento_bajo', severity: rend<2?'critical':'warning', message:`Rendimiento bajo: ${rend.toFixed(2)} km/l`, rawValue:rend });
    }
  }

  const order = { critical:0, warning:1, info:2 };
  return alerts.sort((a,b) => order[a.severity] - order[b.severity]);
}

// ─── Global styles ────────────────────────────────────────────────────────────

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,300;0,400;0,600;0,700;0,800;0,900;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  :root {
    --navy:       #0b1120;
    --navy-2:      #111827;
    --navy-3:      #1a2640;
    --steel:       #2d3f5c;
    --steel-2:     #3d5275;
    --oxford:      #8496b0;
    --mist:        #c8d4e3;
    --ice:         #eef2f7;
    --white:       #ffffff;
    --accent:      #2563eb;
    --accent-lt:   #3b82f6;
    --danger:      #dc2626;
    --warn:        #d97706;
    --success:     #16a34a;
    --fuel:        #0ea5e9;
  }

  * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
  .font-display { font-family: 'Barlow Condensed', sans-serif; }
  .font-mono    { font-family: 'JetBrains Mono', monospace; }
  .font-data    { font-family: 'JetBrains Mono', monospace; font-weight: 700; letter-spacing: -0.02em; }

  body { background: var(--ice); color: var(--navy); }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; }  to { opacity:1; } }
  @keyframes floatY   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
  @keyframes pulseDot { 0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.45)} 60%{box-shadow:0 0 0 9px rgba(37,99,235,0)} }
  @keyframes shimmer  { from{background-position:-300% center} to{background-position:300% center} }

  .anim-up { animation: fadeUp  .5s ease both; }
  .anim-in { animation: fadeIn  .4s ease both; }
  .d1{animation-delay:.08s} .d2{animation-delay:.16s} .d3{animation-delay:.24s} .d4{animation-delay:.32s}
  .float   { animation: floatY 3.5s ease-in-out infinite; }

  .login-bg {
    background: linear-gradient(160deg, var(--navy) 0%, #0a1628 55%, #0d1f3c 100%);
    position: relative; overflow: hidden;
  }
  .login-bg::before {
    content:''; position:absolute; width:700px; height:700px; border-radius:50%;
    background: radial-gradient(circle, rgba(37,99,235,.12) 0%, transparent 65%);
    top:-200px; left:-180px; pointer-events:none;
  }
  .login-bg::after {
    content:''; position:absolute; width:450px; height:450px; border-radius:50%;
    background: radial-gradient(circle, rgba(14,165,233,.08) 0%, transparent 65%);
    bottom:-120px; right:-80px; pointer-events:none;
  }
  .login-dots {
    position:absolute; inset:0; pointer-events:none;
    background-image: radial-gradient(circle, rgba(255,255,255,.04) 1px, transparent 1px);
    background-size: 30px 30px;
  }
  .login-card {
    background: rgba(255,255,255,.038);
    backdrop-filter: blur(28px) saturate(120%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: 0 40px 90px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.07);
  }
  .login-input {
    background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.1);
    color: white; transition: all .22s ease;
  }
  .login-input::placeholder { color: rgba(255,255,255,.22); }
  .login-input:focus {
    background: rgba(37,99,235,.12); border-color: rgba(37,99,235,.55);
    box-shadow: 0 0 0 3px rgba(37,99,235,.18); outline: none;
  }
  .login-btn {
    background: linear-gradient(135deg, #1d4ed8, #2563eb 50%, #3b82f6);
    background-size: 200% auto; transition: all .3s ease;
    box-shadow: 0 8px 28px rgba(37,99,235,.42);
  }
  .login-btn:hover { background-position: right center; box-shadow: 0 12px 36px rgba(37,99,235,.58); transform: translateY(-1px); }

  .nav-shell {
    background: rgba(255,255,255,.96); backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(37,99,235,.07); box-shadow: 0 1px 16px rgba(11,17,32,.07);
  }
  .tab-pill {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 700;
    text-transform: uppercase; letter-spacing:.06em; font-size: 11px;
    transition: all .2s ease; color: var(--oxford);
  }
  .tab-pill.active { background: var(--navy); color: white; box-shadow: 0 3px 12px rgba(11,17,32,.25); }
  .tab-pill:hover:not(.active) { color: var(--navy); background: var(--ice); }

  .card { background: white; border: 1px solid var(--mist); border-radius: 16px; transition: all .25s ease; }
  .card:hover { border-color: rgba(37,99,235,.18); box-shadow: 0 8px 28px rgba(37,99,235,.09); }

  .kpi-hero {
    background: linear-gradient(150deg, var(--navy) 0%, var(--navy-3) 100%);
    border: 1px solid var(--steel); border-radius:18px;
    box-shadow: 0 16px 48px rgba(11,17,32,.35); position: relative; overflow: hidden;
  }
  .kpi-hero::before {
    content:''; position:absolute; inset:0;
    background: radial-gradient(ellipse at 20% 50%, rgba(37,99,235,.15) 0%, transparent 60%);
  }
  .kpi-sub {
    background: white; border: 1px solid var(--mist); border-radius: 14px; transition: all .25s ease;
  }
  .kpi-sub:hover { border-color: rgba(37,99,235,.2); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,99,235,.1); }

  .truck-card {
    background: white; border: 1px solid var(--mist); border-radius:18px;
    transition: all .28s cubic-bezier(.34,1.56,.64,1);
  }
  .truck-card:hover { transform:translateY(-3px); border-color:rgba(37,99,235,.22); box-shadow: 0 14px 36px rgba(37,99,235,.11); }

  .fab {
    background: linear-gradient(135deg, #1d4ed8, #2563eb);
    box-shadow: 0 8px 28px rgba(37,99,235,.48);
    transition: all .28s cubic-bezier(.34,1.56,.64,1);
    animation: pulseDot 2.2s ease-in-out infinite;
  }
  .fab:hover { transform:scale(1.12) rotate(42deg); box-shadow:0 12px 36px rgba(37,99,235,.65); }

  .overlay { background:rgba(6,10,20,.78); backdrop-filter:blur(14px); }
  .modal   { background:white; box-shadow: 0 40px 90px rgba(0,0,0,.28); border-radius:24px; }

  .inp {
    background: var(--ice); border: 1.5px solid var(--mist); color: var(--navy);
    border-radius:12px; transition: all .2s ease; font-family: 'DM Sans', sans-serif;
  }
  .inp:focus { background:white; border-color:var(--accent); box-shadow:0 0 0 3px rgba(37,99,235,.12); outline:none; }
  .inp::placeholder { color:var(--oxford); }

  .badge-good { background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; }
  .badge-warn { background:#fef9c3; color:#a16207; border:1px solid #fde047; }
  .badge-bad  { background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; }

  .alert-strip { background:linear-gradient(135deg,#fffbeb,#fef3c7); border:1px solid #fcd34d; border-radius:16px; }
  .history-row:hover { background:var(--ice); }
  .accent-text { color: var(--accent); }
  .fuel-text   { color: var(--fuel); }

  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--mist); border-radius:10px; }
`;

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]           = useState(null);
  const [userRole, setUserRole]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [trucks, setTrucks]       = useState([]);
  const [history, setHistory]     = useState([]);
  const [users, setUsers]         = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyTruckFilter, setHistoryTruckFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end:   new Date().toISOString().split('T')[0],
  });
  const [notif, setNotif]   = useState(null);
  const [dbError, setDbError] = useState(null);
  const [modals, setModals] = useState({
    expense:false, truck:false, delete:null,
    users:false, addUser:false, clientes:false, addCliente:false,
    editTruck:null, editExpense:null,
  });

  const showNotif = (msg, type='success') => { setNotif({msg,type}); setTimeout(()=>setNotif(null),4000); };

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u); setShowLogin(false);
        try {
          const ref  = doc(db,'artifacts',appId,'public','data','users',u.uid);
          const snap = await getDoc(ref);
          setUserRole(snap.exists() ? (snap.data().role || ROLES.ADMIN) : ROLES.ADMIN);
          if (!snap.exists())
            await addDoc(collection(db,'artifacts',appId,'public','data','users'),
              {uid:u.uid,email:u.email,role:ROLES.ADMIN,createdAt:Date.now()}).catch(()=>{});
        } catch { setUserRole(ROLES.ADMIN); }
      } else { setShowLogin(true); }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Realtime listeners
  useEffect(() => {
    if (!user) return;
    const uT = onSnapshot(collection(db,'artifacts',appId,'public','data','trucks'), s => {
      setTrucks(s.docs.map(d => ({id:d.id,...d.data()}))); setDbError(null);
    }, () => setDbError('Error conectando flota'));
    const uH = onSnapshot(query(collection(db,'artifacts',appId,'public','data','history'),orderBy('timestamp','desc')), s => {
      setHistory(s.docs.map(d => ({id:d.id,...d.data()}))); setDbError(null);
    }, () => setDbError('Error conectando historial'));
    return () => { uT(); uH(); };
  }, [user]);

  useEffect(() => {
    if (!user || userRole !== ROLES.ADMIN) return;
    const u = onSnapshot(collection(db,'artifacts',appId,'public','data','users'), s => {
      setUsers(s.docs.map(d => ({id:d.id,...d.data()})));
    }, () => {});
    return () => u();
  }, [user, userRole]);

  useEffect(() => {
    if (!user) return;
    const u = onSnapshot(collection(db,'artifacts',appId,'public','data','clientes'), s => {
      const list = s.docs.map(d => ({id:d.id,...d.data()}));
      setClientes(list);
      if (!selectedClient && list.length > 0) setSelectedClient(list[0].id);
    }, () => {});
    return () => u();
  }, [user]);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const startTs = new Date(dateRange.start+"T00:00:00").getTime();
    const endTs   = new Date(dateRange.end  +"T23:59:59").getTime();
    const activeHistory = history.filter(h =>
      h.timestamp>=startTs && h.timestamp<=endTs &&
      h.status!=='cancelled' && h.status!=='baja'
    );
    const allPeriod = history.filter(h => h.timestamp>=startTs && h.timestamp<=endTs);

    const combustibleTotal   = activeHistory.filter(h => isFuel(h.categoryLabel)).reduce((a,h) => a+Number(h.amount),0);
    const mantenimientoTotal = activeHistory.filter(h => !isFuel(h.categoryLabel)).reduce((a,h) => a+Number(h.amount),0);
    const pieData = [
      {name:'Combustible',   value:combustibleTotal},
      {name:'Mantenimiento', value:mantenimientoTotal},
    ].filter(d => d.value > 0);

    const truckStats = trucks.map(t => {
      const tHist    = activeHistory.filter(h => h.truckId===t.id);
      const varTotal = tHist.reduce((a,h) => a+(Number(h.amount)||0), 0);
      const fixTotal = (Number(t.seguro)||0)+(Number(t.vtv_costo)||0)+(Number(t.muni_costo)||0);
      const total    = varTotal + fixTotal;
      const kmRecorridos = Math.max(0,(t.kmActual||0)-(t.kmInicio||0));
      const costoPorKm   = kmRecorridos>0 ? total/kmRecorridos : 0;
      const desglose = tHist.reduce((acc,h) => {
        const cat=h.categoryLabel||'VARIOS'; acc[cat]=(acc[cat]||0)+(Number(h.amount)||0); return acc;
      },{});
      return {...t, varTotal, fixTotal, total, kmRecorridos, costoPorKm, desglose};
    }).filter(t =>
      t.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.chofer||'').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grandTotal = truckStats.reduce((a,t) => a+t.total, 0);

    const monthlyMap = {};
    history.filter(h => h.status!=='baja'&&h.status!=='cancelled').forEach(h => {
      const d   = new Date(h.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const lbl = d.toLocaleString('es-AR',{month:'short',year:'2-digit'});
      if (!monthlyMap[key]) monthlyMap[key]={mes:lbl,total:0,combustible:0,mantenimiento:0};
      monthlyMap[key].total += Number(h.amount)||0;
      if (isFuel(h.categoryLabel)) monthlyMap[key].combustible+=Number(h.amount)||0;
      else monthlyMap[key].mantenimiento+=Number(h.amount)||0;
    });
    const trendData = Object.entries(monthlyMap).sort(([a],[b]) => a.localeCompare(b)).slice(-6).map(([,v]) => v);
    const ranking   = [...truckStats].sort((a,b) => b.total-a.total);

    return {truckStats,grandTotal,totalExpenses:activeHistory.length,activeHistory,allPeriod,pieData,trendData,ranking};
  }, [trucks, history, searchTerm, dateRange]);

  // ── Fleet alerts ──────────────────────────────────────────────────────────────
  const fleetAlerts = useMemo(() => generateAlerts(trucks, history), [trucks, history]);

  // ── Efficiency ────────────────────────────────────────────────────────────────
  const efficiencyStats = useMemo(() => {
    const fuelLoads = history
      .filter(h => isFuel(h.categoryLabel) && h.status!=='baja' && (h.litros||0)>0 && (h.km_registro||0)>0)
      .sort((a,b) => a.timestamp - b.timestamp);

    const byTruck = {};
    fuelLoads.forEach(h => {
      if (!byTruck[h.truckId]) byTruck[h.truckId] = {truckId:h.truckId,patente:h.truck,loads:[]};
      byTruck[h.truckId].loads.push(h);
    });

    const truckEfficiency = Object.values(byTruck).map(({truckId,patente,loads}) => {
      const segments = [];
      for (let i=1; i<loads.length; i++) {
        const prev = loads[i-1], curr = loads[i];
        const kmDiff = curr.km_registro - prev.km_registro;
        if (kmDiff>0 && curr.litros>0)
          segments.push({ fecha:curr.date, timestamp:curr.timestamp, kmDiff, litros:curr.litros,
            kmPerLitro:kmDiff/curr.litros, precioPorLitro:curr.precio_por_litro||(curr.amount/curr.litros),
            monto:curr.amount, km_registro:curr.km_registro });
      }
      const lastKmPL = segments.length>0 ? segments[segments.length-1].kmPerLitro : null;
      const prevKmPL = segments.length>1 ? segments[segments.length-2].kmPerLitro : null;
      const avgKmPL  = segments.length>0 ? segments.reduce((a,s) => a+s.kmPerLitro,0)/segments.length : null;
      const desvio   = (lastKmPL!==null&&prevKmPL!==null) ? ((lastKmPL-prevKmPL)/prevKmPL)*100 : null;
      return {truckId,patente,segments,lastKmPL,prevKmPL,avgKmPL,desvio,lastLoad:loads[loads.length-1],
        totalKm:segments.reduce((a,s)=>a+s.kmDiff,0), totalLitros:loads.reduce((a,l)=>a+l.litros,0)};
    });

    const valid = truckEfficiency.filter(t => t.avgKmPL!==null);
    const fleetAvgKmL = valid.length>0 ? valid.reduce((a,t)=>a+t.avgKmPL,0)/valid.length : 0;
    const totalFuelCost = history.filter(h=>isFuel(h.categoryLabel)&&h.status!=='baja').reduce((a,h)=>a+Number(h.amount),0);
    const totalKmFleet  = truckEfficiency.reduce((a,t)=>a+t.totalKm,0);
    const costPerKm      = totalKmFleet>0 ? totalFuelCost/totalKmFleet : 0;
    const desvioAlerts  = truckEfficiency.filter(t => t.desvio!==null && t.desvio<-ALERT_THRESHOLDS.EFFICIENCY_DROP_PCT);
    const priceEvolution = fuelLoads.filter(h=>h.precio_por_litro>0).slice(-12)
      .map(h => ({fecha:h.date?.split(',')[0]||'',precio:Number(h.precio_por_litro)||0,patente:h.truck}));

    return {truckEfficiency,fleetAvgKmL,costPerKm,desvioAlerts,priceEvolution,totalKmFleet};
  }, [history]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleAddTruck = async (data) => {
    try {
      await addDoc(collection(db,'artifacts',appId,'public','data','trucks'), {
        ...data, historialService:[], timestamp:Date.now(),
      });
      setModals(p => ({...p,truck:false})); showNotif("Unidad registrada");
    } catch { showNotif("Error al guardar","error"); }
  };

  const handleEditTruck = async (data, truckId) => {
    try {
      await updateDoc(doc(db,'artifacts',appId,'public','data','trucks',truckId), {
        ...data, editadoPor:user.email, editadoAt:Date.now(),
      });
      setModals(p => ({...p,editTruck:null})); showNotif("Unidad actualizada");
    } catch { showNotif("Error al actualizar","error"); }
  };

  const handleAddExpense = async (e, extra = {}) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const truckId  = fd.get('truckId');
    const truck    = trucks.find(t => t.id===truckId);
    const amount   = parseFloat(fd.get('amount'));
    const category = extra.category || 'varios';
    const label    = category==='varios'&&extra.variosDesc
      ? `VARIOS - ${extra.variosDesc.toUpperCase()}`
      : category.toUpperCase();
    const litros      = parseFloat(fd.get('litros'))||0;
    const km_registro = parseFloat(fd.get('km_registro'))||0;
    const precio_por_litro = litros>0 ? amount/litros : 0;
    try {
      await addDoc(collection(db,'artifacts',appId,'public','data','history'), {
        truckId, truck:truck.patente, categoryLabel:label, amount,
        responsible:user.email, status:'active', timestamp:Date.now(),
        date:new Date().toLocaleString('es-AR'), historialEdiciones:[],
        ...(isFuel(label)&&{litros,km_registro,precio_por_litro}),
      });
      if (isFuel(label)&&km_registro>0)
        await updateDoc(doc(db,'artifacts',appId,'public','data','trucks',truckId),{kmActual:km_registro});
      setModals(p => ({...p,expense:false})); showNotif("Gasto registrado");
    } catch { showNotif("Error al registrar","error"); }
  };

  const handleEditExpense = async (item, newAmount, motivo) => {
    if (!newAmount||isNaN(Number(newAmount))) return showNotif("Monto inválido","error");
    const edicion = {montoAnterior:item.amount,montoNuevo:parseFloat(newAmount),editadoPor:user.email,editadoAt:Date.now(),fecha:new Date().toLocaleString('es-AR'),motivo:motivo||''};
    try {
      await updateDoc(doc(db,'artifacts',appId,'public','data','history',item.id), {
        amount:parseFloat(newAmount),
        historialEdiciones:[...(item.historialEdiciones||[]),edicion],
        ultimaEdicion:edicion,
      });
      setModals(p => ({...p,editExpense:null})); showNotif("Monto actualizado");
    } catch { showNotif("Error al editar","error"); }
  };

  const handleBajaExpense = async (item) => {
    try {
      await updateDoc(doc(db,'artifacts',appId,'public','data','history',item.id),{status:'baja',bajaBy:user.email,bajaAt:Date.now()});
      showNotif("Registro dado de baja");
    } catch { showNotif("Error","error"); }
  };

  const handleDeleteTruck = async () => {
    if (!modals.delete) return;
    try {
      await deleteDoc(doc(db,'artifacts',appId,'public','data','trucks',modals.delete.id));
      showNotif("Unidad eliminada"); setModals(p => ({...p,delete:null}));
    } catch { showNotif("Error al eliminar","error"); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try { await signInWithEmailAndPassword(auth, fd.get('email'), fd.get('password')); showNotif("¡Bienvenido!"); }
    catch(err) { showNotif(err.message||"Credenciales incorrectas","error"); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const uc = await createUserWithEmailAndPassword(auth, fd.get('email'), fd.get('password'));
      await addDoc(collection(db,'artifacts',appId,'public','data','users'),{uid:uc.user.uid,email:fd.get('email'),role:fd.get('role'),createdAt:Date.now(),createdBy:user.email});
      showNotif("Usuario creado"); setModals(p => ({...p,addUser:false})); (e.currentTarget).reset();
    } catch(err) { showNotif(err.message||"Error","error"); }
  };

  const handleCreateCliente = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const ref = await addDoc(collection(db,'artifacts',appId,'public','data','clientes'),{nombre:fd.get('nombre'),email:fd.get('email'),telefono:fd.get('telefono'),createdAt:Date.now(),createdBy:user.email,estado:'activo'});
      setSelectedClient(ref.id); showNotif("Cliente creado"); setModals(p => ({...p,addCliente:false})); (e.currentTarget).reset();
    } catch(err) { showNotif(err.message||"Error","error"); }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = (await import('xlsx')).default || (await import('xlsx'));
      const data = stats.activeHistory.map(h => ({
        Fecha:h.date, Unidad:h.truck, Concepto:h.categoryLabel, Monto:h.amount,
        Litros:h.litros||'', KM_Registro:h.km_registro||'', Precio_Litro:h.precio_por_litro||'',
        Responsable:h.responsible,
        UltimaEdicion:h.ultimaEdicion?`${h.ultimaEdicion.editadoPor} (${h.ultimaEdicion.fecha})`:'',
      }));
      const ws = XLSX.utils.json_to_sheet(data), wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"Gastos");
      XLSX.writeFile(wb,`distribuidora-veracruz-${new Date().toISOString().split('T')[0]}.xlsx`);
      showNotif("Excel exportado");
    } catch { showNotif("Error al exportar","error"); }
  };

  const handleBackup = async () => {
    try {
      await addDoc(collection(db,'artifacts',appId,'public','backups'),{trucks,history:stats.activeHistory,timestamp:new Date().toISOString(),userId:user.uid,createdAt:Date.now()});
      showNotif("Respaldo creado");
    } catch { showNotif("Error en respaldo","error"); }
  };

  const fmt  = (val) => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(val||0);
  const fmtN = (val, dec=2) => Number(val||0).toFixed(dec);

  // ─── Guards ────────────────────────────────────────────────────────────────────
  if (authLoading) return (<><style>{globalStyles}</style><LoadingScreen /></>);
  if (showLogin)   return (<><style>{globalStyles}</style><LoginComponent onLogin={handleLogin} /></>);

  // Driver view — simplified mobile interface
  if (userRole === ROLES.DRIVER) {
    return (
      <>
        <style>{globalStyles}</style>
        <Notification banner={notif} />
        <DriverView trucks={trucks} userEmail={user.email} onSubmit={handleAddExpense} onSignOut={() => signOut(auth)} />
      </>
    );
  }

  const TABS = [
    {id:'dashboard',  label:'Panel'},
    {id:'units',      label:'Flota'},
    {id:'history',    label:'Gastos'},
    {id:'efficiency', label:'Eficiencia'},
  ];

  return (
    <>
      <style>{globalStyles}</style>
      <div className="min-h-screen" style={{background:'var(--ice)'}}>
        <Notification banner={notif} />
        {dbError && <div className="max-w-7xl mx-auto px-4 mt-3"><div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm font-semibold">{dbError}</div></div>}

        {/* NAV */}
        <nav className="nav-shell sticky top-0 z-50 px-4 md:px-6 py-3 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white float"
              style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)',boxShadow:'0 4px 14px rgba(37,99,235,.4)'}}>
              <Truck size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display font-black text-sm uppercase tracking-tight leading-none" style={{color:'var(--navy)',fontSize:15}}>
                DISTRIBUIDORA <span style={{color:'var(--accent)'}}>VERACRUZ</span>
              </h1>
              <p className="text-[7px] font-semibold uppercase tracking-widest" style={{color:'var(--oxford)'}}>Sistema de Gestión de Flota</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl order-last md:order-none w-full md:w-auto justify-center gap-0.5">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`tab-pill px-4 py-2 rounded-xl flex-1 md:flex-none ${activeTab===tab.id?'active':''}`}>
                {tab.label}
                {tab.id==='dashboard' && fleetAlerts.filter(a=>a.severity==='critical').length>0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[7px] font-black text-white"
                    style={{background:'var(--danger)'}}>
                    {fleetAlerts.filter(a=>a.severity==='critical').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 flex-wrap justify-end">
            <button onClick={handleExportExcel} className="px-3 py-2 rounded-xl text-[10px] font-bold border transition-all"
              style={{color:'var(--success)',borderColor:'#bbf7d0',background:'#f0fdf4'}}>XLS</button>
            {userRole===ROLES.ADMIN && (
              <button onClick={() => setModals(m => ({...m,users:true}))} className="p-2 rounded-xl transition-all hover:bg-blue-50" style={{color:'var(--oxford)'}}><Users size={15}/></button>
            )}
            {userRole===ROLES.ADMIN && (
              <button onClick={() => setModals(m => ({...m,clientes:true}))} className="p-2 rounded-xl transition-all hover:bg-cyan-50" style={{color:'var(--oxford)'}}><Building size={15}/></button>
            )}
            <button onClick={handleBackup} className="p-2 rounded-xl transition-all hover:bg-violet-50" style={{color:'var(--oxford)'}}><Clock size={15}/></button>
            <button onClick={() => signOut(auth)} className="p-2 rounded-xl transition-all hover:bg-red-50" style={{color:'var(--oxford)'}}><LogOut size={15}/></button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-5 pb-28">

          {/* Cliente activo */}
          {clientes.length>0 && (
            <div className="p-4 rounded-2xl border" style={{background:'linear-gradient(135deg,#eff6ff,#f0f9ff)',borderColor:'rgba(37,99,235,.15)'}}>
              <div className="flex items-center gap-3">
                <Building size={14} style={{color:'var(--accent)'}} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{color:'var(--accent)'}}>Cliente Activo</p>
                  <select value={selectedClient||''} onChange={e => setSelectedClient(e.target.value)}
                    className="bg-white border rounded-xl text-sm font-semibold p-1.5 w-full focus:outline-none"
                    style={{borderColor:'rgba(37,99,235,.2)',color:'var(--navy)'}}>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="card p-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="text-[8px] font-bold uppercase tracking-wider mb-1 block" style={{color:'var(--oxford)'}}>Buscar unidad</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={13} style={{color:'var(--mist)'}} />
                  <input type="text" placeholder="Patente o chofer..."
                    className="inp pl-8 pr-3 py-2.5 text-xs w-full"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[8px] font-bold uppercase tracking-wider mb-1 block" style={{color:'var(--oxford)'}}>Período</label>
                <div className="inp flex items-center gap-2 px-3 py-2">
                  <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p,start:e.target.value}))} className="bg-transparent text-[10px] outline-none" style={{color:'var(--navy)'}} />
                  <span style={{color:'var(--mist)'}}>—</span>
                  <input type="date" value={dateRange.end}   onChange={e => setDateRange(p => ({...p,end:e.target.value}))}   className="bg-transparent text-[10px] outline-none" style={{color:'var(--navy)'}} />
                </div>
              </div>
            </div>
          </div>

          {/* Alert Panel */}
          <AlertPanel alerts={fleetAlerts} />

          {activeTab==='dashboard'   && <DashboardPanel  stats={stats}  trucks={trucks} fmt={fmt} />}
          {activeTab==='units'       && <FlotaPanel      stats={stats}  setModals={setModals} />}
          {activeTab==='history'    && <HistoryTable    allPeriod={stats.allPeriod} trucks={trucks} truckFilter={historyTruckFilter} onTruckFilter={setHistoryTruckFilter} onBaja={handleBajaExpense} onEdit={item => setModals(m => ({...m,editExpense:item}))} fmt={fmt} onExport={handleExportExcel} />}
          {activeTab==='efficiency' && <EfficiencyPanel effStats={efficiencyStats} trucks={trucks} fmt={fmt} fmtN={fmtN} />}
        </main>

        {/* FAB */}
        <button onClick={() => setModals(m => ({...m,expense:true}))}
          className="fab fixed bottom-6 right-6 z-40 w-14 h-14 text-white rounded-full flex items-center justify-center">
          <Plus size={22} />
        </button>

        {/* MODALS */}
        {modals.truck      && <AltaUnidadModal onSubmit={handleAddTruck} onClose={() => setModals(p => ({...p,truck:false}))} />}
        {modals.editTruck  && <AltaUnidadModal initial={modals.editTruck} onSubmit={data => handleEditTruck(data,modals.editTruck.id)} onClose={() => setModals(p => ({...p,editTruck:null}))} />}
        {modals.expense    && <ExpenseModal trucks={trucks} onSubmit={handleAddExpense} history={history} onClose={() => setModals(m => ({...m,expense:false}))} />}
        {modals.editExpense && <EditExpenseModal item={modals.editExpense} fmt={fmt} onSave={handleEditExpense} onClose={() => setModals(m => ({...m,editExpense:null}))} />}

        {modals.delete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overlay">
            <div className="modal bg-white p-8 w-full max-sm text-center" style={{borderBottom:'4px solid var(--danger)'}}>
              <AlertTriangle size={28} className="mx-auto mb-4" style={{color:'var(--danger)'}} />
              <h3 className="font-display font-black uppercase text-xl mb-1" style={{color:'var(--navy)'}}>¿Eliminar Unidad?</h3>
              <p className="text-sm mb-6" style={{color:'var(--oxford)'}}>Camión <span className="font-bold" style={{color:'var(--navy)'}}>{modals.delete.patente}</span></p>
              <div className="flex gap-3">
                <button onClick={() => setModals(m => ({...m,delete:null}))} className="flex-1 p-3 rounded-xl font-bold text-xs uppercase transition-all hover:bg-slate-100" style={{background:'var(--ice)',color:'var(--oxford)'}}>Cancelar</button>
                <button onClick={handleDeleteTruck} className="flex-1 p-3 text-white rounded-xl font-bold text-xs uppercase" style={{background:'var(--danger)'}}>Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {modals.users && userRole===ROLES.ADMIN && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overlay">
            <div className="modal w-full max-w-lg p-7 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-black text-xl uppercase flex items-center gap-2" style={{color:'var(--navy)'}}><Shield size={18}/> Usuarios</h2>
                <button onClick={() => setModals(m => ({...m,users:false}))} style={{color:'var(--mist)'}}>✕</button>
              </div>
              <button onClick={() => setModals(m => ({...m,addUser:true}))} className="mb-4 w-full text-white px-4 py-3 rounded-xl text-sm font-bold uppercase" style={{background:'var(--navy)'}}>+ Crear Usuario</button>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="p-3 rounded-xl border flex justify-between items-center" style={{background:'var(--ice)',borderColor:'var(--mist)'}}>
                    <div><p className="font-semibold text-sm" style={{color:'var(--navy)'}}>{u.email}</p><p className="text-[8px] uppercase font-bold" style={{color:'var(--oxford)'}}>{u.role}</p></div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase ${u.role===ROLES.ADMIN?'badge-bad':'badge-good'}`}>{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {modals.addUser && userRole===ROLES.ADMIN && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overlay">
            <div className="modal w-full max-w-md p-7">
              <h2 className="font-display font-black text-xl uppercase mb-5" style={{color:'var(--navy)'}}>Crear Usuario</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <input name="email" type="email" placeholder="Email" required className="inp w-full p-3.5" />
                <input name="password" type="password" placeholder="Contraseña" required className="inp w-full p-3.5" />
                <select name="role" className="inp w-full p-3.5">
                  <option value={ROLES.USER}>Usuario Normal</option>
                  <option value={ROLES.ADMIN}>Administrador</option>
                  <option value={ROLES.DRIVER}>Chofer (vista móvil)</option>
                </select>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setModals(m => ({...m,addUser:false}))} className="flex-1 p-3 rounded-xl font-bold text-xs uppercase" style={{background:'var(--ice)',color:'var(--oxford)'}}>Cancelar</button>
                  <button type="submit" className="flex-1 p-3 text-white rounded-xl font-bold text-xs uppercase" style={{background:'var(--navy)'}}>Crear</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {modals.clientes && userRole===ROLES.ADMIN && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overlay">
            <div className="modal w-full max-w-lg p-7 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-black text-xl uppercase flex items-center gap-2" style={{color:'var(--navy)'}}><Building size={18}/> Clientes</h2>
                <button onClick={() => setModals(m => ({...m,clientes:false}))} style={{color:'var(--mist)'}}>✕</button>
              </div>
              <button onClick={() => setModals(m => ({...m,addCliente:true}))} className="mb-4 w-full text-white px-4 py-3 rounded-xl text-sm font-bold uppercase" style={{background:'var(--accent)'}}>+ Crear Cliente</button>
              <div className="space-y-2">
                {clientes.map(c => (
                  <div key={c.id} className="p-3 rounded-xl border flex justify-between items-center" style={{background:'#eff6ff',borderColor:'#bfdbfe'}}>
                    <div><p className="font-semibold text-sm" style={{color:'var(--navy)'}}>{c.nombre}</p><p className="text-[8px] font-bold" style={{color:'var(--accent)'}}>{c.email}</p></div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase ${c.estado==='activo'?'badge-good':'badge-bad'}`}>{c.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {modals.addCliente && userRole===ROLES.ADMIN && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overlay">
            <div className="modal w-full max-w-md p-7">
              <h2 className="font-display font-black text-xl uppercase mb-5" style={{color:'var(--accent)'}}>Crear Cliente</h2>
              <form onSubmit={handleCreateCliente} className="space-y-4">
                <input name="nombre" placeholder="Nombre o empresa" required className="inp w-full p-3.5" />
                <input name="email" type="email" placeholder="Email" required className="inp w-full p-3.5" />
                <input name="telefono" placeholder="Teléfono (opcional)" className="inp w-full p-3.5" />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setModals(m => ({...m,addCliente:false}))} className="flex-1 p-3 rounded-xl font-bold text-xs uppercase" style={{background:'var(--ice)',color:'var(--oxford)'}}>Cancelar</button>
                  <button type="submit" className="flex-1 p-3 text-white rounded-xl font-bold text-xs uppercase" style={{background:'var(--accent)'}}>Crear</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── ALERT PANEL ──────────────────────────────────────────────────────────────

function AlertPanel({ alerts }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border p-4 flex items-center gap-3" style={{background:'#f0fdf4',borderColor:'#bbf7d0'}}>
        <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <ShieldCheck size={16} style={{color:'var(--success)'}} />
        </div>
        <div>
          <p className="font-display font-black text-sm uppercase" style={{color:'var(--success)'}}>Flota al día</p>
          <p className="text-[9px]" style={{color:'var(--oxford)'}}>Sin alertas activas en este momento</p>
        </div>
      </div>
    );
  }

  const criticals = alerts.filter(a => a.severity==='critical');

  const ALERT_ICON = {
    seguro_vencido: ShieldAlert, seguro_proximo: ShieldAlert,
    vtv_vencido: AlertTriangle, vtv_proximo: AlertTriangle,
    service_proximo: Wrench, service_vencido: Wrench,
    rendimiento_bajo: Fuel,
  };
  const ALERT_CAT = {
    seguro_vencido:'Seguro', seguro_proximo:'Seguro',
    vtv_vencido:'VTV', vtv_proximo:'VTV',
    service_proximo:'Service', service_vencido:'Service',
    rendimiento_bajo:'Combustible',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} style={{color:'var(--danger)'}} />
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{color:'var(--danger)'}}>
          {alerts.length} alerta{alerts.length!==1?'s':''} activa{alerts.length!==1?'s':''}
          {criticals.length>0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-white font-bold text-[7px]" style={{background:'var(--danger)'}}>
              {criticals.length} CRÍTICA{criticals.length!==1?'S':''}
            </span>
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {alerts.map(alert => {
          const isCrit = alert.severity==='critical';
          const Icon   = ALERT_ICON[alert.type] || AlertTriangle;
          return (
            <div key={alert.key} className="rounded-2xl border p-3 flex items-start gap-3"
              style={{background:isCrit?'#fff1f2':'#fffbeb',borderColor:isCrit?'#fca5a5':'#fcd34d',
                boxShadow:isCrit?'0 2px 12px rgba(220,38,38,.1)':'none'}}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{background:isCrit?'#fee2e2':'#fef3c7'}}>
                <Icon size={14} style={{color:isCrit?'var(--danger)':'var(--warn)'}} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full"
                    style={{background:isCrit?'#fee2e2':'#fef9c3',color:isCrit?'var(--danger)':'#a16207'}}>
                    {isCrit?'CRÍTICO':'AVISO'}
                  </span>
                  <span className="text-[7px] font-bold uppercase" style={{color:'var(--oxford)'}}>{ALERT_CAT[alert.type]||'Alerta'}</span>
                </div>
                <p className="font-display font-black text-xs uppercase leading-tight" style={{color:'var(--navy)'}}>
                  {alert.patente}{alert.chofer&&<span className="font-sans font-normal normal-case ml-1" style={{color:'var(--oxford)'}}>— {alert.chofer}</span>}
                </p>
                <p className="text-[9px] mt-0.5 font-medium leading-snug" style={{color:'var(--steel)'}}>{alert.message}</p>
                {alert.daysRemaining!==undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={9} style={{color:isCrit?'var(--danger)':'var(--warn)'}} />
                    <span className="text-[8px] font-bold" style={{color:isCrit?'var(--danger)':'var(--warn)'}}>
                      {alert.daysRemaining<0?`Expiró el ${alert.rawValue}`:`Vence: ${alert.rawValue}`}
                    </span>
                  </div>
                )}
                {alert.kmRemaining!==undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    <Gauge size={9} style={{color:isCrit?'var(--danger)':'var(--warn)'}} />
                    <span className="text-[8px] font-bold" style={{color:isCrit?'var(--danger)':'var(--warn)'}}>
                      Service: {Number(alert.rawValue).toLocaleString('es-AR')} km
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DASHBOARD PANEL ──────────────────────────────────────────────────────────

function DashboardPanel({stats,trucks,fmt}) {
  const combustiblePct   = stats.grandTotal>0?((stats.pieData.find((d)=>d.name==='Combustible')?.value||0)/stats.grandTotal*100).toFixed(1):0;
  const mantenimientoPct = stats.grandTotal>0?((stats.pieData.find((d)=>d.name==='Mantenimiento')?.value||0)/stats.grandTotal*100).toFixed(1):0;
  const fixTotal         = stats.truckStats.reduce((a,t)=>a+t.fixTotal,0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 lg:col-span-1 kpi-hero p-6 flex flex-col justify-between" style={{minHeight:148}}>
          <div className="relative flex items-center justify-between mb-4">
            <div className="p-2 rounded-xl" style={{background:'rgba(37,99,235,.25)'}}><DollarSign size={14} style={{color:'#93c5fd'}} /></div>
            <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-full" style={{color:'#93c5fd',background:'rgba(37,99,235,.2)'}}>Período</span>
          </div>
          <div className="relative">
            <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{color:'rgba(255,255,255,.4)'}}>Total Egresos</p>
            <p className="font-data text-3xl text-white leading-none">{fmt(stats.grandTotal)}</p>
          </div>
        </div>
        <SubKpi label="Unidades Activas"     value={trucks.length}  Icon={Truck}      accent="#2563eb" bg="#eff6ff" border="#bfdbfe" suffix="activas" />
        <SubKpi label="Operaciones"          value={stats.totalExpenses} Icon={RotateCcw} accent="#d97706" bg="#fffbeb" border="#fde68a" suffix="registros" />
        <SubKpi label="Promedio por Unidad" value={fmt(stats.grandTotal/(trucks.length||1))} Icon={TrendingUp} accent="#7c3aed" bg="#f5f3ff" border="#ddd6fe" mono />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {label:'Combustible',   emoji:'⛽', pct:combustiblePct,   val:stats.pieData.find((d)=>d.name==='Combustible')?.value||0,   color:'#0ea5e9', bg:'#f0f9ff', border:'#bae6fd', barColor:'linear-gradient(90deg,#38bdf8,#0ea5e9)'},
          {label:'Mantenimiento', emoji:'🔧', pct:mantenimientoPct, val:stats.pieData.find((d)=>d.name==='Mantenimiento')?.value||0, color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe', barColor:'linear-gradient(90deg,#60a5fa,#2563eb)'},
          {label:'Costos Fijos',  emoji:'🛡', pct:stats.grandTotal>0?(fixTotal/stats.grandTotal*100).toFixed(1):0, val:fixTotal,         color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0', barColor:'linear-gradient(90deg,#4ade80,#16a34a)'},
        ].map(item => (
          <div key={item.label} className="rounded-2xl p-5 border" style={{background:item.bg,borderColor:item.border}}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{background:item.color}}>{item.emoji}</div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-wider" style={{color:item.color}}>{item.label}</p>
                <p className="text-[10px] font-bold" style={{color:item.color}}>{item.pct}% del total</p>
              </div>
            </div>
            <p className="font-data text-xl" style={{color:item.color}}>{fmt(item.val)}</p>
            <div className="mt-3 h-1.5 rounded-full" style={{background:item.border}}>
              <div className="h-full rounded-full transition-all duration-700" style={{width:`${item.pct}%`,background:item.barColor}} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-display font-black text-base uppercase tracking-tight" style={{color:'var(--navy)'}}>Costos por Unidad</h3>
              <p className="text-[10px] mt-0.5" style={{color:'var(--oxford)'}}>Fijos + Variables del período</p>
            </div>
            <div className="flex gap-3">
              {[['#2563eb','Fijos'],['#f97316','Variables']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{background:c}}/><span className="text-[9px] font-bold uppercase" style={{color:'var(--oxford)'}}>{l}</span></div>
              ))}
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.truckStats} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="patente" axisLine={false} tickLine={false} tick={{fontSize:10,fontWeight:'700',fill:'#64748b',fontFamily:'Barlow Condensed'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#94a3b8'}} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<BarTooltip fmt={fmt}/>} />
                <Bar dataKey="fixTotal" stackId="a" fill="#2563eb" name="Fijos" />
                <Bar dataKey="varTotal" stackId="a" fill="#f97316" radius={[5,5,0,0]} name="Variables" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-2 card p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="font-display font-black text-base uppercase tracking-tight" style={{color:'var(--navy)'}}>Distribución</h3>
            <p className="text-[10px] mt-0.5" style={{color:'var(--oxford)'}}>Combustible vs Mantenimiento</p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.pieData} innerRadius={50} outerRadius={68} paddingAngle={4} dataKey="value" strokeWidth={0}>
                    <Cell fill="#f97316"/><Cell fill="#2563eb"/>
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-2">
            {[{label:'Combustible',val:stats.pieData.find((d)=>d.name==='Combustible')?.value||0,color:'#f97316',bg:'#fff7ed'},{label:'Mantenimiento',val:stats.pieData.find((d)=>d.name==='Mantenimiento')?.value||0,color:'#2563eb',bg:'#eff6ff'}].map(item => (
              <div key={item.label} className="flex items-center justify-between rounded-xl px-3 py-2" style={{background:item.bg}}>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:item.color}}/><span className="text-[9px] font-bold uppercase" style={{color:item.color}}>{item.label}</span></div>
                <span className="font-mono text-[10px] font-bold" style={{color:'var(--navy)'}}>{fmt(item.val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats.trendData.length>1 && (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-display font-black text-base uppercase tracking-tight" style={{color:'var(--navy)'}}>Tendencia Mensual</h3>
              <p className="text-[10px] mt-0.5" style={{color:'var(--oxford)'}}>Evolución de costos — últimos 6 meses</p>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize:10,fontWeight:'600',fill:'#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#94a3b8'}} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{background:'var(--navy)',border:'none',borderRadius:10,color:'white',fontSize:11}} formatter={(v) => [fmt(v)]} />
                <Line type="monotone" dataKey="combustible"   stroke="#f97316" strokeWidth={2.5} dot={{fill:'#f97316',r:4,strokeWidth:2,stroke:'white'}} name="Combustible" />
                <Line type="monotone" dataKey="mantenimiento" stroke="#2563eb" strokeWidth={2.5} dot={{fill:'#2563eb',r:4,strokeWidth:2,stroke:'white'}} name="Mantenimiento" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {stats.ranking.length>0 && (
        <div className="card p-6">
          <div className="mb-5">
            <h3 className="font-display font-black text-base uppercase tracking-tight" style={{color:'var(--navy)'}}>Ranking de Unidades</h3>
            <p className="text-[10px] mt-0.5" style={{color:'var(--oxford)'}}>Mayor egreso en el período</p>
          </div>
          <div className="space-y-2">
            {stats.ranking.map((t, i) => {
              const pct    = stats.grandTotal>0?(t.total/stats.grandTotal*100):0;
              const fixPct = t.total>0?(t.fixTotal/t.total*100):0;
              const varPct = t.total>0?(t.varTotal/t.total*100):0;
              const medals = ['🥇','🥈','🥉'];
              return (
                <div key={t.id} className="grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-xl"
                  style={{background:i===0?'rgba(37,99,235,.04)':'transparent',border:i===0?'1px solid rgba(37,99,235,.1)':'1px solid transparent'}}>
                  <span className="col-span-1 text-base">{medals[i]||<span className="font-mono font-bold text-xs" style={{color:'var(--oxford)'}}>{i+1}</span>}</span>
                  <div className="col-span-3">
                    <p className="font-display font-bold text-xs uppercase" style={{color:'var(--navy)'}}>{t.patente}</p>
                    <p className="text-[9px]" style={{color:'var(--oxford)'}}>{t.chofer}</p>
                  </div>
                  <div className="col-span-4">
                    <div className="h-2 rounded-full overflow-hidden flex" style={{background:'var(--ice)'}}>
                      <div className="h-full" style={{width:`${fixPct}%`,background:'#2563eb'}}/>
                      <div className="h-full" style={{width:`${varPct}%`,background:'#f97316'}}/>
                    </div>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[7px] font-bold" style={{color:'#2563eb'}}>{fixPct.toFixed(0)}% F</span>
                      <span className="text-[7px] font-bold" style={{color:'#f97316'}}>{varPct.toFixed(0)}% V</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="font-mono font-bold text-xs" style={{color:'var(--navy)'}}>{fmt(t.total)}</p>
                    {t.costoPorKm>0&&<p className="text-[8px]" style={{color:'var(--oxford)'}}>{fmt(t.costoPorKm)}/km</p>}
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-lg text-[9px] font-bold" style={{background:'rgba(37,99,235,.08)',color:'var(--accent)'}}>{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EFFICIENCY PANEL ─────────────────────────────────────────────────────────

function EfficiencyPanel({effStats,trucks,fmt,fmtN}) {
  const {truckEfficiency,fleetAvgKmL,costPerKm,desvioAlerts,priceEvolution} = effStats;
  const kmLBadge = (kmL) => {
    if (kmL===null) return <span className="px-2 py-0.5 rounded-lg text-[8px] font-bold" style={{background:'var(--ice)',color:'var(--oxford)'}}>Sin datos</span>;
    if (kmL>=4) return <span className="badge-good px-2 py-0.5 rounded-lg text-[8px] font-bold">{fmtN(kmL,2)} km/l</span>;
    if (kmL>=3) return <span className="badge-warn px-2 py-0.5 rounded-lg text-[8px] font-bold">{fmtN(kmL,2)} km/l</span>;
    return <span className="badge-bad px-2 py-0.5 rounded-lg text-[8px] font-bold">{fmtN(kmL,2)} km/l</span>;
  };

  return (
    <div className="space-y-5 anim-up">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi-hero p-6 flex flex-col justify-between sm:col-span-1" style={{minHeight:160}}>
          <div className="relative flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl" style={{background:'rgba(14,165,233,.25)'}}><Fuel size={15} style={{color:'#7dd3fc'}} /></div>
            <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-full" style={{color:'#7dd3fc',background:'rgba(14,165,233,.18)'}}>Flota</span>
          </div>
          <div className="relative">
            <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{color:'rgba(255,255,255,.4)'}}>Promedio Flota</p>
            <p className="font-data text-4xl text-white leading-none">{fmtN(fleetAvgKmL,2)}</p>
            <p className="text-[10px] mt-1" style={{color:'rgba(255,255,255,.35)'}}>km por litro</p>
          </div>
        </div>
        <div className="kpi-hero p-6 flex flex-col justify-between sm:col-span-1" style={{minHeight:160}}>
          <div className="relative flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl" style={{background:'rgba(124,58,237,.25)'}}><Gauge size={15} style={{color:'#c4b5fd'}} /></div>
            <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-full" style={{color:'#c4b5fd',background:'rgba(124,58,237,.18)'}}>Eficiencia</span>
          </div>
          <div className="relative">
            <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{color:'rgba(255,255,255,.4)'}}>Costo por KM</p>
            <p className="font-data text-4xl text-white leading-none">{fmt(costPerKm)}</p>
            <p className="text-[10px] mt-1" style={{color:'rgba(255,255,255,.35)'}}>combustible / km</p>
          </div>
        </div>
        <div className="card p-6" style={{borderColor:desvioAlerts.length>0?'#fca5a5':'var(--mist)',background:desvioAlerts.length>0?'#fff5f5':'white'}}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl" style={{background:desvioAlerts.length>0?'#fee2e2':'var(--ice)'}}>
              <AlertTriangle size={14} style={{color:desvioAlerts.length>0?'var(--danger)':'var(--oxford)'}} />
            </div>
            <p className="text-[8px] font-bold uppercase tracking-widest" style={{color:desvioAlerts.length>0?'var(--danger)':'var(--oxford)'}}>Desvíos &gt; 15%</p>
          </div>
          {desvioAlerts.length===0
            ? <div className="flex items-center gap-2 mt-4"><CheckCircle2 size={20} style={{color:'var(--success)'}}/><p className="text-sm font-semibold" style={{color:'var(--success)'}}>Sin desvíos detectados</p></div>
            : <div className="space-y-2 mt-2 max-h-24 overflow-y-auto">{desvioAlerts.map((t) => (
                <div key={t.truckId} className="flex items-center justify-between">
                  <span className="font-display font-bold text-xs uppercase" style={{color:'var(--navy)'}}>{t.patente}</span>
                  <span className="badge-bad px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1"><TrendingDown size={9}/>{fmtN(t.desvio,1)}%</span>
                </div>
              ))}</div>
          }
        </div>
      </div>

      {priceEvolution.length>1 && (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-display font-black text-base uppercase tracking-tight" style={{color:'var(--navy)'}}>Evolución Precio por Litro</h3>
              <p className="text-[10px] mt-0.5" style={{color:'var(--oxford)'}}>Últimas {priceEvolution.length} cargas registradas</p>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceEvolution}>
                <defs>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#94a3b8'}} tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{background:'var(--navy)',border:'none',borderRadius:10,color:'white',fontSize:11}} formatter={(v) => [`$${Number(v).toLocaleString('es-AR')} /L`,'Precio']} />
                <Area type="monotone" dataKey="precio" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#fuelGrad)" dot={{fill:'#0ea5e9',r:3,strokeWidth:2,stroke:'white'}} name="Precio/L" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-5 border-b" style={{borderColor:'var(--mist)',background:'var(--ice)'}}>
          <h3 className="font-display font-black text-base uppercase tracking-tight" style={{color:'var(--navy)'}}>Análisis por Unidad</h3>
          <p className="text-[10px] mt-0.5" style={{color:'var(--oxford)'}}>Rendimiento real calculado por tramo entre cargas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead style={{background:'var(--ice)'}}>
              <tr className="border-b" style={{borderColor:'var(--mist)'}}>
                {['Unidad','Conductor','KM Recorridos','Litros Totales','Rendimiento Prom.','Última Carga','Tendencia'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[8px] font-bold uppercase tracking-wider" style={{color:'var(--oxford)'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{borderColor:'var(--mist)'}}>
              {truckEfficiency.length===0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm" style={{color:'var(--oxford)'}}>Sin datos de combustible con litros registrados</td></tr>}
              {truckEfficiency.map((t) => {
                const truck = trucks.find((tr) => tr.id===t.truckId)||{};
                const tend  = t.desvio===null?null:t.desvio>0?'up':t.desvio<-5?'down':'flat';
                return (
                  <tr key={t.truckId} className="history-row transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background:'var(--ice)',border:'1px solid var(--mist)'}}>
                          <span className="font-display font-black text-[9px]" style={{color:'var(--accent)'}}>{t.patente.slice(-3)}</span>
                        </div>
                        <span className="font-display font-bold text-xs uppercase" style={{color:'var(--navy)'}}>{t.patente}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{color:'var(--oxford)'}}>{truck.chofer||'—'}</td>
                    <td className="px-4 py-3"><span className="font-mono font-bold text-xs" style={{color:'var(--navy)'}}>{t.totalKm.toLocaleString('es-AR')} km</span></td>
                    <td className="px-4 py-3"><span className="font-mono font-bold text-xs" style={{color:'var(--navy)'}}>{t.totalLitros.toLocaleString('es-AR',{maximumFractionDigits:1})} L</span></td>
                    <td className="px-4 py-3">{kmLBadge(t.avgKmPL)}</td>
                    <td className="px-4 py-3"><span className="font-mono text-[9px]" style={{color:'var(--oxford)'}}>{t.lastLoad?.date?.split(',')[0]||'—'}</span></td>
                    <td className="px-4 py-3">
                      {tend==='up'    && <span className="flex items-center gap-1 text-[9px] font-bold" style={{color:'var(--success)'}}><ArrowUp size={11}/>{fmtN(t.desvio,1)}%</span>}
                      {tend==='down' && <span className="flex items-center gap-1 text-[9px] font-bold" style={{color:'var(--danger)'}}><ArrowDown size={11}/>{fmtN(Math.abs(t.desvio),1)}%</span>}
                      {tend==='flat' && <span className="flex items-center gap-1 text-[9px]" style={{color:'var(--oxford)'}}><Minus size={11}/>Estable</span>}
                      {tend===null   && <span className="text-[9px]" style={{color:'var(--mist)'}}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{color:'var(--oxford)'}}>Referencia de Rendimiento</p>
        <div className="flex flex-wrap gap-3">
          {[{cls:'badge-good',label:'Óptimo ≥ 4 km/l'},{cls:'badge-warn',label:'Regular 3–4 km/l'},{cls:'badge-bad',label:'Deficiente < 3 km/l'}].map(b => (
            <span key={b.label} className={`${b.cls} px-3 py-1.5 rounded-lg text-[9px] font-bold`}>{b.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FLOTA PANEL ──────────────────────────────────────────────────────────────

function FlotaPanel({stats, setModals}) {
  const [statusFilter, setStatusFilter] = useState('');

  const STATUS_FILTERS = [
    {value:'',           label:'Todos'},
    {value:'disponible', label:'Disponible'},
    {value:'en_viaje',   label:'En Viaje'},
    {value:'en_taller',  label:'En Taller'},
    {value:'inactivo',   label:'Inactivo'},
  ];

  const filtered = statusFilter
    ? stats.truckStats.filter((t) => t.status===statusFilter)
    : stats.truckStats;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(f => {
          const meta = STATUS_META[f.value];
          const count = f.value ? stats.truckStats.filter((t)=>t.status===f.value).length : stats.truckStats.length;
          return (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className="px-3 py-1.5 rounded-xl font-bold text-[9px] uppercase border-2 transition-all flex items-center gap-1.5"
              style={statusFilter===f.value
                ? {background:meta?.color||'var(--navy)',color:'white',borderColor:meta?.color||'var(--navy)'}
                : {background:'white',color:'var(--oxford)',borderColor:'var(--mist)'}
              }>
              {f.label}
              <span className="px-1.5 py-0.5 rounded-full text-[7px] font-black"
                style={statusFilter===f.value
                  ? {background:'rgba(255,255,255,.25)',color:'white'}
                  : {background:'var(--ice)',color:'var(--oxford)'}
                }>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((truck) => (
          <TruckCard key={truck.id} truck={truck}
            onDelete={() => setModals((m) => ({...m,delete:truck}))}
            onEdit={()   => setModals((m) => ({...m,editTruck:truck}))} />
        ))}
        <button onClick={() => setModals((m) => ({...m,truck:true}))}
          className="group border-2 border-dashed rounded-[20px] p-8 flex flex-col items-center justify-center gap-3 transition-all min-h-[240px]"
          style={{borderColor:'var(--mist)'}}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-inner" style={{background:'var(--ice)'}}>
            <Plus size={22} style={{color:'var(--mist)'}} />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{color:'var(--oxford)'}}>Añadir Unidad</span>
        </button>
      </div>
    </div>
  );
}

// ─── TRUCK CARD ───────────────────────────────────────────────────────────────

function TruckCard({truck, onDelete, onEdit}) {
  const [showVar, setShowVar] = useState(false);
  const fmt = (v) => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v||0);
  const desgloseEntries = Object.entries(truck.desglose||{}).sort((a,b) => b[1]-a[1]);
  const statusMeta = STATUS_META[truck.status] || STATUS_META.disponible;

  return (
    <div className="truck-card p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:'linear-gradient(135deg,#eff6ff,#dbeafe)',border:'1px solid #bfdbfe'}}>
            <span className="font-display font-black text-xs uppercase" style={{color:'var(--accent)'}}>{truck.patente.slice(-3)}</span>
          </div>
          <div>
            <h3 className="font-display font-black text-base uppercase leading-tight" style={{color:'var(--navy)'}}>{truck.chofer||'Sin chofer'}</h3>
            <p className="text-[8px] font-bold mt-0.5 uppercase tracking-widest" style={{color:'var(--oxford)'}}>{truck.patente}</p>
            {(truck.marca||truck.modelo) && (
              <p className="text-[8px] mt-0.5" style={{color:'var(--oxford)'}}>{truck.marca} {truck.modelo} {truck.anio?`(${truck.anio})`:''}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit}   className="p-1.5 rounded-lg transition-all hover:bg-blue-50" style={{color:'var(--mist)'}}><Edit2 size={13}/></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg transition-all hover:bg-red-50"  style={{color:'var(--mist)'}}><Trash2 size={13}/></button>
        </div>
      </div>

      <div className="mb-3">
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[8px] font-black uppercase border"
          style={{background:statusMeta.bg,borderColor:statusMeta.border,color:statusMeta.color}}>
          <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{background:statusMeta.color}}/>
          {statusMeta.label}
        </span>
        {truck.tipoFuel && (
          <span className="ml-2 px-2 py-0.5 rounded-lg text-[7px] font-bold uppercase"
            style={{background:'#f0f9ff',color:'var(--fuel)',border:'1px solid #bae6fd'}}>
            {truck.tipoFuel.toUpperCase()}
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="text-[7px] font-bold uppercase tracking-widest mb-1" style={{color:'var(--oxford)'}}>Egresos del Período</p>
        <p className="font-data text-3xl leading-none" style={{color:'var(--accent)'}}>{fmt(truck.total)}</p>
      </div>

      <div className="space-y-2 pt-3 border-t" style={{borderColor:'var(--ice)'}}>
        {[{label:'Seguro',val:truck.seguro},{label:'VTV',val:truck.vtv_costo},{label:'Hab. Municipal',val:truck.muni_costo}].map((item,idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase" style={{color:'var(--oxford)'}}>{item.label}</span>
            <span className="font-mono text-[9px] font-bold" style={{color:'var(--navy)'}}>{fmt(item.val)}</span>
          </div>
        ))}
      </div>

      <button onClick={() => setShowVar(!showVar)} className="w-full mt-3 pt-3 border-t flex items-center justify-between text-left" style={{borderColor:'var(--ice)'}}>
        <span className="text-[8px] font-bold uppercase" style={{color:'var(--oxford)'}}>Variables del Período</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] font-bold" style={{color:'#f97316'}}>{fmt(truck.varTotal)}</span>
          {showVar?<ChevronUp size={11} style={{color:'var(--oxford)'}}/>:<ChevronDown size={11} style={{color:'var(--oxford)'}}/>}
        </div>
      </button>
      {showVar && (
        <div className="mt-2 rounded-xl p-3 space-y-1.5" style={{background:'#fff7ed',border:'1px solid #fed7aa'}}>
          {desgloseEntries.length===0
            ? <p className="text-[8px] text-center" style={{color:'var(--oxford)'}}>Sin gastos variables</p>
            : desgloseEntries.map(([cat,monto]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-[8px] font-bold uppercase truncate max-w-[130px]" style={{color:'var(--steel)'}}>{cat}</span>
                  <span className="font-mono text-[9px] font-bold ml-2" style={{color:'#c2410c'}}>{fmt(monto)}</span>
                </div>
              ))
          }
        </div>
      )}

      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2" style={{borderColor:'var(--ice)'}}>
        <div className="flex items-center gap-1.5">
          <Gauge size={11} style={{color:'var(--accent)'}}/>
          <span className="text-[8px] font-bold uppercase" style={{color:'var(--oxford)'}}>{(truck.kmActual||0).toLocaleString()} KM</span>
        </div>
        {truck.kmProximoService>0 && (
          <div className="text-right">
            <p className="text-[7px] font-bold uppercase" style={{color:'var(--oxford)'}}>Próx. Service</p>
            <p className="font-mono text-[9px] font-bold" style={{color: (truck.kmProximoService-truck.kmActual)<=500?'var(--danger)':(truck.kmProximoService-truck.kmActual)<=1000?'var(--warn)':'var(--navy)'}}>
              {(truck.kmProximoService-truck.kmActual).toLocaleString('es-AR')} km
            </p>
          </div>
        )}
        {(!truck.kmProximoService||truck.kmProximoService===0) && truck.costoPorKm>0 && (
          <div className="text-right">
            <p className="text-[7px] font-bold uppercase" style={{color:'var(--oxford)'}}>Costo/KM</p>
            <p className="font-mono text-[9px] font-bold" style={{color:'var(--navy)'}}>{fmt(truck.costoPorKm)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ALTA UNIDAD MODAL ──────────────────────────────

function AltaUnidadModal({initial={}, onSubmit, onClose}) {
  const isEdit = Boolean(initial.id);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState({});
  const [tipoFuel,  setTipoFuel]  = useState(initial.tipoFuel||'diesel');
  const [status,    setStatus]    = useState(initial.status||'disponible');
  const [seguroAdj, setSeguroAdj] = useState({file:null,url:'',progress:0});
  const [vtvAdj,    setVtvAdj]    = useState({file:null,url:'',progress:0});
  const seguroRef = useRef(null);
  const vtvRef    = useRef(null);

  const CURRENT_YEAR = new Date().getFullYear();

  const validate = (f) => {
    const e = {};
    if (!f.patente) e.patente='Requerido';
    else if (!/^[A-Z]{2}\d{3}[A-Z]{2}$|^[A-Z]{3}\d{3}$/.test(String(f.patente).toUpperCase())) e.patente='Formato inválido (AA123BB o ABC123)';
    if (!f.marca)  e.marca='Requerido';
    if (!f.modelo) e.modelo='Requerido';
    if (!f.anio||Number(f.anio)<1980||Number(f.anio)>CURRENT_YEAR+1) e.anio=`Año entre 1980 y ${CURRENT_YEAR+1}`;
    if (!f.capacidadTanque||Number(f.capacidadTanque)<=0) e.capacidadTanque='Capacidad > 0';
    if (!f.chofer) e.chofer='Requerido';
    if (f.kmProximoService&&Number(f.kmProximoService)>0&&Number(f.kmProximoService)<=Number(f.kmActual||0)) e.kmProximoService='Debe ser mayor al KM actual';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fields = {
      patente:         String(fd.get('patente')||'').toUpperCase().trim(),
      marca:            String(fd.get('marca')||'').trim(),
      modelo:          String(fd.get('modelo')||'').trim(),
      anio:            Number(fd.get('anio')),
      capacidadTanque: Number(fd.get('capacidadTanque')),
      chofer:          String(fd.get('chofer')||'').trim(),
      kmActual:        Number(fd.get('kmActual'))||0,
      kmProximoService:Number(fd.get('kmProximoService'))||0,
    };
    const errs = validate(fields);
    if (Object.keys(errs).length>0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit({
        ...fields,
        tipoFuel, status,
        kmInicio: isEdit?(initial.kmInicio||0):fields.kmActual,
        habMunicipal: Number(fd.get('habMunicipal'))||0,
        seguro:      Number(fd.get('seguroMonto'))||0,
        vtv_costo:   Number(fd.get('vtvMonto'))||0,
        muni_costo:  Number(fd.get('habMunicipal'))||0,
        seguro_venc: String(fd.get('seguroVenc')||''),
        vtv_venc:    String(fd.get('vtvVenc')||''),
        seguro_poliza: String(fd.get('seguroPoliza')||''),
        vtv_poliza:    String(fd.get('vtvPoliza')||''),
      });
    } finally { setSaving(false); }
  };

  const FieldErr = ({msg}) => msg
    ? <p className="text-[8px] mt-0.5 font-semibold flex items-center gap-1" style={{color:'var(--danger)'}}><AlertCircle size={9}/>{msg}</p>
    : null;

  const SectionHead = ({Icon, title, accent='var(--navy)'}) => (
    <div className="flex items-center gap-2 pt-4 pb-1 border-t" style={{borderColor:'var(--mist)'}}>
      <div className="p-1.5 rounded-lg" style={{background:`${accent}18`}}><Icon size={13} style={{color:accent}}/></div>
      <p className="text-[8px] font-bold uppercase tracking-widest" style={{color:accent}}>{title}</p>
    </div>
  );

  const FUEL_OPTS = [{value:'diesel',label:'Diesel',emoji:'⛽'},{value:'nafta',label:'Nafta',emoji:'🔴'},{value:'gnc',label:'GNC',emoji:'🟢'}];
  const STATUS_OPTS = [
    {value:'disponible',label:'Disponible',color:'var(--success)'},
    {value:'en_viaje',  label:'En Viaje',  color:'var(--accent)'},
    {value:'en_taller', label:'En Taller', color:'var(--warn)'},
    {value:'inactivo',  label:'Inactivo',  color:'var(--oxford)'},
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overlay">
      <div className="modal w-full max-w-2xl p-7 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)',boxShadow:'0 4px 14px rgba(37,99,235,.35)'}}>
              <Truck size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl uppercase tracking-tight" style={{color:'var(--navy)'}}>
                {isEdit?'Editar Unidad':'Alta de Unidad'}
              </h2>
              {isEdit&&<p className="text-[9px] font-bold" style={{color:'var(--accent)'}}>{initial.patente}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-all hover:bg-slate-100" style={{color:'var(--oxford)'}}><X size={16}/></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <SectionHead Icon={Truck} title="Identificación del Vehículo" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Patente *</label>
              {isEdit
                ? <div className="inp p-3 text-sm font-bold uppercase opacity-60">{initial.patente}</div>
                : <>
                    <input name="patente" placeholder="AA123BB" defaultValue={initial.patente||''}
                      className={`inp w-full p-3 text-sm${errors.patente?' border-red-400':''}`}
                      style={{textTransform:'uppercase'}} onChange={e=>{e.target.value=e.target.value.toUpperCase();}} />
                    <FieldErr msg={errors.patente} />
                  </>
              }
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Año *</label>
              <input name="anio" type="number" placeholder={String(CURRENT_YEAR)} defaultValue={initial.anio||''}
                className={`inp w-full p-3 text-sm${errors.anio?' border-red-400':''}`} min={1980} max={CURRENT_YEAR+1} />
              <FieldErr msg={errors.anio} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Marca *</label>
              <input name="marca" placeholder="Mercedes-Benz" defaultValue={initial.marca||''} className={`inp w-full p-3 text-sm${errors.marca?' border-red-400':''}`} />
              <FieldErr msg={errors.marca} />
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Modelo *</label>
              <input name="modelo" placeholder="Atego 1725" defaultValue={initial.modelo||''} className={`inp w-full p-3 text-sm${errors.modelo?' border-red-400':''}`} />
              <FieldErr msg={errors.modelo} />
            </div>
          </div>

          <div>
            <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Chofer Asignado *</label>
            <input name="chofer" placeholder="Nombre completo" defaultValue={initial.chofer||''} className={`inp w-full p-3 text-sm${errors.chofer?' border-red-400':''}`} />
            <FieldErr msg={errors.chofer} />
          </div>

          <div>
            <label className="text-[8px] font-bold uppercase tracking-wider block mb-2" style={{color:'var(--oxford)'}}>Estado Operativo</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setStatus(opt.value)}
                  className="px-3 py-1.5 rounded-xl font-bold text-[9px] uppercase border-2 transition-all"
                  style={status===opt.value?{background:opt.color,color:'white',borderColor:opt.color}:{background:'var(--ice)',color:'var(--oxford)',borderColor:'var(--mist)'}}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <SectionHead Icon={Fuel} title="Motor y Combustible" accent="#0ea5e9" />

          <div>
            <label className="text-[8px] font-bold uppercase tracking-wider block mb-2" style={{color:'var(--oxford)'}}>Tipo de Combustible *</label>
            <div className="grid grid-cols-3 gap-2">
              {FUEL_OPTS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setTipoFuel(opt.value)}
                  className="p-3 rounded-xl font-bold text-xs uppercase border-2 transition-all"
                  style={tipoFuel===opt.value?{background:'#0ea5e9',color:'white',borderColor:'#0ea5e9',boxShadow:'0 4px 14px rgba(14,165,233,.3)'}:{background:'var(--ice)',color:'var(--oxford)',borderColor:'var(--mist)'}}>
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Capacidad del Tanque (Litros) *</label>
            <input name="capacidadTanque" type="number" step="1" placeholder="300" defaultValue={initial.capacidadTanque||''}
              className={`inp w-full p-3 text-sm${errors.capacidadTanque?' border-red-400':''}`} />
            <FieldErr msg={errors.capacidadTanque} />
          </div>

          <SectionHead Icon={Gauge} title="Odómetro y Service Preventivo" accent="#7c3aed" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>KM Actual</label>
              <input name="kmActual" type="number" placeholder="0" defaultValue={initial.kmActual||''} className="inp w-full p-3 text-sm" />
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>KM Próximo Service</label>
              <input name="kmProximoService" type="number" placeholder="Ej: 220000" defaultValue={initial.kmProximoService||''} className={`inp w-full p-3 text-sm${errors.kmProximoService?' border-red-400':''}`} />
              <FieldErr msg={errors.kmProximoService} />
              <p className="text-[8px] mt-0.5" style={{color:'var(--oxford)'}}>Alerta crítica a {ALERT_THRESHOLDS.SERVICE_CRITICAL_KM} km</p>
            </div>
          </div>

          <SectionHead Icon={Wrench} title="Costos Fijos" accent="var(--success)" />

          <div className="grid grid-cols-3 gap-3">
            {[{name:'seguroMonto',label:'Seguro ($/mes)',  val:initial.seguro},
              {name:'vtvMonto',   label:'VTV ($/mes)',      val:initial.vtv_costo},
              {name:'habMunicipal',label:'Hab. Mun. ($/mes)', val:initial.muni_costo}
            ].map(f => (
              <div key={f.name}>
                <label className="text-[8px] font-bold uppercase block mb-1" style={{color:'var(--oxford)'}}>{f.label}</label>
                <input name={f.name} type="number" placeholder="0" defaultValue={f.val||''} className="inp w-full p-2.5 text-sm" />
              </div>
            ))}
          </div>

          <SectionHead Icon={FileText} title="Documentación — Seguro" accent="var(--accent)" />

          <div className="rounded-2xl p-4 border space-y-3" style={{background:'#f8faff',borderColor:'rgba(37,99,235,.12)'}}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Número de Póliza</label>
                <div className="relative">
                  <Hash size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--oxford)'}} />
                  <input name="seguroPoliza" placeholder="Nº póliza" defaultValue={initial.seguro_poliza||''} className="inp w-full pl-8 p-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Vencimiento</label>
                <div className="relative">
                  <Calendar size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--oxford)'}} />
                  <input name="seguroVenc" type="date" defaultValue={initial.seguro_venc||''} className="inp w-full pl-8 p-3 text-sm" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Adjuntar Póliza (PDF o foto)</label>
              {seguroAdj.file
                ? <div className="flex items-center gap-2 p-2 rounded-xl border" style={{background:'#f0fdf4',borderColor:'#bbf7d0'}}>
                    <FileText size={13} style={{color:'var(--success)'}}/>
                    <span className="text-[9px] flex-1 truncate">{seguroAdj.file.name}</span>
                    <CheckCircle2 size={13} style={{color:'var(--success)'}}/>
                    <button type="button" onClick={() => setSeguroAdj({file:null,url:'',progress:0})} className="p-0.5"><X size={11} style={{color:'var(--oxford)'}}/></button>
                  </div>
                : <label className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all"
                    style={{borderColor:'var(--mist)',background:'var(--ice)'}}>
                    <Upload size={14} style={{color:'var(--oxford)'}}/>
                    <span className="text-[9px] font-medium" style={{color:'var(--oxford)'}}>Arrastrá o hacé click — PDF, JPG, PNG</span>
                    <input ref={seguroRef} type="file" accept="application/pdf,image/*" className="hidden"
                      onChange={e => { if(e.target.files?.[0]) setSeguroAdj({file:e.target.files[0],url:URL.createObjectURL(e.target.files[0]),progress:100}); }} />
                  </label>
              }
            </div>
          </div>

          <SectionHead Icon={FileText} title="Documentación — VTV" accent="var(--warn)" />

          <div className="rounded-2xl p-4 border space-y-3" style={{background:'#fffbeb',borderColor:'rgba(217,119,6,.12)'}}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Número de Certificado</label>
                <div className="relative">
                  <Hash size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--oxford)'}} />
                  <input name="vtvPoliza" placeholder="Nº certificado" defaultValue={initial.vtv_poliza||''} className="inp w-full pl-8 p-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Vencimiento</label>
                <div className="relative">
                  <Calendar size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--oxford)'}} />
                  <input name="vtvVenc" type="date" defaultValue={initial.vtv_venc||''} className="inp w-full pl-8 p-3 text-sm" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider block mb-1" style={{color:'var(--oxford)'}}>Adjuntar VTV (PDF o foto)</label>
              {vtvAdj.file
                ? <div className="flex items-center gap-2 p-2 rounded-xl border" style={{background:'#f0fdf4',borderColor:'#bbf7d0'}}>
                    <FileText size={13} style={{color:'var(--success)'}}/>
                    <span className="text-[9px] flex-1 truncate">{vtvAdj.file.name}</span>
                    <CheckCircle2 size={13} style={{color:'var(--success)'}}/>
                    <button type="button" onClick={() => setVtvAdj({file:null,url:'',progress:0})} className="p-0.5"><X size={11} style={{color:'var(--oxford)'}}/></button>
                  </div>
                : <label className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all"
                    style={{borderColor:'var(--mist)',background:'var(--ice)'}}>
                    <Upload size={14} style={{color:'var(--oxford)'}}/>
                    <span className="text-[9px] font-medium" style={{color:'var(--oxford)'}}>Arrastrá o hacé click — PDF, JPG, PNG</span>
                    <input ref={vtvRef} type="file" accept="application/pdf,image/*" className="hidden"
                      onChange={e => { if(e.target.files?.[0]) setVtvAdj({file:e.target.files[0],url:URL.createObjectURL(e.target.files[0]),progress:100}); }} />
                  </label>
              }
            </div>
          </div>

          {initial.editadoPor && (
            <div className="rounded-xl p-3 text-[8px] font-medium border" style={{background:'#eff6ff',borderColor:'#bfdbfe',color:'var(--accent)'}}>
              ✏️ Última edición: <span className="font-bold">{initial.editadoPor}</span> — {initial.editadoAt?new Date(initial.editadoAt).toLocaleString('es-AR'):''}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 p-3.5 rounded-xl font-bold text-xs uppercase transition-all" style={{background:'var(--ice)',color:'var(--oxford)'}}>Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 p-3.5 text-white rounded-xl font-bold text-xs uppercase disabled:opacity-50 transition-all"
              style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)',boxShadow:'0 8px 22px rgba(37,99,235,.3)'}}>
              {saving?<span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin"/>Guardando...</span>:isEdit?'Guardar Cambios':'Registrar Unidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── EXPENSE MODAL ────────────────────────────────────────────────────────────

function ExpenseModal({trucks, onSubmit, onClose, history}) {
  const [tipoGasto,  setTipoGasto]  = useState('');
  const [mantOpen,   setMantOpen]   = useState(false);
  const [subCat,     setSubCat]     = useState('');
  const [variosDesc, setVariosDesc] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [kmError,    setKmError]    = useState('');
  const [ticketFile, setTicketFile] = useState(null);

  const lastKm = useMemo(() => {
    if (!selectedTruck) return 0;
    const loads = history
      .filter((h) => h.truckId===selectedTruck && isFuel(h.categoryLabel) && (h.km_registro||0)>0 && h.status!=='baja')
      .sort((a,b) => b.timestamp-a.timestamp);
    return loads[0]?.km_registro || trucks.find((t)=>t.id===selectedTruck)?.kmActual || 0;
  }, [selectedTruck, history, trucks]);

  const validateKm = (val) => {
    if (!val) { setKmError(''); return; }
    if (parseFloat(val)<=lastKm) setKmError(`KM debe ser mayor al último registrado (${lastKm.toLocaleString('es-AR')} km)`);
    else setKmError('');
  };

  const canSubmit = tipoGasto && (tipoGasto==='combustible'||(tipoGasto==='mantenimiento'&&subCat&&(subCat!=='varios'||variosDesc))) && !kmError;

  const OPCIONES=[
    {value:'mecanico',label:'🔧 Mecánico'},{value:'elastiquero',label:'🔩 Elastiquero'},
    {value:'chapista',label:'🚗 Chapista'},{value:'tapicero',label:'🪑 Tapicero'},
    {value:'gomeria',label:'🔄 Gomería'},{value:'electricista',label:'⚡ Electricista'},
    {value:'neumaticos',label:'🛞 Neumáticos'},{value:'taller',label:'🏭 Taller'},
    {value:'varios',label:'📦 Varios'},
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e,{category:tipoGasto==='combustible'?'combustible':subCat,variosDesc:subCat==='varios'?variosDesc:'',fotoTicket:ticketFile});
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overlay">
      <div className="modal w-full max-w-lg p-7 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display font-black text-2xl uppercase mb-5 tracking-tight" style={{color:'var(--navy)'}}>
          Registrar <span style={{color:'var(--accent)'}}>Gasto</span>
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select name="truckId" required className="inp w-full p-3.5 appearance-none"
            value={selectedTruck} onChange={e => setSelectedTruck(e.target.value)}>
            <option value="">Seleccione Unidad...</option>
            {trucks.map((t) => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
          </select>

          <div className="space-y-2">
            <p className="text-[8px] font-bold uppercase tracking-wider" style={{color:'var(--oxford)'}}>Tipo de Gasto</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => {setTipoGasto('combustible');setSubCat('');setMantOpen(false);}}
                className="p-4 rounded-xl font-bold text-sm uppercase border-2 transition-all"
                style={tipoGasto==='combustible'?{background:'#0ea5e9',color:'white',borderColor:'#0ea5e9',boxShadow:'0 6px 20px rgba(14,165,233,.35)'}:{background:'var(--ice)',color:'var(--oxford)',borderColor:'var(--mist)'}}>
                ⛽ Combustible
              </button>
              <button type="button" onClick={() => {setTipoGasto('mantenimiento');setMantOpen(o=>!o);}}
                className="p-4 rounded-xl font-bold text-sm uppercase border-2 transition-all flex items-center justify-center gap-2"
                style={tipoGasto==='mantenimiento'?{background:'var(--navy)',color:'white',borderColor:'var(--navy)',boxShadow:'0 6px 20px rgba(11,17,32,.3)'}:{background:'var(--ice)',color:'var(--oxford)',borderColor:'var(--mist)'}}>
                🔧 Mantenimiento <span className={`text-xs inline-block transition-transform ${mantOpen?'rotate-180':''}`}>▼</span>
              </button>
            </div>
          </div>

          {tipoGasto==='mantenimiento'&&mantOpen && (
            <div className="grid grid-cols-3 gap-2 p-4 rounded-xl border" style={{background:'#f8faff',borderColor:'var(--mist)'}}>
              {OPCIONES.map(op => (
                <button key={op.value} type="button" onClick={() => {setSubCat(op.value);setMantOpen(false);}}
                  className="p-2.5 rounded-xl font-bold text-[9px] uppercase text-left border transition-all"
                  style={subCat===op.value?{background:'var(--navy)',color:'white',borderColor:'var(--navy)'}:{background:'white',color:'var(--steel)',borderColor:'var(--mist)'}}>
                  {op.label}
                </button>
              ))}
            </div>
          )}

          {tipoGasto==='mantenimiento'&&subCat && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border" style={{background:'#f0f9ff',borderColor:'#bae6fd'}}>
              <span className="text-[8px] font-bold uppercase" style={{color:'var(--fuel)'}}>Subcategoría:</span>
              <span className="text-xs font-bold uppercase" style={{color:'var(--navy)'}}>{subCat}</span>
              <button type="button" onClick={() => setSubCat('')} className="ml-auto text-xs" style={{color:'var(--oxford)'}}>✕</button>
            </div>
          )}

          {subCat==='varios' && (
            <div>
              <label className="text-[8px] font-bold uppercase tracking-wider mb-1 block" style={{color:'var(--oxford)'}}>Descripción (obligatorio)</label>
              <input value={variosDesc} onChange={e => setVariosDesc(e.target.value)} required placeholder="Describí el gasto..." className="inp w-full p-3.5" />
            </div>
          )}

          {tipoGasto==='combustible' && (
            <div className="rounded-xl p-4 space-y-3 border" style={{background:'#f0f9ff',borderColor:'#bae6fd'}}>
              <p className="text-[8px] font-bold uppercase tracking-wider" style={{color:'var(--fuel)'}}>⛽ Datos de Carga</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[7px] font-bold uppercase tracking-wider mb-1 block" style={{color:'var(--oxford)'}}>Litros Cargados *</label>
                  <input name="litros" type="number" step="0.01" required placeholder="0.00" className="inp w-full p-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-[7px] font-bold uppercase tracking-wider mb-1 block" style={{color:'var(--oxford)'}}>
                    KM Odómetro * {lastKm>0&&<span style={{color:'var(--fuel)'}}>(&gt;{lastKm.toLocaleString()})</span>}
                  </label>
                  <input name="km_registro" type="number" required placeholder={lastKm>0?`> ${lastKm}`:'0'}
                    className="inp w-full p-2.5 text-sm"
                    style={kmError?{borderColor:'var(--danger)'}:{}}
                    onChange={e => validateKm(e.target.value)} />
                  {kmError&&<p className="text-[7px] mt-0.5 font-semibold" style={{color:'var(--danger)'}}>{kmError}</p>}
                </div>
              </div>
              <div>
                <label className="text-[7px] font-bold uppercase tracking-wider mb-1 block" style={{color:'var(--oxford)'}}>Foto del Ticket (recomendado)</label>
                {ticketFile
                  ? <div className="flex items-center gap-2 p-2 rounded-xl border" style={{background:'#f0fdf4',borderColor:'#bbf7d0'}}>
                      <Camera size={13} style={{color:'var(--success)'}}/>
                      <span className="text-[9px] flex-1 truncate">{ticketFile.name}</span>
                      <button type="button" onClick={()=>setTicketFile(null)}><X size={11} style={{color:'var(--oxford)'}}/></button>
                    </div>
                  : <label className="flex items-center gap-2 p-2 rounded-xl border-2 border-dashed cursor-pointer"
                      style={{borderColor:'var(--mist)',background:'var(--ice)'}}>
                      <Camera size={14} style={{color:'var(--oxford)'}}/>
                      <span className="text-[9px]" style={{color:'var(--oxford)'}}>Subir foto del ticket</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e=>{if(e.target.files?.[0])setTicketFile(e.target.files[0]);}} />
                    </label>
                }
              </div>
            </div>
          )}

          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black" style={{color:'var(--oxford)'}}>$</span>
            <input name="amount" type="number" step="0.01" required placeholder="0.00"
              className="w-full p-7 rounded-2xl text-center text-4xl font-black text-white outline-none"
              style={{background:'linear-gradient(135deg,var(--navy),var(--navy-3))'}} />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 p-3.5 rounded-xl font-bold text-xs uppercase transition-all" style={{background:'var(--ice)',color:'var(--oxford)'}}>Cancelar</button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 py-3.5 rounded-xl font-bold uppercase text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)',boxShadow:'0 8px 22px rgba(37,99,235,.35)'}}>
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── EDIT EXPENSE MODAL ───────────────────────────────────────────────────────

function EditExpenseModal({item,fmt,onSave,onClose}) {
  const [newAmount, setNewAmount] = useState(String(item.amount));
  const [motivo,     setMotivo]    = useState('');
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overlay">
      <div className="modal w-full max-w-md p-7">
        <h2 className="font-display font-black text-xl uppercase mb-1" style={{color:'var(--accent)'}}>Editar Monto</h2>
        <p className="text-[9px] mb-5" style={{color:'var(--oxford)'}}>{item.truck} — {item.categoryLabel} — {item.date}</p>
        <div className="space-y-4">
          <div>
            <label className="text-[8px] font-bold uppercase" style={{color:'var(--oxford)'}}>Monto actual</label>
            <p className="text-2xl font-bold line-through" style={{color:'var(--mist)'}}>{fmt(item.amount)}</p>
          </div>
          <div>
            <label className="text-[8px] font-bold uppercase block mb-1" style={{color:'var(--oxford)'}}>Nuevo monto ($)</label>
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
              className="w-full p-4 rounded-2xl text-2xl font-black text-center text-white outline-none"
              style={{background:'linear-gradient(135deg,var(--navy),var(--navy-3))'}} />
          </div>
          <div>
            <label className="text-[8px] font-bold uppercase block mb-1" style={{color:'var(--oxford)'}}>Motivo del cambio</label>
            <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: Error de carga, ajuste..." className="inp w-full p-3.5" />
          </div>
          {item.historialEdiciones?.length>0 && (
            <div className="rounded-xl p-3 border" style={{background:'var(--ice)',borderColor:'var(--mist)'}}>
              <p className="text-[8px] font-bold uppercase mb-2 flex items-center gap-1" style={{color:'var(--oxford)'}}><History size={10}/> Historial</p>
              <div className="space-y-2 max-h-28 overflow-y-auto">
                {[...item.historialEdiciones].reverse().map((ed,i) => (
                  <div key={i} className="text-[8px] border-l-2 pl-2" style={{borderColor:'var(--accent)',color:'var(--steel)'}}>
                    <span className="font-bold" style={{color:'var(--accent)'}}>{ed.editadoPor}</span> cambió{' '}
                    <span className="line-through" style={{color:'var(--mist)'}}>{fmt(ed.montoAnterior)}</span> → <span className="font-bold">{fmt(ed.montoNuevo)}</span>
                    {ed.motivo&&<span style={{color:'var(--oxford)'}}> ({ed.motivo})</span>}
                    <span className="block" style={{color:'var(--mist)'}}>{ed.fecha}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 p-3.5 rounded-xl font-bold text-xs uppercase" style={{background:'var(--ice)',color:'var(--oxford)'}}>Cancelar</button>
          <button onClick={() => onSave(item,newAmount,motivo)} className="flex-1 p-3.5 text-white rounded-xl font-bold text-xs uppercase"
            style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)'}}>Guardar Cambio</button>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY TABLE ────────────────────────────────────────────────────────────

function HistoryTable({allPeriod,trucks,truckFilter,onTruckFilter,onBaja,onEdit,fmt,onExport}) {
  const [showBaja, setShowBaja] = useState(false);
  const displayed = allPeriod.filter((h) => {
    const okBaja  = showBaja?true:(h.status!=='baja');
    const okTruck = truckFilter?h.truckId===truckFilter:true;
    return okBaja&&okTruck;
  });
  const total = displayed.filter((h)=>h.status!=='baja').reduce((a,h)=>a+Number(h.amount),0);

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3" style={{borderColor:'var(--mist)',background:'var(--ice)'}}>
        <div>
          <h2 className="font-display font-black uppercase text-sm" style={{color:'var(--navy)'}}>Movimientos</h2>
          <p className="font-mono text-[10px] font-bold mt-0.5" style={{color:'var(--accent)'}}>
            {displayed.filter((h)=>h.status!=='baja').length} registros · {fmt(total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={truckFilter} onChange={e=>onTruckFilter(e.target.value)} className="inp text-xs px-3 py-2 outline-none">
            <option value="">Todas las unidades</option>
            {trucks.map((t) => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer whitespace-nowrap" style={{color:'var(--oxford)'}}>
            <input type="checkbox" checked={showBaja} onChange={e=>setShowBaja(e.target.checked)} className="rounded" style={{accentColor:'var(--accent)'}} />
            Ver bajas
          </label>
          <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all"
            style={{color:'var(--success)',borderColor:'#bbf7d0',background:'#f0fdf4'}}>
            ↓ Exportar XLS
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="border-b" style={{background:'var(--ice)',borderColor:'var(--mist)'}}>
            <tr>
              {['Fecha','Unidad','Concepto','Monto','Acciones'].map((h,i) => (
                <th key={h} className={`px-4 py-3 text-[8px] font-bold uppercase tracking-wider ${i===3?'text-right':i===4?'text-center':'text-left'}`} style={{color:'var(--oxford)'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{borderColor:'var(--ice)'}}>
            {displayed.map((item) => {
              const esBaja  = item.status==='baja';
              const editado = item.ultimaEdicion;
              return (
                <tr key={item.id} className={`history-row transition-colors ${esBaja?'opacity-50':''}`}>
                  <td className="px-4 py-3 text-[9px] whitespace-nowrap font-medium" style={{color:'var(--oxford)'}}>{item.date}</td>
                  <td className="px-4 py-3 font-display font-bold uppercase text-xs" style={{color:'var(--navy)'}}>{item.truck}</td>
                  <td className="px-4 py-3">
                    {esBaja
                      ? <div><span className="line-through text-[9px]" style={{color:'var(--oxford)'}}>{item.categoryLabel}</span><p className="text-[7px] font-bold mt-0.5" style={{color:'var(--danger)'}}>Baja: {item.bajaBy}</p></div>
                      : <div>
                          <span className="px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase border"
                            style={isFuel(item.categoryLabel)?{background:'#f0f9ff',color:'var(--fuel)',borderColor:'#bae6fd'}:{background:'var(--ice)',color:'var(--steel)',borderColor:'var(--mist)'}}>
                            {item.categoryLabel}
                          </span>
                          {isFuel(item.categoryLabel)&&(item.litros||0)>0 && (
                            <span className="ml-1.5 text-[7px] font-mono font-bold" style={{color:'var(--fuel)'}}>{item.litros}L · {item.km_registro?.toLocaleString('es-AR')} km</span>
                          )}
                          {editado&&<p className="text-[7px] font-bold mt-0.5 flex items-center gap-1" style={{color:'var(--accent)'}}><Edit2 size={7}/> {editado.editadoPor}{editado.motivo&&<span style={{color:'var(--oxford)'}}> — {editado.motivo}</span>}</p>}
                        </div>
                    }
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold text-xs ${esBaja?'line-through':''}`} style={{color:esBaja?'var(--mist)':'var(--navy)'}}>
                    {fmt(item.amount)}
                    {editado&&!esBaja&&<p className="text-[7px] font-medium line-through" style={{color:'var(--mist)'}}>{fmt(editado.montoAnterior)}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {!esBaja&&<>
                        <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg transition-all hover:bg-blue-50" style={{color:'var(--mist)'}}><Edit2 size={12}/></button>
                        <button onClick={() => onBaja(item)} className="p-1.5 rounded-lg transition-all hover:bg-red-50"  style={{color:'var(--mist)'}}><Ban size={12}/></button>
                      </>}
                      {esBaja&&<span className="text-[7px] font-bold uppercase" style={{color:'var(--danger)'}}>Baja</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayed.length===0&&<tr><td colSpan={5} className="px-4 py-10 text-center text-sm" style={{color:'var(--oxford)'}}>Sin movimientos en el período</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DRIVER VIEW ──────────────────────────────────────────────────────────────

function DriverView({trucks, userEmail, onSubmit, onSignOut}) {
  const [step,       setStep]       = useState('select');
  const [saving,      setSaving]     = useState(false);
  const [ticketFile, setTicketFile] = useState(null);
  const [kmError,    setKmError]    = useState('');

  const handleFuel = async (e) => {
    if (kmError) return;
    e.preventDefault(); setSaving(true);
    await onSubmit(e,{category:'combustible',fotoTicket:ticketFile});
    setSaving(false); setStep('done');
  };

  const handleMaint = async (e) => {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    const subCat    = fd.get('subCat');
    const variosDesc = fd.get('variosDesc');
    await onSubmit(e,{category:subCat||'varios',variosDesc:subCat==='varios'?variosDesc:''});
    setSaving(false); setStep('done');
  };

  if (step==='done') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{background:'var(--ice)'}}>
      <CheckCircle2 size={56} style={{color:'var(--success)'}} className="mb-4" />
      <h2 className="font-display font-black text-2xl uppercase" style={{color:'var(--navy)'}}>¡Registrado!</h2>
      <p className="text-sm mt-2 mb-8" style={{color:'var(--oxford)'}}>El gasto fue guardado correctamente.</p>
      <button onClick={() => { setStep('select'); setTicketFile(null); setKmError(''); }}
        className="px-8 py-4 text-white rounded-2xl font-bold uppercase text-sm"
        style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)'}}>
        Nuevo Registro
      </button>
    </div>
  );

  return (
    <div className="min-h-screen" style={{background:'var(--ice)'}}>
      <div className="p-5 pb-4 flex items-center justify-between" style={{background:'var(--navy)'}}>
        <div>
          <p className="text-[8px] font-bold uppercase tracking-widest mb-0.5" style={{color:'rgba(255,255,255,.4)'}}>{userEmail}</p>
          <h1 className="font-display font-black text-2xl uppercase text-white">Cargar Gasto</h1>
        </div>
        <button onClick={onSignOut} className="p-2 rounded-xl" style={{color:'rgba(255,255,255,.4)'}}><LogOut size={16}/></button>
      </div>

      <div className="p-4 space-y-4">
        {step==='select' && (
          <div className="space-y-3 pt-2">
            {[
              {key:'fuel',  emoji:'⛽', title:'Combustible',   sub:'Registrar carga con litros y KM', color:'#bae6fd', bg:'white'},
              {key:'maint', emoji:'🔧', title:'Mantenimiento', sub:'Mecánico, gomas, varios...',       color:'var(--mist)', bg:'white'},
            ].map(item => (
              <button key={item.key} onClick={() => setStep(item.key)}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left"
                style={{background:item.bg, borderColor:item.color}}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{background:'var(--ice)'}}>{item.emoji}</div>
                <div className="flex-1">
                  <p className="font-display font-black text-lg uppercase" style={{color:'var(--navy)'}}>{item.title}</p>
                  <p className="text-[10px]" style={{color:'var(--oxford)'}}>{item.sub}</p>
                </div>
                <ChevronRight size={18} style={{color:'var(--mist)'}} />
              </button>
            ))}
          </div>
        )}

        {step==='fuel' && (
          <form onSubmit={handleFuel} className="space-y-4">
            <button type="button" onClick={() => setStep('select')} className="text-[9px] font-bold uppercase tracking-wider" style={{color:'var(--oxford)'}}>← Volver</button>
            <select name="truckId" required className="inp w-full p-4 text-base font-bold">
              <option value="">Seleccioná tu camión...</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <p className="text-[8px] font-bold uppercase mb-2" style={{color:'var(--oxford)'}}>KM Odómetro *</p>
                <input name="km_registro" type="number" inputMode="numeric" placeholder="0" required
                  className="w-full font-data text-2xl font-black outline-none bg-transparent" style={{color:'var(--navy)'}}
                  onChange={e => {
                    const t = trucks.find((tr) => tr.id===(document.querySelector('[name=truckId]'))?.value);
                    const last = t?.kmActual||0;
                    if (parseFloat(e.target.value)<=last) setKmError(`Debe ser > ${last.toLocaleString()} km`);
                    else setKmError('');
                  }} />
                {kmError&&<p className="text-[7px] mt-1 font-bold" style={{color:'var(--danger)'}}>{kmError}</p>}
              </div>
              <div className="card p-4">
                <p className="text-[8px] font-bold uppercase mb-2" style={{color:'var(--oxford)'}}>Litros *</p>
                <input name="litros" type="number" inputMode="decimal" step="0.01" placeholder="0.00" required
                  className="w-full font-data text-2xl font-black outline-none bg-transparent" style={{color:'#0ea5e9'}} />
              </div>
            </div>
            <div className="card p-5">
              <p className="text-[8px] font-bold uppercase mb-2" style={{color:'var(--oxford)'}}>Monto Total ($) *</p>
              <input name="amount" type="number" inputMode="decimal" step="0.01" placeholder="0.00" required
                className="w-full font-data text-4xl font-black outline-none bg-transparent" style={{color:'var(--navy)'}} />
            </div>
            <div className="card p-4">
              <p className="text-[8px] font-bold uppercase mb-3" style={{color:'var(--oxford)'}}>Foto del Ticket</p>
              {ticketFile
                ? <div className="flex items-center gap-2 p-2 rounded-xl border" style={{background:'#f0fdf4',borderColor:'#bbf7d0'}}>
                    <Camera size={14} style={{color:'var(--success)'}}/>
                    <span className="text-[9px] flex-1 truncate">{ticketFile.name}</span>
                    <button type="button" onClick={()=>setTicketFile(null)}><X size={11}/></button>
                  </div>
                : <label className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed cursor-pointer" style={{borderColor:'var(--mist)',background:'var(--ice)'}}>
                    <Camera size={24} style={{color:'var(--oxford)'}}/>
                    <p className="text-[10px] font-bold uppercase" style={{color:'var(--oxford)'}}>Sacar foto</p>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e=>{if(e.target.files?.[0])setTicketFile(e.target.files[0]);}} />
                  </label>
              }
            </div>
            <button type="submit" disabled={saving||Boolean(kmError)}
              className="w-full py-5 text-white rounded-2xl font-display font-black text-lg uppercase disabled:opacity-40"
              style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)',boxShadow:'0 10px 28px rgba(37,99,235,.4)'}}>
              {saving?<span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin"/>Guardando...</span>:'Confirmar Carga'}
            </button>
          </form>
        )}

        {step==='maint' && (
          <form onSubmit={handleMaint} className="space-y-4">
            <button type="button" onClick={() => setStep('select')} className="text-[9px] font-bold uppercase tracking-wider" style={{color:'var(--oxford)'}}>← Volver</button>
            <select name="truckId" required className="inp w-full p-4 text-base font-bold">
              <option value="">Seleccioná tu camión...</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
            </select>
            <div>
              <p className="text-[8px] font-bold uppercase mb-2" style={{color:'var(--oxford)'}}>Tipo de trabajo *</p>
              <select name="subCat" required className="inp w-full p-4 text-base font-bold">
                <option value="">Seleccionar...</option>
                {[['mecanico','Mecánico'],['elastiquero','Elastiquero'],['chapista','Chapista'],['tapicero','Tapicero'],
                  ['gomeria','Gomería'],['electricista','Electricista'],['neumaticos','Neumáticos'],['taller','Taller General'],['varios','Otros / Varios']
                ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <textarea name="variosDesc" placeholder="Descripción del trabajo..." rows={3} className="inp w-full p-3 text-sm resize-none" />
            <div className="card p-5">
              <p className="text-[8px] font-bold uppercase mb-2" style={{color:'var(--oxford)'}}>Monto Total ($) *</p>
              <input name="amount" type="number" inputMode="decimal" step="0.01" placeholder="0.00" required
                className="w-full font-data text-4xl font-black outline-none bg-transparent" style={{color:'var(--navy)'}} />
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-5 text-white rounded-2xl font-display font-black text-lg uppercase disabled:opacity-40"
              style={{background:'linear-gradient(135deg,var(--navy),var(--navy-3))',boxShadow:'0 10px 28px rgba(11,17,32,.35)'}}>
              {saving?<span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin"/>Guardando...</span>:'Registrar Gasto'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

function SubKpi({label,value,Icon,accent,bg,border,suffix,mono}) {
  return (
    <div className="kpi-sub p-5 flex flex-col justify-between" style={{minHeight:130}}>
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-xl" style={{background:bg,border:`1px solid ${border}`}}><Icon size={13} style={{color:accent}} /></div>
        {suffix&&<span className="text-[7px] font-bold uppercase tracking-widest" style={{color:'var(--mist)'}}>{suffix}</span>}
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{color:'var(--oxford)'}}>{label}</p>
        <p className={`font-extrabold text-xl tracking-tight ${mono?'font-mono font-data':''}`} style={{color:'var(--navy)'}}>{value}</p>
      </div>
    </div>
  );
}

function BarTooltip({active,payload,fmt}) {
  if (!active||!payload?.length) return null;
  return (
    <div className="p-3 rounded-xl shadow-2xl text-white text-xs" style={{background:'var(--navy)'}}>
      <p className="text-[8px] font-bold uppercase mb-2" style={{color:'var(--oxford)'}}>{payload[0]?.payload?.patente}</p>
      <p className="font-bold flex justify-between gap-5"><span className="opacity-50">Fijos:</span>{fmt(payload[0]?.value||0)}</p>
      <p className="font-bold flex justify-between gap-5" style={{color:'#fb923c'}}><span className="opacity-50 text-white">Variables:</span>{fmt(payload[1]?.value||0)}</p>
    </div>
  );
}

function Notification({banner}) {
  if (!banner) return null;
  const isErr = banner.type==='error';
  return (
    <div className="fixed top-4 right-4 z-[200] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 max-w-xs anim-up"
      style={{background:isErr?'linear-gradient(135deg,#b91c1c,#dc2626)':'linear-gradient(135deg,var(--navy),var(--navy-3))',border:`1px solid ${isErr?'#f87171':'rgba(37,99,235,.3)'}`,boxShadow:isErr?'0 8px 28px rgba(185,28,28,.4)':'0 8px 28px rgba(0,0,0,.4)'}}>
      {isErr?<AlertCircle size={15}/>:<CheckCircle2 size={15} style={{color:'#93c5fd'}}/>}
      <p className="font-medium text-sm">{banner.msg}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{background:'linear-gradient(135deg,var(--navy) 0%,#0a1628 100%)'}}>
      <div className="w-14 h-14 rounded-[22px] flex items-center justify-center mb-6 float"
        style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)',boxShadow:'0 8px 28px rgba(37,99,235,.5)'}}>
        <Truck className="text-white" size={24}/>
      </div>
      <Loader2 className="animate-spin mb-3" size={20} style={{color:'var(--accent)'}}/>
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{color:'var(--steel)'}}>Conectando sistema...</p>
    </div>
  );
}

function LoginComponent({onLogin}) {
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const submit = async (e) => { setLoading(true); await onLogin(e); setLoading(false); };

  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-4">
      <div className="login-dots"/>
      <div className="login-card w-full max-w-md rounded-[32px] p-9 relative z-10 anim-up">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-[22px] flex items-center justify-center float"
            style={{background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',boxShadow:'0 12px 36px rgba(37,99,235,.5)'}}>
            <Truck className="text-white" size={28}/>
          </div>
        </div>
        <div className="text-center mb-8">
          <h1 className="font-display font-black text-3xl uppercase tracking-tight text-white mb-1">
            DISTRIBUIDORA <span style={{color:'#93c5fd'}}>VERACRUZ</span>
          </h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{color:'rgba(255,255,255,.28)'}}>Sistema de Gestión de Flota</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="d2 anim-up">
            <label className="text-[8px] font-bold uppercase tracking-widest block mb-1.5" style={{color:'rgba(255,255,255,.38)'}}>Email</label>
            <input type="email" name="email" placeholder="tu@email.com" required className="login-input w-full p-3.5 rounded-2xl text-sm" />
          </div>
          <div className="d3 anim-up">
            <label className="text-[8px] font-bold uppercase tracking-widest block mb-1.5" style={{color:'rgba(255,255,255,.38)'}}>Contraseña</label>
            <div className="relative">
              <input type={showPass?'text':'password'} name="password" placeholder="••••••••" required className="login-input w-full p-3.5 rounded-2xl text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:text-white" style={{color:'rgba(255,255,255,.28)'}}>
                {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
              </button>
            </div>
          </div>
          <div className="pt-2 d4 anim-up">
            <button type="submit" disabled={loading} className="login-btn w-full py-4 rounded-2xl font-display font-black uppercase text-sm text-white tracking-wider disabled:opacity-50">
              {loading?<span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin"/>Verificando...</span>:'Iniciar Sesión'}
            </button>
          </div>
        </form>
        <div className="mt-8 pt-6" style={{borderTop:'1px solid rgba(255,255,255,.06)'}}>
          <p className="text-center text-[8px] font-bold uppercase tracking-widest" style={{color:'rgba(255,255,255,.13)'}}>
            Distribuidora Veracruz S.A. · Sistema Interno
          </p>
        </div>
      </div>
    </div>
  );
}