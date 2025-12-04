
import React, { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { Dispatch } from '../types';
import { Send, Truck, CheckCircle, User, Tag, Calendar, Package, Box, Printer } from 'lucide-react';
import { APP_NAME } from '../constants';

const DispatchPage: React.FC = () => {
    const { lots, addDispatch, dispatches, activeWorkCenter } = useApp();
    const [step, setStep] = useState(0);
    
    // Track selected Folios (Pallets) instead of Lots
    const [selectedFolios, setSelectedFolios] = useState<string[]>([]);
    const [form, setForm] = useState({ client: '', guide: '', date: new Date().toISOString().slice(0,10) });

    // Flatten available stock into individual pallets
    const availablePallets = useMemo(() => {
        // Collect all dispatched folios
        const dispatchedFoliosSet = new Set(
            dispatches.reduce<string[]>((acc, d) => acc.concat(d.dispatchedFolios || []), [])
        );
        // Also collect lotIds from legacy dispatches that might not have dispatchedFolios details
        // If a dispatch has NO dispatchedFolios but HAS lotIds, we assume those lots are fully dispatched.
        const fullyDispatchedLotIds = new Set(
            dispatches
                .filter(d => !d.dispatchedFolios || d.dispatchedFolios.length === 0)
                .reduce<string[]>((acc, d) => acc.concat(d.lotIds), [])
        );

        const pallets: {
            uniqueKey: string;
            folio: string;
            lotId: string;
            producer: string;
            variety: string;
            format: string;
            weightPerUnit: number;
            units: number;
            kilos: number;
            date: string;
        }[] = [];

        lots.forEach(lot => {
            // Skip if the entire lot was dispatched in a legacy record
            if (fullyDispatchedLotIds.has(lot.id)) return;

            lot.details.forEach((detail, index) => {
                // Identifier for the pallet
                const folio = detail.manualFolio;
                
                // Only add if it has a folio and hasn't been dispatched
                if (folio && !dispatchedFoliosSet.has(folio)) {
                    pallets.push({
                        uniqueKey: `${lot.id}-${index}-${folio}`, // Composite key for React list
                        folio: folio,
                        lotId: lot.id,
                        producer: detail.originProducer || lot.lotProducer,
                        variety: detail.originVariety || lot.lotVariety,
                        format: detail.formatName,
                        weightPerUnit: detail.weightPerUnit,
                        units: detail.units,
                        kilos: detail.totalKilos,
                        date: detail.originDate || lot.createdAt
                    });
                }
            });
        });

        return pallets;
    }, [lots, dispatches]);

    const togglePallet = (folio: string) => {
        if (selectedFolios.includes(folio)) setSelectedFolios(prev => prev.filter(f => f !== folio));
        else setSelectedFolios(prev => [...prev, folio]);
    };

    const handleDispatch = (e: React.FormEvent) => {
        e.preventDefault();
        
        const selectedItems = availablePallets.filter(p => selectedFolios.includes(p.folio));
        
        const totalKilos = selectedItems.reduce((sum, p) => sum + p.kilos, 0);
        const totalUnits = selectedItems.reduce((sum, p) => sum + p.units, 0);
        
        // We still track involved lots for reference, though dispatchedFolios is the source of truth
        const involvedLotIds = Array.from(new Set(selectedItems.map(p => p.lotId))) as string[];

        const newDispatch: Dispatch = {
            id: `DISP-${Date.now()}`,
            dispatchGuide: form.guide,
            clientName: form.client,
            dispatchDate: form.date,
            lotIds: involvedLotIds,
            dispatchedFolios: selectedFolios, // Save specific folios
            totalKilos,
            totalUnits,
            workCenter: activeWorkCenter
        };

        addDispatch(newDispatch);
        setStep(2); // Success
    };

    const reset = () => {
        setStep(0);
        setSelectedFolios([]);
        setForm({ client: '', guide: '', date: new Date().toISOString().slice(0,10) });
    };

    const handlePrintDispatchGuide = (dispatch: Dispatch) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date(dispatch.dispatchDate).toLocaleDateString();
        
        // Items list - Just folio list for now as per dispatch object structure
        const itemsRows = (dispatch.dispatchedFolios || []).map(folio => `
            <tr>
                <td style="padding: 5px; border-bottom: 1px solid #eee;">${folio}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Guía Despacho ${dispatch.dispatchGuide}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { margin: 0; color: #2e7d32; }
                    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .meta div { margin-bottom: 10px; }
                    .label { font-weight: bold; font-size: 12px; color: #666; text-transform: uppercase; display: block; }
                    .value { font-size: 16px; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th { text-align: left; background: #f5f5f5; padding: 10px; border-bottom: 2px solid #ddd; }
                    .totals { text-align: right; border-top: 2px solid #333; padding-top: 20px; }
                    .total-row { font-size: 18px; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${APP_NAME}</h1>
                    <p>Comprobante de Despacho Interno</p>
                </div>
                
                <div class="meta">
                    <div>
                        <span class="label">Cliente</span>
                        <span class="value">${dispatch.clientName}</span>
                    </div>
                    <div>
                        <span class="label">N° Guía</span>
                        <span class="value">${dispatch.dispatchGuide}</span>
                    </div>
                    <div>
                        <span class="label">Fecha</span>
                        <span class="value">${dateStr}</span>
                    </div>
                </div>

                <h3>Detalle de Pallets</h3>
                <table>
                    <thead>
                        <tr><th>N° Pallet (Folio)</th></tr>
                    </thead>
                    <tbody>
                        ${itemsRows || '<tr><td style="padding:10px; font-style:italic;">Detalle no disponible (Legacy)</td></tr>'}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row">Total Cajas: <strong>${dispatch.totalUnits}</strong></div>
                    <div class="total-row" style="color: #2e7d32; font-size: 24px;">Total Kilos: <strong>${dispatch.totalKilos.toLocaleString()} kg</strong></div>
                </div>

                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // Derived totals for summary
    const summaryUnits = availablePallets.filter(p => selectedFolios.includes(p.folio)).reduce((s, p) => s + p.units, 0);
    const summaryKilos = availablePallets.filter(p => selectedFolios.includes(p.folio)).reduce((s, p) => s + p.kilos, 0);

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-white">
             <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Despacho de Producto Terminado</h1>
                <p className="text-gray-500">Salida de inventario y guías de despacho.</p>
            </header>

            {step === 2 ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center animate-fade-in">
                    <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-900 mb-2">¡Despacho Exitoso!</h2>
                    <p className="text-green-700 mb-6">La guía {form.guide} ha sido registrada y el inventario descontado.</p>
                    <button onClick={reset} className="bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 shadow-lg">Nuevo Despacho</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-700">Seleccionar Stock Disponible</h3>
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-bold">{availablePallets.length} pallets disponibles</span>
                            </div>
                            
                            {availablePallets.length === 0 ? (
                                <p className="text-gray-400 text-center py-8 border-2 border-dashed rounded-xl">No hay stock de producto terminado disponible.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold sticky top-0">
                                            <tr>
                                                <th className="p-3 w-10 text-center">
                                                    {/* Checkbox header could implement select all */}
                                                </th>
                                                <th className="p-3">N° Pallet (Folio)</th>
                                                <th className="p-3">Productor</th>
                                                <th className="p-3">Variedad</th>
                                                <th className="p-3">Formato</th>
                                                <th className="p-3">Fecha Emb.</th>
                                                <th className="p-3 text-right">Cajas</th>
                                                <th className="p-3 text-right">Kilos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {availablePallets.map(pallet => (
                                                <tr 
                                                    key={pallet.uniqueKey} 
                                                    onClick={() => togglePallet(pallet.folio)}
                                                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedFolios.includes(pallet.folio) ? 'bg-blue-50' : ''}`}
                                                >
                                                    <td className="p-3 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedFolios.includes(pallet.folio)}
                                                            onChange={() => {}} // Handled by tr onClick
                                                            className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-3 font-mono font-black text-blue-800">
                                                        {pallet.folio}
                                                    </td>
                                                    <td className="p-3 text-xs font-medium text-gray-700">{pallet.producer}</td>
                                                    <td className="p-3 text-xs text-gray-500">{pallet.variety}</td>
                                                    <td className="p-3 text-xs">
                                                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                                            {pallet.format}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-xs text-gray-400">{new Date(pallet.date).toLocaleDateString()}</td>
                                                    <td className="p-3 text-right font-bold text-gray-800">
                                                        {pallet.units}
                                                    </td>
                                                    <td className="p-3 text-right text-gray-500 font-mono text-xs">
                                                        {pallet.kilos.toFixed(1)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                         <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 sticky top-8">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <Truck className="text-primary"/> Resumen Despacho
                            </h3>
                            
                            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-500">Pallets Seleccionados:</span>
                                    <span className="font-bold text-blue-600">{selectedFolios.length}</span>
                                </div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-500">Total Unidades:</span>
                                    <span className="font-bold text-gray-800">{summaryUnits}</span>
                                </div>
                                <div className="border-t border-gray-200 my-2 pt-2 flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-600">Total Kilos:</span>
                                    <span className="text-xl font-bold text-primary">{summaryKilos.toFixed(1)} kg</span>
                                </div>
                            </div>

                            <form onSubmit={handleDispatch} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3 top-3 text-gray-400"/>
                                        <input 
                                            type="text" required 
                                            className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary bg-black text-white"
                                            placeholder="Nombre Cliente"
                                            value={form.client} onChange={e => setForm({...form, client: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guía Salida</label>
                                    <div className="relative">
                                        <Tag size={16} className="absolute left-3 top-3 text-gray-400"/>
                                        <input 
                                            type="text" required 
                                            className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary bg-black text-white"
                                            placeholder="N° Guía Despacho"
                                            value={form.guide} onChange={e => setForm({...form, guide: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Despacho</label>
                                    <div className="relative">
                                        <Calendar size={16} className="absolute left-3 top-3 text-gray-400"/>
                                        <input 
                                            type="date" required 
                                            className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary bg-black text-white"
                                            value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <button 
                                    type="submit"
                                    disabled={selectedFolios.length === 0}
                                    className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-800 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                                >
                                    <Send size={18} /> Confirmar Salida
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

             {/* History Table */}
             <div className="mt-12">
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-gray-100 p-2 rounded-lg text-gray-600"><Truck size={20}/></div>
                    <h3 className="text-xl font-bold text-gray-800">Historial de Despachos</h3>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Guía</th>
                                <th className="p-4">Detalle (N° Pallets)</th>
                                <th className="p-4 text-right">Kilos Totales</th>
                                <th className="p-4 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {dispatches.slice().reverse().map(d => (
                                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-gray-600 text-xs">{d.dispatchDate}</td>
                                    <td className="p-4 font-bold text-gray-800">{d.clientName}</td>
                                    <td className="p-4">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-mono text-xs font-bold">
                                            {d.dispatchGuide}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs">
                                        {d.dispatchedFolios ? (
                                            <div className="flex flex-wrap gap-1">
                                                {d.dispatchedFolios.map(f => (
                                                    <span key={f} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 font-mono font-bold">
                                                        {f}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">Despacho por Lote (Legacy)</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right font-bold text-primary">{d.totalKilos.toLocaleString()} kg</td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={() => handlePrintDispatchGuide(d)}
                                            className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50"
                                            title="Imprimir Guía"
                                        >
                                            <Printer size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                             {dispatches.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay despachos realizados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
        </div>
    );
};

export default DispatchPage;
