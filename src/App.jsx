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

// Colores de gráficos
const LINE_COLORS = ['#2563eb', '#f97316', '#8b5cf6', '#10b981', '#ef4444', '#facc15'];

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

  // Auth
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

  // Data listeners
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

  // Stats
  const stats = useMemo(() => {
    const startTs = new Date(dateRange.start + "T00:00:00").getTime();
    const endTs = new Date(dateRange.end + "T23:59:59").getTime();

    const activeHistory = history.filter(h =>
      h.timestamp >= startTs && h.timestamp <= endTs &&
      h.status !== 'cancelled' && h.status !== 'baja'
    );
    const allPeriod = history.filter(h => h.timestamp >= startTs && h.timestamp <= endTs);

    // Pie: Combustible vs Mantenimiento
    const combustibleTotal = activeHistory.filter(h => isFuel(h.categoryLabel)).reduce((a, h) => a + Number(h.amount), 0);
    const mantenimientoTotal = activeHistory.filter(h => !isFuel(h.categoryLabel)).reduce((a, h) => a + Number(h.amount), 0);
    const pieData = [
      { name: 'Combustible', value: combustibleTotal },
      { name: 'Mantenimiento', value: mantenimientoTotal }
    ].filter(d => d.value > 0);

    // Truck stats
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

    // Tendencia mensual (últimos 6 meses)
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

    // Ranking
    const ranking = [...truckStats].sort((a, b) => b.total - a.total);

    // Vencimientos próximos
    const alertas = trucks.filter(t => {
      const as = alertVencimiento(t.seguro_venc);
      const av = alertVencimiento(t.vtv_venc);
      return as || av;
    }).map(t => ({
      patente: t.patente,
      chofer: t.chofer,
      alertaSeguro: alertVencimiento(t.seguro_venc),
      alertaVtv: alertVencimiento(t.vtv_venc),
      seguro_venc: t.seguro_venc,
      vtv_venc: t.vtv_venc
    }));

    return { truckStats, grandTotal, totalExpenses: activeHistory.length, activeHistory, allPeriod, pieData, trendData, ranking, alertas };
  }, [trucks, history, searchTerm, dateRange]);

  // Handlers
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
      montoAnterior: item.amount,
      montoNuevo: parseFloat(newAmount),
      editadoPor: user.email,
      editadoAt: Date.now(),
      fecha: new Date().toLocaleString('es-AR'),
      motivo: motivo || ''
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

  if (authLoading) return <LoadingScreen message="Conectando..." />;
  if (showLogin) return <LoginComponent onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      <Notification banner={notif} />
      {dbError && (
        <div className="mx-auto max-w-7xl px-4 mt-3">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm font-bold">{dbError}</div>
        </div>
      )}

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white border-b px-4 md:px-6 py-3 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <Truck size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-black italic text-base uppercase tracking-tighter">Veracruz <span className="text-blue-600">Pro</span></h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none hidden sm:block">Gestión Veracruz S.A.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border order-last md:order-none w-full md:w-auto justify-center">
          {[{ id: 'dashboard', label: 'Panel' }, { id: 'units', label: 'Flota' }, { id: 'history', label: 'Gastos' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex-1 md:flex-none ${activeTab === tab.id ? "bg-white shadow-sm text-blue-600" : "text-slate-400"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={handleExportExcel} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 text-xs font-bold">XLS</button>
          {userRole === ROLES.ADMIN && (
            <button onClick={() => setModals(m => ({ ...m, users: true }))} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100"><Users size={16} /></button>
          )}
          {userRole === ROLES.ADMIN && (
            <button onClick={() => setModals(m => ({ ...m, clientes: true }))} className="p-2 bg-cyan-50 text-cyan-600 rounded-xl hover:bg-cyan-100"><Building size={16} /></button>
          )}
          <button onClick={handleBackup} className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100"><Clock size={16} /></button>
          <button onClick={() => signOut(auth)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><LogOut size={16} /></button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-5 pb-28">

        {/* CLIENTE */}
        {clientes.length > 0 && (
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 rounded-2xl border border-cyan-200">
            <div className="flex items-center gap-3">
              <Building size={16} className="text-cyan-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black uppercase text-cyan-400 tracking-widest">Cliente Activo</p>
                <select value={selectedClient || ''} onChange={e => setSelectedClient(e.target.value)}
                  className="bg-white border border-cyan-200 rounded-xl text-sm font-bold p-1.5 w-full mt-0.5">
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* FILTROS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400">Buscador</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13} />
                <input type="text" placeholder="Patente o Chofer..."
                  className="pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400">Período</label>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5">
                <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="bg-transparent text-[10px] font-bold outline-none" />
                <span className="text-slate-300">/</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="bg-transparent text-[10px] font-bold outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ALERTAS DE VENCIMIENTO */}
        {stats.alertas.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-[9px] font-black uppercase text-amber-600 tracking-widest">Alertas de Vencimiento</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {stats.alertas.map((a, i) => (
                <div key={i} className="bg-white rounded-xl border border-amber-200 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                    <Truck size={14} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-xs uppercase">{a.patente} <span className="font-normal text-slate-400">— {a.chofer}</span></p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {a.alertaSeguro && (
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ${a.alertaSeguro === 'vencido' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                          Seguro {a.alertaSeguro === 'vencido' ? 'VENCIDO' : `vence ${a.seguro_venc}`}
                        </span>
                      )}
                      {a.alertaVtv && (
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ${a.alertaVtv === 'vencido' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
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
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Egresos" value={fmt(stats.grandTotal)} icon={DollarSign} color="blue" />
              <StatCard title="Unidades" value={trucks.length} subtitle="Activas" icon={Truck} color="slate" />
              <StatCard title="Operaciones" value={stats.totalExpenses} subtitle="Registradas" icon={RotateCcw} color="orange" />
              <StatCard title="Promedio x Unidad" value={fmt(stats.grandTotal / (trucks.length || 1))} icon={TrendingUp} color="violet" />
            </div>

            {/* Gráficos principales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-white p-6 rounded-[28px] border shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-sm uppercase italic tracking-tighter">Costos por Unidad</h3>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-600 rounded-full" /><span className="text-[8px] font-black uppercase">Fijos</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-orange-500 rounded-full" /><span className="text-[8px] font-black uppercase">Variables</span></div>
                  </div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.truckStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="patente" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '700', fill: '#94a3b8' }} tickFormatter={v => `$${v / 1000}k`} />
                      <Tooltip content={<CustomBarTooltip fmt={fmt} />} />
                      <Bar dataKey="fixTotal" stackId="a" fill="#2563eb" name="Fijos" />
                      <Bar dataKey="varTotal" stackId="a" fill="#f97316" radius={[5, 5, 0, 0]} name="Variables" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[28px] border shadow-sm">
                <h3 className="font-black text-sm uppercase mb-5 italic">Combustible vs Mant.</h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.pieData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                        <Cell fill="#f97316" />
                        <Cell fill="#2563eb" />
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Tendencia mensual */}
            {stats.trendData.length > 1 && (
              <div className="bg-white p-6 rounded-[28px] border shadow-sm">
                <h3 className="font-black text-sm uppercase italic mb-5 tracking-tighter">Tendencia Mensual</h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '700', fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '700', fill: '#94a3b8' }} tickFormatter={v => `$${v / 1000}k`} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Line type="monotone" dataKey="combustible" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} name="Combustible" />
                      <Line type="monotone" dataKey="mantenimiento" stroke="#2563eb" strokeWidth={2.5} dot={{ fill: '#2563eb', r: 4 }} name="Mantenimiento" />
                      <Legend wrapperStyle={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Ranking */}
            {stats.ranking.length > 0 && (
              <div className="bg-white p-6 rounded-[28px] border shadow-sm">
                <h3 className="font-black text-sm uppercase italic mb-4 tracking-tighter">🏆 Ranking — Mayor Gasto</h3>
                <div className="space-y-2">
                  {stats.ranking.map((t, i) => {
                    const pct = stats.grandTotal > 0 ? (t.total / stats.grandTotal) * 100 : 0;
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div key={t.id} className="flex items-center gap-3">
                        <span className="text-base w-6 shrink-0">{medals[i] || `${i + 1}.`}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase">{t.patente} <span className="font-normal text-slate-400">{t.chofer}</span></span>
                            <span className="text-[10px] font-black text-blue-600 shrink-0 ml-2">{fmt(t.total)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-orange-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[7px] text-slate-400 font-bold">{pct.toFixed(1)}% del total</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
              className="group border-2 border-dashed border-slate-200 rounded-[28px] p-8 flex flex-col items-center justify-center gap-3 hover:border-blue-400 hover:bg-blue-50 transition-all min-h-[240px]">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                <Plus className="text-slate-300 group-hover:text-blue-500" size={24} />
              </div>
              <span className="font-black text-[9px] uppercase text-slate-400 tracking-widest text-center">Añadir Camión</span>
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
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-300 flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all">
        <Plus size={24} />
      </button>

      {/* MODAL: NUEVA UNIDAD */}
      {modals.truck && (
        <TruckFormModal
          title="Alta de Camión"
          onSubmit={handleAddTruck}
          onClose={() => setModals(p => ({ ...p, truck: false }))}
        />
      )}

      {/* MODAL: EDITAR UNIDAD */}
      {modals.editTruck && (
        <TruckFormModal
          title="Editar Camión"
          initial={modals.editTruck}
          onSubmit={(e) => handleEditTruck(e, modals.editTruck.id)}
          onClose={() => setModals(p => ({ ...p, editTruck: null }))}
        />
      )}

      {/* MODAL: GASTO */}
      {modals.expense && (
        <ExpenseModal trucks={trucks} onSubmit={handleAddExpense}
          onClose={() => setModals(m => ({ ...m, expense: false }))} />
      )}

      {/* MODAL: EDITAR GASTO */}
      {modals.editExpense && (
        <EditExpenseModal
          item={modals.editExpense}
          fmt={fmt}
          onSave={handleEditExpense}
          onClose={() => setModals(m => ({ ...m, editExpense: null }))}
        />
      )}

      {/* MODAL: ELIMINAR */}
      {modals.delete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[28px] w-full max-w-sm text-center shadow-2xl border-b-4 border-red-500">
            <AlertTriangle size={28} className="mx-auto text-red-500 mb-4" />
            <h3 className="font-black uppercase text-lg mb-1 italic">¿Eliminar Unidad?</h3>
            <p className="text-sm font-bold text-slate-400 mb-6">Camión <span className="text-slate-900">{modals.delete.patente}</span></p>
            <div className="flex gap-3">
              <button onClick={() => setModals(m => ({ ...m, delete: null }))} className="flex-1 p-3 bg-slate-100 rounded-2xl font-black text-xs uppercase">Cancelar</button>
              <button onClick={handleDeleteTruck} className="flex-1 p-3 bg-red-500 text-white rounded-2xl font-black text-xs uppercase">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: USUARIOS */}
      {modals.users && userRole === ROLES.ADMIN && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-7 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black uppercase italic text-blue-600 flex items-center gap-2"><Shield size={20} /> Usuarios</h2>
              <button onClick={() => setModals(m => ({ ...m, users: false }))} className="text-slate-300 hover:text-slate-900">✕</button>
            </div>
            <button onClick={() => setModals(m => ({ ...m, addUser: true }))} className="mb-4 w-full bg-blue-600 text-white px-4 py-3 rounded-2xl text-sm font-black uppercase">+ Crear Usuario</button>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="bg-slate-50 p-3 rounded-2xl border flex justify-between items-center">
                  <div><p className="font-bold text-sm">{u.email}</p><p className="text-[8px] text-slate-400 uppercase font-black">{u.role}</p></div>
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${u.role === ROLES.ADMIN ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modals.addUser && userRole === ROLES.ADMIN && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[32px] p-7 shadow-2xl">
            <h2 className="text-xl font-black uppercase italic mb-5 text-blue-600">Crear Usuario</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <input name="email" type="email" placeholder="Email" required className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              <input name="password" type="password" placeholder="Contraseña" required className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              <select name="role" className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold">
                <option value={ROLES.USER}>Usuario Normal</option>
                <option value={ROLES.ADMIN}>Administrador</option>
              </select>
              <div className="flex gap-3"><button type="button" onClick={() => setModals(m => ({ ...m, addUser: false }))} className="flex-1 p-3 bg-slate-100 rounded-2xl font-black text-xs uppercase">Cancelar</button><button type="submit" className="flex-1 p-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase">Crear</button></div>
            </form>
          </div>
        </div>
      )}

      {modals.clientes && userRole === ROLES.ADMIN && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-7 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black uppercase italic text-cyan-600 flex items-center gap-2"><Building size={20} /> Clientes</h2>
              <button onClick={() => setModals(m => ({ ...m, clientes: false }))} className="text-slate-300 hover:text-slate-900">✕</button>
            </div>
            <button onClick={() => setModals(m => ({ ...m, addCliente: true }))} className="mb-4 w-full bg-cyan-600 text-white px-4 py-3 rounded-2xl text-sm font-black uppercase">+ Crear Cliente</button>
            <div className="space-y-2">
              {clientes.map(c => (
                <div key={c.id} className="bg-cyan-50 p-3 rounded-2xl border border-cyan-200 flex justify-between items-center">
                  <div><p className="font-bold text-sm">{c.nombre}</p><p className="text-[8px] text-cyan-600 uppercase font-black">{c.email}</p></div>
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${c.estado === 'activo' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{c.estado}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modals.addCliente && userRole === ROLES.ADMIN && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[32px] p-7 shadow-2xl">
            <h2 className="text-xl font-black uppercase italic mb-5 text-cyan-600">Crear Cliente</h2>
            <form onSubmit={handleCreateCliente} className="space-y-4">
              <input name="nombre" placeholder="Nombre o empresa" required className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" />
              <input name="email" type="email" placeholder="Email" required className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" />
              <input name="telefono" placeholder="Teléfono (opcional)" className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" />
              <div className="flex gap-3"><button type="button" onClick={() => setModals(m => ({ ...m, addCliente: false }))} className="flex-1 p-3 bg-slate-100 rounded-2xl font-black text-xs uppercase">Cancelar</button><button type="submit" className="flex-1 p-3 bg-cyan-600 text-white rounded-2xl font-black text-xs uppercase">Crear</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TRUCK FORM MODAL (Alta / Edición) ───────────────────────────────────────
function TruckFormModal({ title, initial = {}, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-[36px] p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-black uppercase italic mb-5 text-blue-600">{title}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          {!initial.id && (
            <input name="patente" placeholder="PATENTE (EJ: AA123BB)" required defaultValue={initial.patente || ''}
              className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none" />
          )}
          {initial.id && (
            <div className="bg-slate-50 border rounded-2xl p-3.5 font-black uppercase text-sm text-slate-500">{initial.patente}</div>
          )}
          <input name="chofer" placeholder="Nombre del chofer" required defaultValue={initial.chofer || ''}
            className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
          <input name="km" type="number" placeholder="KM Actual" defaultValue={initial.kmActual || ''}
            className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[8px] font-black uppercase text-slate-400 mb-3">Gastos Fijos Mensuales</p>
            <div className="grid grid-cols-3 gap-3">
              {[{ name: 'seguro', label: 'Seguro ($)', val: initial.seguro }, { name: 'vtv', label: 'VTV ($)', val: initial.vtv_costo }, { name: 'muni', label: 'Hab. Mun. ($)', val: initial.muni_costo }].map(f => (
                <div key={f.name} className="space-y-1">
                  <label className="text-[7px] font-black uppercase text-slate-400">{f.label}</label>
                  <input name={f.name} type="number" placeholder="0" defaultValue={f.val || ''}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" />
                </div>
              ))}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[8px] font-black uppercase text-slate-400 mb-3">Fechas de Vencimiento</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[7px] font-black uppercase text-slate-400">Venc. Seguro</label>
                <input name="seguro_venc" type="date" defaultValue={initial.seguro_venc || ''}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[7px] font-black uppercase text-slate-400">Venc. VTV</label>
                <input name="vtv_venc" type="date" defaultValue={initial.vtv_venc || ''}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" />
              </div>
            </div>
          </div>
          {initial.editadoPor && (
            <div className="bg-blue-50 rounded-xl p-3 text-[8px] font-bold text-blue-600 border border-blue-100">
              ✏️ Última edición por <span className="font-black">{initial.editadoPor}</span> — {new Date(initial.editadoAt).toLocaleString('es-AR')}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 p-3.5 bg-slate-100 rounded-2xl font-black text-xs uppercase text-slate-500">Cancelar</button>
            <button type="submit" className="flex-1 p-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-200">Guardar</button>
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-[32px] p-7 shadow-2xl">
        <h2 className="text-xl font-black uppercase italic mb-1 text-blue-600">Editar Monto</h2>
        <p className="text-[9px] font-bold text-slate-400 mb-5">{item.truck} — {item.categoryLabel} — {item.date}</p>

        <div className="space-y-4">
          <div>
            <label className="text-[8px] font-black uppercase text-slate-400">Monto actual</label>
            <p className="text-2xl font-black text-slate-400 line-through">{fmt(item.amount)}</p>
          </div>
          <div>
            <label className="text-[8px] font-black uppercase text-slate-400">Nuevo monto ($)</label>
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
              className="w-full p-4 bg-slate-900 text-white rounded-2xl text-2xl font-black text-center outline-none focus:ring-4 focus:ring-blue-500/50 mt-1" />
          </div>
          <div>
            <label className="text-[8px] font-black uppercase text-slate-400">Motivo del cambio</label>
            <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Error de carga, ajuste..."
              className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1" />
          </div>

          {/* Historial de ediciones */}
          {item.historialEdiciones && item.historialEdiciones.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
              <p className="text-[8px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1"><History size={10} /> Historial de cambios</p>
              <div className="space-y-2 max-h-28 overflow-y-auto">
                {[...item.historialEdiciones].reverse().map((ed, i) => (
                  <div key={i} className="text-[8px] text-slate-600 border-l-2 border-blue-200 pl-2">
                    <span className="font-black text-blue-600">{ed.editadoPor}</span> cambió{' '}
                    <span className="line-through text-slate-400">{fmt(ed.montoAnterior)}</span> → <span className="font-black">{fmt(ed.montoNuevo)}</span>
                    {ed.motivo && <span className="text-slate-400"> ({ed.motivo})</span>}
                    <span className="block text-slate-300">{ed.fecha}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 p-3.5 bg-slate-100 rounded-2xl font-black text-xs uppercase">Cancelar</button>
          <button onClick={() => onSave(item, newAmount, motivo)} className="flex-1 p-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg">Guardar Cambio</button>
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
    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-black uppercase italic text-sm">Últimos Movimientos</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select value={truckFilter} onChange={e => onTruckFilter(e.target.value)}
            className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas las unidades</option>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={showBaja} onChange={e => setShowBaja(e.target.checked)} className="rounded" />
            Ver bajas
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[560px]">
          <thead className="bg-slate-50 text-[8px] font-black uppercase text-slate-400 border-b">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayed.map(item => {
              const esBaja = item.status === 'baja';
              const editado = item.ultimaEdicion;
              return (
                <tr key={item.id} className={`transition-colors ${esBaja ? 'bg-red-50/40 opacity-60' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3 text-[9px] text-slate-500 font-bold whitespace-nowrap">{item.date}</td>
                  <td className="px-4 py-3 font-black uppercase italic text-xs">{item.truck}</td>
                  <td className="px-4 py-3">
                    {esBaja ? (
                      <div>
                        <span className="line-through text-[9px] text-slate-400 font-bold">{item.categoryLabel}</span>
                        <p className="text-[7px] text-red-500 font-black mt-0.5">Baja: {item.bajaBy}</p>
                      </div>
                    ) : (
                      <div>
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${isFuel(item.categoryLabel) ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {item.categoryLabel}
                        </span>
                        {editado && (
                          <p className="text-[7px] text-blue-500 font-black mt-0.5 flex items-center gap-1">
                            <Edit2 size={7} /> Editado por {editado.editadoPor}
                            {editado.motivo && <span className="text-slate-400">— {editado.motivo}</span>}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-black text-xs ${esBaja ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    <div>
                      {fmt(item.amount)}
                      {editado && !esBaja && (
                        <p className="text-[7px] text-slate-400 font-bold line-through">{fmt(editado.montoAnterior)}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {!esBaja && (
                        <>
                          <button onClick={() => onEdit(item)}
                            className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Editar monto">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => onBaja(item)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Dar de baja">
                            <Ban size={12} />
                          </button>
                        </>
                      )}
                      {esBaja && <span className="text-[7px] text-red-400 font-black uppercase">Baja</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayed.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm font-bold">Sin movimientos</td></tr>
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
    const color = alert === 'vencido' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-black border ${color}`}>
        <AlertIcon size={8} /> {label} {alert === 'vencido' ? 'VENCIDO' : 'PRÓXIMO'}
      </span>
    );
  };

  return (
    <div className="bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm hover:shadow-lg transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0">
            <span className="font-black text-xs uppercase italic">{truck.patente.slice(-3)}</span>
          </div>
          <div>
            <h3 className="font-black text-base uppercase italic leading-tight">{truck.chofer || 'Sin chofer'}</h3>
            <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{truck.patente}</p>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={onEdit} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={13} /></button>
          <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
        </div>
      </div>

      {(alertSeguro || alertVtv) && (
        <div className="flex flex-wrap gap-1 mb-3">{alertBadge(alertSeguro, 'Seguro')}{alertBadge(alertVtv, 'VTV')}</div>
      )}

      <div className="mb-4">
        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Egresos del Período</p>
        <p className="text-3xl font-black text-blue-600 tracking-tighter">{fmt(truck.total)}</p>
      </div>

      <div className="space-y-2 pt-3 border-t border-slate-50">
        {[{ label: 'Seguro', val: truck.seguro }, { label: 'VTV', val: truck.vtv_costo }, { label: 'Hab. Municipal', val: truck.muni_costo }].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-[8px] font-black uppercase text-slate-500">{item.label}</span>
            <span className="text-[9px] font-black text-slate-900">{fmt(item.val)}</span>
          </div>
        ))}
      </div>

      {/* Acordeón variables */}
      <button onClick={() => setShowVar(!showVar)}
        className="w-full mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-left">
        <span className="text-[8px] font-black uppercase text-slate-500">Variables del Período</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-orange-600">{fmt(truck.varTotal)}</span>
          {showVar ? <ChevronUp size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />}
        </div>
      </button>

      {showVar && (
        <div className="mt-2 bg-orange-50 rounded-xl p-3 border border-orange-100 space-y-1.5">
          {desgloseEntries.length === 0
            ? <p className="text-[8px] text-slate-400 font-bold text-center">Sin gastos variables en el período</p>
            : desgloseEntries.map(([cat, monto]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-[8px] font-black uppercase text-slate-600 truncate max-w-[130px]">{cat}</span>
                <span className="text-[9px] font-black text-orange-700 shrink-0 ml-2">{fmt(monto)}</span>
              </div>
            ))
          }
        </div>
      )}

      {/* KPI */}
      <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <Gauge size={11} className="text-blue-500" />
          <span className="text-[8px] font-black uppercase text-slate-400">{(truck.kmActual || 0).toLocaleString()} KM</span>
        </div>
        {truck.costoPorKm > 0 && (
          <div className="text-right">
            <p className="text-[7px] font-black uppercase text-slate-400">Costo/KM</p>
            <p className="text-[9px] font-black text-slate-700">{fmt(truck.costoPorKm)}</p>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-[36px] p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-black uppercase italic mb-5 tracking-tighter">Registrar <span className="text-blue-600">Gasto</span></h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select name="truckId" required className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold appearance-none">
            <option value="">Seleccione Camión...</option>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
          </select>

          <div className="space-y-2">
            <p className="text-[8px] font-black uppercase text-slate-400">Tipo de Gasto</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setTipoGasto('combustible'); setSubCat(''); setMantOpen(false); }}
                className={`p-4 rounded-2xl font-black text-sm uppercase border-2 transition-all ${tipoGasto === 'combustible' ? 'bg-orange-500 text-white border-orange-500 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-orange-300'}`}>
                ⛽ Combustible
              </button>
              <button type="button" onClick={() => { setTipoGasto('mantenimiento'); setMantOpen(o => !o); }}
                className={`p-4 rounded-2xl font-black text-sm uppercase border-2 transition-all flex items-center justify-center gap-2 ${tipoGasto === 'mantenimiento' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                🔧 Mantenimiento <span className={`text-xs inline-block transition-transform ${mantOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
            </div>
          </div>

          {tipoGasto === 'mantenimiento' && mantOpen && (
            <div className="grid grid-cols-2 gap-2 bg-blue-50 p-4 rounded-2xl border border-blue-100">
              {opciones.map(op => (
                <button key={op.value} type="button" onClick={() => { setSubCat(op.value); setMantOpen(false); }}
                  className={`p-3 rounded-xl font-black text-[10px] uppercase text-left border transition-all ${subCat === op.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                  {op.label}
                </button>
              ))}
            </div>
          )}

          {tipoGasto === 'mantenimiento' && subCat && (
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
              <span className="text-[8px] font-black uppercase text-blue-400">Subcategoría:</span>
              <span className="text-xs font-black text-blue-700 uppercase">{subCat}</span>
              <button type="button" onClick={() => setSubCat('')} className="ml-auto text-blue-300 hover:text-blue-600 text-xs">✕</button>
            </div>
          )}

          {subCat === 'varios' && (
            <div>
              <label className="text-[8px] font-black uppercase text-slate-400">Descripción (obligatorio)</label>
              <input value={variosDesc} onChange={e => setVariosDesc(e.target.value)} required placeholder="Describí el gasto..."
                className="w-full p-3.5 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none mt-1" />
            </div>
          )}

          {tipoGasto === 'combustible' && (
            <input name="km" type="number" placeholder="KM ACTUAL"
              className="w-full p-3.5 bg-orange-50 border border-orange-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-orange-400" />
          )}

          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300">$</span>
            <input name="amount" type="number" step="0.01" required placeholder="0.00"
              className="w-full p-7 bg-slate-900 text-white rounded-[24px] text-center text-4xl font-black outline-none focus:ring-4 focus:ring-blue-500/50" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 p-3.5 bg-slate-100 rounded-2xl font-black text-xs uppercase text-slate-500">Cancelar</button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 bg-blue-600 text-white py-3.5 rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed">
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = { blue: "bg-blue-50 text-blue-600", orange: "bg-orange-50 text-orange-600", violet: "bg-violet-50 text-violet-600", slate: "bg-slate-900 text-white" };
  return (
    <div className="bg-white p-5 rounded-[22px] border border-slate-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}><Icon size={15} strokeWidth={2.5} /></div>
        {subtitle && <span className="text-[7px] font-black uppercase text-slate-300 tracking-widest">{subtitle}</span>}
      </div>
      <div>
        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-xl font-black tracking-tighter truncate">{value}</p>
      </div>
    </div>
  );
}

function CustomBarTooltip({ active, payload, fmt }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 p-3 rounded-2xl shadow-2xl text-white text-xs">
        <p className="text-[8px] font-black uppercase text-slate-400 mb-2">{payload[0]?.payload?.patente}</p>
        <p className="font-black flex justify-between gap-5"><span className="opacity-50">Fijos:</span>{fmt(payload[0]?.value || 0)}</p>
        <p className="font-black text-orange-400 flex justify-between gap-5"><span className="opacity-50 text-white">Variables:</span>{fmt(payload[1]?.value || 0)}</p>
      </div>
    );
  }
  return null;
}

function Notification({ banner }) {
  if (!banner) return null;
  const styles = { success: "bg-slate-900 border-blue-500", error: "bg-red-600 border-white" };
  return (
    <div className={`fixed top-4 right-4 z-[200] ${styles[banner.type]} text-white px-5 py-3.5 rounded-[18px] shadow-2xl border-l-4 flex items-center gap-3 max-w-xs`}>
      {banner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <p className="font-bold text-sm">{banner.msg}</p>
    </div>
  );
}

function LoadingScreen({ message }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 bg-blue-600 rounded-[22px] flex items-center justify-center mb-6 animate-pulse">
        <Truck className="text-white" size={24} />
      </div>
      <Loader2 className="text-blue-500 animate-spin mb-3" size={22} />
      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{message}</p>
    </div>
  );
}

function LoginComponent({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e) => { setIsLoading(true); await onLogin(e); setIsLoading(false); };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[36px] p-9 shadow-2xl">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 bg-blue-600 rounded-[22px] flex items-center justify-center shadow-xl shadow-blue-500/30">
            <Truck className="text-white" size={26} />
          </div>
        </div>
        <h1 className="text-3xl font-black uppercase italic text-center mb-1 tracking-tighter">Veracruz <span className="text-blue-600">Pro</span></h1>
        <p className="text-center text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-7">Gestión de Flota</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-slate-400">Email</label>
            <input type="email" name="email" placeholder="tu@email.com" required
              className="w-full p-3.5 bg-slate-50 border rounded-2xl font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-slate-400">Contraseña</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} name="password" placeholder="••••••••" required
                className="w-full p-3.5 bg-slate-50 border rounded-2xl font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50">
            {isLoading ? 'Conectando...' : 'Iniciar Sesión'}
          </button>
        </form>
        <div className="mt-5 p-3 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Demo</p>
          <p className="text-[9px] text-slate-600"><strong>Email:</strong> admin@veracruz.com · <strong>Pass:</strong> admin123</p>
        </div>
      </div>
    </div>
  );
}