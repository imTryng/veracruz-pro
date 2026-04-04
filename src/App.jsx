import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line
} from 'recharts';
import {
  Truck, Plus, Search, LogOut, RotateCcw,
  AlertTriangle, Trash2, Gauge, DollarSign,
  TrendingUp, Loader2, CheckCircle2, AlertCircle,
  Users, Shield, Clock, Eye, EyeOff,
  Building, ChevronDown, ChevronUp, Ban,
  AlertCircle as AlertIcon, Edit2, Save, X, History
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'veracruz-fleet-pro-v2';

const ROLES = { ADMIN: 'admin', USER: 'user' };
const TODAY = new Date('2026-04-03');

function alertVencimiento(fechaStr) {
  if (!fechaStr) return null;
  const fecha = new Date(fechaStr);
  const diffDays = Math.floor((fecha - TODAY) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 30) return 'proximo';
  return null;
}

function isFuel(label) {
  return (label || '').toLowerCase().startsWith('combustible');
}

const LINE_COLORS = ['#6366f1', '#f97316', '#8b5cf6', '#10b981', '#ef4444', '#facc15'];

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;600;700&display=swap');

  * { font-family: 'DM Sans', sans-serif; }
  .font-display { font-family: 'Syne', sans-serif; }
  .font-mono { font-family: 'JetBrains Mono', monospace; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
    70% { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
    100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }

  .animate-fade-up { animation: fadeUp 0.5s ease forwards; }
  .animate-fade-in { animation: fadeIn 0.4s ease forwards; }
  .anim-delay-1 { animation-delay: 0.1s; opacity: 0; }
  .anim-delay-2 { animation-delay: 0.2s; opacity: 0; }
  .anim-delay-3 { animation-delay: 0.3s; opacity: 0; }
  .anim-delay-4 { animation-delay: 0.4s; opacity: 0; }
  .float-icon { animation: float 3s ease-in-out infinite; }

  .login-bg {
    background: linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 40%, #111827 100%);
    position: relative;
    overflow: hidden;
  }
  .login-bg::before {
    content: '';
    position: absolute;
    width: 600px; height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
    top: -150px; left: -100px;
    pointer-events: none;
  }
  .login-bg::after {
    content: '';
    position: absolute;
    width: 400px; height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%);
    bottom: -100px; right: -50px;
    pointer-events: none;
  }

  .login-card {
    background: rgba(255,255,255,0.035);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
  }

  .login-input {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: white;
    transition: all 0.25s ease;
  }
  .login-input::placeholder { color: rgba(255,255,255,0.25); }
  .login-input:focus {
    background: rgba(99,102,241,0.1);
    border-color: rgba(99,102,241,0.5);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    outline: none;
  }

  .login-btn {
    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%);
    background-size: 200% auto;
    transition: all 0.3s ease;
    box-shadow: 0 8px 32px rgba(99,102,241,0.4);
  }
  .login-btn:hover {
    background-position: right center;
    box-shadow: 0 12px 40px rgba(99,102,241,0.6);
    transform: translateY(-1px);
  }
  .login-btn:active { transform: translateY(0); }

  .nav-glass {
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(99,102,241,0.08);
    box-shadow: 0 1px 20px rgba(0,0,0,0.06);
  }

  .tab-active {
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: white !important;
    box-shadow: 0 4px 14px rgba(99,102,241,0.35);
  }

  .stat-card {
    background: white;
    border: 1px solid rgba(99,102,241,0.08);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(99,102,241,0.12);
    border-color: rgba(99,102,241,0.2);
  }

  .chart-card {
    background: white;
    border: 1px solid rgba(99,102,241,0.08);
    box-shadow: 0 2px 20px rgba(0,0,0,0.04);
  }

  .truck-card {
    background: white;
    border: 1px solid rgba(99,102,241,0.08);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .truck-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 16px 40px rgba(99,102,241,0.12);
    border-color: rgba(99,102,241,0.25);
  }

  .fab-btn {
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    box-shadow: 0 8px 32px rgba(99,102,241,0.5);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: pulse-ring 2s ease-in-out infinite;
  }
  .fab-btn:hover {
    transform: scale(1.1) rotate(45deg);
    box-shadow: 0 12px 40px rgba(99,102,241,0.65);
  }

  .modal-overlay {
    background: rgba(5, 8, 20, 0.75);
    backdrop-filter: blur(12px);
  }
  .modal-card {
    background: white;
    box-shadow: 0 40px 100px rgba(0,0,0,0.3);
  }

  .form-input {
    background: #f8f9ff;
    border: 1.5px solid #e8eaf6;
    transition: all 0.2s ease;
  }
  .form-input:focus {
    background: white;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
    outline: none;
  }

  .alert-banner {
    background: linear-gradient(135deg, #fffbeb, #fef3c7);
    border: 1px solid #fcd34d;
  }

  .gradient-text {
    background: linear-gradient(135deg, #4f46e5, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .indigo-accent { color: #6366f1; }
  .indigo-bg { background: #6366f1; }

  .filter-bar {
    background: white;
    border: 1px solid rgba(99,102,241,0.1);
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  }

  .history-row:hover { background: #f8f9ff; }

  .rank-bar {
    background: linear-gradient(90deg, #4f46e5, #818cf8);
  }
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [trucks, setTrucks] = useState([]);
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyTruckFilter, setHistoryTruckFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [notif, setNotif] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [modals, setModals] = useState({
    expense: false, truck: false, delete: null,
    users: false, addUser: false, clientes: false, addCliente: false,
    editTruck: null, editExpense: null
  });

  const showNotif = (msg, type = 'success') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 4000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setShowLogin(false);
        try {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setUserRole(snap.data().role || ROLES.ADMIN);
          } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), {
              uid: u.uid, email: u.email, role: ROLES.ADMIN, createdAt: Date.now()
            }).catch(() => {});
            setUserRole(ROLES.ADMIN);
          }
        } catch { setUserRole(ROLES.ADMIN); }
      } else { setShowLogin(true); }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubT = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'trucks'), snap => {
      setTrucks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDbError(null);
    }, () => setDbError('Error conectando flota'));
    const unsubH = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'history'), orderBy('timestamp', 'desc')), snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDbError(null);
    }, () => setDbError('Error conectando historial'));
    return () => { unsubT(); unsubH(); };
  }, [user]);

  useEffect(() => {
    if (!user || userRole !== ROLES.ADMIN) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [user, userRole]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'clientes'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientes(list);
      if (!selectedClient && list.length > 0) setSelectedClient(list[0].id);
    }, () => {});
    return () => unsub();
  }, [user]);

  const stats = useMemo(() => {
    const startTs = new Date(dateRange.start + "T00:00:00").getTime();
    const endTs = new Date(dateRange.end + "T23:59:59").getTime();
    const activeHistory = history.filter(h =>
      h.timestamp >= startTs && h.timestamp <= endTs &&
      h.status !== 'cancelled' && h.status !== 'baja'
    );
    const allPeriod = history.filter(h => h.timestamp >= startTs && h.timestamp <= endTs);
    const combustibleTotal = activeHistory.filter(h => isFuel(h.categoryLabel)).reduce((a, h) => a + Number(h.amount), 0);
    const mantenimientoTotal = activeHistory.filter(h => !isFuel(h.categoryLabel)).reduce((a, h) => a + Number(h.amount), 0);
    const pieData = [
      { name: 'Combustible', value: combustibleTotal },
      { name: 'Mantenimiento', value: mantenimientoTotal }
    ].filter(d => d.value > 0);
    const truckStats = trucks.map(t => {
      const tHist = activeHistory.filter(h => h.truckId === t.id);
      const varTotal = tHist.reduce((a, h) => a + (Number(h.amount) || 0), 0);
      const fixTotal = (Number(t.seguro) || 0) + (Number(t.vtv_costo) || 0) + (Number(t.muni_costo) || 0);
      const total = varTotal + fixTotal;
      const kmRecorridos = Math.max(0, (t.kmActual || 0) - (t.kmInicio || 0));
      const costoPorKm = kmRecorridos > 0 ? total / kmRecorridos : 0;
      const desglose = tHist.reduce((acc, h) => {
        const cat = h.categoryLabel || 'VARIOS';
        acc[cat] = (acc[cat] || 0) + (Number(h.amount) || 0);
        return acc;
      }, {});
      return { ...t, varTotal, fixTotal, total, kmRecorridos, costoPorKm, desglose };
    }).filter(t =>
      t.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.chofer || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const grandTotal = truckStats.reduce((a, t) => a + t.total, 0);
    const monthlyMap = {};
    history.filter(h => h.status !== 'baja' && h.status !== 'cancelled').forEach(h => {
      const d = new Date(h.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('es-AR', { month: 'short', year: '2-digit' });
      if (!monthlyMap[key]) monthlyMap[key] = { mes: label, total: 0, combustible: 0, mantenimiento: 0 };
      monthlyMap[key].total += Number(h.amount) || 0;
      if (isFuel(h.categoryLabel)) monthlyMap[key].combustible += Number(h.amount) || 0;
      else monthlyMap[key].mantenimiento += Number(h.amount) || 0;
    });
    const trendData = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => v);
    const ranking = [...truckStats].sort((a, b) => b.total - a.total);
    const alertas = trucks.filter(t => alertVencimiento(t.seguro_venc) || alertVencimiento(t.vtv_venc))
      .map(t => ({
        patente: t.patente, chofer: t.chofer,
        alertaSeguro: alertVencimiento(t.seguro_venc),
        alertaVtv: alertVencimiento(t.vtv_venc),
        seguro_venc: t.seguro_venc, vtv_venc: t.vtv_venc
      }));
    return { truckStats, grandTotal, totalExpenses: activeHistory.length, activeHistory, allPeriod, pieData, trendData, ranking, alertas };
  }, [trucks, history, searchTerm, dateRange]);

  const handleAddTruck = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trucks'), {
        patente: fd.get('patente').toUpperCase(), chofer: fd.get('chofer'),
        seguro: parseFloat(fd.get('seguro')) || 0, vtv_costo: parseFloat(fd.get('vtv')) || 0,
        muni_costo: parseFloat(fd.get('muni')) || 0,
        seguro_venc: fd.get('seguro_venc') || '', vtv_venc: fd.get('vtv_venc') || '',
        kmActual: parseFloat(fd.get('km')) || 0, kmInicio: parseFloat(fd.get('km')) || 0,
        timestamp: Date.now()
      });
      setModals(p => ({ ...p, truck: false }));
      showNotif("Camión añadido");
    } catch { showNotif("Error al guardar", "error"); }
  };

  const handleEditTruck = async (e, truckId) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', truckId), {
        chofer: fd.get('chofer'),
        seguro: parseFloat(fd.get('seguro')) || 0, vtv_costo: parseFloat(fd.get('vtv')) || 0,
        muni_costo: parseFloat(fd.get('muni')) || 0,
        seguro_venc: fd.get('seguro_venc') || '', vtv_venc: fd.get('vtv_venc') || '',
        kmActual: parseFloat(fd.get('km')) || 0,
        editadoPor: user.email, editadoAt: Date.now()
      });
      setModals(p => ({ ...p, editTruck: null }));
      showNotif("Camión actualizado");
    } catch { showNotif("Error al actualizar", "error"); }
  };

  const handleAddExpense = async (e, extra = {}) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const truckId = fd.get('truckId');
    const truck = trucks.find(t => t.id === truckId);
    const amount = parseFloat(fd.get('amount'));
    const category = extra.category || 'varios';
    const variosDesc = extra.variosDesc || '';
    const km = fd.get('km');
    const label = category === 'varios' && variosDesc ? `VARIOS - ${variosDesc.toUpperCase()}` : category.toUpperCase();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'history'), {
        truckId, truck: truck.patente, categoryLabel: label, amount,
        responsible: user.email, status: 'active',
        timestamp: Date.now(), date: new Date().toLocaleString('es-AR'),
        historialEdiciones: []
      });
      if (isFuel(label) && km) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', truckId), { kmActual: parseFloat(km) });
      }
      setModals(p => ({ ...p, expense: false }));
      showNotif("Gasto registrado");
    } catch { showNotif("Error al registrar", "error"); }
  };

  const handleEditExpense = async (item, newAmount, motivo) => {
    if (!newAmount || isNaN(newAmount)) return showNotif("Monto inválido", "error");
    const edicion = {
      montoAnterior: item.amount, montoNuevo: parseFloat(newAmount),
      editadoPor: user.email, editadoAt: Date.now(),
      fecha: new Date().toLocaleString('es-AR'), motivo: motivo || ''
    };
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'history', item.id), {
        amount: parseFloat(newAmount),
        historialEdiciones: [...(item.historialEdiciones || []), edicion],
        ultimaEdicion: edicion
      });
      setModals(p => ({ ...p, editExpense: null }));
      showNotif("Monto actualizado");
    } catch { showNotif("Error al editar", "error"); }
  };

  const handleBajaExpense = async (item) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'history', item.id), {
        status: 'baja', bajaBy: user.email, bajaAt: Date.now()
      });
      showNotif("Registro dado de baja");
    } catch { showNotif("Error al dar de baja", "error"); }
  };

  const handleDeleteTruck = async () => {
    if (!modals.delete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', modals.delete.id));
      showNotif("Unidad eliminada");
      setModals(p => ({ ...p, delete: null }));
    } catch { showNotif("Error al borrar", "error"); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await signInWithEmailAndPassword(auth, fd.get('email'), fd.get('password'));
      showNotif("¡Bienvenido!");
    } catch (err) { showNotif(err.message || "Error en login", "error"); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const uc = await createUserWithEmailAndPassword(auth, fd.get('email'), fd.get('password'));
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), {
        uid: uc.user.uid, email: fd.get('email'), role: fd.get('role'),
        createdAt: Date.now(), createdBy: user.email
      });
      showNotif("Usuario creado");
      setModals(p => ({ ...p, addUser: false }));
      e.target.reset();
    } catch (err) { showNotif(err.message || "Error", "error"); }
  };

  const handleCreateCliente = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clientes'), {
        nombre: fd.get('nombre'), email: fd.get('email'), telefono: fd.get('telefono'),
        createdAt: Date.now(), createdBy: user.email, estado: 'activo'
      });
      setSelectedClient(ref.id);
      showNotif("Cliente creado");
      setModals(p => ({ ...p, addCliente: false }));
      e.target.reset();
    } catch (err) { showNotif(err.message || "Error", "error"); }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = (await import('xlsx')).default || (await import('xlsx'));
      const data = stats.activeHistory.map(h => ({
        Fecha: h.date, Unidad: h.truck, Concepto: h.categoryLabel,
        Monto: h.amount, Responsable: h.responsible,
        UltimaEdicion: h.ultimaEdicion ? `${h.ultimaEdicion.editadoPor} (${h.ultimaEdicion.fecha})` : ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Gastos");
      XLSX.writeFile(wb, `gastos-${new Date().toISOString().split('T')[0]}.xlsx`);
      showNotif("Excel descargado");
    } catch { showNotif("Error al exportar", "error"); }
  };

  const handleBackup = async () => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'backups'), {
        trucks, history: stats.activeHistory,
        timestamp: new Date().toISOString(), userId: user.uid, createdAt: Date.now()
      });
      showNotif("Respaldo creado");
    } catch { showNotif("Error en respaldo", "error"); }
  };

  const fmt = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);

  if (authLoading) return (
    <>
      <style>{globalStyles}</style>
      <LoadingScreen message="Conectando..." />
    </>
  );
  if (showLogin) return (
    <>
      <style>{globalStyles}</style>
      <LoginComponent onLogin={handleLogin} />
    </>
  );

  return (
    <>
      <style>{globalStyles}</style>
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Notification banner={notif} />
        {dbError && (
          <div className="mx-auto max-w-7xl px-4 mt-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm font-bold">{dbError}</div>
          </div>
        )}

        {/* NAV */}
        <nav className="nav-glass sticky top-0 z-50 px-4 md:px-6 py-3 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white float-icon"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
              <Truck size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-base uppercase tracking-tight">
                <span style={{ color: '#0f172a' }}>VERACRUZ</span>{' '}
                <span className="gradient-text">PRO</span>
              </h1>
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none hidden sm:block">Gestión Veracruz S.A.</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl order-last md:order-none w-full md:w-auto justify-center">
            {[{ id: 'dashboard', label: 'Panel' }, { id: 'units', label: 'Flota' }, { id: 'history', label: 'Gastos' }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all duration-200 flex-1 md:flex-none tracking-wider ${activeTab === tab.id ? 'tab-active' : 'text-slate-400 hover:text-slate-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl hover:bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 transition-all">
              XLS
            </button>
            {userRole === ROLES.ADMIN && (
              <button onClick={() => setModals(m => ({ ...m, users: true }))}
                className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100">
                <Users size={15} />
              </button>
            )}
            {userRole === ROLES.ADMIN && (
              <button onClick={() => setModals(m => ({ ...m, clientes: true }))}
                className="p-2 rounded-xl text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all border border-transparent hover:border-cyan-100">
                <Building size={15} />
              </button>
            )}
            <button onClick={handleBackup}
              className="p-2 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-all border border-transparent hover:border-violet-100">
              <Clock size={15} />
            </button>
            <button onClick={() => signOut(auth)}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100">
              <LogOut size={15} />
            </button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-5 pb-28">

          {/* CLIENTE */}
          {clientes.length > 0 && (
            <div className="p-4 rounded-2xl border" style={{ background: 'linear-gradient(135deg, #eef2ff, #f0f9ff)', borderColor: 'rgba(99,102,241,0.15)' }}>
              <div className="flex items-center gap-3">
                <Building size={15} className="indigo-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-bold uppercase text-indigo-400 tracking-widest">Cliente Activo</p>
                  <select value={selectedClient || ''} onChange={e => setSelectedClient(e.target.value)}
                    className="bg-white border rounded-xl text-sm font-semibold p-1.5 w-full mt-0.5 focus:outline-none focus:ring-2"
                    style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* FILTROS */}
          <div className="filter-bar p-4 rounded-2xl">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[160px] space-y-1">
                <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13} />
                  <input type="text" placeholder="Patente o chofer..."
                    className="form-input pl-8 pr-3 py-2.5 rounded-xl text-xs font-medium w-full"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Período</label>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 form-input">
                  <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="bg-transparent text-[10px] font-medium outline-none" />
                  <span className="text-slate-300 text-xs">—</span>
                  <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="bg-transparent text-[10px] font-medium outline-none" />
                </div>
              </div>
            </div>
          </div>

          {/* ALERTAS */}
          {stats.alertas.length > 0 && (
            <div className="alert-banner rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-amber-500" />
                <p className="text-[9px] font-bold uppercase text-amber-600 tracking-widest">Alertas de Vencimiento</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {stats.alertas.map((a, i) => (
                  <div key={i} className="bg-white rounded-xl border border-amber-200 p-3 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                      <Truck size={13} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs uppercase">{a.patente} <span className="font-normal text-slate-400">— {a.chofer}</span></p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.alertaSeguro && (
                          <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full ${a.alertaSeguro === 'vencido' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                            Seguro {a.alertaSeguro === 'vencido' ? 'VENCIDO' : `vence ${a.seguro_venc}`}
                          </span>
                        )}
                        {a.alertaVtv && (
                          <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full ${a.alertaVtv === 'vencido' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                            VTV {a.alertaVtv === 'vencido' ? 'VENCIDO' : `vence ${a.vtv_venc}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <DashboardPanel stats={stats} trucks={trucks} fmt={fmt} />
          )}

          {/* FLOTA */}
          {activeTab === 'units' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {stats.truckStats.map(truck => (
                <TruckCard key={truck.id} truck={truck} fmt={fmt}
                  onDelete={() => setModals(m => ({ ...m, delete: truck }))}
                  onEdit={() => setModals(m => ({ ...m, editTruck: truck }))} />
              ))}
              <button onClick={() => setModals(m => ({ ...m, truck: true }))}
                className="group border-2 border-dashed border-slate-200 rounded-[24px] p-8 flex flex-col items-center justify-center gap-3 hover:border-indigo-400 hover:bg-indigo-50 transition-all min-h-[240px]">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-100 transition-transform shadow-inner">
                  <Plus className="text-slate-300 group-hover:text-indigo-500" size={22} />
                </div>
                <span className="font-bold text-[9px] uppercase text-slate-400 group-hover:text-indigo-400 tracking-widest text-center transition-colors">Añadir Camión</span>
              </button>
            </div>
          )}

          {/* HISTORIAL */}
          {activeTab === 'history' && (
            <HistoryTable
              allPeriod={stats.allPeriod}
              trucks={trucks}
              truckFilter={historyTruckFilter}
              onTruckFilter={setHistoryTruckFilter}
              onBaja={handleBajaExpense}
              onEdit={(item) => setModals(m => ({ ...m, editExpense: item }))}
              fmt={fmt}
            />
          )}
        </main>

        {/* FAB */}
        <button onClick={() => setModals(m => ({ ...m, expense: true }))}
          className="fab-btn fixed bottom-6 right-6 z-40 w-14 h-14 text-white rounded-full flex items-center justify-center">
          <Plus size={22} />
        </button>

        {/* MODALS */}
        {modals.truck && <TruckFormModal title="Alta de Camión" onSubmit={handleAddTruck} onClose={() => setModals(p => ({ ...p, truck: false }))} />}
        {modals.editTruck && <TruckFormModal title="Editar Camión" initial={modals.editTruck} onSubmit={(e) => handleEditTruck(e, modals.editTruck.id)} onClose={() => setModals(p => ({ ...p, editTruck: null }))} />}
        {modals.expense && <ExpenseModal trucks={trucks} onSubmit={handleAddExpense} onClose={() => setModals(m => ({ ...m, expense: false }))} />}
        {modals.editExpense && <EditExpenseModal item={modals.editExpense} fmt={fmt} onSave={handleEditExpense} onClose={() => setModals(m => ({ ...m, editExpense: null }))} />}

        {modals.delete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-overlay">
            <div className="modal-card bg-white p-8 rounded-[28px] w-full max-w-sm text-center border-b-4 border-red-500">
              <AlertTriangle size={28} className="mx-auto text-red-500 mb-4" />
              <h3 className="font-display font-extrabold uppercase text-lg mb-1">¿Eliminar Unidad?</h3>
              <p className="text-sm font-medium text-slate-400 mb-6">Camión <span className="text-slate-900 font-bold">{modals.delete.patente}</span></p>
              <div className="flex gap-3">
                <button onClick={() => setModals(m => ({ ...m, delete: null }))} className="flex-1 p-3 bg-slate-100 rounded-2xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={handleDeleteTruck} className="flex-1 p-3 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase hover:bg-red-600 transition-all">Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {modals.users && userRole === ROLES.ADMIN && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay">
            <div className="modal-card bg-white w-full max-w-lg rounded-[28px] p-7 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-extrabold text-xl uppercase gradient-text flex items-center gap-2"><Shield size={18} /> Usuarios</h2>
                <button onClick={() => setModals(m => ({ ...m, users: false }))} className="text-slate-300 hover:text-slate-700 transition-colors text-lg">✕</button>
              </div>
              <button onClick={() => setModals(m => ({ ...m, addUser: true }))}
                className="mb-4 w-full text-white px-4 py-3 rounded-2xl text-sm font-bold uppercase transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}>
                + Crear Usuario
              </button>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                    <div><p className="font-semibold text-sm">{u.email}</p><p className="text-[8px] text-slate-400 uppercase font-bold">{u.role}</p></div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase ${u.role === ROLES.ADMIN ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {modals.addUser && userRole === ROLES.ADMIN && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 modal-overlay">
            <div className="modal-card bg-white w-full max-w-md rounded-[28px] p-7">
              <h2 className="font-display font-extrabold text-xl uppercase mb-5 gradient-text">Crear Usuario</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <input name="email" type="email" placeholder="Email" required className="form-input w-full p-3.5 rounded-2xl font-medium" />
                <input name="password" type="password" placeholder="Contraseña" required className="form-input w-full p-3.5 rounded-2xl font-medium" />
                <select name="role" className="form-input w-full p-3.5 rounded-2xl font-medium">
                  <option value={ROLES.USER}>Usuario Normal</option>
                  <option value={ROLES.ADMIN}>Administrador</option>
                </select>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setModals(m => ({ ...m, addUser: false }))} className="flex-1 p-3 bg-slate-100 rounded-2xl font-bold text-xs uppercase hover:bg-slate-200 transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 p-3 text-white rounded-2xl font-bold text-xs uppercase" style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}>Crear</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {modals.clientes && userRole === ROLES.ADMIN && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay">
            <div className="modal-card bg-white w-full max-w-lg rounded-[28px] p-7 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-extrabold text-xl uppercase text-cyan-600 flex items-center gap-2"><Building size={18} /> Clientes</h2>
                <button onClick={() => setModals(m => ({ ...m, clientes: false }))} className="text-slate-300 hover:text-slate-700 transition-colors text-lg">✕</button>
              </div>
              <button onClick={() => setModals(m => ({ ...m, addCliente: true }))}
                className="mb-4 w-full bg-cyan-600 text-white px-4 py-3 rounded-2xl text-sm font-bold uppercase hover:bg-cyan-700 transition-all">
                + Crear Cliente
              </button>
              <div className="space-y-2">
                {clientes.map(c => (
                  <div key={c.id} className="bg-cyan-50 p-3 rounded-2xl border border-cyan-100 flex justify-between items-center">
                    <div><p className="font-semibold text-sm">{c.nombre}</p><p className="text-[8px] text-cyan-500 uppercase font-bold">{c.email}</p></div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase ${c.estado === 'activo' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{c.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {modals.addCliente && userRole === ROLES.ADMIN && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 modal-overlay">
            <div className="modal-card bg-white w-full max-w-md rounded-[28px] p-7">
              <h2 className="font-display font-extrabold text-xl uppercase mb-5 text-cyan-600">Crear Cliente</h2>
              <form onSubmit={handleCreateCliente} className="space-y-4">
                <input name="nombre" placeholder="Nombre o empresa" required className="form-input w-full p-3.5 rounded-2xl font-medium" />
                <input name="email" type="email" placeholder="Email" required className="form-input w-full p-3.5 rounded-2xl font-medium" />
                <input name="telefono" placeholder="Teléfono (opcional)" className="form-input w-full p-3.5 rounded-2xl font-medium" />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setModals(m => ({ ...m, addCliente: false }))} className="flex-1 p-3 bg-slate-100 rounded-2xl font-bold text-xs uppercase hover:bg-slate-200 transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 p-3 bg-cyan-600 text-white rounded-2xl font-bold text-xs uppercase hover:bg-cyan-700 transition-all">Crear</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── TRUCK FORM MODAL ─────────────────────────────────────────────────────────
function TruckFormModal({ title, initial = {}, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay">
      <div className="modal-card bg-white w-full max-w-lg rounded-[28px] p-7 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display font-extrabold text-2xl uppercase mb-5 gradient-text">{title}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          {!initial.id && (
            <input name="patente" placeholder="PATENTE (EJ: AA123BB)" required defaultValue={initial.patente || ''}
              className="form-input w-full p-3.5 rounded-2xl font-bold uppercase" />
          )}
          {initial.id && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 font-bold uppercase text-sm text-slate-500">{initial.patente}</div>
          )}
          <input name="chofer" placeholder="Nombre del chofer" required defaultValue={initial.chofer || ''}
            className="form-input w-full p-3.5 rounded-2xl font-medium" />
          <input name="km" type="number" placeholder="KM Actual" defaultValue={initial.kmActual || ''}
            className="form-input w-full p-3.5 rounded-2xl font-medium" />
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[8px] font-bold uppercase text-slate-400 mb-3 tracking-wider">Gastos Fijos Mensuales</p>
            <div className="grid grid-cols-3 gap-3">
              {[{ name: 'seguro', label: 'Seguro ($)', val: initial.seguro }, { name: 'vtv', label: 'VTV ($)', val: initial.vtv_costo }, { name: 'muni', label: 'Hab. Mun. ($)', val: initial.muni_costo }].map(f => (
                <div key={f.name} className="space-y-1">
                  <label className="text-[7px] font-bold uppercase text-slate-400">{f.label}</label>
                  <input name={f.name} type="number" placeholder="0" defaultValue={f.val || ''}
                    className="form-input w-full p-2.5 rounded-xl text-xs" />
                </div>
              ))}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[8px] font-bold uppercase text-slate-400 mb-3 tracking-wider">Fechas de Vencimiento</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[7px] font-bold uppercase text-slate-400">Venc. Seguro</label>
                <input name="seguro_venc" type="date" defaultValue={initial.seguro_venc || ''}
                  className="form-input w-full p-2.5 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[7px] font-bold uppercase text-slate-400">Venc. VTV</label>
                <input name="vtv_venc" type="date" defaultValue={initial.vtv_venc || ''}
                  className="form-input w-full p-2.5 rounded-xl text-xs" />
              </div>
            </div>
          </div>
          {initial.editadoPor && (
            <div className="rounded-xl p-3 text-[8px] font-medium text-indigo-600 border" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
              ✏️ Última edición por <span className="font-bold">{initial.editadoPor}</span> — {new Date(initial.editadoAt).toLocaleString('es-AR')}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 p-3.5 bg-slate-100 rounded-2xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-200 transition-all">Cancelar</button>
            <button type="submit" className="flex-1 p-3.5 text-white rounded-2xl font-bold text-xs uppercase transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── EDIT EXPENSE MODAL ───────────────────────────────────────────────────────
function EditExpenseModal({ item, fmt, onSave, onClose }) {
  const [newAmount, setNewAmount] = useState(String(item.amount));
  const [motivo, setMotivo] = useState('');
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-overlay">
      <div className="modal-card bg-white w-full max-w-md rounded-[28px] p-7">
        <h2 className="font-display font-extrabold text-xl uppercase mb-1 gradient-text">Editar Monto</h2>
        <p className="text-[9px] font-medium text-slate-400 mb-5">{item.truck} — {item.categoryLabel} — {item.date}</p>
        <div className="space-y-4">
          <div>
            <label className="text-[8px] font-bold uppercase text-slate-400">Monto actual</label>
            <p className="text-2xl font-bold text-slate-300 line-through">{fmt(item.amount)}</p>
          </div>
          <div>
            <label className="text-[8px] font-bold uppercase text-slate-400">Nuevo monto ($)</label>
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
              className="w-full p-4 rounded-2xl text-2xl font-black text-center text-white mt-1 outline-none focus:ring-4 focus:ring-indigo-500/40"
              style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }} />
          </div>
          <div>
            <label className="text-[8px] font-bold uppercase text-slate-400">Motivo del cambio</label>
            <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Error de carga, ajuste..."
              className="form-input w-full p-3.5 rounded-2xl text-sm mt-1" />
          </div>
          {item.historialEdiciones && item.historialEdiciones.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <p className="text-[8px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1"><History size={10} /> Historial</p>
              <div className="space-y-2 max-h-28 overflow-y-auto">
                {[...item.historialEdiciones].reverse().map((ed, i) => (
                  <div key={i} className="text-[8px] text-slate-600 border-l-2 pl-2" style={{ borderColor: '#6366f1' }}>
                    <span className="font-bold indigo-accent">{ed.editadoPor}</span> cambió{' '}
                    <span className="line-through text-slate-400">{fmt(ed.montoAnterior)}</span> → <span className="font-bold">{fmt(ed.montoNuevo)}</span>
                    {ed.motivo && <span className="text-slate-400"> ({ed.motivo})</span>}
                    <span className="block text-slate-300">{ed.fecha}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 p-3.5 bg-slate-100 rounded-2xl font-bold text-xs uppercase hover:bg-slate-200 transition-all">Cancelar</button>
          <button onClick={() => onSave(item, newAmount, motivo)}
            className="flex-1 p-3.5 text-white rounded-2xl font-bold text-xs uppercase hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
            Guardar Cambio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY TABLE ────────────────────────────────────────────────────────────
function HistoryTable({ allPeriod, trucks, truckFilter, onTruckFilter, onBaja, onEdit, fmt }) {
  const [showBaja, setShowBaja] = useState(false);
  const displayed = allPeriod.filter(h => {
    const okBaja = showBaja ? true : (h.status !== 'baja');
    const okTruck = truckFilter ? h.truckId === truckFilter : true;
    return okBaja && okTruck;
  });
  return (
    <div className="bg-white rounded-[20px] border overflow-hidden" style={{ borderColor: 'rgba(99,102,241,0.1)', boxShadow: '0 2px 20px rgba(0,0,0,0.04)' }}>
      <div className="p-4 border-b bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-bold uppercase text-sm text-slate-800">Últimos Movimientos</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select value={truckFilter} onChange={e => onTruckFilter(e.target.value)}
            className="form-input text-xs font-medium rounded-xl px-3 py-2 outline-none">
            <option value="">Todas las unidades</option>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={showBaja} onChange={e => setShowBaja(e.target.checked)} className="rounded accent-indigo-600" />
            Ver bajas
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[560px]">
          <thead className="bg-slate-50 text-[8px] font-bold uppercase text-slate-400 border-b tracking-wider">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayed.map(item => {
              const esBaja = item.status === 'baja';
              const editado = item.ultimaEdicion;
              return (
                <tr key={item.id} className={`history-row transition-colors ${esBaja ? 'bg-red-50/30 opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-[9px] text-slate-400 font-medium whitespace-nowrap">{item.date}</td>
                  <td className="px-4 py-3 font-display font-bold uppercase text-xs text-slate-800">{item.truck}</td>
                  <td className="px-4 py-3">
                    {esBaja ? (
                      <div>
                        <span className="line-through text-[9px] text-slate-400">{item.categoryLabel}</span>
                        <p className="text-[7px] text-red-500 font-bold mt-0.5">Baja: {item.bajaBy}</p>
                      </div>
                    ) : (
                      <div>
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase border ${isFuel(item.categoryLabel) ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                          {item.categoryLabel}
                        </span>
                        {editado && (
                          <p className="text-[7px] text-indigo-400 font-bold mt-0.5 flex items-center gap-1">
                            <Edit2 size={7} /> Editado por {editado.editadoPor}
                            {editado.motivo && <span className="text-slate-400">— {editado.motivo}</span>}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-xs ${esBaja ? 'line-through text-slate-300' : 'text-slate-900'}`}>
                    <div>
                      {fmt(item.amount)}
                      {editado && !esBaja && <p className="text-[7px] text-slate-300 font-medium line-through">{fmt(editado.montoAnterior)}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {!esBaja && (
                        <>
                          <button onClick={() => onEdit(item)} className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"><Edit2 size={12} /></button>
                          <button onClick={() => onBaja(item)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Ban size={12} /></button>
                        </>
                      )}
                      {esBaja && <span className="text-[7px] text-red-400 font-bold uppercase">Baja</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayed.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm font-medium">Sin movimientos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TRUCK CARD ───────────────────────────────────────────────────────────────
function TruckCard({ truck, fmt, onDelete, onEdit }) {
  const [showVar, setShowVar] = useState(false);
  const alertSeguro = alertVencimiento(truck.seguro_venc);
  const alertVtv = alertVencimiento(truck.vtv_venc);
  const desgloseEntries = Object.entries(truck.desglose || {}).sort((a, b) => b[1] - a[1]);

  const alertBadge = (alert, label) => {
    if (!alert) return null;
    const color = alert === 'vencido' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-bold border ${color}`}>
        <AlertIcon size={7} /> {label} {alert === 'vencido' ? 'VENCIDO' : 'PRÓXIMO'}
      </span>
    );
  };

  return (
    <div className="truck-card p-5 rounded-[24px]">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110"
            style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', border: '1px solid #c7d2fe' }}>
            <span className="font-display font-extrabold text-xs uppercase" style={{ color: '#4f46e5' }}>{truck.patente.slice(-3)}</span>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-base uppercase leading-tight text-slate-800">{truck.chofer || 'Sin chofer'}</h3>
            <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{truck.patente}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"><Edit2 size={13} /></button>
          <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={13} /></button>
        </div>
      </div>

      {(alertSeguro || alertVtv) && (
        <div className="flex flex-wrap gap-1 mb-3">{alertBadge(alertSeguro, 'Seguro')}{alertBadge(alertVtv, 'VTV')}</div>
      )}

      <div className="mb-4">
        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Egresos del Período</p>
        <p className="text-3xl font-display font-extrabold tracking-tight gradient-text">{fmt(truck.total)}</p>
      </div>

      <div className="space-y-2 pt-3 border-t border-slate-50">
        {[{ label: 'Seguro', val: truck.seguro }, { label: 'VTV', val: truck.vtv_costo }, { label: 'Hab. Municipal', val: truck.muni_costo }].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase text-slate-400">{item.label}</span>
            <span className="text-[9px] font-bold text-slate-600">{fmt(item.val)}</span>
          </div>
        ))}
      </div>

      <button onClick={() => setShowVar(!showVar)} className="w-full mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-left">
        <span className="text-[8px] font-bold uppercase text-slate-400">Variables del Período</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-orange-500">{fmt(truck.varTotal)}</span>
          {showVar ? <ChevronUp size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />}
        </div>
      </button>

      {showVar && (
        <div className="mt-2 rounded-xl p-3 space-y-1.5" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          {desgloseEntries.length === 0
            ? <p className="text-[8px] text-slate-400 font-medium text-center">Sin gastos variables</p>
            : desgloseEntries.map(([cat, monto]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase text-slate-500 truncate max-w-[130px]">{cat}</span>
                <span className="text-[9px] font-bold text-orange-600 shrink-0 ml-2">{fmt(monto)}</span>
              </div>
            ))
          }
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <Gauge size={11} className="indigo-accent" />
          <span className="text-[8px] font-bold uppercase text-slate-400">{(truck.kmActual || 0).toLocaleString()} KM</span>
        </div>
        {truck.costoPorKm > 0 && (
          <div className="text-right">
            <p className="text-[7px] font-bold uppercase text-slate-400">Costo/KM</p>
            <p className="text-[9px] font-bold text-slate-600">{fmt(truck.costoPorKm)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EXPENSE MODAL ────────────────────────────────────────────────────────────
function ExpenseModal({ trucks, onSubmit, onClose }) {
  const [tipoGasto, setTipoGasto] = useState('');
  const [mantOpen, setMantOpen] = useState(false);
  const [subCat, setSubCat] = useState('');
  const [variosDesc, setVariosDesc] = useState('');

  const opciones = [
    { value: 'mecanico', label: '🔧 Mecánico' }, { value: 'elastiquero', label: '🔩 Elastiquero' },
    { value: 'chapista', label: '🚗 Chapista' }, { value: 'tapicero', label: '🪑 Tapicero' },
    { value: 'gomeria', label: '🔄 Gomería' }, { value: 'electricista', label: '⚡ Electricista' },
    { value: 'neumaticos', label: '🛞 Neumáticos' }, { value: 'varios', label: '📦 Varios' },
  ];

  const canSubmit = tipoGasto && (tipoGasto === 'combustible' || (tipoGasto === 'mantenimiento' && subCat && (subCat !== 'varios' || variosDesc)));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e, { category: tipoGasto === 'combustible' ? 'combustible' : subCat, variosDesc: subCat === 'varios' ? variosDesc : '' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay">
      <div className="modal-card bg-white w-full max-w-lg rounded-[28px] p-7 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display font-extrabold text-2xl uppercase mb-5 tracking-tight">
          Registrar <span className="gradient-text">Gasto</span>
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select name="truckId" required className="form-input w-full p-3.5 rounded-2xl font-medium appearance-none">
            <option value="">Seleccione Camión...</option>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
          </select>

          <div className="space-y-2">
            <p className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Tipo de Gasto</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setTipoGasto('combustible'); setSubCat(''); setMantOpen(false); }}
                className={`p-4 rounded-2xl font-bold text-sm uppercase border-2 transition-all ${tipoGasto === 'combustible' ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-orange-300'}`}>
                ⛽ Combustible
              </button>
              <button type="button" onClick={() => { setTipoGasto('mantenimiento'); setMantOpen(o => !o); }}
                className={`p-4 rounded-2xl font-bold text-sm uppercase border-2 transition-all flex items-center justify-center gap-2 ${tipoGasto === 'mantenimiento' ? 'text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                style={tipoGasto === 'mantenimiento' ? { background: 'linear-gradient(135deg, #4f46e5, #6366f1)' } : {}}>
                🔧 Mantenimiento <span className={`text-xs inline-block transition-transform ${mantOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
            </div>
          </div>

          {tipoGasto === 'mantenimiento' && mantOpen && (
            <div className="grid grid-cols-2 gap-2 p-4 rounded-2xl border" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
              {opciones.map(op => (
                <button key={op.value} type="button" onClick={() => { setSubCat(op.value); setMantOpen(false); }}
                  className={`p-3 rounded-xl font-bold text-[10px] uppercase text-left border transition-all ${subCat === op.value ? 'text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                  style={subCat === op.value ? { background: 'linear-gradient(135deg, #4f46e5, #6366f1)' } : {}}>
                  {op.label}
                </button>
              ))}
            </div>
          )}

          {tipoGasto === 'mantenimiento' && subCat && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
              <span className="text-[8px] font-bold uppercase text-indigo-400">Subcategoría:</span>
              <span className="text-xs font-bold indigo-accent uppercase">{subCat}</span>
              <button type="button" onClick={() => setSubCat('')} className="ml-auto text-indigo-300 hover:text-indigo-600 text-xs">✕</button>
            </div>
          )}

          {subCat === 'varios' && (
            <div>
              <label className="text-[8px] font-bold uppercase text-slate-400">Descripción (obligatorio)</label>
              <input value={variosDesc} onChange={e => setVariosDesc(e.target.value)} required placeholder="Describí el gasto..."
                className="form-input w-full p-3.5 rounded-2xl font-medium mt-1" />
            </div>
          )}

          {tipoGasto === 'combustible' && (
            <input name="km" type="number" placeholder="KM ACTUAL"
              className="form-input w-full p-3.5 rounded-2xl font-medium" style={{ background: '#fff7ed', borderColor: '#fed7aa' }} />
          )}

          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-500">$</span>
            <input name="amount" type="number" step="0.01" required placeholder="0.00"
              className="w-full p-7 rounded-[20px] text-center text-4xl font-black text-white outline-none focus:ring-4 focus:ring-indigo-500/30"
              style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }} />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 p-3.5 bg-slate-100 rounded-2xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-200 transition-all">Cancelar</button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 py-3.5 rounded-2xl font-bold uppercase text-sm text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── DASHBOARD PANEL ──────────────────────────────────────────────────────────
function DashboardPanel({ stats, trucks, fmt }) {
  const combustiblePct = stats.grandTotal > 0
    ? ((stats.pieData.find(d => d.name === 'Combustible')?.value || 0) / stats.grandTotal * 100).toFixed(1)
    : 0;
  const mantenimientoPct = stats.grandTotal > 0
    ? ((stats.pieData.find(d => d.name === 'Mantenimiento')?.value || 0) / stats.grandTotal * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">

      {/* ── FILA 1: KPI STRIP ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Egresos — destacado */}
        <div className="col-span-2 lg:col-span-1 relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', minHeight: 130 }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.2)' }}>
                <DollarSign size={14} style={{ color: '#818cf8' }} />
              </div>
              <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
                style={{ color: '#818cf8', background: 'rgba(99,102,241,0.15)' }}>Período</span>
            </div>
            <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Egresos</p>
            <p className="font-display font-extrabold text-2xl tracking-tight text-white leading-none">{fmt(stats.grandTotal)}</p>
          </div>
        </div>

        {/* Unidades */}
        <KpiCard
          label="Unidades Activas"
          value={trucks.length}
          Icon={Truck}
          accent="#4f46e5"
          accentBg="#eef2ff"
          accentBorder="#c7d2fe"
          suffix="unidades"
        />
        {/* Operaciones */}
        <KpiCard
          label="Operaciones"
          value={stats.totalExpenses}
          Icon={RotateCcw}
          accent="#f97316"
          accentBg="#fff7ed"
          accentBorder="#fed7aa"
          suffix="registros"
        />
        {/* Promedio */}
        <KpiCard
          label="Promedio por Unidad"
          value={fmt(stats.grandTotal / (trucks.length || 1))}
          Icon={TrendingUp}
          accent="#7c3aed"
          accentBg="#f5f3ff"
          accentBorder="#ddd6fe"
          mono
        />
      </div>

      {/* ── FILA 2: DISTRIBUCIÓN RÁPIDA ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Combustible */}
        <div className="rounded-2xl p-5 border" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#f97316' }}>
                <span className="text-white text-sm">⛽</span>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-wider text-orange-400">Combustible</p>
                <p className="text-[10px] font-bold text-orange-600">{combustiblePct}% del total</p>
              </div>
            </div>
          </div>
          <p className="font-display font-extrabold text-xl tracking-tight" style={{ color: '#c2410c' }}>
            {fmt(stats.pieData.find(d => d.name === 'Combustible')?.value || 0)}
          </p>
          <div className="mt-3 h-1.5 rounded-full" style={{ background: '#fed7aa' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${combustiblePct}%`, background: 'linear-gradient(90deg, #fb923c, #f97316)' }} />
          </div>
        </div>

        {/* Mantenimiento */}
        <div className="rounded-2xl p-5 border" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#4f46e5' }}>
                <span className="text-white text-sm">🔧</span>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-wider text-indigo-400">Mantenimiento</p>
                <p className="text-[10px] font-bold text-indigo-600">{mantenimientoPct}% del total</p>
              </div>
            </div>
          </div>
          <p className="font-display font-extrabold text-xl tracking-tight" style={{ color: '#3730a3' }}>
            {fmt(stats.pieData.find(d => d.name === 'Mantenimiento')?.value || 0)}
          </p>
          <div className="mt-3 h-1.5 rounded-full" style={{ background: '#c7d2fe' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${mantenimientoPct}%`, background: 'linear-gradient(90deg, #818cf8, #4f46e5)' }} />
          </div>
        </div>

        {/* Costos fijos totales */}
        <div className="rounded-2xl p-5 border" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#16a34a' }}>
              <Shield size={14} className="text-white" />
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-green-500">Costos Fijos</p>
              <p className="text-[10px] font-bold text-green-600">Seguros + VTV + Hab.</p>
            </div>
          </div>
          <p className="font-display font-extrabold text-xl tracking-tight" style={{ color: '#15803d' }}>
            {fmt(stats.truckStats.reduce((a, t) => a + t.fixTotal, 0))}
          </p>
          <div className="mt-3 h-1.5 rounded-full" style={{ background: '#bbf7d0' }}>
            <div className="h-full rounded-full" style={{
              width: stats.grandTotal > 0 ? `${(stats.truckStats.reduce((a,t)=>a+t.fixTotal,0)/stats.grandTotal*100).toFixed(1)}%` : '0%',
              background: 'linear-gradient(90deg, #4ade80, #16a34a)'
            }} />
          </div>
        </div>
      </div>

      {/* ── FILA 3: GRÁFICOS PRINCIPALES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Costos por unidad — ocupa 3 columnas */}
        <div className="lg:col-span-3 bg-white rounded-2xl border p-6" style={{ borderColor: 'rgba(99,102,241,0.1)', boxShadow: '0 2px 20px rgba(0,0,0,0.04)' }}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="font-display font-bold text-base text-slate-800 uppercase tracking-tight">Costos por Unidad</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Fijos + Variables del período</p>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#4f46e5' }} />
                <span className="text-[9px] font-bold uppercase text-slate-400">Fijos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                <span className="text-[9px] font-bold uppercase text-slate-400">Variables</span>
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.truckStats} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="patente" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fontWeight: '700', fill: '#64748b', fontFamily: 'Syne' }} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fontWeight: '500', fill: '#94a3b8' }}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomBarTooltip fmt={fmt} />} />
                <Bar dataKey="fixTotal" stackId="a" fill="#4f46e5" name="Fijos" />
                <Bar dataKey="varTotal" stackId="a" fill="#f97316" radius={[6, 6, 0, 0]} name="Variables" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut — ocupa 2 columnas */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6 flex flex-col" style={{ borderColor: 'rgba(99,102,241,0.1)', boxShadow: '0 2px 20px rgba(0,0,0,0.04)' }}>
          <div className="mb-4">
            <h3 className="font-display font-bold text-base text-slate-800 uppercase tracking-tight">Distribución</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Combustible vs Mantenimiento</p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.pieData} innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value"
                    strokeWidth={0}>
                    <Cell fill="#f97316" />
                    <Cell fill="#4f46e5" />
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Leyenda manual más legible */}
          <div className="space-y-2 mt-2">
            {[
              { label: 'Combustible', value: stats.pieData.find(d=>d.name==='Combustible')?.value||0, color: '#f97316', bg: '#fff7ed' },
              { label: 'Mantenimiento', value: stats.pieData.find(d=>d.name==='Mantenimiento')?.value||0, color: '#4f46e5', bg: '#eef2ff' }
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: item.bg }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-[9px] font-bold uppercase" style={{ color: item.color }}>{item.label}</span>
                </div>
                <span className="font-mono text-[10px] font-bold text-slate-700">{fmt(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FILA 4: TENDENCIA MENSUAL ── */}
      {stats.trendData.length > 1 && (
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: 'rgba(99,102,241,0.1)', boxShadow: '0 2px 20px rgba(0,0,0,0.04)' }}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="font-display font-bold text-base text-slate-800 uppercase tracking-tight">Tendencia Mensual</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Evolución de costos — últimos 6 meses</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 rounded-full" style={{ background: '#f97316' }} />
                <span className="text-[9px] font-bold uppercase text-slate-400">Combustible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 rounded-full" style={{ background: '#4f46e5' }} />
                <span className="text-[9px] font-bold uppercase text-slate-400">Mantenimiento</span>
              </div>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="mes" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fontWeight: '600', fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fontWeight: '500', fill: '#94a3b8' }}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, color: 'white', fontSize: 11 }}
                  formatter={v => [fmt(v)]}
                />
                <Line type="monotone" dataKey="combustible" stroke="#f97316" strokeWidth={2.5}
                  dot={{ fill: '#f97316', r: 4, strokeWidth: 2, stroke: 'white' }} name="Combustible" />
                <Line type="monotone" dataKey="mantenimiento" stroke="#4f46e5" strokeWidth={2.5}
                  dot={{ fill: '#4f46e5', r: 4, strokeWidth: 2, stroke: 'white' }} name="Mantenimiento" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── FILA 5: RANKING ── */}
      {stats.ranking.length > 0 && (
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: 'rgba(99,102,241,0.1)', boxShadow: '0 2px 20px rgba(0,0,0,0.04)' }}>
          <div className="mb-5">
            <h3 className="font-display font-bold text-base text-slate-800 uppercase tracking-tight">Ranking de Unidades</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Ordenadas por mayor egreso en el período</p>
          </div>

          {/* Header de tabla */}
          <div className="grid grid-cols-12 gap-2 px-3 mb-2">
            <span className="col-span-1 text-[8px] font-bold uppercase text-slate-400">#</span>
            <span className="col-span-3 text-[8px] font-bold uppercase text-slate-400">Unidad</span>
            <span className="col-span-4 text-[8px] font-bold uppercase text-slate-400">Distribución</span>
            <span className="col-span-2 text-[8px] font-bold uppercase text-slate-400 text-right">Total</span>
            <span className="col-span-2 text-[8px] font-bold uppercase text-slate-400 text-right">% Flota</span>
          </div>

          <div className="space-y-2">
            {stats.ranking.map((t, i) => {
              const pct = stats.grandTotal > 0 ? (t.total / stats.grandTotal) * 100 : 0;
              const fixPct = t.total > 0 ? (t.fixTotal / t.total * 100) : 0;
              const varPct = t.total > 0 ? (t.varTotal / t.total * 100) : 0;
              const medals = ['🥇', '🥈', '🥉'];
              const rowBg = i === 0 ? 'rgba(99,102,241,0.04)' : 'transparent';
              return (
                <div key={t.id} className="grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-xl transition-colors"
                  style={{ background: rowBg, border: i === 0 ? '1px solid rgba(99,102,241,0.12)' : '1px solid transparent' }}>
                  <span className="col-span-1 text-base">{medals[i] || <span className="font-mono font-bold text-slate-400 text-xs">{i+1}</span>}</span>
                  <div className="col-span-3">
                    <p className="font-display font-bold text-xs uppercase text-slate-800">{t.patente}</p>
                    <p className="text-[9px] text-slate-400 font-medium truncate">{t.chofer}</p>
                  </div>
                  <div className="col-span-4">
                    <div className="h-2 rounded-full overflow-hidden flex" style={{ background: '#f1f5f9' }}>
                      <div className="h-full" style={{ width: `${fixPct}%`, background: '#4f46e5' }} />
                      <div className="h-full" style={{ width: `${varPct}%`, background: '#f97316' }} />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[7px] font-bold" style={{ color: '#4f46e5' }}>{fixPct.toFixed(0)}% fijos</span>
                      <span className="text-[7px] font-bold" style={{ color: '#f97316' }}>{varPct.toFixed(0)}% var.</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="font-mono font-bold text-xs text-slate-800">{fmt(t.total)}</p>
                    <p className="text-[8px] text-slate-400 font-medium">{fmt(t.costoPorKm)}/km</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-lg text-[9px] font-bold"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#4f46e5' }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer totales */}
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
            {[
              { label: 'Total flota', value: fmt(stats.grandTotal), color: '#4f46e5' },
              { label: 'Mayor egreso', value: fmt(stats.ranking[0]?.total || 0), color: '#f97316' },
              { label: 'Menor egreso', value: fmt(stats.ranking[stats.ranking.length-1]?.total || 0), color: '#16a34a' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                <p className="font-mono font-bold text-sm mt-0.5" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, Icon, accent, accentBg, accentBorder, suffix, mono }) {
  return (
    <div className="stat-card bg-white p-5 rounded-2xl flex flex-col justify-between" style={{ minHeight: 130 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-xl" style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
          <Icon size={13} style={{ color: accent }} />
        </div>
        {suffix && <span className="text-[7px] font-bold uppercase tracking-widest text-slate-300">{suffix}</span>}
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className={`font-extrabold text-xl tracking-tight text-slate-900 ${mono ? 'font-mono' : 'font-display'}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const configs = {
    indigo: { bg: '#eef2ff', iconColor: '#4f46e5', border: '#c7d2fe' },
    orange: { bg: '#fff7ed', iconColor: '#f97316', border: '#fed7aa' },
    violet: { bg: '#f5f3ff', iconColor: '#7c3aed', border: '#ddd6fe' },
    slate: { bg: '#0f172a', iconColor: '#e2e8f0', border: '#1e293b', dark: true },
  };
  const cfg = configs[color] || configs.indigo;
  return (
    <div className="stat-card p-5 rounded-[20px] flex flex-col justify-between" style={{ background: cfg.dark ? cfg.bg : 'white' }}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: cfg.dark ? 'rgba(255,255,255,0.08)' : cfg.bg, border: `1px solid ${cfg.border}` }}>
          <Icon size={14} strokeWidth={2} style={{ color: cfg.iconColor }} />
        </div>
        {subtitle && <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: cfg.dark ? '#475569' : '#cbd5e1' }}>{subtitle}</span>}
      </div>
      <div>
        <p className="text-[7px] font-bold uppercase tracking-widest mb-1" style={{ color: cfg.dark ? '#64748b' : '#94a3b8' }}>{title}</p>
        <p className="text-xl font-display font-extrabold tracking-tight truncate" style={{ color: cfg.dark ? 'white' : '#0f172a' }}>{value}</p>
      </div>
    </div>
  );
}

function CustomBarTooltip({ active, payload, fmt }) {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 rounded-2xl shadow-2xl text-white text-xs" style={{ background: '#0f172a' }}>
        <p className="text-[8px] font-bold uppercase text-slate-400 mb-2">{payload[0]?.payload?.patente}</p>
        <p className="font-bold flex justify-between gap-5"><span className="opacity-50">Fijos:</span>{fmt(payload[0]?.value || 0)}</p>
        <p className="font-bold text-orange-400 flex justify-between gap-5"><span className="opacity-50 text-white">Variables:</span>{fmt(payload[1]?.value || 0)}</p>
      </div>
    );
  }
  return null;
}

function Notification({ banner }) {
  if (!banner) return null;
  const isError = banner.type === 'error';
  return (
    <div className={`fixed top-4 right-4 z-[200] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 max-w-xs animate-fade-up`}
      style={{
        background: isError ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'linear-gradient(135deg, #0f172a, #1e293b)',
        border: `1px solid ${isError ? '#f87171' : 'rgba(99,102,241,0.3)'}`,
        boxShadow: isError ? '0 8px 32px rgba(220,38,38,0.4)' : '0 8px 32px rgba(0,0,0,0.4)'
      }}>
      {isError ? <AlertCircle size={15} /> : <CheckCircle2 size={15} style={{ color: '#818cf8' }} />}
      <p className="font-medium text-sm">{banner.msg}</p>
    </div>
  );
}

function LoadingScreen({ message }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 100%)' }}>
      <div className="w-14 h-14 rounded-[22px] flex items-center justify-center mb-6 float-icon"
        style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 8px 32px rgba(99,102,241,0.5)' }}>
        <Truck className="text-white" size={24} />
      </div>
      <Loader2 className="animate-spin mb-3" size={20} style={{ color: '#6366f1' }} />
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{message}</p>
    </div>
  );
}

function LoginComponent({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e) => { setIsLoading(true); await onLogin(e); setIsLoading(false); };

  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-4">
      {/* Decorative dots */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.08) 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }} />

      <div className="login-card w-full max-w-md rounded-[32px] p-9 relative z-10 animate-fade-up">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-[22px] flex items-center justify-center float-icon"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #818cf8)', boxShadow: '0 12px 40px rgba(99,102,241,0.5)' }}>
            <Truck className="text-white" size={28} />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-white mb-1 anim-delay-1 animate-fade-up">
            VERACRUZ <span style={{ color: '#818cf8' }}>PRO</span>
          </h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] anim-delay-2 animate-fade-up" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Gestión de Flota
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 anim-delay-2 animate-fade-up">
            <label className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Email</label>
            <input type="email" name="email" placeholder="tu@email.com" required
              className="login-input w-full p-3.5 rounded-2xl font-medium text-sm" />
          </div>

          <div className="space-y-1.5 anim-delay-3 animate-fade-up">
            <label className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Contraseña</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} name="password" placeholder="••••••••" required
                className="login-input w-full p-3.5 rounded-2xl font-medium text-sm" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="pt-2 anim-delay-4 animate-fade-up">
            <button type="submit" disabled={isLoading}
              className="login-btn w-full py-4 rounded-2xl font-display font-extrabold uppercase text-sm text-white tracking-wider disabled:opacity-50">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Conectando...
                </span>
              ) : 'Iniciar Sesión'}
            </button>
          </div>
        </form>

        {/* Subtle divider line at bottom */}
        <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-center text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.15)' }}>
            Veracruz S.A. · Sistema de Gestión
          </p>
        </div>
      </div>
    </div>
  );
}