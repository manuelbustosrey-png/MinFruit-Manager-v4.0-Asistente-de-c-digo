
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { FileSpreadsheet, Calendar, Truck, Printer, ArrowLeft, Save, ShoppingBag, Send, Package, ArrowRight, ArrowDownLeft, ArrowUpRight, Filter, Search, FileText } from 'lucide-react';
import { APP_NAME, PRODUCERS_DATA } from '../constants';

// Local Interface for Tray Dispatch (Envases)
interface TrayDispatch {
    id: string;
    date: string;
    recipient: string; // Producer or Provider
    type: string; // e.g. "Bandeja Cosechera Negra"
    quantity: number;
    guideNumber: string;
}

// Unified Interface for Movements (Ledger)
interface TrayMovement {
    id: string;
    date: string;
    producer: string;
    type: 'INGRESO' | 'SALIDA';
    quantity: number;
    guideNumber: string;
    description: string;
    timestamp: number;
}

const ReportsPage: React.FC = () => {
    const { receptions, lots } = useApp();
    
    // View Mode: MAIN | TRAYS
    const [view, setView] = useState<'MAIN' | 'TRAYS'>('MAIN');

    // State for Reception Dates
    const [recStartDate, setRecStartDate] = useState('');
    const [recEndDate, setRecEndDate] = useState('');

    // State for Packing Dates
    const [packStartDate, setPackStartDate] = useState('');
    const [packEndDate, setPackEndDate] = useState('');
    
    // State for Tray Management (Envases)
    const [trayDispatches, setTrayDispatches] = useState<TrayDispatch[]>(() => {
        const saved = localStorage.getItem('db_tray_dispatches');
        return saved ? JSON.parse(saved) : [];
    });
    
    // Tray Management UI State
    const [selectedProducer, setSelectedProducer] = useState<string>('TODOS');
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [trayForm, setTrayForm] = useState<Partial<TrayDispatch>>({
        date: new Date().toISOString().slice(0, 10),
        type: 'Bandeja Cosechera Estándar'
    });

    // Persist Tray Dispatches
    useEffect(() => {
        localStorage.setItem('db_tray_dispatches', JSON.stringify(trayDispatches));
    }, [trayDispatches]);

    // --- TRAY LEDGER LOGIC ---
    
    // 1. Aggregate all movements
    const trayMovements = useMemo(() => {
        const moves: TrayMovement[] = [];

        // Inflows from Receptions
        receptions.forEach(rec => {
            if (rec.trays > 0) {
                moves.push({
                    id: `REC-${rec.id}`,
                    date: rec.receptionDate,
                    producer: rec.producer,
                    type: 'INGRESO',
                    quantity: rec.trays,
                    guideNumber: rec.guideNumber,
                    description: `Recepción: ${rec.variety}`,
                    timestamp: new Date(rec.receptionDate).getTime()
                });
            }
        });

        // Outflows from Dispatches
        trayDispatches.forEach(disp => {
            moves.push({
                id: disp.id,
                date: disp.date,
                producer: disp.recipient,
                type: 'SALIDA',
                quantity: disp.quantity,
                guideNumber: disp.guideNumber,
                description: `Despacho: ${disp.type}`,
                timestamp: new Date(disp.date).getTime()
            });
        });

        return moves.sort((a, b) => b.timestamp - a.timestamp);
    }, [receptions, trayDispatches]);

    // 2. Calculate Balances per Producer
    const producerBalances = useMemo(() => {
        const balances: Record<string, { in: number, out: number, balance: number }> = {};
        
        trayMovements.forEach(m => {
            if (!balances[m.producer]) balances[m.producer] = { in: 0, out: 0, balance: 0 };
            
            if (m.type === 'INGRESO') {
                balances[m.producer].in += m.quantity;
                balances[m.producer].balance += m.quantity; // Plant owes producer
            } else {
                balances[m.producer].out += m.quantity;
                balances[m.producer].balance -= m.quantity; // Plant returns to producer
            }
        });
        return balances;
    }, [trayMovements]);

    // 3. Filtered Movements for View
    const filteredMovements = useMemo(() => {
        if (selectedProducer === 'TODOS') return trayMovements;
        return trayMovements.filter(m => m.producer === selectedProducer);
    }, [trayMovements, selectedProducer]);

    // --- HELPER: FORMAT DATE DD-MM-YYYY ---
    const formatDateCSV = (dateStr: string) => {
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // --- RECEPTION REPORT LOGIC ---
    const handleDownloadReception = () => {
        // Filter Data
        const filteredReceptions = receptions.filter(rec => {
            const date = new Date(rec.receptionDate);
            if (recStartDate && date < new Date(recStartDate)) return false;
            if (recEndDate) {
                const end = new Date(recEndDate);
                end.setHours(23, 59, 59);
                if (date > end) return false;
            }
            return true;
        });

        const headers = [
            "Fecha Recepción",
            "N° Guía",
            "Nombre Productor",
            "Variedad",
            "Kilos Netos",
            "Total Bandejas"
        ];

        const rows = filteredReceptions.map(rec => {
            return [
                formatDateCSV(rec.receptionDate),
                rec.guideNumber,
                `"${rec.producer}"`,
                `"${rec.variety}"`,
                rec.netWeight.toString().replace('.', ','), // Flexible decimal
                rec.trays
            ];
        });

        downloadCSV(headers, rows, `Reporte_Recepcion_${new Date().toISOString().slice(0,10)}`, "Recepcion Granel");
    };

    // --- PACKING REPORT LOGIC ---
    const handleDownloadPacking = () => {
        // Filter Data
        const filteredLots = lots.filter(lot => {
            const date = new Date(lot.createdAt);
            if (packStartDate && date < new Date(packStartDate)) return false;
            if (packEndDate) {
                const end = new Date(packEndDate);
                end.setHours(23, 59, 59);
                if (date > end) return false;
            }
            return true;
        });

        const headers = [
            "Fecha Proceso",
            "ID Lote / Proceso",
            "Productor",
            "Variedad",
            "Kilos Entrada (MP)",
            "Kilos Exportables (PT)",
            "IQF (kg)",
            "Merma (kg)",
            "Desecho (kg)",
            "Rendimiento %",
            "Total Pallets PT"
        ];

        const rows = filteredLots.map(lot => {
            const totalPallets = lot.details.reduce((sum, d) => sum + d.pallets, 0);

            return [
                formatDateCSV(lot.createdAt),
                lot.id,
                `"${lot.lotProducer || ''}"`,
                `"${lot.lotVariety || ''}"`,
                lot.totalInputNetWeight.toFixed(2).replace('.', ','),
                lot.producedKilos.toFixed(2).replace('.', ','),
                lot.iqfKilos.toFixed(2).replace('.', ','),
                lot.mermaKilos.toFixed(2).replace('.', ','),
                lot.wasteKilos.toFixed(2).replace('.', ','),
                lot.yieldPercentage.toFixed(2).replace('.', ',') + '%',
                totalPallets
            ];
        });

        downloadCSV(headers, rows, `Reporte_Packing_${new Date().toISOString().slice(0,10)}`, "Reporte de Packing");
    };

    // --- TRAY EXPORT LOGIC (NEW) ---
    const handleDownloadTrayLedger = () => {
        const headers = [
            "Fecha",
            "Tipo Movimiento",
            "Productor / Destinatario",
            "N° Guía",
            "Cantidad",
            "Detalle"
        ];

        const rows = filteredMovements.map(m => {
            return [
                formatDateCSV(m.date),
                m.type,
                `"${m.producer}"`,
                m.guideNumber,
                m.quantity,
                `"${m.description}"`
            ];
        });

        downloadCSV(headers, rows, `Reporte_Envases_Bandejas_${new Date().toISOString().slice(0,10)}`, "Control de Envases y Embalajes");
    };

    // --- TRAY DISPATCH HANDLERS ---
    const handleTraySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!trayForm.recipient || !trayForm.quantity || !trayForm.guideNumber) return;

        const newDispatch: TrayDispatch = {
            id: `TRAY-${Date.now()}`,
            date: trayForm.date!,
            recipient: trayForm.recipient,
            type: trayForm.type || 'Bandeja Cosechera Estándar',
            quantity: Number(trayForm.quantity),
            guideNumber: trayForm.guideNumber
        };

        setTrayDispatches(prev => [...prev, newDispatch]);
        
        // Auto print? or just alert
        if (window.confirm("Despacho registrado. ¿Desea imprimir la guía?")) {
            handlePrintTrayGuide(newDispatch);
        }

        setTrayForm({
            date: new Date().toISOString().slice(0, 10),
            type: 'Bandeja Cosechera Estándar',
            recipient: '',
            quantity: 0,
            guideNumber: ''
        });
        setIsDispatchModalOpen(false);
    };

    const handlePrintTrayGuide = (dispatch: TrayDispatch) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Guía Despacho Envases ${dispatch.guideNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { margin: 0; color: #2e7d32; font-size: 24px; }
                    .header h2 { margin: 5px 0; color: #333; font-size: 18px; }
                    
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .info-item label { display: block; font-weight: bold; font-size: 12px; color: #666; text-transform: uppercase; }
                    .info-item div { font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; }

                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #f0f0f0; text-align: left; padding: 10px; border-bottom: 2px solid #ccc; }
                    td { padding: 10px; border-bottom: 1px solid #eee; }
                    
                    .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                    .signature { width: 40%; border-top: 1px solid #333; text-align: center; padding-top: 10px; margin-top: 50px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${APP_NAME}</h1>
                    <h2>CONTROL DE ENVASES Y EMBALAJES</h2>
                    <p>Guía de Despacho Interna N° ${dispatch.guideNumber}</p>
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <label>Fecha</label>
                        <div>${new Date(dispatch.date).toLocaleDateString()}</div>
                    </div>
                    <div class="info-item">
                        <label>Destinatario (Productor/Proveedor)</label>
                        <div>${dispatch.recipient}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th style="text-align:right;">Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${dispatch.type}</td>
                            <td style="text-align:right; font-weight:bold;">${dispatch.quantity}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer">
                    <div class="signature">Entregado Por (Firma)</div>
                    <div class="signature">Recibido Por (Firma)</div>
                </div>
                
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // Shared Helper
    const downloadCSV = (headers: string[], rows: (string | number)[][], filename: string, title?: string) => {
        const contentRows = [
            headers.join(';'),
            ...rows.map(r => r.join(';'))
        ];
        
        if (title) {
            contentRows.unshift(""); // Empty Row
            contentRows.unshift(title); // Title Row
        }

        const csvContent = "\uFEFF" + contentRows.join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- RENDER: TRAY MANAGEMENT VIEW ---
    if (view === 'TRAYS') {
        const currentBalance = selectedProducer !== 'TODOS' ? (producerBalances[selectedProducer] || {in:0, out:0, balance:0}) : {
            in: trayMovements.filter(m=>m.type==='INGRESO').reduce((s,m)=>s+m.quantity,0),
            out: trayMovements.filter(m=>m.type==='SALIDA').reduce((s,m)=>s+m.quantity,0),
            balance: 0 // Global balance might be misleading if mixing producers, but calculated:
        };
        // Recalc global balance correctly
        if (selectedProducer === 'TODOS') {
            currentBalance.balance = currentBalance.in - currentBalance.out;
        }

        return (
            <div className="p-8 max-w-7xl mx-auto min-h-screen bg-white">
                <div className="flex items-center justify-between gap-4 mb-6 border-b pb-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('MAIN')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ArrowLeft size={24} className="text-gray-600"/>
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-amber-800 flex items-center gap-2">
                                <ShoppingBag size={32}/> Gestión de Envases
                            </h1>
                            <p className="text-gray-500">Control de flujo de bandejas (Entradas vs Salidas).</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handleDownloadTrayLedger}
                            className="bg-green-600 text-white px-4 py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
                        >
                            <FileSpreadsheet size={20}/> Exportar Excel
                        </button>
                        <button 
                            onClick={() => setIsDispatchModalOpen(true)}
                            className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-amber-700 transition-all flex items-center gap-2"
                        >
                            <Send size={20}/> Registrar Devolución (Salida)
                        </button>
                    </div>
                </div>

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Total Recibido (Entrada)</p>
                                <h3 className="text-2xl font-bold text-green-600">{currentBalance.in.toLocaleString()}</h3>
                            </div>
                            <div className="bg-green-50 p-2 rounded-lg text-green-600"><ArrowDownLeft size={24}/></div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Total Devuelto (Salida)</p>
                                <h3 className="text-2xl font-bold text-red-600">{currentBalance.out.toLocaleString()}</h3>
                            </div>
                            <div className="bg-red-50 p-2 rounded-lg text-red-600"><ArrowUpRight size={24}/></div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Saldo (En Planta)</p>
                                <h3 className="text-2xl font-bold text-amber-600">{currentBalance.balance.toLocaleString()}</h3>
                            </div>
                            <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Package size={24}/></div>
                        </div>
                    </div>
                </div>

                {/* FILTER & LEDGER */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Filter size={20} className="text-gray-400"/>
                            <select 
                                className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
                                value={selectedProducer}
                                onChange={(e) => setSelectedProducer(e.target.value)}
                            >
                                <option value="TODOS">Todos los Productores</option>
                                {Object.keys(producerBalances).sort().map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase">{filteredMovements.length} movimientos encontrados</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Tipo Movimiento</th>
                                    <th className="p-4">Productor / Destinatario</th>
                                    <th className="p-4">Guía</th>
                                    <th className="p-4">Detalle</th>
                                    <th className="p-4 text-right text-green-700">Entrada</th>
                                    <th className="p-4 text-right text-red-700">Salida</th>
                                    <th className="p-4 text-center">Doc</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredMovements.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-gray-500 text-xs">
                                            {new Date(m.date).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            {m.type === 'INGRESO' ? (
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold flex w-fit items-center gap-1">
                                                    <ArrowDownLeft size={12}/> RECEPCIÓN
                                                </span>
                                            ) : (
                                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold flex w-fit items-center gap-1">
                                                    <ArrowUpRight size={12}/> DESPACHO
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 font-bold text-gray-700">{m.producer}</td>
                                        <td className="p-4 font-mono text-xs text-gray-600">{m.guideNumber}</td>
                                        <td className="p-4 text-xs text-gray-500">{m.description}</td>
                                        <td className="p-4 text-right font-mono font-bold text-green-600">
                                            {m.type === 'INGRESO' ? m.quantity : '-'}
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-red-600">
                                            {m.type === 'SALIDA' ? m.quantity : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {m.type === 'SALIDA' && (
                                                <button 
                                                    onClick={() => handlePrintTrayGuide({
                                                        id: m.id, 
                                                        date: m.date, 
                                                        recipient: m.producer, 
                                                        quantity: m.quantity, 
                                                        type: m.description.replace('Despacho: ', ''), 
                                                        guideNumber: m.guideNumber
                                                    })}
                                                    className="text-gray-400 hover:text-blue-600"
                                                    title="Reimprimir Guía"
                                                >
                                                    <FileText size={16}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredMovements.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-gray-400">No hay movimientos registrados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* DISPATCH MODAL */}
                {isDispatchModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <Send size={20} className="text-amber-600"/> Registrar Salida de Envases
                            </h3>
                            <form onSubmit={handleTraySubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destinatario</label>
                                    <select 
                                        className="w-full p-2 border rounded-lg text-sm bg-white"
                                        value={trayForm.recipient} 
                                        onChange={e => setTrayForm({...trayForm, recipient: e.target.value})}
                                        required
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {PRODUCERS_DATA.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                                    <input 
                                        type="date" required 
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={trayForm.date} onChange={e => setTrayForm({...trayForm, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Envase</label>
                                    <select 
                                        className="w-full p-2 border rounded-lg text-sm"
                                        value={trayForm.type} onChange={e => setTrayForm({...trayForm, type: e.target.value})}
                                    >
                                        <option value="Bandeja Cosechera Estándar">Bandeja Cosechera Estándar</option>
                                        <option value="Bandeja Cosechera Negra">Bandeja Cosechera Negra</option>
                                        <option value="Bins Plástico">Bins Plástico</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad</label>
                                        <input 
                                            type="number" required min="1"
                                            className="w-full p-2 border rounded-lg text-sm font-bold text-right"
                                            value={trayForm.quantity || ''} onChange={e => setTrayForm({...trayForm, quantity: parseInt(e.target.value) || 0})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">N° Guía</label>
                                        <input 
                                            type="text" required 
                                            className="w-full p-2 border rounded-lg text-sm"
                                            value={trayForm.guideNumber} onChange={e => setTrayForm({...trayForm, guideNumber: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6 pt-2 border-t">
                                    <button type="button" onClick={() => setIsDispatchModalOpen(false)} className="flex-1 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancelar</button>
                                    <button type="submit" className="flex-1 bg-amber-600 text-white py-2 rounded-lg font-bold shadow hover:bg-amber-700">Registrar Salida</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-white">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Centro de Reportes</h1>
                <p className="text-gray-500">Descarga de informes detallados y gestión de descartes.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* RECEPTION CARD */}
                <div className="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden relative group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                    <div className="p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                                <Truck size={32} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Reporte de Recepción</h2>
                                <p className="text-sm text-gray-500">Detalle de materia prima ingresada.</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                <Calendar size={12}/> Rango de Fechas
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="date" className="w-full p-2 border rounded-lg text-sm outline-none" value={recStartDate} onChange={e => setRecStartDate(e.target.value)}/>
                                <input type="date" className="w-full p-2 border rounded-lg text-sm outline-none" value={recEndDate} onChange={e => setRecEndDate(e.target.value)}/>
                            </div>
                        </div>

                        <button onClick={handleDownloadReception} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center gap-3 transition-all">
                            <FileSpreadsheet size={24} /> Descargar Excel
                        </button>
                    </div>
                </div>

                {/* PACKING CARD */}
                <div className="bg-white rounded-2xl shadow-lg border border-green-100 overflow-hidden relative group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-green-600"></div>
                    <div className="p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-green-100 p-3 rounded-xl text-green-600">
                                <Package size={32} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Reporte de Packing</h2>
                                <p className="text-sm text-gray-500">Procesos, rendimiento y PT.</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                <Calendar size={12}/> Rango de Fechas
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="date" className="w-full p-2 border rounded-lg text-sm outline-none" value={packStartDate} onChange={e => setPackStartDate(e.target.value)}/>
                                <input type="date" className="w-full p-2 border rounded-lg text-sm outline-none" value={packEndDate} onChange={e => setPackEndDate(e.target.value)}/>
                            </div>
                        </div>

                        <button onClick={handleDownloadPacking} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center gap-3 transition-all">
                            <FileSpreadsheet size={24} /> Descargar Excel
                        </button>
                    </div>
                </div>

                {/* TRAY MANAGEMENT CARD */}
                <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden relative group cursor-pointer hover:shadow-xl transition-all" onClick={() => setView('TRAYS')}>
                    <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
                    <div className="p-8 h-full flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                                <ShoppingBag size={32} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Bandejas Cosechera</h2>
                                <p className="text-sm text-gray-500">Control y despacho de envases vacíos.</p>
                            </div>
                        </div>
                        
                        <div className="mt-auto">
                            <button className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center gap-3 transition-all">
                                <Truck size={24} /> Gestionar Envases
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ReportsPage;