import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Truck, Plus, Search, LogOut, RotateCcw,
  AlertTriangle, Trash2, Gauge, DollarSign,
  TrendingUp, Loader2, CheckCircle2, AlertCircle,
  Users, Settings, Download, Shield, Clock, Eye, EyeOff,
  Mail, Bell
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { 
  getFirestore, collection, doc, onSnapshot, 
  addDoc, updateDoc, deleteDoc, query, orderBy, where, getDoc
} from 'firebase/firestore';
import { 
  getAuth, onAuthStateChanged, signOut, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from 'firebase/auth';

// --- CONFIGURACIÓN DE FIREBASE ---
// En tu entorno local, aquí pondrás las llaves que te da Firebase Console.
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
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'veracruz-fleet-pro-v2';

const COLORS = ['#2563eb', '#f97316', '#8b5cf6', '#10b981', '#ef4444', '#facc15'];
const ROLES = { ADMIN: 'admin', USER: 'user' };

export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [trucks, setTrucks] = useState([]);
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [fleetFilter, setFleetFilter] = useState('Todas');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  const [notif, setNotif] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [modals, setModals] = useState({
    expense: false,
    truck: false,
    delete: null,
    editFixed: null,
    users: false,
    addUser: false,
    backup: false
  });

  const showNotif = (msg, type = 'success') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 4000);
  };

  // 1. Manejo de Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setShowLogin(false);
        // Obtener rol del usuario
        try {
          const userDocRef = doc(db, 'artifacts', appId, 'public', 'users', u.uid);
          const userDoc = await getDoc(userDocRef);
          const role = userDoc.exists() ? userDoc.data().role : ROLES.USER;
          setUserRole(role);
        } catch (err) {
          console.log('Error getting user role:', err);
          setUserRole(ROLES.USER);
        }
      } else {
        setShowLogin(true);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Escucha de Datos de Firestore
  useEffect(() => {
    if (!user) return;

    const trucksRef = collection(db, 'artifacts', appId, 'public', 'data', 'trucks');
    const historyRef = collection(db, 'artifacts', appId, 'public', 'data', 'history');

    const unsubTrucks = onSnapshot(trucksRef, (snap) => {
      setTrucks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDbError(null);
    }, (err) => {
      console.error('trucks snapshot error', err);
      setDbError('Error de conexión con la flota');
      showNotif("Error de conexión con la flota", "error");
    });

    const unsubHistory = onSnapshot(query(historyRef, orderBy('timestamp', 'desc')), (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDbError(null);
    }, (err) => {
      console.error('history snapshot error', err);
      setDbError('Error de conexión con el historial');
      showNotif("Error de conexión con el historial", "error");
    });

    return () => { unsubTrucks(); unsubHistory(); };
  }, [user]);

  // 2b. Cargar usuarios (solo para admin)
  useEffect(() => {
    if (!user || userRole !== ROLES.ADMIN) return;

    const usersRef = collection(db, 'artifacts', appId, 'public', 'users');
    const unsubUsers = onSnapshot(usersRef, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error('users snapshot error', err);
    });

    return () => unsubUsers();
  }, [user, userRole]);

  // 3. Lógica de Cálculos
  const stats = useMemo(() => {
    const startTs = new Date(dateRange.start + "T00:00:00").getTime();
    const endTs = new Date(dateRange.end + "T23:59:59").getTime();
    
    const filteredHistory = history.filter(h => 
      h.timestamp >= startTs && h.timestamp <= endTs && h.status !== 'cancelled'
    );

    const categoryStats = filteredHistory.reduce((acc, h) => {
      const cat = h.categoryLabel || 'VARIOS';
      acc[cat] = (acc[cat] || 0) + Number(h.amount);
      return acc;
    }, {});

    const pieData = Object.keys(categoryStats).map(key => ({
      name: key,
      value: categoryStats[key]
    }));

    const truckStats = trucks.map(t => {
      const tHistory = filteredHistory.filter(h => h.truckId === t.id);
      const varTotal = tHistory.reduce((acc, h) => acc + (Number(h.amount) || 0), 0);
      const fixTotal = (Number(t.seguro) || 0) + (Number(t.vtv_costo) || 0) + (Number(t.muni_costo) || 0);
      return { 
        ...t, 
        varTotal, 
        fixTotal, 
        total: varTotal + fixTotal
      };
    }).filter(t => 
      (t.patente.toLowerCase().includes(searchTerm.toLowerCase()) || 
       (t.chofer || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
      (fleetFilter === 'Todas' || t.flota === fleetFilter)
    );

    const grandTotal = truckStats.reduce((acc, t) => acc + t.total, 0);

    return { truckStats, grandTotal, totalExpenses: filteredHistory.length, filteredHistory, pieData };
  }, [trucks, history, searchTerm, fleetFilter, dateRange]);

  // 4. Funciones de Base de Datos
  const handleAddTruck = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trucks'), {
        patente: fd.get('patente').toUpperCase(),
        chofer: fd.get('chofer'),
        flota: fd.get('flota'),
        seguro: parseFloat(fd.get('seguro')) || 0,
        vtv_costo: parseFloat(fd.get('vtv')) || 0,
        muni_costo: parseFloat(fd.get('muni')) || 0,
        kmActual: parseFloat(fd.get('km')) || 0,
        timestamp: Date.now()
      });
      setModals(prev => ({ ...prev, truck: false }));
      showNotif("Camión añadido con éxito");
    } catch (err) { showNotif("Error al guardar camión", "error"); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const truckId = fd.get('truckId');
    const truck = trucks.find(t => t.id === truckId);
    const amount = parseFloat(fd.get('amount'));
    const category = fd.get('category');
    const km = fd.get('km');

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'history'), {
        truckId,
        truck: truck.patente,
        categoryLabel: category.toUpperCase(),
        amount,
        responsible: user.email || 'Admin',
        status: 'active',
        timestamp: Date.now(),
        date: new Date().toLocaleString('es-AR')
      });

      if (category === 'combustible' && km) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', truckId), {
          kmActual: parseFloat(km)
        });
      }

      setModals(prev => ({ ...prev, expense: false }));
      showNotif("Gasto registrado");
    } catch (err) { showNotif("Error al registrar", "error"); }
  };

  const handleDeleteTruck = async () => {
    if (!modals.delete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', modals.delete.id));
      showNotif("Unidad eliminada");
      setModals(prev => ({ ...prev, delete: null }));
    } catch (err) { showNotif("Error al borrar", "error"); }
  };

  // Autenticación con Email/Contraseña
  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email');
    const password = fd.get('password');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLogin(false);
      showNotif("¡Bienvenido!");
    } catch (err) {
      showNotif(err.message || "Error en login", "error");
    }
  };

  // Crear nuevo usuario (solo admin)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (userRole !== ROLES.ADMIN) {
      showNotif("No tienes permisos", "error");
      return;
    }

    const fd = new FormData(e.target);
    const email = fd.get('email');
    const password = fd.get('password');
    const role = fd.get('role');

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'users'), {
        uid: userCred.user.uid,
        email,
        role,
        createdAt: Date.now(),
        createdBy: user.email
      });
      showNotif("Usuario creado exitosamente");
      setModals(prev => ({ ...prev, addUser: false }));
      e.target.reset();
    } catch (err) {
      showNotif(err.message || "Error al crear usuario", "error");
    }
  };

  // Exportar a Excel
  const handleExportExcel = async () => {
    try {
      const XLSX = (await import('xlsx')).default || (await import('xlsx'));
      const data = stats.filteredHistory.map(h => ({
        Fecha: h.date,
        Unidad: h.truck,
        Concepto: h.categoryLabel,
        Monto: h.amount,
        Responsable: h.responsible
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Gastos");
      XLSX.writeFile(wb, `gastos-${new Date().toISOString().split('T')[0]}.xlsx`);
      showNotif("Archivo Excel descargado");
    } catch (err) {
      console.error(err);
      showNotif("Error al exportar Excel", "error");
    }
  };

  // Exportar a PDF
  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text("Reporte de Gastos Veracruz Pro", 10, 10);
      doc.setFontSize(10);
      doc.text(`Período: ${dateRange.start} a ${dateRange.end}`, 10, 20);
      
      const tableData = stats.filteredHistory.map(h => [
        h.date, h.truck, h.categoryLabel, `$${h.amount}`
      ]);
      
      doc.autoTable({
        head: [['Fecha', 'Unidad', 'Concepto', 'Monto']],
        body: tableData,
        startY: 30
      });
      
      doc.save(`reporte-gastos-${new Date().toISOString().split('T')[0]}.pdf`);
      showNotif("PDF descargado");
    } catch (err) {
      console.error(err);
      showNotif("Error al exportar PDF", "error");
    }
  };

  // Realizar backup automático
  const handleBackup = async () => {
    try {
      const backupData = {
        trucks,
        history: stats.filteredHistory,
        timestamp: new Date().toISOString(),
        userId: user.uid
      };
      
      await addDoc(collection(db, 'artifacts', appId, 'public', 'backups'), {
        ...backupData,
        createdAt: Date.now()
      });
      
      showNotif("Respaldo creado exitosamente");
    } catch (err) {
      showNotif("Error al hacer respaldo", "error");
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0 
  }).format(val || 0);

  if (authLoading) return <LoadingScreen message="Conectando..." />;
  
  if (showLogin) return <LoginComponent onLogin={handleLogin} onSignup={() => {}} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      <Notification banner={notif} />
      {dbError && (
        <div className="mx-auto max-w-7xl px-6 mt-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm font-bold">
            {dbError}. Revisa tu red o reglas de Firestore.
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR */}
      <nav className="sticky top-0 z-50 bg-white border-b px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <Truck size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-black italic text-lg uppercase tracking-tighter">Veracruz <span className="text-blue-600">Pro</span></h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Gestión Veracruz S.A.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl border">
          {[
            { id: 'dashboard', label: 'Panel' },
            { id: 'units', label: 'Flota' },
            { id: 'history', label: 'Gastos' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                activeTab === tab.id ? "bg-white shadow-sm text-blue-600" : "text-slate-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
           <button onClick={() => setModals(m => ({ ...m, expense: true }))} className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-slate-200 hover:bg-blue-600 transition-all">
             Registrar Gasto
           </button>
           <button onClick={handleExportExcel} title="Descargar Excel" className="p-2.5 bg-green-50 text-green-600 rounded-2xl hover:bg-green-100 transition-colors text-xs font-bold">
             XLS
           </button>
           <button onClick={handleExportPDF} title="Descargar PDF" className="p-2.5 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors text-xs font-bold">
             PDF
           </button>
           {userRole === ROLES.ADMIN && (
             <button onClick={() => setModals(m => ({ ...m, users: true }))} title="Gestión de usuarios" className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors">
               <Users size={18} />
             </button>
           )}
           <button onClick={handleBackup} title="Hacer respaldo" className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl hover:bg-purple-100 transition-colors">
             <Clock size={18} />
           </button>
           <button onClick={() => signOut(auth)} className="p-2.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors">
             <LogOut size={18} />
           </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8 pb-24">
        
        {/* BUSCADOR Y FILTROS */}
        <header className="flex flex-wrap items-end justify-between gap-6 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Buscador</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                  type="text" 
                  placeholder="Patente o Chofer..." 
                  className="pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold w-64 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Flota</label>
              <select 
                value={fleetFilter}
                onChange={(e) => setFleetFilter(e.target.value)}
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Todas">Todas</option>
                <option value="Pesada">Pesada (Tractor)</option>
                <option value="Liviana">Liviana (Chasis)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Periodo</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5">
                <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="bg-transparent text-[10px] font-bold p-1.5 outline-none" />
                <span className="text-slate-300">/</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="bg-transparent text-[10px] font-bold p-1.5 outline-none" />
              </div>
            </div>
          </div>
        </header>

        {/* PANEL PRINCIPAL */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Egresos" value={formatCurrency(stats.grandTotal)} icon={DollarSign} color="blue" />
              <StatCard title="Unidades" value={trucks.length} subtitle="Activas" icon={Truck} color="slate" />
              <StatCard title="Operaciones" value={stats.totalExpenses} subtitle="Registradas" icon={RotateCcw} color="orange" />
              <StatCard title="Promedio x Unidad" value={formatCurrency(stats.grandTotal / (trucks.length || 1))} icon={TrendingUp} color="violet" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-lg uppercase italic tracking-tighter">Costos por Patente</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-600 rounded-full" /><span className="text-[9px] font-black uppercase">Fijos</span></div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-orange-500 rounded-full" /><span className="text-[9px] font-black uppercase">Variables</span></div>
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.truckStats} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="patente" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: '900', fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: '700', fill: '#94a3b8'}} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="fixTotal" stackId="a" fill="#2563eb" />
                      <Bar dataKey="varTotal" stackId="a" fill="#f97316" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[40px] border shadow-sm">
                <h3 className="font-black text-lg uppercase mb-8 italic flex items-center gap-2">
                   Distribución de Gastos
                </h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {stats.pieData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Legend wrapperStyle={{fontSize: '9px', fontWeight: '900', textTransform: 'uppercase'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LISTA DE FLOTA */}
        {activeTab === 'units' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            {stats.truckStats.map(truck => (
              <TruckCard 
                key={truck.id} 
                truck={truck} 
                formatCurrency={formatCurrency}
                onDelete={() => setModals(m => ({ ...m, delete: truck }))}
              />
            ))}
            <button 
              onClick={() => setModals(m => ({ ...m, truck: true }))}
              className="group border-2 border-dashed border-slate-200 rounded-[40px] p-10 flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50 transition-all min-h-[300px]"
            >
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                <Plus className="text-slate-300 group-hover:text-blue-500" size={32} />
              </div>
              <span className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Añadir Camión Veracruz</span>
            </button>
          </div>
        )}

        {/* TABLA DE HISTORIAL */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
              <h2 className="font-black uppercase italic text-base">Últimos Movimientos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b">
                  <tr>
                    <th className="px-8 py-4">Fecha</th>
                    <th className="px-8 py-4">Unidad</th>
                    <th className="px-8 py-4">Concepto</th>
                    <th className="px-8 py-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.filteredHistory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-5 text-[10px] text-slate-500 font-bold">{item.date}</td>
                      <td className="px-8 py-5 font-black uppercase italic text-xs">{item.truck}</td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${
                          item.categoryLabel.includes('COMBUSTIBLE') ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {item.categoryLabel}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-slate-900 text-xs">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: NUEVA UNIDAD */}
      {modals.truck && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[48px] p-10 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-3xl font-black uppercase italic mb-8 text-blue-600 tracking-tighter">Alta de Camión</h2>
            <form onSubmit={handleAddTruck} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input name="patente" placeholder="PATENTE (EJ: AA123BB)" required className="w-full p-4 bg-slate-50 border rounded-2xl font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none" />
                <select name="flota" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold">
                  <option value="Pesada">Pesada (Tractor)</option>
                  <option value="Liviana">Liviana (Chasis)</option>
                </select>
              </div>
              <input name="chofer" placeholder="NOMBRE COMPLETO DEL CHOFER" required className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400">Seguro ($)</label>
                   <input name="seguro" type="number" placeholder="0" className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs" />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400">VTV ($)</label>
                   <input name="vtv" type="number" placeholder="0" className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs" />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400">Muni ($)</label>
                   <input name="muni" type="number" placeholder="0" className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setModals(m => ({ ...m, truck: false }))} className="flex-1 p-4 bg-slate-100 rounded-2xl font-black text-xs uppercase text-slate-500">Cerrar</button>
                <button type="submit" className="flex-1 p-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-200">Dar de Alta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR GASTO */}
      {modals.expense && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[48px] p-10 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-3xl font-black uppercase italic mb-8 tracking-tighter">Registrar <span className="text-blue-600">Gasto</span></h2>
            <form onSubmit={handleAddExpense} className="space-y-6">
              <select name="truckId" required className="w-full p-4 bg-slate-50 border rounded-2xl font-bold appearance-none">
                <option value="">Seleccione Camión...</option>
                {trucks.map(t => <option key={t.id} value={t.id}>{t.patente} — {t.chofer}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <select name="category" required className="w-full p-4 bg-slate-50 border rounded-2xl font-bold">
                  <option value="combustible">⛽ Combustible</option>
                  <option value="taller">🔧 Taller / Repuestos</option>
                  <option value="peaje">🛣️ Peaje / Viáticos</option>
                  <option value="varios">📦 Varios</option>
                </select>
                <input name="km" type="number" placeholder="KM ACTUAL" className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="relative pt-4">
                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-4xl font-black text-slate-300">$</span>
                <input name="amount" type="number" step="0.01" required placeholder="0.00" autoFocus className="w-full p-10 bg-slate-900 text-white rounded-[32px] text-center text-5xl font-black outline-none focus:ring-4 focus:ring-blue-500/50 transition-all" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase text-sm shadow-xl shadow-blue-200 transition-transform active:scale-95">Confirmar Operación</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ELIMINAR */}
      {modals.delete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white p-10 rounded-[40px] w-full max-w-sm text-center shadow-2xl border-b-8 border-red-500">
            <AlertTriangle size={32} className="mx-auto text-red-500 mb-6" />
            <h3 className="font-black uppercase text-xl mb-2 italic">¿Eliminar Unidad?</h3>
            <p className="text-sm font-bold text-slate-400 mb-8 leading-relaxed">
              Borrarás el camión <span className="text-slate-900 font-black">{modals.delete.patente}</span> de la flota activa.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModals(m => ({ ...m, delete: null }))} className="flex-1 p-4 bg-slate-100 rounded-2xl font-black text-[10px] uppercase">Cancelar</button>
              <button onClick={handleDeleteTruck} className="flex-1 p-4 bg-red-500 rounded-2xl text-white font-black text-[10px] uppercase shadow-lg shadow-red-200">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GESTIÓN DE USUARIOS */}
      {modals.users && userRole === ROLES.ADMIN && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[48px] p-10 shadow-2xl animate-in zoom-in-95 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black uppercase italic text-blue-600 flex items-center gap-3">
                <Shield size={28} /> Gestión de Usuarios
              </h2>
              <button onClick={() => setModals(m => ({ ...m, users: false }))} className="text-slate-300 hover:text-slate-900">✕</button>
            </div>

            <button 
              onClick={() => setModals(m => ({ ...m, addUser: true }))}
              className="mb-6 w-full bg-blue-600 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase shadow-lg hover:bg-blue-700"
            >
              + Crear Nuevo Usuario
            </button>

            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{u.email}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-black">{u.role}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                      u.role === ROLES.ADMIN ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR USUARIO */}
      {modals.addUser && userRole === ROLES.ADMIN && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[48px] p-10 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-3xl font-black uppercase italic mb-8 text-blue-600">Crear Usuario</h2>
            <form onSubmit={handleCreateUser} className="space-y-6">
              <input 
                name="email" 
                type="email"
                placeholder="Email usuario" 
                required 
                className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input 
                name="password" 
                type="password"
                placeholder="Contraseña" 
                required 
                className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <select name="role" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                <option value={ROLES.USER}>Usuario Normal</option>
                <option value={ROLES.ADMIN}>Administrador</option>
              </select>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setModals(m => ({ ...m, addUser: false }))} className="flex-1 p-4 bg-slate-100 rounded-2xl font-black text-xs uppercase">Cancelar</button>
                <button type="submit" className="flex-1 p-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-200">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// --- SUB-COMPONENTES ---

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 shadow-blue-50",
    orange: "bg-orange-50 text-orange-600 shadow-orange-50",
    violet: "bg-violet-50 text-violet-600 shadow-violet-50",
    slate: "bg-slate-900 text-white shadow-slate-200"
  };

  return (
    <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between hover:translate-y-[-4px] transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl ${colors[color]} shadow-md`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        {subtitle && <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">{subtitle}</span>}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black tracking-tighter truncate">{value}</p>
      </div>
    </div>
  );
}

function TruckCard({ truck, formatCurrency, onDelete }) {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200 transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex gap-4">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
            <span className="font-black text-xs uppercase italic tracking-tighter">{truck.patente.slice(-3)}</span>
          </div>
          <div>
            <h3 className="font-black text-lg uppercase italic leading-none">{truck.chofer || 'Admin'}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{truck.patente} • {truck.flota}</p>
          </div>
        </div>
        <button onClick={onDelete} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mb-8 space-y-1 relative z-10">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Egresos del Periodo</p>
        <p className="text-4xl font-black text-blue-600 tracking-tighter">{formatCurrency(truck.total)}</p>
      </div>

      <div className="space-y-3 pt-6 border-t border-slate-50 relative z-10">
        {[
          { label: 'Seguro Mensual', val: truck.seguro },
          { label: 'Costo VTV', val: truck.vtv_costo },
          { label: 'Imp. Municipal', val: truck.muni_costo }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">{item.label}</span>
            <span className="text-[11px] font-black text-slate-900">{formatCurrency(item.val)}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between relative z-10">
         <div className="flex items-center gap-2">
            <Gauge size={14} className="text-blue-500" />
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{truck.kmActual?.toLocaleString() || '---'} KM</span>
         </div>
         <span className="text-[9px] font-black uppercase text-green-600 flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Activo
         </span>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-800 text-white">
        <p className="text-[9px] font-black uppercase text-slate-400 mb-2">{payload[0].payload.patente}</p>
        <div className="space-y-1">
          <p className="text-xs font-black flex justify-between gap-8"><span className="opacity-50">Base Fija:</span> {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(payload[0].value)}</p>
          <p className="text-xs font-black text-orange-400 flex justify-between gap-8"><span className="opacity-50 text-white">Operativos:</span> {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(payload[1].value)}</p>
        </div>
      </div>
    );
  }
  return null;
}

function Notification({ banner }) {
  if (!banner) return null;
  const styles = { 
    success: "bg-slate-900 border-blue-500", 
    error: "bg-red-600 border-white", 
    info: "bg-blue-600 border-white" 
  };
  return (
    <div className={`fixed top-6 right-6 z-[200] ${styles[banner.type]} text-white px-8 py-5 rounded-[24px] shadow-2xl border-l-8 flex items-center gap-4 animate-in slide-in-from-right-full duration-300`}>
      {banner.type === 'success' ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
      <div><p className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em]">SISTEMA VERACRUZ</p><p className="font-bold text-sm leading-none mt-1">{banner.msg}</p></div>
    </div>
  );
}

function LoadingScreen({ message }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-blue-600 rounded-[28px] flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/20 animate-pulse">
        <Truck className="text-white" size={28} />
      </div>
      <Loader2 className="text-blue-500 animate-spin mb-4" size={28} />
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">{message}</p>
    </div>
  );
}

function LoginComponent({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    setIsLoading(true);
    onLogin(e);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-[48px] p-12 shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-[28px] flex items-center justify-center shadow-xl shadow-blue-500/30">
              <Truck className="text-white" size={32} />
            </div>
          </div>

          <h1 className="text-4xl font-black uppercase italic text-center mb-2 tracking-tighter">
            Veracruz <span className="text-blue-600">Pro</span>
          </h1>
          <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-10">
            Gestión de Flota
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Email</label>
              <input 
                type="email" 
                name="email"
                placeholder="tu@email.com" 
                required 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Contraseña</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••" 
                  required 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Conectando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Credenciales Demo</p>
            <p className="text-[10px] text-slate-600"><strong>Email:</strong> admin@veracruz.com</p>
            <p className="text-[10px] text-slate-600"><strong>Pass:</strong> admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}