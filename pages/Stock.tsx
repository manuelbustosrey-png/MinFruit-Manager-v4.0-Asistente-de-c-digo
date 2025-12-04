
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { Package, Scale, Box, Tag, User, Calendar, ClipboardList, CheckSquare, Square, Truck, Layers, Hash, Edit, Save, X, ArrowRight, Trash2, ArrowLeftRight, Printer, Database, ArrowRightCircle, Play, Info, ChevronDown, ChevronUp } from 'lucide-react';
import StatCard from '../components/StatCard';
import { TARE_PALLET, TARE_TRAY, APP_NAME } from '../constants';
import { ProcessStatus } from '../types';

interface EditRow {
    uniqueId: string; 
    originalLotId: string;
    format: string; 
    producer: string;
    variety: string;
    date: string;
    targetLotId: string; 
    manualFolio: string;
    units: number;
    pallets: number; 
    isFullPallet: boolean;
    isDeleted: boolean; 
}

interface GroupedStockRow {
    folioKey: string; 
    displayFolio: string;
    format: string;
    totalUnits: number;
    totalPallets: number;
    totalKilos: number;
    isFullPallet: boolean;
    subItems: {
        uniqueId: string;
        producer: string;
        variety: string;
        date: string;
        units: number;
        lineKilos: number;
        manualFolio: string;
        lotId: string;
    }[];
}

const StockPage: React.FC = () => {
    const { lots, dispatches, bulkUpdateStockItems } = useApp();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    const [expandedFolios, setExpandedFolios] = useState<string[]>([]);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editRows, setEditRows] = useState<EditRow[]>([]);

    const [isTransferMode, setIsTransferMode] = useState(false);
    const [transferSourceIdx, setTransferSourceIdx] = useState<string>('');
    const [transferTargetIdx, setTransferTargetIdx] = useState<string>('');
    const [transferQty, setTransferQty] = useState<number>(0);

    const activeLots = useMemo(() => {
        const dispatchedLotIds = dispatches.flatMap(d => d.lotIds);
        return lots.filter(l => !dispatchedLotIds.includes(l.id));
    }, [lots, dispatches]);

    const finishedStockLines = useMemo(() => {
        return activeLots.flatMap(lot => {
            return lot.details.map((detail, index) => ({
                uniqueId: `${lot.id}-${index}`,
                lotId: lot.id,
                date: detail.originDate || lot.createdAt,
                producer: detail.originProducer || lot.lotProducer,
                variety: detail.originVariety || lot.lotVariety,
                pallets: detail.pallets,
                units: detail.units,
                format: detail.formatName,
                weightPerUnit: detail.weightPerUnit,
                isFullPallet: detail.isFullPallet,
                manualFolio: detail.manualFolio || '', 
                lineKilos: detail.totalKilos
            }));
        });
    }, [activeLots]);

    const groupedStock = useMemo(() => {
        const groups: Record<string, GroupedStockRow> = {};
        
        finishedStockLines.forEach(line => {
            const key = line.manualFolio ? line.manualFolio : line.uniqueId;
            
            if (!groups[key]) {
                groups[key] = {
                    folioKey: key,
                    displayFolio: line.manualFolio || 'S/N',
                    format: line.format,
                    totalUnits: 0,
                    totalPallets: 0,
                    totalKilos: 0,
                    isFullPallet: false,
                    subItems: []
                };
            }
            
            groups[key].totalUnits += line.units;
            groups[key].totalPallets += (line.pallets || 0);
            groups[key].totalKilos += line.lineKilos;
            groups[key].isFullPallet = groups[key].isFullPallet || line.isFullPallet || false; 
            
            groups[key].subItems.push(line);
        });
        
        return Object.values(groups);
    }, [finishedStockLines]);

    const totalFinishedKilos = activeLots.reduce((sum, l) => sum + l.producedKilos, 0);
    const totalFinishedPallets = activeLots.reduce((sum, l) => sum + l.details.reduce((p, d) => p + (d.pallets || 0), 0), 0);
    
    const toggleRowExpand = (folioKey: string) => {
        setExpandedFolios(prev => prev.includes(folioKey) ? prev.filter(k => k !== folioKey) : [...prev, folioKey]);
    };

    const toggleGroupSelection = (group: GroupedStockRow) => {
        const groupIds = group.subItems.map(i => i.uniqueId);
        const allSelected = groupIds.every(id => selectedIds.includes(id));
        
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...groupIds])]);
        }
    };

    const openEditModal = () => {
        const selectedLines = finishedStockLines.filter(l => selectedIds.includes(l.uniqueId));
        
        const uniqueFormats = new Set(selectedLines.map(l => l.format));
        if (uniqueFormats.size > 1) {
            alert("ERROR: No se pueden juntar o editar pallets de diferentes formatos/embalajes. Seleccione solo items del mismo tipo.");
            return;
        }

        const rows: EditRow[] = selectedLines.map(line => ({
            uniqueId: line.uniqueId,
            originalLotId: line.lotId,
            format: line.format,
            producer: line.producer,
            variety: line.variety,
            date: line.date,
            targetLotId: line.lotId, 
            manualFolio: line.manualFolio,
            units: line.units,
            pallets: line.pallets || 0, 
            isFullPallet: line.isFullPallet || false,
            isDeleted: false
        }));
        
        setEditRows(rows);
        setIsTransferMode(false);
        setTransferSourceIdx('');
        setTransferTargetIdx('');
        setTransferQty(0);
        setIsEditModalOpen(true);
    };

    const updateEditRow = (index: number, field: keyof EditRow, value: any) => {
        setEditRows(prevRows => {
            const newRows = [...prevRows];
            // @ts-ignore
            newRows[index][field] = value;
            return newRows;
        });
    };

    const executeTransfer = () => {
        const sIdx = parseInt(transferSourceIdx);
        const tIdx = parseInt(transferTargetIdx);

        if (isNaN(sIdx) || isNaN(tIdx)) {
            alert("Seleccione Origen y Destino");
            return;
        }
        if (sIdx === tIdx) {
            alert("El origen y el destino deben ser diferentes.");
            return;
        }
        
        const sourceRow = editRows[sIdx];
        const targetRow = editRows[tIdx];

        if (transferQty <= 0) {
            alert("La cantidad debe ser mayor a 0");
            return;
        }
        if (transferQty > sourceRow.units) {
            alert(`Cantidad excede disponibilidad del origen (${sourceRow.units}).`);
            return;
        }

        setEditRows(prev => {
            const newRows = [...prev];
            newRows[sIdx].units -= transferQty;
            const splitRow: EditRow = {
                ...sourceRow, 
                units: transferQty,
                manualFolio: targetRow.manualFolio, 
                targetLotId: targetRow.targetLotId, 
                isFullPallet: false, 
                pallets: 0 
            };
            newRows.push(splitRow);
            return newRows;
        });

        setTransferQty(0); 
    };

    const handleSaveBulkUpdate = () => {
        const updates = editRows.map(row => ({
            originalUniqueId: row.uniqueId,
            targetLotId: row.targetLotId,
            manualFolio: row.manualFolio,
            units: row.units,
            pallets: row.pallets,
            isFullPallet: row.isFullPallet,
            delete: row.isDeleted
        }));

        bulkUpdateStockItems(updates);
        setIsEditModalOpen(false);
        setSelectedIds([]); 
    };

    const handleDeleteFolio = (group: GroupedStockRow) => {
        if (window.confirm(`¿Eliminar Folio ${group.displayFolio} con ${group.totalUnits} cajas? Esta acción es irreversible.`)) {
            const updates = group.subItems.map(item => ({
                originalUniqueId: item.uniqueId,
                targetLotId: item.lotId,
                manualFolio: item.manualFolio,
                units: item.units,
                pallets: 0,
                isFullPallet: false,
                delete: true
            }));
            bulkUpdateStockItems(updates);
        }
    };
    
    // FULL PAGE TAG
    const handlePrintGroupTag = (group: GroupedStockRow) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const totalBoxes = group.totalUnits;
        const totalKilos = group.totalKilos;
        const format = group.format;
        const displayFolio = group.displayFolio;

        const origins = group.subItems.map(l => ({
            producer: l.producer,
            variety: l.variety,
            date: l.date,
            units: l.units
        }));

        const originsRows = origins.map(o => `
            <tr>
                <td style="font-size:20px; padding: 8px; border-bottom: 1px solid #ccc;">${o.producer}</td>
                <td style="font-size:20px; padding: 8px; border-bottom: 1px solid #ccc;">${o.variety}</td>
                <td style="font-size:20px; padding: 8px; border-bottom: 1px solid #ccc;">${new Date(o.date).toLocaleDateString()}</td>
                <td style="font-size:20px; padding: 8px; border-bottom: 1px solid #ccc; font-weight:bold; text-align:right;">${o.units}</td>
            </tr>
        `).join('');

        const labelContent = `
            <div class="container">
                <div class="header">
                    <h1>${APP_NAME}</h1>
                    <div class="label-box">PALLET TERMINADO ${origins.length > 1 ? '(MIXTO)' : ''}</div>
                    <h2>${displayFolio}</h2>
                </div>

                <div class="field" style="margin-top: 20px; margin-bottom: 20px;">
                    <span class="label">Formato:</span>
                    <span class="value">${format}</span>
                </div>

                <div style="flex: 1; border: 2px solid #999; margin-bottom: 20px;">
                    <table style="width:100%; border-collapse: collapse;">
                        <tr style="background:#eee;">
                            <th style="text-align:left; font-size:18px; padding: 10px;">PROD</th>
                            <th style="text-align:left; font-size:18px; padding: 10px;">VAR</th>
                            <th style="text-align:left; font-size:18px; padding: 10px;">FECHA</th>
                            <th style="text-align:right; font-size:18px; padding: 10px;">CJ</th>
                        </tr>
                        ${originsRows}
                    </table>
                </div>

                <div class="grid">
                    
                    <div style="text-align: right;">
                            <span class="label">Peso Neto Total:</span>
                            <span class="value">${totalKilos.toFixed(2)} kg</span>
                    </div>
                </div>
                
                <div class="box-qty">
                    <span class="label" style="color:#ccc">TOTAL CAJAS</span>
                    <span class="value">${totalBoxes}</span>
                </div>
            </div>
        `;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tarja PT ${displayFolio}</title>
                <style>
                    @page { size: letter portrait; margin: 1cm; }
                    body { font-family: sans-serif; padding: 0; margin: 0; height: 100vh; display: flex; flex-direction: column; }
                    .container { 
                        width: 100%; 
                        height: 100%; 
                        border: 4px solid #000; 
                        box-sizing: border-box; 
                        padding: 40px; 
                        display: flex; 
                        flex-direction: column; 
                    }
                    .header { text-align: center; border-bottom: 4px solid black; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { font-size: 32px; text-transform: uppercase; margin: 0; color: #333; }
                    .header h2 { font-size: 60px; font-weight: 900; margin: 10px 0; }
                    .label-box { background: black; color: white; padding: 8px 20px; font-weight: bold; font-size: 24px; display: inline-block; margin-bottom: 10px; border-radius: 8px; }
                    
                    .field { margin-bottom: 15px; }
                    .label { font-size: 24px; text-transform: uppercase; color: #555; font-weight: bold; display: block; margin-bottom: 5px; }
                    .value { font-size: 42px; font-weight: bold; display: block; line-height: 1.1; }
                    
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: auto; border-top: 4px solid black; pt: 30px; padding-bottom: 20px;}
                    
                    .box-qty { background: #000; color: white; text-align: center; padding: 20px; border-radius: 16px; margin-top: 10px;}
                    .box-qty .label { color: #ccc; font-size: 20px; margin-bottom: 0;}
                    .box-qty .value { font-size: 80px; color: white; }
                </style>
            </head>
            <body>
                ${labelContent}
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };
    
    const renderTransferDetail = (idxString: string) => {
        const idx = parseInt(idxString);
        if (isNaN(idx) || !editRows[idx]) return null;
        
        const r = editRows[idx];
        return (
            <div className="mt-3 bg-white rounded-lg border border-amber-200 p-3 shadow-sm animate-fade-in">
                <div className="flex items-start gap-2 mb-2 border-b border-amber-100 pb-2">
                    <Info size={14} className="text-amber-500 mt-0.5"/>
                    <span className="text-xs font-bold text-amber-800 uppercase">Información del Pallet</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                        <span className="block text-gray-400 text-[10px] uppercase">Productor</span>
                        <span className="font-bold text-gray-700 truncate block" title={r.producer}>{r.producer}</span>
                    </div>
                    <div>
                        <span className="block text-gray-400 text-[10px] uppercase">Variedad</span>
                        <span className="font-bold text-gray-700">{r.variety}</span>
                    </div>
                    <div>
                        <span className="block text-gray-400 text-[10px] uppercase">Fecha Proceso</span>
                        <span className="font-bold text-gray-700">{new Date(r.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                        <div>
                            <span className="block text-gray-400 text-[10px] uppercase">N° Pall</span>
                            <span className="font-bold text-blue-600">{r.pallets}</span>
                        </div>
                        <div>
                            <span className="block text-gray-400 text-[10px] uppercase">Cajas</span>
                            <span className="font-bold text-blue-600">{r.units}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const availableLotIds = useMemo(() => activeLots.map(l => l.id), [activeLots]);

    return (
        <div className="p-8 max-w-7xl mx-auto relative">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Paletizar</h1>
                <p className="text-gray-500">Gestión de pallets y producto terminado.</p>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard title={"Kilos Embalados"} value={`${totalFinishedKilos.toLocaleString()} kg`} icon={<Scale />} color={"green"} />
                <StatCard title={"Pallets en Piso"} value={totalFinishedPallets} icon={<Package />} color={"green"} />
                <StatCard title={"Lotes P. Terminado"} value={activeLots.length} icon={<Box />} color="amber" />
            </div>

            {/* TABLE VIEW */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ClipboardList size={20} className="text-gray-500"/>
                        <h3 className="font-bold text-gray-700">Detalle de Existencia (Producto Terminado)</h3>
                    </div>
                    <div className="flex items-center gap-3">
                            <div className="text-xs text-gray-500">
                            {selectedIds.length} seleccionados
                        </div>
                        {selectedIds.length > 0 && (
                            <>
                                <button onClick={openEditModal} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-md border border-green-800 animate-fade-in">
                                    <Play size={16} fill="currentColor" /> Proceder a Gestión de Cajas
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-gray-500 bg-gray-50/50 text-xs uppercase font-bold">
                            <tr>
                                <th className="p-3 w-10 text-center"></th>
                                <th className="p-3 text-left font-black text-gray-800">N° Pallet</th>
                                {/* Removed Cant. Pallets Column */}
                                <th className="p-3 text-right">Total Cajas</th>
                                <th className="p-3">Formato</th>
                                <th className="p-3 text-right">Total Kilos</th>
                                <th className="p-3 text-center">Detalle Origen</th>
                                <th className="p-3 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {groupedStock.map((group) => {
                                const groupIds = group.subItems.map(i => i.uniqueId);
                                const isPartiallySelected = groupIds.some(id => selectedIds.includes(id));
                                const isFullySelected = groupIds.every(id => selectedIds.includes(id));
                                
                                return (
                                <React.Fragment key={group.folioKey}>
                                    <tr 
                                        className={`hover:bg-green-50 transition-colors ${isFullySelected || isPartiallySelected ? 'bg-green-50' : ''}`}
                                        onClick={() => toggleGroupSelection(group)}
                                    >
                                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={isFullySelected} onChange={() => toggleGroupSelection(group)} onClick={(e) => e.stopPropagation()} className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer" />
                                        </td>
                                        <td className="p-3 text-left font-mono font-black text-blue-800 text-sm">
                                            {group.displayFolio}
                                        </td>
                                        <td className="p-3 text-right font-bold text-gray-800">{group.totalUnits}</td>
                                        <td className="p-3 text-xs text-gray-600">{group.format}</td>
                                        <td className="p-3 text-right font-mono font-bold text-primary text-sm">{group.totalKilos.toFixed(1)} kg</td>
                                        <td className="p-3 text-center">
                                            <button onClick={(e) => { e.stopPropagation(); toggleRowExpand(group.folioKey); }} className="text-gray-400 hover:text-blue-600 flex items-center justify-center gap-1 mx-auto text-xs">
                                                {group.subItems.length > 1 ? (<><span className="font-bold text-amber-600">{group.subItems.length} Origenes</span>{expandedFolios.includes(group.folioKey) ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</>) : (<span className="text-gray-400">Único</span>)}
                                            </button>
                                        </td>
                                        <td className="p-3 text-center flex items-center justify-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); handlePrintGroupTag(group); }} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50" title="Imprimir Tarja"><Printer size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFolio(group); }} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50" title="Eliminar Folio"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                    
                                    {(expandedFolios.includes(group.folioKey) || group.subItems.length === 1) && (
                                        <tr className="bg-gray-50/50">
                                            <td colSpan={7} className="p-0">
                                                <div className={`overflow-hidden transition-all ${expandedFolios.includes(group.folioKey) ? 'max-h-96 border-b border-gray-200' : 'max-h-0'}`}>
                                                    <table className="w-full text-xs bg-white m-2 rounded border border-gray-200 w-[98%] mx-auto mb-4">
                                                        <thead className="bg-gray-100 text-gray-500 font-bold">
                                                            <tr>
                                                                <th className="p-2 pl-4">Registro</th>
                                                                <th className="p-2">Productor</th>
                                                                <th className="p-2">Variedad</th>
                                                                <th className="p-2 text-center">Fecha Proc.</th>
                                                                <th className="p-2 text-right">Cajas</th>
                                                                <th className="p-2 text-right">Kilos</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.subItems.map((sub, idx) => (
                                                                <tr key={idx} className="border-b border-gray-50 last:border-0">
                                                                    <td className="p-2 pl-4 font-mono text-blue-800 font-bold">{sub.manualFolio || 'S/N'}</td>
                                                                    <td className="p-2 font-medium text-blue-700">{sub.producer}</td>
                                                                    <td className="p-2 text-gray-600">{sub.variety}</td>
                                                                    <td className="p-2 text-center text-gray-500">{new Date(sub.date).toLocaleDateString()}</td>
                                                                    <td className="p-2 text-right font-bold">{sub.units}</td>
                                                                    <td className="p-2 text-right text-gray-600">{sub.lineKilos.toFixed(1)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )})}
                            {groupedStock.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">No hay stock de producto terminado.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BULK EDIT MODAL */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full p-6 h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Edit size={20} className="text-blue-600" /> Editar / Mover Pallets (Gestión de Cajas)</h3>
                                <p className="text-xs text-gray-500">Base de datos de cajas: La información de trazabilidad se conserva al mover entre lotes.</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-4">
                            <button onClick={() => setIsTransferMode(!isTransferMode)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${isTransferMode ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                <ArrowLeftRight size={16} /> {isTransferMode ? 'Salir de Modo Transferencia' : 'Activar Modo Transferencia'}
                            </button>
                            {isTransferMode && <span className="text-xs text-amber-600 font-medium">Seleccione origen y destino para mover cajas específicamente.</span>}
                        </div>

                        {isTransferMode && (
                            <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 mb-4 shadow-inner">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                    <div className="md:col-span-5">
                                        <label className="block text-xs font-bold text-amber-800 uppercase mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Desde (Origen)</label>
                                        <select className="w-full p-3 border border-amber-300 rounded-lg bg-black text-white text-sm font-medium shadow-sm focus:ring-2 focus:ring-amber-500 outline-none" value={transferSourceIdx} onChange={e => setTransferSourceIdx(e.target.value)}>
                                            <option value="">-- Seleccionar Pallet Origen --</option>
                                            {editRows.map((r, idx) => !r.isDeleted && r.units > 0 && (
                                                <option key={idx} value={idx} disabled={idx.toString() === transferTargetIdx}>#{idx+1} | {r.manualFolio || r.uniqueId} | {r.units} cajas</option>
                                            ))}
                                        </select>
                                        {renderTransferDetail(transferSourceIdx)}
                                    </div>
                                    <div className="md:col-span-2 flex flex-col items-center justify-center gap-4 pt-6">
                                        <div className="bg-white p-2 rounded-full shadow-sm text-amber-400"><ArrowRightCircle size={32} /></div>
                                        <div className="w-full">
                                            <label className="block text-[10px] font-bold text-amber-700 uppercase text-center mb-1">Cantidad a Mover</label>
                                            <input type="number" min="1" className="w-full p-2 border border-amber-300 rounded-lg text-center font-bold text-lg text-white bg-black focus:ring-2 focus:ring-amber-500 outline-none" value={transferQty || ''} onChange={e => setTransferQty(parseInt(e.target.value) || 0)} placeholder="0"/>
                                        </div>
                                        <button onClick={executeTransfer} disabled={!transferSourceIdx || !transferTargetIdx || transferQty <= 0} className="w-full bg-amber-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all">Transferir</button>
                                        <button onClick={handleSaveBulkUpdate} className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center justify-center gap-2 transition-all text-xs"><Save size={14} /> Guardar Transferencia</button>
                                    </div>
                                    <div className="md:col-span-5">
                                        <label className="block text-xs font-bold text-amber-800 uppercase mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Hacia (Destino)</label>
                                        <select className="w-full p-3 border border-amber-300 rounded-lg bg-black text-white text-sm font-medium shadow-sm focus:ring-2 focus:ring-amber-500 outline-none" value={transferTargetIdx} onChange={e => setTransferTargetIdx(e.target.value)}>
                                            <option value="">-- Seleccionar Pallet Destino --</option>
                                            {editRows.map((r, idx) => !r.isDeleted && (
                                                <option key={idx} value={idx} disabled={idx.toString() === transferSourceIdx}>#{idx+1} | {r.manualFolio || r.uniqueId} | {r.units} cajas</option>
                                            ))}
                                        </select>
                                        {renderTransferDetail(transferTargetIdx)}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto border rounded-lg mb-4 bg-gray-50">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-blue-100 text-blue-800 text-xs uppercase font-bold sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 w-10">#</th>
                                        <th className="p-3">Origen (Trazabilidad)</th>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Formato</th>
                                        <th className="p-3 w-48">Lote Destino (Reasignar)</th>
                                        <th className="p-3 w-32">Folio Manual</th>
                                        <th className="p-3 w-20 text-center">N° Pall</th>
                                        <th className="p-3 w-24 text-center">Cajas</th>
                                        <th className="p-3 w-24 text-center">P. Completo</th>
                                        <th className="p-3 w-16 text-center">Eliminar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {editRows.map((row, idx) => (
                                        <tr key={idx} className={`hover:bg-gray-50 ${row.isDeleted ? 'bg-red-50 opacity-50' : ''}`}>
                                            <td className="p-3 text-center text-xs text-gray-400">{idx + 1}</td>
                                            <td className={`p-3 text-xs text-gray-600 ${row.isDeleted ? 'line-through' : ''}`}>
                                                <div className="font-bold text-blue-700">{row.producer}</div>
                                                <div>{row.variety}</div>
                                            </td>
                                            <td className={`p-3 text-xs text-gray-500 ${row.isDeleted ? 'line-through' : ''}`}>{new Date(row.date).toLocaleDateString()}</td>
                                            <td className={`p-3 text-xs text-gray-600 ${row.isDeleted ? 'line-through' : ''}`}>{row.format}</td>
                                            <td className="p-3">
                                                <select className="w-full border border-blue-200 rounded p-1 text-xs font-bold focus:ring-1 focus:ring-blue-500 bg-black text-white" value={row.targetLotId} onChange={(e) => updateEditRow(idx, 'targetLotId', e.target.value)} disabled={row.isDeleted || isTransferMode}>
                                                    {availableLotIds.map(id => (<option key={id} value={id}>{id}</option>))}
                                                </select>
                                            </td>
                                            <td className="p-3">
                                                <input type="text" className="w-full border border-blue-200 rounded p-1 text-xs font-mono focus:ring-1 focus:ring-blue-500 bg-black text-white" value={row.manualFolio} onChange={(e) => updateEditRow(idx, 'manualFolio', e.target.value)} placeholder="ej. P-001" disabled={row.isDeleted || isTransferMode}/>
                                            </td>
                                            <td className="p-3">
                                                <input type="number" min="0" className="w-full border border-blue-200 rounded p-1 text-center font-bold focus:ring-1 focus:ring-blue-500 bg-black text-white" value={row.pallets || ''} onChange={(e) => updateEditRow(idx, 'pallets', parseInt(e.target.value) || 0)} disabled={row.isDeleted || isTransferMode}/>
                                            </td>
                                            <td className="p-3">
                                                <input type="number" min="0" className={`w-full border rounded p-1 text-center font-bold focus:ring-1 ${isTransferMode ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-black text-white border-blue-200 focus:ring-blue-500'}`} value={row.units || ''} onChange={(e) => updateEditRow(idx, 'units', parseInt(e.target.value) || 0)} disabled={row.isDeleted || isTransferMode}/>
                                            </td>
                                            <td className="p-3 text-center">
                                                <input type="checkbox" className="w-4 h-4 text-green-600 rounded cursor-pointer" checked={row.isFullPallet} onChange={(e) => updateEditRow(idx, 'isFullPallet', e.target.checked)} disabled={row.isDeleted || isTransferMode}/>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex justify-center">
                                                    <div onClick={() => !isTransferMode && updateEditRow(idx, 'isDeleted', !row.isDeleted)} className={`w-8 h-8 border-2 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 ${row.isDeleted ? 'bg-red-500 border-red-600 text-white shadow-inner' : isTransferMode ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-300 hover:border-red-300 hover:text-red-300'}`} title={row.isDeleted ? "Restaurar Item" : "Eliminar Item del Stock"}>
                                                        <Trash2 size={16} className={row.isDeleted ? "animate-pulse" : ""} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4 flex justify-between items-center">
                            <div className="text-xs text-blue-800">
                                <span className="font-bold">Resumen:</span> Modificando {editRows.length} items. 
                                {editRows.some(r => r.isDeleted) && <span className="text-red-600 font-bold ml-2">({editRows.filter(r => r.isDeleted).length} serán eliminados)</span>}
                                <span className="ml-2">| Total Cajas Resultante: <strong>{editRows.filter(r => !r.isDeleted).reduce((s,r) => s + r.units, 0)}</strong></span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-3 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                            <button onClick={handleSaveBulkUpdate} className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md flex justify-center items-center gap-2 transition-colors"><Save size={18} /> Guardar Todos los Cambios</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockPage;
