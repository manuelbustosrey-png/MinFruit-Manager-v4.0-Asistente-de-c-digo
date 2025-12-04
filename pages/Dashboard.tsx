
import React from 'react';
import { useApp } from '../store/AppContext';
import { Truck, Package, Scale, TrendingUp, AlertTriangle, ArrowRight, Layers, Activity, Building2, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { ProcessStatus } from '../types';
import { TARE_PALLET, TARE_TRAY } from '../constants';

const DashboardPage: React.FC = () => {
    const { receptions, lots, dispatches, currentUser } = useApp();

    // Retrieve Work Center from Session or User Profile
    const activeWorkCenter = localStorage.getItem('selectedWorkCenter') || currentUser?.workCenter || 'Sin Asignar';

    // --- Calculations for KPIs ---

    // 1. Total Received Kilos (Net)
    const totalReceivedKilos = receptions.reduce((sum, r) => sum + r.netWeight, 0);
    
    // 2. Total Processed Kilos (Output Exportable)
    const totalExportKilos = lots.reduce((sum, l) => sum + l.producedKilos, 0);
    
    // 3. Average Yield (Weighted could be better, but simple average for now)
    const averageYield = lots.length > 0 
        ? lots.reduce((sum, l) => sum + l.yieldPercentage, 0) / lots.length 
        : 0;

    // 4. Stock Pallets (Physical Count)
    // Raw Material Pending Pallets
    const rawPalletsPending = receptions
        .reduce((sum, r) => {
            // If detailed pallets exist, count only the ones NOT used
            if(r.palletDetails && r.palletDetails.length > 0) {
                return sum + r.palletDetails.filter(p => !p.isUsed).length;
            }
            // Fallback for simple mode: if status is PENDING, count all pallets. If PROCESSED, count 0.
            return r.status === ProcessStatus.PENDING ? sum + r.pallets : sum; 
        }, 0);

    // Finished Product Pallets (Not dispatched)
    const dispatchedLotIds = dispatches.flatMap(d => d.lotIds);
    // Note: Dispatch logic should ideally track individual pallets, but here we estimate active lots
    // Better approach: Sum all created pallets minus dispatched pallets count if available, 
    // but relying on "Active Lots" logic is consistent with current AppContext
    // Refined logic: Iterate all lots, sum details.pallets, subtract dispatched logic if possible.
    // For now, using the standard activeLots filter based on Lot ID is the safe approximation in this context
    const activeLots = lots.filter(l => !dispatchedLotIds.includes(l.id));
    const finishedPallets = activeLots.reduce((sum, l) => sum + l.details.reduce((ds, d) => ds + (d.pallets || 0), 0), 0);

    // 5. Stock Granel (Existing Bulk Kilos)
    const totalBulkStockKilos = receptions.reduce((sum, r) => {
        // Detailed calculation for accuracy
        if (r.palletDetails && r.palletDetails.length > 0) {
             const unusedWeight = r.palletDetails
                .filter(p => !p.isUsed)
                .reduce((w, p) => {
                    const tare = (p.trays * TARE_TRAY) + TARE_PALLET;
                    return w + Math.max(0, p.weight - tare);
                }, 0);
             return sum + unusedWeight;
        }
        // Fallback for simple mode receptions
        return r.status === ProcessStatus.PENDING ? sum + r.netWeight : sum;
    }, 0);

    // --- Chart Data Preparation ---
    const chartData = receptions.slice(-7).map(rec => ({
        name: rec.guideNumber.slice(-4), // Last 4 digits of guide
        kilos: rec.netWeight,
        date: new Date(rec.receptionDate).toLocaleDateString(undefined, {weekday: 'short'})
    }));

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Panel de Control</h1>
                    <p className="text-gray-500">Resumen general de operaciones planta Rio Donguil.</p>
                </div>

                {/* Work Center Badge */}
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-blue-100 shadow-sm">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Centro de Trabajo Activo</p>
                        <h2 className="text-sm font-bold text-blue-800">{activeWorkCenter}</h2>
                    </div>
                </div>
            </header>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                {/* Card 1: Recepcion */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Recepcionado</p>
                            <h3 className="text-2xl font-bold text-gray-800 mt-1">{totalReceivedKilos.toLocaleString()} kg</h3>
                        </div>
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Truck size={20} />
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <TrendingUp size={12} />
                        <span>+ {receptions.length} Guías ingresadas</span>
                    </div>
                </div>

                {/* Card 2: Stock Granel (New) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-teal-50 rounded-full opacity-50"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Granel (MP)</p>
                            <h3 className="text-2xl font-bold text-gray-800 mt-1">{totalBulkStockKilos.toLocaleString(undefined, {maximumFractionDigits: 0})} kg</h3>
                        </div>
                        <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
                            <Database size={20} />
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-teal-600 font-medium">
                        <span>Disponible para Proceso</span>
                    </div>
                </div>

                {/* Card 3: Yield */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                     <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-50 rounded-full opacity-50"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rendimiento Prom.</p>
                            <h3 className="text-2xl font-bold text-gray-800 mt-1">{averageYield.toFixed(1)}%</h3>
                        </div>
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                            <Activity size={20} />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(averageYield, 100)}%` }}></div>
                    </div>
                </div>

                {/* Card 4: Processed */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full opacity-50"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Exportación Total</p>
                            <h3 className="text-2xl font-bold text-gray-800 mt-1">{totalExportKilos.toLocaleString()} kg</h3>
                        </div>
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                            <Package size={20} />
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>{lots.length} lotes procesados</span>
                    </div>
                </div>

                {/* Card 5: Stock Pallets */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Pallets Piso</p>
                            <h3 className="text-2xl font-bold text-gray-800 mt-1">{rawPalletsPending + finishedPallets}</h3>
                        </div>
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Layers size={20} />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">MP: {rawPalletsPending}</span>
                        <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">PT: {finishedPallets}</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left: Recent Activity & Charts */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Chart Section */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-700 mb-4">Ingresos Recientes (Últimas 7 recepciones)</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorKilos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                        itemStyle={{color: '#2e7d32', fontWeight: 'bold'}}
                                        formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Peso Neto']}
                                    />
                                    <Area type="monotone" dataKey="kilos" stroke="#2e7d32" strokeWidth={3} fillOpacity={1} fill="url(#colorKilos)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Receptions List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700">Últimos Movimientos</h3>
                            <Link to="/reports" className="text-xs text-primary font-bold hover:underline">Ver Reportes</Link>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {receptions.slice(-5).reverse().map(rec => (
                                <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                            <Truck size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">Recepción {rec.guideNumber}</p>
                                            <p className="text-xs text-gray-500">{rec.producer} • {rec.variety}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-700">{rec.netWeight.toLocaleString()} kg</p>
                                        <p className="text-[10px] text-gray-400">{new Date(rec.receptionDate).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Quick Actions & Alerts */}
                <div className="space-y-6">
                    {/* Action Card */}
                    <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 text-white shadow-lg">
                        <h3 className="text-lg font-bold mb-2">Acciones Rápidas</h3>
                        <p className="text-green-100 text-sm mb-6">Seleccione una operación frecuente para comenzar.</p>
                        
                        <div className="space-y-3">
                            <Link to="/reception" className="flex items-center justify-between bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors backdrop-blur-sm border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white text-green-700 p-1.5 rounded-lg"><Truck size={16}/></div>
                                    <span className="font-medium text-sm">Nueva Recepción</span>
                                </div>
                                <ArrowRight size={16} />
                            </Link>
                            
                            <Link to="/process" className="flex items-center justify-between bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors backdrop-blur-sm border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white text-green-700 p-1.5 rounded-lg"><Package size={16}/></div>
                                    <span className="font-medium text-sm">Crear Lote Producción</span>
                                </div>
                                <ArrowRight size={16} />
                            </Link>

                            <Link to="/dispatch" className="flex items-center justify-between bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors backdrop-blur-sm border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white text-green-700 p-1.5 rounded-lg"><Truck size={16}/></div>
                                    <span className="font-medium text-sm">Despachar Pedido</span>
                                </div>
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>

                    {/* System Status / Alerts */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" /> Alertas de Inventario
                        </h3>
                        
                        <div className="space-y-4">
                            {/* Fake alert logic for demo */}
                            {averageYield < 50 && (
                                <div className="flex gap-3 items-start p-3 bg-red-50 rounded-lg border border-red-100">
                                    <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-xs font-bold text-red-800">Rendimiento Crítico</p>
                                        <p className="text-[10px] text-red-600 mt-1">El promedio de rendimiento global está por debajo del 50%. Revise procesos de descarte.</p>
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex gap-3 items-start p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                                <div>
                                    <p className="text-xs font-bold text-blue-800">Stock Disponible</p>
                                    <p className="text-[10px] text-blue-600 mt-1">Tiene {finishedPallets} pallets de producto terminado listos para despacho.</p>
                                </div>
                            </div>

                            <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-400 flex-shrink-0"></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-700">Sistema Actualizado</p>
                                    <p className="text-[10px] text-gray-500 mt-1">Versión 2.0.5 - Rio Donguil Manager funcionando correctamente.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
