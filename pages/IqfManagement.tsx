
import React, { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { IqfPallet, IqfSourceItem } from '../types';
import { Snowflake, Plus, Layers, Save, Printer, Truck, Edit, Check, X, Trash2, FileSpreadsheet, CheckSquare, Square } from 'lucide-react';
import { APP_NAME } from '../constants';

const IqfManagementPage: React.FC = () => {
    const { lots, iqfPallets, addIqfPallet, updateIqfPallet, removeIqfPallet, activeWorkCenter } = useApp();
    
    // Selection State for creating new pallet
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    // New State: Trays for new pallet
    const [creationTrays, setCreationTrays] = useState(0);
    
    // Edit/Dispatch Modal State
    const [editingPallet, setEditingPallet] = useState<IqfPallet | null>(null);
    // Removed 'trays' from edit form as requested
    const [editForm, setEditForm] = useState<{ producer: string, variety: string }>({ producer: '', variety: '' });

    // Bulk Actions State
    const [selectedPalletIds, setSelectedPalletIds] = useState<string[]>([]);
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [dispatchGuideInput, setDispatchGuideInput] = useState('');

    // Available IQF Stock Logic
    const availableIqfStock = useMemo(() => {
        const usedMap: Record<string, number> = {};
        
        // Calculate used amounts
        iqfPallets.forEach(pallet => {
            pallet.items.forEach(item => {
                usedMap[item.lotId] = (usedMap[item.lotId] || 0) + item.kilos;
            });
        });

        // Generate list of available sources
        return lots
            .filter(lot => lot.iqfKilos > 0)
            .map(lot => {
                const used = usedMap[lot.id] || 0;
                const remaining = Math.max(0, lot.iqfKilos - used);
                const guide = 'Ver Lote'; 

                return {
                    lotId: lot.id,
                    totalGenerated: lot.iqfKilos,
                    remaining,
                    producer: lot.lotProducer,
                    variety: lot.lotVariety,
                    guide
                };
            })
            .filter(item => item.remaining > 0); // Only show if stock remains
    }, [lots, iqfPallets]);

    const toggleSourceSelection = (lotId: string) => {
        setSelectedSourceIds(prev => prev.includes(lotId) ? prev.filter(id => id !== lotId) : [...prev, lotId]);
    };

    // --- Pallet Selection Logic ---
    const togglePalletSelection = (palletId: string) => {
        setSelectedPalletIds(prev => prev.includes(palletId) ? prev.filter(id => id !== palletId) : [...prev, palletId]);
    };

    const toggleAllPallets = () => {
        if (selectedPalletIds.length === iqfPallets.length) {
            setSelectedPalletIds([]);
        } else {
            setSelectedPalletIds(iqfPallets.map(p => p.id));
        }
    };
    // ------------------------------

    const generateFolio = () => {
        const base = 500100001;
        let max = base - 1;
        iqfPallets.forEach(p => {
            const num = parseInt(p.folio);
            if (!isNaN(num) && num > max) max = num;
        });
        return (max + 1).toString();
    };

    const handleCreatePallet = () => {
        const selectedItems = availableIqfStock.filter(i => selectedSourceIds.includes(i.lotId));
        
        if (selectedItems.length === 0) return;

        // Default consolidated strings
        const producers = Array.from(new Set(selectedItems.map(i => i.producer))).join(' + ');
        const varieties = Array.from(new Set(selectedItems.map(i => i.variety))).join(' + ');
        
        const newPallet: IqfPallet = {
            id: `IQF-${Date.now()}`,
            folio: generateFolio(),
            creationDate: new Date().toISOString(),
            totalKilos: selectedItems.reduce((sum, i) => sum + i.remaining, 0),
            items: selectedItems.map(i => ({
                lotId: i.lotId,
                kilos: i.remaining, // Consuming all remaining for simplicity
                producer: i.producer,
                variety: i.variety,
                guide: i.guide
            })),
            trays: creationTrays, // Use value from creation input
            status: 'PENDING',
            formattedProducer: producers,
            formattedVariety: varieties,
            workCenter: activeWorkCenter
        };

        addIqfPallet(newPallet);
        setSelectedSourceIds([]);
        setCreationTrays(0); // Reset
        setIsCreateModalOpen(false);
    };

    const startEdit = (pallet: IqfPallet) => {
        setEditingPallet(pallet);
        setEditForm({
            producer: pallet.formattedProducer || '',
            variety: pallet.formattedVariety || ''
        });
    }

    const handleSaveEdit = () => {
        if (!editingPallet) return;
        
        const updated: IqfPallet = {
            ...editingPallet,
            formattedProducer: editForm.producer,
            formattedVariety: editForm.variety
        };
        
        updateIqfPallet(updated);
        setEditingPallet(null);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("¿Desarmar este pallet? Los kilos volverán al inventario granel disponible.")) {
            removeIqfPallet(id);
        }
    };

    const handleBulkDispatch = () => {
        if (!dispatchGuideInput.trim()) {
            alert("Debe ingresar un número de guía.");
            return;
        }

        if (window.confirm(`¿Despachar ${selectedPalletIds.length} pallets con Guía N° ${dispatchGuideInput}?`)) {
            selectedPalletIds.forEach(id => {
                const pallet = iqfPallets.find(p => p.id === id);
                if (pallet) {
                    updateIqfPallet({ 
                        ...pallet, 
                        status: 'DISPATCHED',
                        dispatchGuide: dispatchGuideInput
                    });
                }
            });
            
            setIsDispatchModalOpen(false);
            setDispatchGuideInput('');
            setSelectedPalletIds([]);
            alert("Pallets despachados correctamente.");
        }
    };

    const handleExportExcel = () => {
        const headers = ["Folio", "Fecha", "Productor(es)", "Variedad(es)", "Kilos Netos", "Bandejas", "Estado", "Guía Despacho"];
        const rows = iqfPallets.map(p => [
            p.folio,
            new Date(p.creationDate).toLocaleDateString(),
            `"${p.formattedProducer || ''}"`,
            `"${p.formattedVariety || ''}"`,
            p.totalKilos.toFixed(2).replace('.', ','),
            p.trays,
            p.status === 'PENDING' ? "EN STOCK" : "DESPACHADO",
            p.dispatchGuide || "-"
        ]);

        const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `IQF_Pallets_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintTag = (pallet: IqfPallet) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tarja IQF ${pallet.folio}</title>
                <style>
                    @page { size: letter portrait; margin: 1cm; }
                    body { font-family: Arial, sans-serif; padding: 20px; border: 2px solid black; height: 90vh; display: flex; flex-direction: column; }
                    .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; }
                    h1 { margin: 0; font-size: 24px; }
                    h2 { font-size: 60px; margin: 10px 0; font-weight: 900; }
                    .label { font-size: 14px; color: #666; text-transform: uppercase; font-weight: bold; }
                    .value { font-size: 24px; font-weight: bold; margin-bottom: 15px; display: block; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 2px solid black; padding-top: 20px; margin-top: auto; }
                    .big-value { font-size: 48px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${APP_NAME}</h1>
                    <div style="background: #000; color: #fff; display: inline-block; padding: 5px 20px; font-weight: bold; margin-top: 10px;">DESCARTE IQF</div>
                    <h2>${pallet.folio}</h2>
                </div>

                <div>
                    <span class="label">Productor(es)</span>
                    <span class="value">${pallet.formattedProducer || 'Varios'}</span>
                </div>
                
                <div>
                    <span class="label">Variedad(es)</span>
                    <span class="value">${pallet.formattedVariety || 'Mix'}</span>
                </div>

                <div>
                    <span class="label">Fecha</span>
                    <span class="value">${new Date(pallet.creationDate).toLocaleDateString()}</span>
                </div>

                <div class="grid">
                    <div style="text-align: center;">
                        <span class="label">BANDEJAS</span>
                        <div class="big-value">${pallet.trays}</div>
                    </div>
                    <div style="text-align: center;">
                        <span class="label">KILOS NETOS</span>
                        <div class="big-value">${pallet.totalKilos.toFixed(1)}</div>
                    </div>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <Snowflake className="text-blue-500"/> Gestión Descarte IQF
                    </h1>
                    <p className="text-gray-500">Control de inventario de congelado, armado de pallets y despacho.</p>
                </div>
                <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-700 flex items-center gap-2">
                    <FileSpreadsheet size={20}/> Exportar Excel
                </button>
            </div>

            <div className="flex flex-col gap-8">
                
                {/* TOP: AVAILABLE INVENTORY (100% Width) */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                        <div>
                            <h2 className="text-lg font-bold text-gray-700">Inventario Granel IQF Disponible</h2>
                            <p className="text-xs text-gray-500">Seleccione los lotes para consolidar en un nuevo pallet.</p>
                        </div>
                        <div className="text-right">
                             <span className="text-sm font-bold text-blue-600">
                                {selectedSourceIds.length} seleccionados
                             </span>
                             <div className="text-xs text-gray-400">
                                Total: {availableIqfStock.filter(i => selectedSourceIds.includes(i.lotId)).reduce((s,i) => s + i.remaining, 0).toFixed(1)} kg
                             </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[300px]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-blue-50 text-blue-800 text-xs uppercase sticky top-0">
                                <tr>
                                    <th className="p-3 text-center w-10">
                                        {/* Checkbox Header */}
                                    </th>
                                    <th className="p-3">Lote Origen</th>
                                    <th className="p-3">Productor</th>
                                    <th className="p-3">Variedad</th>
                                    <th className="p-3 text-right">Disponible (kg)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {availableIqfStock.map(item => (
                                    <tr 
                                        key={item.lotId} 
                                        className={`hover:bg-blue-50 cursor-pointer ${selectedSourceIds.includes(item.lotId) ? 'bg-blue-50' : ''}`}
                                        onClick={() => toggleSourceSelection(item.lotId)}
                                    >
                                        <td className="p-3 text-center">
                                            <input 
                                                type="checkbox"
                                                checked={selectedSourceIds.includes(item.lotId)}
                                                onChange={() => {}} // Handled by row click
                                                className="rounded text-blue-600 pointer-events-none"
                                            />
                                        </td>
                                        <td className="p-3 font-mono font-bold text-gray-700">{item.lotId}</td>
                                        <td className="p-3 text-gray-600">{item.producer}</td>
                                        <td className="p-3 text-gray-600">{item.variety}</td>
                                        <td className="p-3 text-right font-bold text-blue-600">{item.remaining.toFixed(1)}</td>
                                    </tr>
                                ))}
                                {availableIqfStock.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">No hay stock granel IQF disponible.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                        <button 
                            disabled={selectedSourceIds.length === 0}
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Plus size={20}/> Armar Pallet
                        </button>
                    </div>
                </div>

                {/* BOTTOM: PALLET INVENTORY */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                            <Layers size={20} className="text-gray-400"/> Pallets Armados (En Piso)
                        </h2>
                        
                        {/* Bulk Action Bar */}
                        {selectedPalletIds.length > 0 && (
                            <div className="flex items-center gap-2 animate-fade-in">
                                <span className="text-xs font-bold text-blue-600">{selectedPalletIds.length} seleccionados</span>
                                <button 
                                    onClick={() => setIsDispatchModalOpen(true)}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-2 shadow-sm"
                                >
                                    <Truck size={14}/> Despachar Seleccionados
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th className="p-3 text-center w-10">
                                        <button onClick={toggleAllPallets} className="text-gray-500 hover:text-gray-700">
                                            {selectedPalletIds.length > 0 && selectedPalletIds.length === iqfPallets.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                                        </button>
                                    </th>
                                    <th className="p-3">Folio</th>
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3">Productor(es)</th>
                                    <th className="p-3">Variedad(es)</th>
                                    <th className="p-3 text-right">Bandejas</th>
                                    <th className="p-3 text-right">Kilos Netos</th>
                                    <th className="p-3 text-center">Estado</th>
                                    <th className="p-3 text-center">Guía Desp.</th>
                                    <th className="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {iqfPallets.slice().reverse().map(pallet => (
                                    <tr key={pallet.id} className={`hover:bg-gray-50 ${selectedPalletIds.includes(pallet.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-3 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedPalletIds.includes(pallet.id)}
                                                onChange={() => togglePalletSelection(pallet.id)}
                                                className="rounded text-blue-600 cursor-pointer"
                                                disabled={pallet.status === 'DISPATCHED'} // Optional: Disable selection if dispatched, or allow for multi-delete? Assuming dispatch only for now.
                                            />
                                        </td>
                                        <td className="p-3 font-mono font-black text-gray-800">{pallet.folio}</td>
                                        <td className="p-3 text-xs text-gray-500">{new Date(pallet.creationDate).toLocaleDateString()}</td>
                                        <td className="p-3 text-xs text-gray-600 max-w-[150px] truncate" title={pallet.formattedProducer}>{pallet.formattedProducer}</td>
                                        <td className="p-3 text-xs text-gray-600 max-w-[150px] truncate" title={pallet.formattedVariety}>{pallet.formattedVariety}</td>
                                        <td className="p-3 text-right font-bold text-gray-700">{pallet.trays}</td>
                                        <td className="p-3 text-right font-mono font-bold text-blue-600">{pallet.totalKilos.toFixed(1)}</td>
                                        <td className="p-3 text-center">
                                            {pallet.status === 'PENDING' ? 
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">En Stock</span> :
                                                <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[10px] font-bold">Despachado</span>
                                            }
                                        </td>
                                        <td className="p-3 text-center text-xs font-mono">
                                            {pallet.dispatchGuide || '-'}
                                        </td>
                                        <td className="p-3 text-center flex items-center justify-center gap-1">
                                            <button onClick={() => handlePrintTag(pallet)} className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded" title="Imprimir Tarja"><Printer size={16}/></button>
                                            {pallet.status === 'PENDING' && (
                                                <>
                                                    <button onClick={() => startEdit(pallet)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit size={16}/></button>
                                                    <button onClick={() => handleDelete(pallet.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar"><Trash2 size={16}/></button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {iqfPallets.length === 0 && (
                                    <tr><td colSpan={10} className="p-8 text-center text-gray-400">No hay pallets IQF creados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* CREATE MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-700">Confirmar Pallet IQF</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        
                        <div className="mb-4 text-sm text-gray-600">
                            Se creará un pallet con <strong>{availableIqfStock.filter(i => selectedSourceIds.includes(i.lotId)).reduce((s,i) => s + i.remaining, 0).toFixed(1)} kg</strong> proveniente de {selectedSourceIds.length} lotes.
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad de Bandejas</label>
                            <input 
                                type="number" 
                                min="0" 
                                className="w-full p-3 border border-gray-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                value={creationTrays}
                                onChange={e => setCreationTrays(parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                            <button onClick={handleCreatePallet} className="flex-1 bg-blue-600 text-white py-3 font-bold rounded-xl hover:bg-blue-700 shadow-lg">Crear Pallet</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BULK DISPATCH MODAL */}
            {isDispatchModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                                <Truck size={20} className="text-green-600"/> Despachar Pallets
                            </h3>
                            <button onClick={() => setIsDispatchModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        
                        <div className="mb-4 text-sm text-gray-600">
                            Se despacharán <strong>{selectedPalletIds.length}</strong> pallets seleccionados.
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Número de Guía</label>
                            <input 
                                type="text" 
                                className="w-full p-3 border border-gray-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="Ingrese N° Guía"
                                value={dispatchGuideInput}
                                onChange={e => setDispatchGuideInput(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsDispatchModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                            <button onClick={handleBulkDispatch} className="flex-1 bg-green-600 text-white py-3 font-bold rounded-xl hover:bg-green-700 shadow-lg">Confirmar Despacho</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editingPallet && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-700">Editar Información Pallet {editingPallet.folio}</h3>
                            <button onClick={() => setEditingPallet(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Productor(es) Texto</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                    value={editForm.producer}
                                    onChange={e => setEditForm({...editForm, producer: e.target.value})}
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Puede editar este texto para la etiqueta.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Variedad(es) Texto</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                    value={editForm.variety}
                                    onChange={e => setEditForm({...editForm, variety: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setEditingPallet(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                            <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 text-white py-3 font-bold rounded-xl hover:bg-blue-700 shadow-lg">Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IqfManagementPage;
