


import React, { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { Material } from '../types';
import { PRODUCERS_DATA } from '../constants';
import { Plus, Archive, PackageMinus, FileText, ArrowRight, TrendingDown, TrendingUp, ClipboardList, User, Hash, Edit } from 'lucide-react';
import StatCard from '../components/StatCard';

const InventoryPage: React.FC = () => {
    const { materials, materialMovements, addMaterial, updateMaterial, removeMaterial, activeWorkCenter } = useApp();
    const [activeTab, setActiveTab] = useState<'STOCK' | 'ENTRY' | 'DISPATCH' | 'HISTORY'>('STOCK');
    
    // State for Entry/Edit Form
    const [isEditing, setIsEditing] = useState(false);
    const [entryForm, setEntryForm] = useState<Partial<Material>>({
        name: '',
        provider: '',
        quantity: 0,
        unitCost: 0,
        guideNumber: '',
        entryDate: new Date().toISOString().slice(0, 10)
    });

    // State for Dispatch Form (Expanded)
    const [dispatchForm, setDispatchForm] = useState({
        materialName: '',
        quantity: 0,
        reason: '',
        producer: '', // Destinatario
        guide: ''     // N° Guía
    });

    // --- HANDLERS ---

    const handleEntrySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!entryForm.name || !entryForm.quantity) return;
        
        if (isEditing && entryForm.id) {
            // Update Existing Material
            const updatedMat: Material = {
                id: entryForm.id,
                name: entryForm.name,
                provider: entryForm.provider || 'Sin Proveedor',
                quantity: Number(entryForm.quantity),
                unitCost: 0, // Removed from UI, setting default
                entryDate: entryForm.entryDate!,
                workCenter: entryForm.workCenter || activeWorkCenter,
                guideNumber: entryForm.guideNumber || ''
            };
            updateMaterial(updatedMat);
            alert("Material Actualizado Correctamente");
        } else {
            // New Entry
            const newMat: Material = {
                id: `MAT-${Date.now()}`,
                name: entryForm.name,
                provider: entryForm.provider || 'Sin Proveedor',
                quantity: Number(entryForm.quantity),
                unitCost: 0, // Removed
                entryDate: entryForm.entryDate!,
                workCenter: activeWorkCenter,
                guideNumber: entryForm.guideNumber || ''
            };
            addMaterial(newMat);
            alert("Material Ingresado Correctamente");
        }
        
        // Reset and switch to stock
        setEntryForm({ name: '', provider: '', quantity: 0, unitCost: 0, guideNumber: '', entryDate: new Date().toISOString().slice(0, 10) });
        setIsEditing(false);
        setActiveTab('STOCK');
    };

    const handleEditMaterial = (material: Material) => {
        setEntryForm(material);
        setIsEditing(true);
        setActiveTab('ENTRY');
    };

    const handleDispatchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!dispatchForm.materialName || !dispatchForm.quantity || !dispatchForm.producer) {
            alert("Complete los campos obligatorios (Material, Cantidad, Destinatario)");
            return;
        }

        // Check availability
        const stockMap = materials.reduce((acc, m) => {
            acc[m.name] = (acc[m.name] || 0) + m.quantity;
            return acc;
        }, {} as Record<string, number>);
        
        const available = stockMap[dispatchForm.materialName] || 0;

        if (dispatchForm.quantity > available) {
            alert(`Stock insuficiente. Disponible: ${available}`);
            return;
        }

        // Construct a descriptive reason including the guide and producer
        const fullReason = `Destino: ${dispatchForm.producer} | Guía: ${dispatchForm.guide || 'S/N'} | Motivo: ${dispatchForm.reason || 'Despacho'}`;

        removeMaterial(dispatchForm.materialName, dispatchForm.quantity, fullReason);
        setDispatchForm({ materialName: '', quantity: 0, reason: '', producer: '', guide: '' });
        alert("Salida de Material Registrada");
        setActiveTab('STOCK');
    };

    // --- AGGREGATION LOGIC FOR STOCK SHEET ---
    // Note: For editing, we might want to list individual batches or aggregated.
    // The current aggregation sums duplicates. If we edit, we usually edit a specific batch.
    // However, to keep it simple as per "Inventory Management", we will list individual items for editing.
    // Let's change the view slightly to allow editing specific entries or keep aggregation for display.
    // If we want to edit, we should see the list of Materials (Batches).
    
    // Switch: If we use Aggregation for "Planilla", we can't easily edit "The Material" if it's composed of 3 entries.
    // Interpretation: "En insumo al ingreso... poder editar el ingreso". This means editing the ENTRY itself.
    // So I will add an "Edit" button to the HISTORY (Kardex)? Or maybe show a detailed list in Stock.
    // Let's add a "Detalle / Editar" section in Stock tab.

    const aggregatedStock = useMemo(() => {
        const acc: Record<string, { name: string, quantity: number }> = {};
        
        materials.forEach(m => {
            if (!acc[m.name]) {
                acc[m.name] = { name: m.name, quantity: 0 };
            }
            acc[m.name].quantity += m.quantity;
        });

        return Object.values(acc);
    }, [materials]);

    // Unique Material Names for Dropdowns
    const uniqueMaterialNames = Array.from(new Set(materials.map(m => m.name)));

    const totalStockItems = aggregatedStock.reduce((s, i) => s + i.quantity, 0);

    return (
        <div className="p-8 max-w-7xl mx-auto">
             <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Gestión de Insumos</h1>
                <p className="text-gray-500">Control de inventario, ingresos y salidas de materiales.</p>
            </header>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-xl border border-gray-100 shadow-sm w-fit">
                <button 
                    onClick={() => { setActiveTab('STOCK'); setIsEditing(false); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'STOCK' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <ClipboardList size={18} /> Planilla Stock
                </button>
                <button 
                    onClick={() => { setActiveTab('ENTRY'); setIsEditing(false); setEntryForm({name:'', provider:'', quantity:0, unitCost:0, guideNumber: '', entryDate: new Date().toISOString().slice(0, 10)}); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'ENTRY' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <TrendingUp size={18} /> {isEditing ? 'Editar Ingreso' : 'Ingreso (Entrada)'}
                </button>
                <button 
                    onClick={() => { setActiveTab('DISPATCH'); setIsEditing(false); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'DISPATCH' ? 'bg-amber-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <TrendingDown size={18} /> Despacho (Salida)
                </button>
                <button 
                    onClick={() => { setActiveTab('HISTORY'); setIsEditing(false); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'HISTORY' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <FileText size={18} /> Kardex / Historia
                </button>
            </div>

            {/* --- TAB CONTENT: STOCK SHEET --- */}
            {activeTab === 'STOCK' && (
                <div className="animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                         <StatCard 
                            title="Total Unidades" 
                            value={totalStockItems.toLocaleString()} 
                            icon={<Archive />} 
                            color="blue"
                        />
                    </div>

                    {/* Detailed List for Editing */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">Listado Detallado de Ingresos (Lotes de Insumos)</div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs">
                                <tr>
                                    <th className="p-4">Fecha Ingreso</th>
                                    <th className="p-4">N° Guía</th>
                                    <th className="p-4">Material</th>
                                    <th className="p-4">Proveedor</th>
                                    <th className="p-4 text-right">Cantidad Actual</th>
                                    <th className="p-4 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {materials.slice().reverse().map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-gray-500 text-xs">{new Date(item.entryDate).toLocaleDateString()}</td>
                                        <td className="p-4 text-xs font-mono font-bold text-blue-700">{item.guideNumber || '-'}</td>
                                        <td className="p-4 font-bold text-gray-800">{item.name}</td>
                                        <td className="p-4 text-gray-600">{item.provider}</td>
                                        <td className="p-4 text-right font-mono font-bold text-blue-700">{item.quantity.toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => handleEditMaterial(item)}
                                                className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded transition-colors"
                                                title="Editar Ingreso"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {materials.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay materiales registrados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: ENTRY (INGRESO) --- */}
            {activeTab === 'ENTRY' && (
                <div className="animate-fade-in max-w-2xl mx-auto">
                    <div className="bg-white p-8 rounded-2xl border border-blue-100 shadow-lg">
                        <div className="flex items-center justify-between mb-6 text-blue-800">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-2 rounded-lg"><Plus size={24}/></div>
                                <h2 className="text-xl font-bold">{isEditing ? 'Editar Ingreso de Material' : 'Nuevo Ingreso de Material'}</h2>
                            </div>
                            {isEditing && <button onClick={() => {setIsEditing(false); setActiveTab('STOCK');}} className="text-gray-400 hover:text-gray-600 text-sm">Cancelar</button>}
                        </div>
                        
                        <form onSubmit={handleEntrySubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Material</label>
                                <input 
                                    type="text" required placeholder="ej. Caja 10kg Generica"
                                    className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={entryForm.name} onChange={e => setEntryForm({...entryForm, name: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Proveedor</label>
                                    <input 
                                        type="text" required
                                        className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={entryForm.provider} onChange={e => setEntryForm({...entryForm, provider: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">N° Guía / Referencia</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="N° Guía Despacho"
                                        value={entryForm.guideNumber || ''} onChange={e => setEntryForm({...entryForm, guideNumber: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Ingreso</label>
                                    <input 
                                        type="date" required
                                        className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={entryForm.entryDate} onChange={e => setEntryForm({...entryForm, entryDate: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad (Unidades)</label>
                                    <input 
                                        type="number" required min="1"
                                        className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                                        value={entryForm.quantity || ''} onChange={e => setEntryForm({...entryForm, quantity: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                {/* Removed Unit Cost Input */}
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 mt-4">
                                <Plus size={20} /> {isEditing ? 'Guardar Cambios' : 'Registrar Ingreso'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: DISPATCH (SALIDA) --- */}
            {activeTab === 'DISPATCH' && (
                <div className="animate-fade-in max-w-2xl mx-auto">
                    <div className="bg-white p-8 rounded-2xl border border-amber-100 shadow-lg">
                        <div className="flex items-center gap-3 mb-6 text-amber-800">
                            <div className="bg-amber-100 p-2 rounded-lg"><PackageMinus size={24}/></div>
                            <h2 className="text-xl font-bold">Despacho / Salida Manual</h2>
                            <span className="text-xs bg-amber-50 px-2 py-1 rounded border border-amber-200 text-amber-600 ml-auto">Descuenta FIFO autom.</span>
                        </div>
                        
                        <form onSubmit={handleDispatchSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Seleccionar Material</label>
                                <select 
                                    className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-amber-500"
                                    value={dispatchForm.materialName}
                                    onChange={e => setDispatchForm({...dispatchForm, materialName: e.target.value})}
                                    required
                                >
                                    <option value="">-- Seleccione Material --</option>
                                    {uniqueMaterialNames.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {dispatchForm.materialName && (
                                <div className="text-right text-xs text-gray-500 font-bold">
                                    Stock Disponible: {aggregatedStock.find(s => s.name === dispatchForm.materialName)?.quantity || 0}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destinatario (Productor)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User size={16} className="text-gray-400" />
                                    </div>
                                    <select 
                                        className="w-full pl-10 p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-amber-500"
                                        value={dispatchForm.producer}
                                        onChange={e => setDispatchForm({...dispatchForm, producer: e.target.value})}
                                        required
                                    >
                                        <option value="">-- Seleccione Productor --</option>
                                        {PRODUCERS_DATA.map(p => (
                                            <option key={p.name} value={p.name}>{p.name}</option>
                                        ))}
                                        <option value="OTRO / PLANTA">OTRO / USO INTERNO PLANTA</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">N° Guía</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Hash size={16} className="text-gray-400" />
                                        </div>
                                        <input 
                                            type="text"
                                            className="w-full pl-10 p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-amber-500"
                                            placeholder="S/N"
                                            value={dispatchForm.guide} onChange={e => setDispatchForm({...dispatchForm, guide: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad a Descontar</label>
                                    <input 
                                        type="number" required min="1"
                                        className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-lg"
                                        value={dispatchForm.quantity || ''} onChange={e => setDispatchForm({...dispatchForm, quantity: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo / Detalle</label>
                                <input 
                                    type="text" placeholder="ej. Daño, Ajuste, Producción Manual"
                                    className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg focus:ring-2 focus:ring-amber-500"
                                    value={dispatchForm.reason} onChange={e => setDispatchForm({...dispatchForm, reason: e.target.value})}
                                />
                            </div>

                            <button type="submit" className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-amber-700 transition-all flex items-center justify-center gap-2 mt-4">
                                <PackageMinus size={20} /> Registrar Salida
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: HISTORY (KARDEX) --- */}
            {activeTab === 'HISTORY' && (
                <div className="animate-fade-in">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-700">Historial de Movimientos (Kardex)</h3>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Tipo Movimiento</th>
                                    <th className="p-4">Material</th>
                                    <th className="p-4 text-right">Cantidad</th>
                                    <th className="p-4">Detalle / Razón</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {materialMovements.slice().reverse().map((mov) => (
                                    <tr key={mov.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-gray-500 text-xs">
                                            {new Date(mov.date).toLocaleDateString()} {new Date(mov.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                        </td>
                                        <td className="p-4">
                                            {mov.type === 'IN' ? (
                                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                                                    <TrendingUp size={14}/> INGRESO
                                                </span>
                                            ) : (
                                                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                                                    <TrendingDown size={14}/> SALIDA
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 font-medium text-gray-800">{mov.materialName}</td>
                                        <td className={`p-4 text-right font-bold font-mono ${mov.type === 'IN' ? 'text-blue-600' : 'text-amber-600'}`}>
                                            {mov.type === 'IN' ? '+' : '-'}{mov.quantity}
                                        </td>
                                        <td className="p-4 text-gray-600 text-xs">{mov.reason}</td>
                                    </tr>
                                ))}
                                {materialMovements.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">No hay movimientos registrados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryPage;