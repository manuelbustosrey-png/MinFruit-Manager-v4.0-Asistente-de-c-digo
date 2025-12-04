
import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { Reception, ProcessStatus, PalletDetail } from '../types';
import { TARE_PALLET, TARE_TRAY, APP_NAME, PRODUCERS_DATA } from '../constants';
import { Plus, Edit2, Save, Scale, Truck, List, X, Layers, Hash, Calculator, ChevronDown, ChevronUp, Eye, Printer, FileText, Trash2, CheckSquare, Square, Package, Leaf } from 'lucide-react';
import StatCard from '../components/StatCard';

const VARIETIES_LIST = [
    "BLUE CROOP",
    "BLUE RIBBON",
    "BRIGITTA",
    "CAMELLIA",
    "CARGO",
    "DUKE",
    "LEGACY",
    "SWEET JAME",
    "TOP SHELF"
];

const ReceptionPage: React.FC = () => {
    const { receptions, addReception, updateReception, activeWorkCenter } = useApp();
    const [isEditing, setIsEditing] = useState<string | null>(null);
    
    // State for expandable table rows
    const [expandedReceptionId, setExpandedReceptionId] = useState<string | null>(null);
    
    // Reception Modes: 'DETAILED' | 'PACKED' (Simple removed)
    const [receptionMode, setReceptionMode] = useState<'DETAILED' | 'PACKED'>('DETAILED');

    const [currentPalletWeight, setCurrentPalletWeight] = useState<string>('');
    const [currentPalletTrays, setCurrentPalletTrays] = useState<string>(''); // New: Trays per pallet
    const [palletQuantityToAdd, setPalletQuantityToAdd] = useState<number>(1);
    const [folioSequence, setFolioSequence] = useState<string>('0001'); // Manual Sequence Control
    
    // Store detailed pallet objects
    const [individualPallets, setIndividualPallets] = useState<PalletDetail[]>([]);
    
    // State for bulk selection of pallets
    const [selectedPalletIndices, setSelectedPalletIndices] = useState<number[]>([]);

    // Form State
    const [form, setForm] = useState<Partial<Reception>>({
        lotNumber: '',
        guideNumber: '',
        producer: '',
        variety: '',
        originType: 'ORGANICO', // Default
        temperature: 0, // Keeping internally to satisfy type but hidden from UI
        trays: 0,
        pallets: 0,
        grossWeight: 0,
        receptionDate: new Date().toISOString().slice(0, 16) // Local datetime format
    });

    // Effect to sync individual pallets with form totals
    useEffect(() => {
        if (receptionMode === 'DETAILED') {
            const totalWeight = individualPallets.reduce((sum, p) => sum + p.weight, 0);
            const totalTrays = individualPallets.reduce((sum, p) => sum + (p.trays || 0), 0);
            setForm(prev => ({
                ...prev,
                pallets: individualPallets.length,
                trays: totalTrays,
                grossWeight: totalWeight
            }));
        }
    }, [individualPallets, receptionMode]);

    // Effect to update "PENDIENTE" folios and Sequence when PRODUCER changes
    useEffect(() => {
        if (!form.producer) return;

        const selectedProducerData = PRODUCERS_DATA.find(p => p.name === form.producer);
        const producerCode = selectedProducerData?.code || '0000';

        // 1. Update PENDIENTE folios to use the Producer Code
        if (individualPallets.some(p => p.folio.includes('PENDIENTE'))) {
            setIndividualPallets(prev => prev.map(p => {
                if (p.folio.includes('PENDIENTE')) {
                    const parts = p.folio.split('-');
                    // Use the sequence part + new producer code
                    // Format: 0001-[ProducerCode]
                    return { ...p, folio: `${parts[0]}-${producerCode}` };
                }
                return p;
            }));
        }

        // 2. Update Correlative Sequence based on PRODUCER CODE
        // Scan ALL existing receptions to find highest sequence for this Producer Code
        let maxSeq = 0;
        
        // Check history
        receptions.forEach(rec => {
            rec.palletDetails?.forEach(p => {
                const parts = p.folio.split('-');
                // Format assumed: SEQUENCE-CODE (e.g. 0001-4046)
                // Check if the suffix matches the current producer code
                if (parts.length === 2 && parts[1] === producerCode) {
                    const seq = parseInt(parts[0]);
                    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
            });
        });

        // Check current session (including those we just might have updated from PENDIENTE)
        individualPallets.forEach(p => {
            const parts = p.folio.split('-');
            const seq = parseInt(parts[0]);
            // If the suffix matches (should be updated above) or if it's the sequence we are building
            if (parts.length === 2 && parts[1] === producerCode) {
               if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        });

        setFolioSequence((maxSeq + 1).toString().padStart(4, '0'));

    }, [form.producer, receptions]); // Depend on producer code

    // When starting a new form, reset sequence
    useEffect(() => {
        if (!isEditing && individualPallets.length === 0 && !form.producer) {
            setFolioSequence('0001');
            setSelectedPalletIndices([]);
        }
    }, [isEditing, individualPallets.length, form.producer]);

    const addIndividualPallet = () => {
        const weight = parseFloat(currentPalletWeight);
        const trays = parseInt(currentPalletTrays);
        const qty = Math.max(1, Math.floor(palletQuantityToAdd));
        
        const selectedProducerData = PRODUCERS_DATA.find(p => p.name === form.producer);
        const producerCode = selectedProducerData?.code || 'PENDIENTE';
        
        // Parse current sequence to integer
        let currentSeqInt = parseInt(folioSequence);
        if (isNaN(currentSeqInt)) currentSeqInt = 1;

        if (weight > 0 && trays >= 0) {
            const newPallets: PalletDetail[] = [];
            
            for (let i = 0; i < qty; i++) {
                // Generate Folio: [ManualSequence(4 digits)]-[ProducerCode]
                const seq = (currentSeqInt + i).toString().padStart(4, '0');
                const folio = `${seq}-${producerCode}`;
                
                newPallets.push({
                    folio,
                    weight,
                    trays
                });
            }
            
            setIndividualPallets(prev => [...prev, ...newPallets]);
            
            // Prepare for next entry (increment sequence)
            const nextSeq = currentSeqInt + qty;
            setFolioSequence(nextSeq.toString().padStart(4, '0'));

            // Keep trays and weight for rapid entry if needed, or clear? 
            // Usually weight changes, trays might stay same. Let's clear weight but keep trays.
            setCurrentPalletWeight('');
            setPalletQuantityToAdd(1);
        } else {
            alert("Ingrese peso y cantidad de bandejas válidos.");
        }
    };

    const removeIndividualPallet = (index: number) => {
        setIndividualPallets(prev => prev.filter((_, i) => i !== index));
        // Remove from selection if it was selected
        setSelectedPalletIndices(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    };

    // Bulk Selection Handlers
    const togglePalletSelection = (index: number) => {
        setSelectedPalletIndices(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index) 
                : [...prev, index]
        );
    };

    const toggleAllPallets = () => {
        if (selectedPalletIndices.length === individualPallets.length) {
            setSelectedPalletIndices([]);
        } else {
            setSelectedPalletIndices(individualPallets.map((_, i) => i));
        }
    };

    const removeSelectedPallets = () => {
        if (selectedPalletIndices.length === 0) return;
        
        setIndividualPallets(prev => prev.filter((_, index) => !selectedPalletIndices.includes(index)));
        setSelectedPalletIndices([]);
    };

    const calculateNet = (gross: number, trays: number, pallets: number) => {
        const tare = (trays * TARE_TRAY) + (pallets * TARE_PALLET);
        return Math.max(0, gross - tare);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.guideNumber || !form.producer) return;

        const netWeight = calculateNet(form.grossWeight || 0, form.trays || 0, form.pallets || 0);

        const newReception: Reception = {
            id: isEditing || `REC-${Date.now()}`,
            workCenter: activeWorkCenter,
            lotNumber: form.lotNumber || '', // Used for Folio in Packed Mode
            guideNumber: form.guideNumber!,
            producer: form.producer!,
            variety: form.variety || 'Sin Variedad',
            originType: form.originType || 'ORGANICO',
            receptionDate: form.receptionDate!,
            temperature: 0, // Removed form UI, default to 0
            trays: Number(form.trays),
            pallets: Number(form.pallets),
            grossWeight: Number(form.grossWeight),
            netWeight: netWeight,
            status: ProcessStatus.PENDING,
            palletDetails: receptionMode === 'DETAILED' ? individualPallets : []
        };

        if (isEditing) {
            updateReception(newReception);
        } else {
            addReception(newReception);
        }

        // Reset
        setIsEditing(null);
        setForm({
            lotNumber: '',
            guideNumber: '',
            producer: '',
            variety: '',
            originType: 'ORGANICO',
            temperature: 0,
            trays: 0,
            pallets: 0,
            grossWeight: 0,
            receptionDate: new Date().toISOString().slice(0, 16)
        });
        setIndividualPallets([]);
        setSelectedPalletIndices([]);
        setReceptionMode('DETAILED');
    };

    const startEdit = (rec: Reception) => {
        setIsEditing(rec.id);
        setForm(rec);
        if (rec.palletDetails && rec.palletDetails.length > 0) {
            setReceptionMode('DETAILED');
            setIndividualPallets(rec.palletDetails);
            setSelectedPalletIndices([]);
        } else if (rec.lotNumber) {
             // If it has a manual lot number (Folio) and no detailed pallets, assume Packed Mode
             setReceptionMode('PACKED');
             setIndividualPallets([]);
        } else {
            setReceptionMode('DETAILED');
            setIndividualPallets([]);
            setSelectedPalletIndices([]);
        }
    };

    const toggleRow = (id: string) => {
        setExpandedReceptionId(prev => prev === id ? null : id);
    };

    // Print General Report (Recepción Completa)
    const handlePrint = (rec: Reception) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date(rec.receptionDate).toLocaleDateString();
        
        // Generate Rows
        let rows = '';
        if (rec.palletDetails && rec.palletDetails.length > 0) {
            rows = rec.palletDetails.map((p, idx) => {
                const tare = (p.trays * TARE_TRAY) + TARE_PALLET;
                const net = Math.max(0, p.weight - tare);
                return `
                    <tr>
                        <td style="text-align:center;">${idx + 1}</td>
                        <td style="font-family:monospace; font-weight:bold;">${p.folio}</td>
                        <td style="text-align:right;">${p.trays}</td>
                        <td style="text-align:right;">${p.weight.toFixed(1)} kg</td>
                        <td style="text-align:right; color:#666;">-${tare.toFixed(2)} kg</td>
                        <td style="text-align:right; font-weight:bold;">${net.toFixed(2)} kg</td>
                    </tr>
                `;
            }).join('');
        } else {
             rows = `
                <tr>
                    <td colspan="6" style="text-align:center; padding: 20px;">
                        Carga General ${rec.lotNumber ? `(Folio: ${rec.lotNumber})` : ''}<br/>
                        Total Pallets: ${rec.pallets} | Total Bandejas: ${rec.trays}
                    </td>
                </tr>
             `;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reporte Recepción ${rec.guideNumber}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; max-width: 800px; mx-auto; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; }
                    .header h1 { color: #2e7d32; margin: 0; font-size: 24px; }
                    .header p { color: #666; margin: 5px 0 0 0; font-size: 12px; }
                    
                    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; }
                    .meta-item label { display: block; font-size: 10px; text-transform: uppercase; color: #888; font-weight: bold; }
                    .meta-item div { font-size: 16px; font-weight: 600; color: #333; }

                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th { background: #2e7d32; color: white; padding: 10px; text-align: left; }
                    td { border-bottom: 1px solid #eee; padding: 8px; }
                    tr:nth-child(even) { background: #fcfcfc; }

                    .totals { margin-top: 20px; text-align: right; border-top: 2px solid #333; padding-top: 10px; }
                    .totals div { font-size: 14px; margin-bottom: 5px; }
                    .totals .grand-total { font-size: 18px; font-weight: bold; color: #2e7d32; }

                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${APP_NAME}</h1>
                    <p>Informe de Recepción / Detalle de Tarja</p>
                </div>

                <div class="meta-grid">
                    <div class="meta-item">
                        <label>Productor</label>
                        <div>${rec.producer}</div>
                    </div>
                    <div class="meta-item">
                        <label>Variedad / Tipo</label>
                        <div>${rec.variety} (${rec.originType || 'S/I'})</div>
                    </div>
                    <div class="meta-item">
                        <label>N° Guía</label>
                        <div>${rec.guideNumber}</div>
                    </div>
                    <div class="meta-item">
                        <label>Fecha Recepción</label>
                        <div>${dateStr}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="text-align:center; width: 40px;">#</th>
                            <th>Folio Pallet</th>
                            <th style="text-align:right;">Bandejas</th>
                            <th style="text-align:right;">Peso Bruto</th>
                            <th style="text-align:right;">Tara Calc.</th>
                            <th style="text-align:right;">Peso Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="totals">
                    <div>Total Bandejas: <strong>${rec.trays}</strong></div>
                    <div>Total Pallets: <strong>${rec.pallets}</strong></div>
                    <div>Peso Bruto Total: <strong>${rec.grossWeight.toLocaleString()} kg</strong></div>
                    <div class="grand-total">Peso Neto Total: ${rec.netWeight.toLocaleString()} kg</div>
                </div>

                <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #999;">
                    <p>Documento generado electrónicamente por ${APP_NAME}</p>
                    <p>${new Date().toLocaleString()}</p>
                </div>

                <script>
                    window.print();
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // Print Individual Pallet (Tarja de Pallet)
    const handlePrintPallet = (rec: Reception, pallet: PalletDetail) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date(rec.receptionDate).toLocaleDateString();
        
        // Calculate specific net for this pallet
        const tare = (pallet.trays * TARE_TRAY) + TARE_PALLET;
        const net = Math.max(0, pallet.weight - tare);

        const labelContent = `
            <div class="container">
                <div class="header">
                    <h1>${APP_NAME}</h1>
                    <h2>${pallet.folio}</h2>
                </div>

                <div class="field">
                    <span class="label">Productor:</span>
                    <span class="value large">${rec.producer}</span>
                </div>

                <div class="field">
                    <span class="label">Variedad / Especie:</span>
                    <span class="value">${rec.variety}</span>
                </div>
                
                <div class="field">
                    <span class="label">Tipo / Origen:</span>
                    <span class="value">${rec.originType || 'CONVENCIONAL'}</span>
                </div>

                <div class="field" style="display: flex; justify-content: space-between;">
                    <div>
                        <span class="label">N° Guía:</span>
                        <span class="value">${rec.guideNumber}</span>
                    </div>
                    <div style="text-align: right;">
                        <span class="label">Fecha Recepción:</span>
                        <span class="value">${dateStr}</span>
                    </div>
                </div>

                <div class="grid">
                    <div>
                        <span class="label">Bandejas:</span>
                        <span class="value">${pallet.trays}</span>
                    </div>
                </div>
                
                <div class="net-weight">
                    <span class="label">PESO NETO (KG)</span>
                    <span class="value">${net.toFixed(1)}</span>
                </div>

                <div class="footer">
                    Materia Prima - Trazabilidad Interna
                </div>
            </div>
        `;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tarja Pallet ${pallet.folio}</title>
                <style>
                    @page { size: letter portrait; margin: 0.5cm; }
                    body { font-family: sans-serif; padding: 0; margin: 0; }
                    
                    .container { 
                        width: 100%; 
                        height: 12.5cm; 
                        padding: 15px; 
                        display: flex; 
                        flex-direction: column; 
                        box-sizing: border-box; 
                        border: 2px solid #000; 
                        margin-bottom: 1cm;
                        page-break-inside: avoid;
                        border-radius: 8px;
                    }
                    
                    .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 5px; margin-bottom: 10px; }
                    .header h1 { font-size: 16px; text-transform: uppercase; margin: 0; color: #333; }
                    .header h2 { font-size: 32px; font-weight: 900; margin: 5px 0; }

                    .field { margin-bottom: 10px; }
                    .label { font-size: 12px; text-transform: uppercase; color: #555; font-weight: bold; display: block; }
                    .value { font-size: 22px; font-weight: bold; display: block; line-height: 1.1; }
                    .value.large { font-size: 30px; }
                    
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; border-top: 1px solid black; pt: 10px; }

                    .net-weight { margin-top: auto; background: #000; color: white; text-align: center; padding: 10px; border-radius: 8px; }
                    .net-weight .label { color: #ccc; }
                    .net-weight .value { font-size: 42px; color: white; }

                    .footer { font-size: 10px; text-align: center; margin-top: 10px; }
                    
                    .cut-line { border-bottom: 2px dashed #999; margin-bottom: 1cm; display: block; }
                </style>
            </head>
            <body>
                ${labelContent}
                <div class="cut-line"></div>
                ${labelContent}
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // Helper to print from the form state (Transient/Unsaved Pallet)
    const printTransientPallet = (pallet: PalletDetail) => {
        const tempRec: Reception = {
            id: 'TEMP',
            workCenter: activeWorkCenter,
            guideNumber: form.guideNumber || 'S/N',
            producer: form.producer || 'Sin Productor',
            variety: form.variety || 'Sin Variedad',
            originType: form.originType || 'ORGANICO',
            receptionDate: form.receptionDate || new Date().toISOString(),
            lotNumber: '',
            temperature: 0,
            trays: 0,
            pallets: 0,
            grossWeight: 0,
            netWeight: 0,
            status: ProcessStatus.PENDING
        };
        handlePrintPallet(tempRec, pallet);
    };

    // Real-time calculation for display
    const currentTareTrays = (form.trays || 0) * TARE_TRAY;
    const currentTarePallets = (form.pallets || 0) * TARE_PALLET;
    const currentTotalTare = currentTareTrays + currentTarePallets;
    const currentNetWeight = Math.max(0, (form.grossWeight || 0) - currentTotalTare);

    return (
        <div className="p-8 max-w-7xl mx-auto">
             <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Recepción de Fruta</h1>
                <p className="text-gray-500">Registro de entradas, pesaje y control de calidad inicial.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Form Column */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 sticky top-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                                {isEditing ? <Edit2 size={20}/> : <Truck size={20}/>} 
                                {isEditing ? 'Editar Recepción' : 'Nueva Recepción'}
                            </h2>
                            {isEditing && <button onClick={() => { setIsEditing(null); setForm({}); setIndividualPallets([]); setSelectedPalletIndices([]); }} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Mode Toggle */}
                            <div className="bg-gray-50 p-1 rounded-lg flex mb-4 gap-1">
                                <button 
                                    type="button"
                                    onClick={() => setReceptionMode('DETAILED')}
                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${receptionMode === 'DETAILED' ? 'bg-white shadow text-blue-600 border border-blue-100' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Pallet a Pallet
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setReceptionMode('PACKED')}
                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${receptionMode === 'PACKED' ? 'bg-white shadow text-amber-600 border border-amber-100' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Embalado
                                </button>
                            </div>

                            {/* Fields specific to Packed Mode */}
                            {receptionMode === 'PACKED' && (
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mb-2">
                                    <h3 className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1 mb-2">
                                        <Package size={14}/> Ingreso Embalado
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-bold text-amber-800 uppercase mb-1">Folio</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-1.5 border border-amber-200 rounded text-sm bg-black text-white"
                                                placeholder="N° Folio"
                                                value={form.lotNumber || ''} onChange={e => setForm({...form, lotNumber: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-amber-800 uppercase mb-1">Especie</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-1.5 border border-amber-200 rounded text-sm bg-black text-white"
                                                placeholder="Especie"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Origen / Tipo</label>
                                    <select 
                                        className="w-full p-2 border rounded-lg text-sm bg-black text-white border-gray-600"
                                        value={form.originType || 'ORGANICO'} 
                                        onChange={e => setForm({...form, originType: e.target.value})}
                                    >
                                        <option value="ORGANICO">ORGANICO</option>
                                        <option value="CONVENCIONAL">CONVENCIONAL</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guía de Despacho</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Hash size={14} className="text-gray-400" />
                                        </div>
                                        <input 
                                            type="text" required 
                                            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-black text-white border-gray-600 placeholder-gray-400"
                                            placeholder="N° Guía"
                                            value={form.guideNumber} onChange={e => setForm({...form, guideNumber: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Productor</label>
                                    <select 
                                        required 
                                        className="w-full p-2 border rounded-lg text-sm bg-black text-white border-gray-600 placeholder-gray-400"
                                        value={form.producer || ''} 
                                        onChange={e => setForm({...form, producer: e.target.value})}
                                    >
                                        <option value="" className="text-gray-400">-- Seleccionar Productor --</option>
                                        {PRODUCERS_DATA.map((prod, idx) => (
                                            <option key={idx} value={prod.name}>{prod.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Variedad</label>
                                    <select 
                                        required 
                                        className="w-full p-2 border rounded-lg text-sm bg-black text-white border-gray-600 placeholder-gray-400"
                                        value={form.variety || ''} 
                                        onChange={e => setForm({...form, variety: e.target.value})}
                                    >
                                        <option value="" className="text-gray-400">-- Seleccionar Variedad --</option>
                                        {VARIETIES_LIST.map((v, idx) => (
                                            <option key={idx} value={v}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                                    <input 
                                        type="datetime-local" required 
                                        className="w-full p-2 border rounded-lg text-sm bg-black text-white border-gray-600"
                                        value={form.receptionDate} onChange={e => setForm({...form, receptionDate: e.target.value})}
                                    />
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {receptionMode === 'DETAILED' ? (
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1"><Layers size={14}/> Ingreso Pallets</h3>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] text-blue-600 font-bold uppercase">Seq:</label>
                                            <input 
                                                type="text" 
                                                className="w-12 text-xs border border-blue-200 rounded px-1 py-0.5 text-center bg-black text-white border-gray-600"
                                                value={folioSequence}
                                                onChange={e => setFolioSequence(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        <div className="col-span-1">
                                            <label className="block text-[9px] text-blue-600 mb-0.5">Bandejas</label>
                                            <input 
                                                type="number" placeholder="0"
                                                className="w-full p-1.5 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 bg-black text-white border-gray-600"
                                                value={currentPalletTrays} onChange={e => setCurrentPalletTrays(e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[9px] text-blue-600 mb-0.5">Peso Bruto (kg)</label>
                                            <input 
                                                type="number" step="0.1" placeholder="0.0"
                                                className="w-full p-1.5 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 font-bold bg-black text-white border-gray-600"
                                                value={currentPalletWeight} onChange={e => setCurrentPalletWeight(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addIndividualPallet()}
                                            />
                                        </div>
                                    </div>
                                    
                                    <button 
                                        type="button"
                                        onClick={addIndividualPallet}
                                        disabled={!currentPalletWeight}
                                        className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <Plus size={14} className="inline mr-1"/> Agregar Pallet
                                    </button>

                                    {/* Mini List of Pallets */}
                                    {individualPallets.length > 0 && (
                                        <div className="mt-3">
                                            {/* Batch Actions Header */}
                                            <div className="flex justify-between items-center mb-1 px-1">
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        type="button"
                                                        onClick={toggleAllPallets}
                                                        className="text-[10px] text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1"
                                                    >
                                                        {selectedPalletIndices.length > 0 && selectedPalletIndices.length === individualPallets.length ? <CheckSquare size={12}/> : <Square size={12}/>}
                                                        Sel. Todo
                                                    </button>
                                                </div>
                                                {selectedPalletIndices.length > 0 && (
                                                    <button 
                                                        type="button"
                                                        onClick={removeSelectedPallets}
                                                        className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold hover:bg-red-200 transition-colors flex items-center gap-1"
                                                    >
                                                        <Trash2 size={10} /> Eliminar ({selectedPalletIndices.length})
                                                    </button>
                                                )}
                                            </div>

                                            <div className="max-h-40 overflow-y-auto bg-white rounded border border-blue-100">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-blue-50 text-blue-400">
                                                        <tr>
                                                            <th className="p-1 pl-2 w-6"></th>
                                                            <th className="p-1 pl-1">Folio</th>
                                                            <th className="p-1">Guía</th>
                                                            <th className="p-1">Variedad</th>
                                                            <th className="p-1 text-right">Bandejas</th>
                                                            <th className="p-1 text-right">P. Bruto</th>
                                                            <th className="p-1 text-right">P. Neto</th>
                                                            <th className="p-1 text-right">Acción</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {individualPallets.slice().reverse().map((p, idx) => {
                                                            const realIndex = individualPallets.length - 1 - idx;
                                                            const isSelected = selectedPalletIndices.includes(realIndex);
                                                            const tare = (p.trays * TARE_TRAY) + TARE_PALLET;
                                                            const net = Math.max(0, p.weight - tare);

                                                            return (
                                                                <tr key={idx} className={`border-b border-gray-50 last:border-0 ${isSelected ? 'bg-blue-50' : ''}`}>
                                                                    <td className="p-1 pl-2 text-center">
                                                                        <input 
                                                                            type="checkbox"
                                                                            className="rounded text-blue-600 w-3 h-3 cursor-pointer"
                                                                            checked={isSelected}
                                                                            onChange={() => togglePalletSelection(realIndex)}
                                                                        />
                                                                    </td>
                                                                    <td className="p-1 pl-1 font-mono text-gray-700">{p.folio}</td>
                                                                    <td className="p-1 text-gray-600 text-[10px]">{form.guideNumber}</td>
                                                                    <td className="p-1 text-gray-600 text-[10px] truncate max-w-[60px]" title={form.variety}>{form.variety}</td>
                                                                    <td className="p-1 text-right text-gray-700">{p.trays}</td>
                                                                    <td className="p-1 text-right font-bold text-gray-700">{p.weight.toFixed(1)}</td>
                                                                    <td className="p-1 text-right font-bold text-green-600">{net.toFixed(1)}</td>
                                                                    <td className="p-1 text-right">
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => printTransientPallet(p)} 
                                                                            className="text-gray-400 hover:text-blue-600 px-1 mr-1" 
                                                                            title="Imprimir"
                                                                        >
                                                                            <Printer size={12}/>
                                                                        </button>
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => removeIndividualPallet(realIndex)} 
                                                                            className="text-red-400 hover:text-red-600 px-1"
                                                                        >
                                                                            <X size={12}/>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-2 text-right text-xs text-blue-800 font-bold">
                                        Total: {individualPallets.length} pallets | {individualPallets.reduce((s, p) => s + p.weight, 0).toFixed(1)} kg
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bandejas Totales</label>
                                            <input 
                                                type="number" required
                                                className="w-full p-2 border rounded-lg text-sm bg-black text-white border-gray-600"
                                                value={form.trays || ''} onChange={e => setForm({...form, trays: parseInt(e.target.value) || 0})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pallets Totales</label>
                                            <input 
                                                type="number" required
                                                className="w-full p-2 border rounded-lg text-sm bg-black text-white border-gray-600"
                                                value={form.pallets || ''} onChange={e => setForm({...form, pallets: parseInt(e.target.value) || 0})}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Peso Bruto Total (kg)</label>
                                        <div className="relative">
                                            <Scale size={14} className="absolute left-2 top-3 text-gray-400" />
                                            <input 
                                                type="number" step="0.1" required
                                                className="w-full pl-7 p-2 border rounded-lg text-lg font-bold text-white bg-black border-gray-600"
                                                value={form.grossWeight || ''} onChange={e => setForm({...form, grossWeight: parseFloat(e.target.value) || 0})}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-inner">
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                                    <Calculator size={14}/> Desglose de Peso (Destare)
                                </h3>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between text-gray-400">
                                        <span>Peso Bruto:</span>
                                        <span>{(form.grossWeight || 0).toFixed(1)} kg</span>
                                    </div>
                                    <div className="flex justify-between text-red-400 text-xs">
                                        <span>Tara Bandejas ({form.trays || 0} x {TARE_TRAY}kg):</span>
                                        <span>- {currentTareTrays.toFixed(1)} kg</span>
                                    </div>
                                    <div className="flex justify-between text-red-400 text-xs">
                                        <span>Tara Pallets ({form.pallets || 0} x {TARE_PALLET}kg):</span>
                                        <span>- {currentTarePallets.toFixed(1)} kg</span>
                                    </div>
                                    <div className="border-t border-gray-600 my-2 pt-2 flex justify-between font-bold text-xl text-white items-center">
                                        <span>Peso Neto:</span>
                                        <span className="bg-green-900/50 px-3 py-1 rounded text-green-400 border border-green-800">{currentNetWeight.toFixed(1)} kg</span>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                                <Save size={20} /> {isEditing ? 'Guardar Cambios' : 'Registrar Recepción'}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <StatCard title="Total Recepciones" value={receptions.length} icon={<List />} color="blue"/>
                        <StatCard title="Kilos Netos" value={receptions.reduce((acc, r) => acc + r.netWeight, 0).toLocaleString()} icon={<Scale />} color="green"/>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">Bitácora de Recepciones</h3>
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{receptions.length} registros</span>
                        </div>
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 text-xs uppercase">
                                    <tr>
                                        <th className="p-3 w-8"></th>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Guía / Productor</th>
                                        <th className="p-3 text-center">Detalle</th>
                                        <th className="p-3 text-right">Peso Neto</th>
                                        <th className="p-3 text-center">Estado</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {receptions.slice().reverse().map((rec) => (
                                        <React.Fragment key={rec.id}>
                                            <tr className="hover:bg-gray-50 transition-colors">
                                                <td className="p-3 text-center">
                                                    {rec.palletDetails && rec.palletDetails.length > 0 && (
                                                        <button onClick={() => toggleRow(rec.id)} className="text-gray-400 hover:text-primary transition-colors" title="Ver detalle de pallets">
                                                            {expandedReceptionId === rec.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="p-3 text-gray-500 text-xs">
                                                    {new Date(rec.receptionDate).toLocaleDateString()}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-800">{rec.guideNumber}</div>
                                                    <div className="text-xs text-gray-500">{rec.producer}</div>
                                                    <div className="flex gap-1 mt-1">
                                                        <div className="text-[10px] text-primary bg-green-50 px-1.5 py-0.5 rounded inline-block">{rec.variety}</div>
                                                        <div className={`text-[10px] px-1.5 py-0.5 rounded inline-block ${rec.originType === 'ORGANICO' ? 'text-green-700 bg-green-100 border border-green-200' : 'text-gray-600 bg-gray-100 border border-gray-200'}`}>
                                                            {rec.originType || 'ORG'}
                                                        </div>
                                                    </div>
                                                    {rec.lotNumber && <div className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-1">Folio: {rec.lotNumber}</div>}
                                                </td>
                                                <td className="p-3 text-center text-xs">
                                                    <span className="block font-medium">{rec.pallets} Pallets</span>
                                                    <span className="text-gray-400">{rec.trays} Bandejas</span>
                                                    {rec.palletDetails && rec.palletDetails.length > 0 && (
                                                        <span className="text-[10px] text-blue-500 block mt-0.5">(Ver Detalle)</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-gray-700">
                                                    {rec.netWeight.toLocaleString()} kg
                                                </td>
                                                <td className="p-3 text-center">
                                                    {rec.status === ProcessStatus.PENDING ? (
                                                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium">Pendiente</span>
                                                    ) : (
                                                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Procesado</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right flex items-center justify-end gap-2">
                                                    <button onClick={() => handlePrint(rec)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Imprimir Tarja / Informe"><Printer size={16} /></button>
                                                    <button onClick={() => startEdit(rec)} className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Editar Recepción"><Edit2 size={16} /></button>
                                                </td>
                                            </tr>
                                            {expandedReceptionId === rec.id && rec.palletDetails && (
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan={7} className="p-4 border-b border-gray-100 shadow-inner">
                                                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
                                                            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-800 flex items-center gap-2">
                                                                <List size={14}/> Detalle de Pallets ({rec.palletDetails.length})
                                                            </div>
                                                            <table className="w-full text-xs text-left">
                                                                <thead className="bg-gray-50 text-gray-500 uppercase">
                                                                    <tr>
                                                                        <th className="p-2 pl-4">Folio Pallet</th>
                                                                        <th className="p-2">Variedad</th>
                                                                        <th className="p-2 text-right">Bandejas</th>
                                                                        <th className="p-2 text-right">Peso Bruto</th>
                                                                        <th className="p-2 text-right">Peso Neto</th>
                                                                        <th className="p-2 text-center">Estado</th>
                                                                        <th className="p-2 text-center w-16">Tarja</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {rec.palletDetails.map((pallet, idx) => {
                                                                         const tare = (pallet.trays * TARE_TRAY) + TARE_PALLET;
                                                                         const net = Math.max(0, pallet.weight - tare);
                                                                         return (
                                                                        <tr key={idx} className="hover:bg-gray-50">
                                                                            <td className="p-2 pl-4 font-mono font-medium text-blue-700">{pallet.folio}</td>
                                                                            <td className="p-2">{rec.variety}</td>
                                                                            <td className="p-2 text-right">{pallet.trays} un.</td>
                                                                            <td className="p-2 text-right text-gray-500">{pallet.weight} kg</td>
                                                                            <td className="p-2 text-right font-bold text-gray-800">{net.toFixed(1)} kg</td>
                                                                            <td className="p-2 text-center">
                                                                                {pallet.isUsed ? <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px]">Procesado</span> : <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">Disponible</span>}
                                                                            </td>
                                                                            <td className="p-2 text-center">
                                                                                 <button onClick={() => handlePrintPallet(rec, pallet)} className="text-gray-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded" title="Imprimir Tarja de Pallet"><FileText size={14} /></button>
                                                                            </td>
                                                                        </tr>
                                                                    )})}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {receptions.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400 text-sm">No hay recepciones registradas.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReceptionPage;
