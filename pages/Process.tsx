
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { ProductionLot, ProductionDetail } from '../types';
import { PACKING_FORMATS, TARE_TRAY, TARE_PALLET, APP_NAME } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sparkles, Download, Box, Plus, Trash2, Save, AlertCircle, Factory, Calendar, User, Tag, FileText, Package, Edit, X, Layers, Hash, ListPlus, Printer, Split, ArrowRight, AlertTriangle, Scale, Calculator, CheckSquare, Square, Lock, Check, Settings, Search, Info, Link as LinkIcon, SplitSquareVertical } from 'lucide-react';
import { analyzeYield } from '../services/geminiService';

// Simple component for showing Gemini results
const AIAnalysisResult: React.FC<{ analysis: string, loading: boolean }> = ({ analysis, loading }) => {
    if (loading) return <div className="animate-pulse text-primary text-sm">Analizando datos con Gemini AI...</div>;
    if (!analysis) return null;
    return (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mt-4">
            <div className="flex items-center gap-2 mb-2 text-indigo-800 font-bold">
                <Sparkles size={16} />
                <h4>Análisis de Inteligencia Artificial</h4>
            </div>
            <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">{analysis}</p>
        </div>
    );
};

// Interface for flattened view of available stock (Receptions or Individual Pallets)
interface StockItem {
    uniqueId: string;
    receptionId: string;
    lotNumber?: string;
    guideNumber: string;
    producer: string;
    variety: string;
    folio: string; // Pallet folio or "General"
    trays: number;
    grossWeight: number;
    netWeight: number;
    isIndividual: boolean;
    classification?: string;
}

const ProcessPage: React.FC = () => {
    const { getAvailableReceptions, createLot, updateLot, updateReceptionPallet, splitReceptionPallet, lots, receptions, dispatches, activeWorkCenter } = useApp();
    const availableReceptions = getAvailableReceptions();

    // Steps: 0 = Select Receptions/Pallets, 1 = Input Outputs (Multi-Lot)
    const [step, setStep] = useState(0);
    
    // Step 0 State: Selected unique IDs from the flattened stock list
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    
    // Edit Stock Item Modal State
    const [editingStockItem, setEditingStockItem] = useState<StockItem | null>(null);
    // State for Split Mode in Modal
    const [isSplitMode, setIsSplitMode] = useState(false);
    
    // Add Bulk Pallet Modal State (Step 1)
    const [isAddBulkModalOpen, setIsAddBulkModalOpen] = useState(false);
    const [tempSelectedBulkIds, setTempSelectedBulkIds] = useState<string[]>([]);

    // Edit Form for Single Item
    const [editStockForm, setEditStockForm] = useState({
        netWeight: 0, // User edits Net Weight
        trays: 0,
        classification: 'PROCESO'
    });

    // Edit Form for Split Item (Part 2) - Part 1 reuses editStockForm
    const [splitStockForm, setSplitStockForm] = useState({
        netWeight: 0,
        trays: 0,
        classification: 'PROCESO'
    });
    
    // Step 1 State (Queue System)
    const [pendingLots, setPendingLots] = useState<ProductionLot[]>([]);
    
    // UPDATE MODE STATE
    const [isUpdateMode, setIsUpdateMode] = useState(false);

    // Form State for current lot being added/edited
    const [processId, setProcessId] = useState('');
    const [inputKilosToUse, setInputKilosToUse] = useState(0);
    
    // Detailed list of input pallets used in the current lot (for Step 1 display)
    const [activeInputItems, setActiveInputItems] = useState<StockItem[]>([]);

    // New Output Details Array (Multiple Rows)
    const [productionLines, setProductionLines] = useState<ProductionDetail[]>([]);
    
    // Manual Discard States (Editable) - Direct discards are calculated separately
    const [iqfKilos, setIqfKilos] = useState(0);
    const [wasteKilos, setWasteKilos] = useState(0);
    const [mermaKilos, setMermaKilos] = useState(0);
    
    // Dynamic Discards (Custom Boxes) - Logic removed from UI but kept in state for legacy support if needed
    const [customDiscards, setCustomDiscards] = useState<{label: string, kilos: number}[]>([]);

    // Additional Metadata for the Lot being created
    const [customProducer, setCustomProducer] = useState('');
    const [customVariety, setCustomVariety] = useState('');
    const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 10));

    // Gemini State
    const [aiAnalysis, setAiAnalysis] = useState<Record<string, string>>({});
    const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});

    // List of ALL existing finished pallet folios for validation
    // Map folio to its details for smarter info
    // FILTERED: Only show incomplete pallets (isFullPallet === false) AND NOT DISPATCHED
    const existingFolioMap = useMemo(() => {
        const map = new Map<string, { producer: string, variety: string, units: number, pallets: number, format: string }>();
        
        // Create a set of dispatched folios for quick lookup
        const dispatchedFoliosSet = new Set(dispatches.flatMap(d => d.dispatchedFolios || []));

        lots.forEach(l => {
            l.details.forEach(d => {
                // Only consider if it has a folio AND IS NOT FULL AND IS NOT DISPATCHED
                if (d.manualFolio && !d.isFullPallet && !dispatchedFoliosSet.has(d.manualFolio)) {
                    const current = map.get(d.manualFolio) || { producer: l.lotProducer, variety: l.lotVariety, units: 0, pallets: 0, format: d.formatName };
                    current.units += d.units;
                    current.pallets += d.pallets || 0;
                    map.set(d.manualFolio, current);
                }
            });
        });
        return map;
    }, [lots, dispatches]);

    const existingFolios = Array.from(existingFolioMap.keys());

    // --- FOLIO GENERATION LOGIC (SEQUENTIAL 10 DIGITS) ---
    const generateNextFolio = () => {
        const BASE_START = 1001000001;
        let maxFolio = BASE_START - 1;

        // 1. Scan existing lots in history
        lots.forEach(lot => {
            lot.details.forEach(d => {
                const val = parseInt(d.manualFolio);
                if (!isNaN(val) && val > maxFolio) {
                    maxFolio = val;
                }
            });
        });

        // 2. Scan current production lines (to avoid duplicates in the same form)
        productionLines.forEach(line => {
            const val = parseInt(line.manualFolio);
            if (!isNaN(val) && val > maxFolio) {
                maxFolio = val;
            }
        });

        return (maxFolio + 1).toString();
    };

    // Auto-calculate Part 1 when Part 2 changes in Split Mode
    useEffect(() => {
        if (isSplitMode && editingStockItem) {
            const originalNet = editingStockItem.netWeight;
            const originalTrays = editingStockItem.trays;
            
            const part2Net = splitStockForm.netWeight || 0;
            const part2Trays = splitStockForm.trays || 0;

            const part1Net = Math.max(0, originalNet - part2Net);
            const part1Trays = Math.max(0, originalTrays - part2Trays);

            setEditStockForm(prev => ({
                ...prev,
                netWeight: parseFloat(part1Net.toFixed(2)), // Ensure precision doesn't drift
                trays: part1Trays
            }));
        }
    }, [isSplitMode, editingStockItem, splitStockForm.netWeight, splitStockForm.trays]);

    // Flatten available receptions into selectable items (Pallets or Whole Receptions)
    const stockItems: StockItem[] = useMemo(() => {
        return availableReceptions.flatMap((rec): StockItem[] => {
            if (rec.palletDetails && rec.palletDetails.length > 0) {
                // Filter out pallets that are already marked as used
                return rec.palletDetails
                    .filter(p => !p.isUsed)
                    .map((p, idx) => {
                        const palletTare = (p.trays * TARE_TRAY) + TARE_PALLET;
                        const pNet = Math.max(0, p.weight - palletTare);

                        // Include index in uniqueId to avoid collisions with duplicate folios
                        return {
                            uniqueId: `${rec.id}::${p.folio}::${idx}`,
                            receptionId: rec.id,
                            lotNumber: rec.lotNumber,
                            guideNumber: rec.guideNumber,
                            producer: rec.producer,
                            variety: rec.variety,
                            folio: p.folio,
                            trays: p.trays || 0,
                            grossWeight: p.weight,
                            netWeight: pNet,
                            isIndividual: true,
                            classification: p.classification || 'PROCESO'
                        };
                    });
            } else {
                return [{
                    uniqueId: `${rec.id}::GENERAL`,
                    receptionId: rec.id,
                    lotNumber: rec.lotNumber,
                    guideNumber: rec.guideNumber,
                    producer: rec.producer,
                    variety: rec.variety,
                    folio: 'General',
                    trays: rec.trays,
                    grossWeight: rec.grossWeight,
                    netWeight: rec.netWeight,
                    isIndividual: false
                }];
            }
        });
    }, [availableReceptions]);

    // Filtered items for "Add Bulk Pallet" modal
    const availableBulkItems = useMemo(() => {
        return stockItems.filter(item => 
            item.producer === customProducer && 
            item.variety === customVariety &&
            !activeInputItems.some(active => active.uniqueId === item.uniqueId) &&
            !item.folio.match(/-[A-Z]$/) // Filter out split suffixes if "Original only" is desired
        );
    }, [stockItems, customProducer, customVariety, activeInputItems]);

    const totalSelectedInputKilos = stockItems
        .filter(item => selectedItemIds.includes(item.uniqueId))
        .reduce((sum, item) => sum + item.netWeight, 0);

    // Calculate how much input weight is already assigned to pending lots
    const assignedInputKilos = pendingLots.reduce((sum, lot) => sum + lot.totalInputNetWeight, 0);
    const remainingInputKilos = Math.max(0, totalSelectedInputKilos - assignedInputKilos);

    const toggleSelection = (id: string) => {
        setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // --- PRODUCER & VARIETY MIX VALIDATION & STEP CHANGE ---
    const handleNextStep = () => {
        const selectedItems = stockItems.filter(item => selectedItemIds.includes(item.uniqueId));
        
        if (selectedItems.length > 0) {
            const uniqueProducers = new Set(selectedItems.map(i => i.producer));
            const uniqueVarieties = new Set(selectedItems.map(i => i.variety));

            if (uniqueProducers.size > 1) {
                if (!window.confirm(`ALERTA: Ha seleccionado folios de ${uniqueProducers.size} productores distintos. \n\nProductores: ${Array.from(uniqueProducers).join(', ')}.\n\n¿Está seguro que desea mezclar estos productores en un mismo lote?`)) {
                    return;
                }
            }

            if (uniqueVarieties.size > 1) {
                if (!window.confirm(`ALERTA: Ha seleccionado ${uniqueVarieties.size} variedades distintas. \n\nVariedades: ${Array.from(uniqueVarieties).join(', ')}.\n\n¿Está seguro que desea mezclar estas variedades?`)) {
                    return;
                }
            }
        }

        // --- UPDATE ACTIVE ITEMS AND KILOS TO USE (REFRESH) ---
        // This ensures any edits (like Classification changes) done in Step 0 are reflected
        setActiveInputItems(selectedItems);

        // Calculate totals ONLY for processable items (excluding Direct Discards)
        const processableItems = selectedItems.filter(i => 
            !i.classification || i.classification === 'PROCESO'
        );
        const processableTotal = processableItems.reduce((sum, i) => sum + i.netWeight, 0);

        // If not in update mode, refresh calculations and metadata
        if (!isUpdateMode) {
             setInputKilosToUse(processableTotal);
             
             // Initial Setup for New Lot
             if (productionLines.length === 0) {
                 addProductionLine();

                // Auto-detect Metadata from selected items
                if (processableItems.length > 0) {
                    const firstItem = processableItems[0];
                    setCustomProducer(firstItem.producer);
                    setCustomVariety(firstItem.variety);
                } else if (selectedItems.length > 0) {
                     setCustomProducer(selectedItems[0].producer);
                     setCustomVariety(selectedItems[0].variety);
                }

                setIqfKilos(0);
                setMermaKilos(0);
                setWasteKilos(0);

                // Generate ID
                const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const existingIds = lots.filter(l => l.id.includes(todayStr)).map(l => l.id);
                let maxSeq = 0;
                existingIds.forEach(id => {
                    const parts = id.split('-');
                    if (parts.length >= 3) {
                        const seq = parseInt(parts[2]);
                        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                    }
                });
                const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
                setProcessId(`PROC-${todayStr}-${nextSeq}`);
             }
        }

        setStep(1);
    };

    const addProductionLine = () => {
        setProductionLines([...productionLines, {
            formatName: PACKING_FORMATS[0].name,
            weightPerUnit: PACKING_FORMATS[0].weight,
            units: 0,
            pallets: 0, // Initialize as 0 so input is empty
            isFullPallet: false,
            manualFolio: generateNextFolio(), // Auto-generate sequential folio
            totalKilos: 0,
            productionLine: 'LINEA 1' // Default
        }]);
    };

    const updateProductionLine = (index: number, field: keyof ProductionDetail, value: any) => {
        const newLines = [...productionLines];
        // @ts-ignore
        newLines[index][field] = value;
        
        // Auto-calc Total Kilos for line
        if (field === 'units' || field === 'weightPerUnit') {
             newLines[index].totalKilos = newLines[index].units * newLines[index].weightPerUnit;
        }

        // SYNCHRONIZATION LOGIC (Existing Folio)
        // When user selects an existing folio from search, we update the manualFolio (ID)
        if (field === 'manualFolio' && typeof value === 'string' && value.trim() !== '') {
            // This logic might be triggered if we treat 'manualFolio' as the search result target
            // However, typically we update manualFolio directly.
            
            const existingInfo = existingFolioMap.get(value.trim());
            const currentSessionLine = newLines.find((l, i) => i !== index && l.manualFolio === value.trim());

            if (currentSessionLine) {
                // Sync pallet count with other line in current session
                // @ts-ignore
                newLines[index].pallets = currentSessionLine.pallets;
            } else if (existingInfo) {
                // Sync with history
                // @ts-ignore
                newLines[index].pallets = existingInfo.pallets; 
                alert(`Atención: El N° de Pallet ${value} ya existe. Se cargarán cajas a este folio existente.`);
            }
        }

        // SYNCHRONIZATION LOGIC (Pallet Count)
        if (field === 'pallets') {
            const currentFolio = newLines[index].manualFolio;
            if (currentFolio) {
                // Update all lines with the same folio
                newLines.forEach((l, i) => {
                    if (i !== index && l.manualFolio === currentFolio) {
                        l.pallets = value as number;
                    }
                });
            }
        }

        setProductionLines(newLines);
    };

    const removeProductionLine = (index: number) => {
        setProductionLines(productionLines.filter((_, i) => i !== index));
    };
    
    // Calculate Totals for Current Lot Form
    const currentOutputKilos = productionLines.reduce((sum, line) => sum + line.totalKilos, 0);
    const currentDiscardKilos = Number(iqfKilos) + Number(wasteKilos) + Number(mermaKilos);
    
    const customDiscardTotal = customDiscards.reduce((sum, d) => sum + Number(d.kilos), 0);
    
    // Calculate Balance
    // The Balance is based on the Processable Input (excluding direct discards)
    // So Balance = Input - (Output + Manual Discards)
    const currentLotBalance = inputKilosToUse - (currentOutputKilos + currentDiscardKilos + customDiscardTotal);

    // Export Percentage Calculation
    const exportPercentage = inputKilosToUse > 0 ? (currentOutputKilos / inputKilosToUse) * 100 : 0;

    // Calculate Direct Discards from Source Selection (for display and final saving)
    // Use activeInputItems for both Create and Edit modes to be consistent with what's shown in the table
    // activeInputItems now contains ALL items (process + direct)
    const sourceItemsForDiscards = activeInputItems;
    
    // Calculate Direct Discards (Read Only)
    const directIqf = sourceItemsForDiscards.filter(i => i.classification === 'IQF DIRECTO').reduce((s, i) => s + i.netWeight, 0);
    const directMerma = sourceItemsForDiscards.filter(i => i.classification === 'MERMA DIRECTA').reduce((s, i) => s + i.netWeight, 0);
    const directDesecho = sourceItemsForDiscards.filter(i => i.classification === 'DESECHO DIRECTO').reduce((s, i) => s + i.netWeight, 0);

    // Helper for percentages
    const getPercentage = (val: number) => {
        if (inputKilosToUse <= 0) return '0.0%';
        return ((val / inputKilosToUse) * 100).toFixed(1) + '%';
    };

    const handleSaveOrQueue = () => {
        if (!processId) { alert("Falta ID Proceso"); return; }
        
        // Validation: Check if Output Exceeds Input
        if (currentLotBalance < 0) {
            const exceeded = Math.abs(currentLotBalance).toFixed(2);
            alert(`Error: Los kilos de salida exceden la entrada por ${exceeded} kg. No se puede guardar.`);
            return;
        }

        let finalDirectIqf = directIqf;
        let finalDirectMerma = directMerma;
        let finalDirectDesecho = directDesecho;
        
        const finalIqf = Number(iqfKilos) + finalDirectIqf;
        const finalMerma = Number(mermaKilos) + finalDirectMerma;
        const finalWaste = Number(wasteKilos) + finalDirectDesecho;

        const totalInputForLot = inputKilosToUse + finalDirectIqf + finalDirectMerma + finalDirectDesecho;

        // Unique Timestamp Strategy for Pallet Folios (Replacing Process Sequence)
        const timestampBase = Date.now().toString();

        const newLot: ProductionLot = {
            id: processId,
            workCenter: activeWorkCenter,
            receptionIds: Array.from(new Set(
                activeInputItems.map(i => i.receptionId)
            )),
            // Save ALL used folios, including Direct Discards, so they are marked as used in AppContext
            usedPalletFolios: activeInputItems.map(i => i.folio).filter(f => f !== 'General'),
                
            totalInputNetWeight: totalInputForLot,
            createdAt: customDate, // User editable date
            lotProducer: customProducer,
            lotVariety: customVariety,
            
            details: productionLines.map((l, idx) => ({
                ...l,
                // Ensure folio is present. Use existing or generate a pure numeric independent ID
                manualFolio: l.manualFolio || `${timestampBase}${idx}`
            })),

            producedKilos: currentOutputKilos,
            iqfKilos: finalIqf,
            mermaKilos: finalMerma,
            wasteKilos: finalWaste,
            
            customDiscards: customDiscards,

            // Yield = Export / Total Input * 100
            yieldPercentage: totalInputForLot > 0 ? (currentOutputKilos / totalInputForLot) * 100 : 0
        };

        if (isUpdateMode) {
            updateLot(newLot);
            alert("Lote actualizado correctamente.");
            setIsUpdateMode(false);
            setStep(0);
        } else {
            createLot(newLot, 'GENERIC', 0); // Material deduction simplified
            setStep(0);
            setSelectedItemIds([]);
            setPendingLots([]); // Clear pending
        }

        // Reset Form
        setProductionLines([]);
        setInputKilosToUse(0);
        setIqfKilos(0);
        setMermaKilos(0);
        setWasteKilos(0);
        setCustomDiscards([]);
        setProcessId('');
        setActiveInputItems([]);
    };

    // --- EDIT / SPLIT STOCK ITEM HANDLERS ---
    const openEditStockModal = (item: StockItem) => {
        setEditingStockItem(item);
        setEditStockForm({
            netWeight: item.netWeight,
            trays: item.trays,
            classification: item.classification || 'PROCESO'
        });
        // Reset split form
        setSplitStockForm({
            netWeight: 0,
            trays: 0,
            classification: 'PROCESO'
        });
        setIsSplitMode(false); // Default to simple edit
    };

    const handleSaveStockEdit = () => {
        if (!editingStockItem) return;
        
        // RECALCULATE GROSS WEIGHT TO PREVENT DATA LOSS
        // The context functions expect GROSS Weight, but we are editing NET Weight.
        // Gross = Net + (Trays * 0.32) + 20
        const tareTray = TARE_TRAY; // 0.32
        const tarePallet = TARE_PALLET; // 20.0

        if (isSplitMode) {
            // Need to convert both parts to Gross
            const part1Gross = editStockForm.netWeight + (editStockForm.trays * tareTray) + tarePallet;
            const part2Gross = splitStockForm.netWeight + (splitStockForm.trays * tareTray) + tarePallet;

            // Logic to split pallet
            splitReceptionPallet(
                editingStockItem.receptionId,
                editingStockItem.folio,
                { 
                    weight: part1Gross, 
                    trays: editStockForm.trays, 
                    classification: editStockForm.classification 
                },
                { 
                    weight: part2Gross, 
                    trays: splitStockForm.trays, 
                    classification: splitStockForm.classification 
                }
            );
        } else {
            // Simple Update
            const gross = editStockForm.netWeight + (editStockForm.trays * tareTray) + tarePallet;

            updateReceptionPallet(
                editingStockItem.receptionId, 
                editingStockItem.folio, 
                gross, 
                editStockForm.trays,
                editStockForm.classification
            );
        }
        
        setEditingStockItem(null);
    };
    
    // --- START EDIT EXISTING LOT ---
    const handleStartEdit = (lot: ProductionLot) => {
        // 1. Switch to Form View (Step 1)
        setIsUpdateMode(true);
        setStep(1);
        
        // 2. Populate Form Data
        setProcessId(lot.id);
        setCustomProducer(lot.lotProducer);
        setCustomVariety(lot.lotVariety);
        setCustomDate(lot.createdAt);
        
        setProductionLines(lot.details.map(d => ({...d})));
        setCustomDiscards(lot.customDiscards || []);
        
        // 3. Reconstruct Inputs
        const allStockItems = receptions.flatMap(rec => {
            if (rec.palletDetails) {
                return rec.palletDetails.map((p, idx) => ({
                    uniqueId: `${rec.id}::${p.folio}::${idx}`, // Added idx to ID to prevent collisions with duplicate folios
                    receptionId: rec.id,
                    folio: p.folio,
                    netWeight: Math.max(0, p.weight - (p.trays * TARE_TRAY) - TARE_PALLET),
                    trays: p.trays,
                    producer: rec.producer,
                    variety: rec.variety,
                    classification: p.classification || 'PROCESO',
                    lotNumber: rec.lotNumber,
                    guideNumber: rec.guideNumber,
                    grossWeight: p.weight,
                    isIndividual: true
                }));
            }
            return [];
        });

        const lotInputItems = allStockItems.filter(item => 
            lot.usedPalletFolios?.includes(item.folio)
        );
        
        setActiveInputItems(lotInputItems);
        
        // Separate Processable vs Direct Discards from history
        const processable = lotInputItems.filter(i => i.classification === 'PROCESO' || !i.classification);
        const processableTotal = processable.reduce((s, i) => s + i.netWeight, 0);
        
        setInputKilosToUse(processableTotal);
        
        // Calculate Manual Discards
        // Lot stores Total. We need to subtract Direct from Total to get Manual.
        const directIqf = lotInputItems.filter(i => i.classification === 'IQF DIRECTO').reduce((s, i) => s + i.netWeight, 0);
        const directMerma = lotInputItems.filter(i => i.classification === 'MERMA DIRECTA').reduce((s, i) => s + i.netWeight, 0);
        const directDesecho = lotInputItems.filter(i => i.classification === 'DESECHO DIRECTO').reduce((s, i) => s + i.netWeight, 0);
        
        setIqfKilos(Math.max(0, lot.iqfKilos - directIqf));
        setMermaKilos(Math.max(0, lot.mermaKilos - directMerma));
        setWasteKilos(Math.max(0, lot.wasteKilos - directDesecho));
    };
    
    const handleRemoveInputItem = (itemUniqueId: string) => {
        setActiveInputItems(prev => {
            const updated = prev.filter(i => i.uniqueId !== itemUniqueId);
            // Recalc totals immediately for UI
            const processable = updated.filter(i => i.classification === 'PROCESO' || !i.classification);
            setInputKilosToUse(processable.reduce((s, i) => s + i.netWeight, 0));
            return updated;
        });
    };

    // --- ADD BULK PALLETS LOGIC ---
    const toggleBulkSelection = (id: string) => {
        setTempSelectedBulkIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleAddBulkPallets = () => {
        const newItems = availableBulkItems.filter(item => tempSelectedBulkIds.includes(item.uniqueId));
        
        setActiveInputItems(prev => {
            const updated = [...prev, ...newItems];
            // Recalc processable total
            const processable = updated.filter(i => i.classification === 'PROCESO' || !i.classification);
            setInputKilosToUse(processable.reduce((s, i) => s + i.netWeight, 0));
            return updated;
        });

        setIsAddBulkModalOpen(false);
        setTempSelectedBulkIds([]);
    };


    // --- AI ANALYSIS ---
    const handleAnalyze = async (lot: ProductionLot) => {
        if (analyzing[lot.id]) return;
        
        setAnalyzing(prev => ({ ...prev, [lot.id]: true }));
        const result = await analyzeYield(lot, lot.lotProducer);
        setAiAnalysis(prev => ({ ...prev, [lot.id]: result }));
        setAnalyzing(prev => ({ ...prev, [lot.id]: false }));
    };

    // --- PRINT HANDLERS ---
    const handlePrintFinishedProduct = (line: ProductionDetail, lot: ProductionLot) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date(lot.createdAt).toLocaleDateString();
        
        const labelContent = `
             <div class="container">
                <div class="header">
                    <h1>${APP_NAME}</h1>
                    <div class="label-box">PALLET TERMINADO</div>
                    <h2>${line.manualFolio}</h2>
                </div>

                <div class="field">
                    <span class="label">Productor:</span>
                    <span class="value">${lot.lotProducer}</span>
                </div>

                <div class="field">
                    <span class="label">Variedad:</span>
                    <span class="value">${lot.lotVariety}</span>
                </div>

                <div class="field">
                    <span class="label">Formato:</span>
                    <span class="value">${line.formatName}</span>
                </div>
                
                ${line.productionLine ? `
                <div class="field">
                    <span class="label">Línea:</span>
                    <span class="value">${line.productionLine}</span>
                </div>` : ''}

                <div class="grid">
                     <div>
                        <span class="label">Cajas:</span>
                        <span class="value">${line.units}</span>
                    </div>
                    <div style="text-align: right;">
                        <span class="label">Fecha:</span>
                        <span class="value">${dateStr}</span>
                    </div>
                </div>
                
                <div class="net-weight">
                    <span class="label">PESO NETO (KG)</span>
                    <span class="value">${line.totalKilos.toFixed(2)}</span>
                </div>

                 <div class="footer">
                    Producto Terminado - ${APP_NAME}
                </div>
            </div>
        `;
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tarja PT ${line.manualFolio}</title>
                <style>
                    @page { size: auto; margin: 5mm; }
                    body { font-family: sans-serif; padding: 0; margin: 0; }
                    
                    .container { 
                        width: 10cm; 
                        min-height: 14.5cm; 
                        border: 1px solid #ccc; 
                        box-sizing: border-box; 
                        padding: 15px; 
                        display: flex; 
                        flex-direction: column; 
                        margin-bottom: 10px;
                        page-break-inside: avoid;
                    }
                    
                    .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 5px; margin-bottom: 10px; }
                    .header h1 { font-size: 14px; text-transform: uppercase; margin: 0; color: #333; }
                    .header h2 { font-size: 24px; font-weight: 900; margin: 5px 0; }

                    .label-box { background: black; color: white; padding: 4px 10px; font-weight: bold; font-size: 12px; display: inline-block; margin-bottom: 4px; border-radius: 4px; }
                    
                    .field { margin-bottom: 10px; }
                    .label { font-size: 10px; text-transform: uppercase; color: #555; font-weight: bold; display: block; }
                    .value { font-size: 18px; font-weight: bold; display: block; line-height: 1.1; }
                    
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; border-top: 1px solid black; pt: 10px; }

                    .net-weight { margin-top: auto; background: #000; color: white; text-align: center; padding: 10px; border-radius: 8px; margin-top: 15px;}
                    .net-weight .label { color: #ccc; }
                    .net-weight .value { font-size: 36px; color: white; }

                    .footer { font-size: 8px; text-align: center; margin-top: 10px; }
                    
                    .cut-line { border-bottom: 2px dashed #999; margin: 20px 0; }
                </style>
            </head>
            <body>
                ${labelContent}
                <div class="cut-line"></div>
                ${labelContent}
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };
    
    const handlePrintTransientLine = (line: ProductionDetail) => {
         const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date(customDate).toLocaleDateString();
        
        const labelContent = `
             <div class="container">
                <div class="header">
                    <h1>${APP_NAME}</h1>
                    <div class="label-box">PALLET TERMINADO</div>
                    <h2>${line.manualFolio || 'PREVIEW'}</h2>
                </div>

                <div class="field">
                    <span class="label">Productor:</span>
                    <span class="value">${customProducer}</span>
                </div>

                <div class="field">
                    <span class="label">Variedad:</span>
                    <span class="value">${customVariety}</span>
                </div>

                <div class="field">
                    <span class="label">Formato:</span>
                    <span class="value">${line.formatName}</span>
                </div>
                
                 ${line.productionLine ? `
                <div class="field">
                    <span class="label">Línea:</span>
                    <span class="value">${line.productionLine}</span>
                </div>` : ''}

                <div class="grid">
                     <div>
                        <span class="label">Cajas:</span>
                        <span class="value">${line.units}</span>
                    </div>
                    <div style="text-align: right;">
                        <span class="label">N° Pallets:</span>
                        <span class="value">${line.pallets || 1}</span>
                    </div>
                </div>
                
                <div class="net-weight">
                    <span class="label">PESO NETO (KG)</span>
                    <span class="value">${line.totalKilos.toFixed(2)}</span>
                </div>

                 <div class="footer">
                    Producto Terminado - ${APP_NAME}
                </div>
            </div>
        `;
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tarja PT Preview</title>
                <style>
                    @page { size: auto; margin: 5mm; }
                    body { font-family: sans-serif; padding: 0; margin: 0; }
                    
                    .container { 
                        width: 10cm; 
                        min-height: 14.5cm; 
                        border: 1px solid #ccc; 
                        box-sizing: border-box; 
                        padding: 15px; 
                        display: flex; 
                        flex-direction: column; 
                        margin-bottom: 10px;
                        page-break-inside: avoid;
                    }
                    
                    .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 5px; margin-bottom: 10px; }
                    .header h1 { font-size: 14px; text-transform: uppercase; margin: 0; color: #333; }
                    .header h2 { font-size: 24px; font-weight: 900; margin: 5px 0; }
                    .label-box { background: black; color: white; padding: 4px 10px; font-weight: bold; font-size: 12px; display: inline-block; margin-bottom: 4px; border-radius: 4px; }

                    .field { margin-bottom: 10px; }
                    .label { font-size: 10px; text-transform: uppercase; color: #555; font-weight: bold; display: block; }
                    .value { font-size: 18px; font-weight: bold; display: block; line-height: 1.1; }
                    
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; border-top: 1px solid black; pt: 10px; }

                    .net-weight { margin-top: auto; background: #000; color: white; text-align: center; padding: 10px; border-radius: 8px; margin-top: 15px;}
                    .net-weight .label { color: #ccc; }
                    .net-weight .value { font-size: 36px; color: white; }

                    .footer { font-size: 8px; text-align: center; margin-top: 10px; }
                     .cut-line { border-bottom: 2px dashed #999; margin: 20px 0; }
                </style>
            </head>
            <body>
                ${labelContent}
                <div class="cut-line"></div>
                ${labelContent}
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintProcessReport = (lot: ProductionLot) => {
        // ... (existing report logic)
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Calculate Totals for Report
        
        // Re-fetch all used pallets (including Direct)
        const allStockItems = receptions.flatMap(rec => rec.palletDetails || []);
        const usedPallets = allStockItems.filter(p => lot.usedPalletFolios?.includes(p.folio));

        // Net Weight calculation for pallets
        const palletNet = (p: any) => Math.max(0, p.weight - (p.trays * TARE_TRAY) - TARE_PALLET);

        // FILTER: Separate Process vs Direct
        const processPallets = usedPallets.filter(p => !p.classification || p.classification === 'PROCESO');
        const directPallets = usedPallets.filter(p => p.classification && p.classification.includes('DIRECTO'));

        // Calculate Totals (Process Only)
        const totalProcessNet = processPallets.reduce((s, p) => s + palletNet(p), 0);
        const totalProcessTrays = processPallets.reduce((s, p) => s + p.trays, 0);

        // Calculate Grand Total (for percentages if needed, though strictly requested to separate)
        const totalGrandInput = lot.totalInputNetWeight;

        // Direct Stats
        const directIqfSum = directPallets.filter(p => p.classification === 'IQF DIRECTO').reduce((s, p) => s + palletNet(p), 0);
        const directMermaSum = directPallets.filter(p => p.classification === 'MERMA DIRECTA').reduce((s, p) => s + palletNet(p), 0);
        const directDesechoSum = directPallets.filter(p => p.classification === 'DESECHO DIRECTO').reduce((s, p) => s + palletNet(p), 0);
        const totalDirectSum = directIqfSum + directMermaSum + directDesechoSum;

        // Calculate Percentages based on GRAND TOTAL (to keep consistency with database yield)
        const pct = (val: number) => totalGrandInput > 0 ? ((val / totalGrandInput) * 100).toFixed(1) + '%' : '0.0%';

        // Extract Guide Numbers from Used Receptions
        const guideNumbers = Array.from(new Set(
            usedPallets.map(p => {
                const parentRec = receptions.find(r => r.palletDetails?.some(pd => pd.folio === p.folio));
                return parentRec?.guideNumber;
            }).filter(Boolean)
        )).join(', ');

        // Rows for Input Table (Fruta A PROCESO ONLY)
        const inputRows = processPallets.map(p => {
            const net = palletNet(p);
            const avgTray = p.trays > 0 ? (net / p.trays).toFixed(2) : '0';
            const parentRec = receptions.find(r => r.palletDetails?.some(pd => pd.folio === p.folio));
            const date = parentRec ? new Date(parentRec.receptionDate).toLocaleDateString() : '-';
            
            return `
                <tr>
                    <td>${date}</td>
                    <td style="text-align:right;">${p.trays}</td>
                    <td style="text-align:center; font-weight:bold;">${p.folio}</td>
                    <td style="text-align:right;">${net.toFixed(0)}</td>
                    <td style="text-align:right;">${avgTray}</td>
                </tr>
            `;
        }).join('');
        
        // Output Rows
        const outputRows = lot.details.map(d => `
            <tr>
                <td>${d.formatName}</td>
                <td style="text-align:right;">${d.weightPerUnit}</td>
                <td style="text-align:right;">${d.units}</td>
                <td style="text-align:right;">${d.totalKilos.toFixed(2)}</td>
                <td style="text-align:center;">${new Date(lot.createdAt).toLocaleDateString()}</td>
                <td style="text-align:center;">${d.manualFolio || ''}</td>
            </tr>
        `).join('');
        
        // Discards Breakdown
        const manualIqf = Math.max(0, lot.iqfKilos - directIqfSum);
        const manualMerma = Math.max(0, lot.mermaKilos - directMermaSum);
        const manualDesecho = Math.max(0, lot.wasteKilos - directDesechoSum);

        const totalIqf = lot.iqfKilos; 
        const totalMerma = lot.mermaKilos;
        const totalDesecho = lot.wasteKilos;

        const discardsSubtotal = totalIqf + totalMerma + totalDesecho;
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Informe Proceso ${lot.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .logo { width: 150px; }
                    .title-bar { background: #001f3f; color: white; padding: 5px 20px; font-weight: bold; font-size: 16px; text-align: center; flex-grow: 1; margin: 0 20px; border-radius: 4px; }
                    .lot-info { background: #003366; color: white; padding: 10px; border-radius: 0; font-weight: bold; font-size: 11px; width: 200px;}
                    .lot-info div { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    
                    .section-title { background: #001f3f; color: white; padding: 3px 10px; font-weight: bold; display: inline-block; margin-bottom: 5px; border-radius: 2px; }
                    
                    .meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 5px 10px; margin-bottom: 15px; font-size: 11px; font-weight: bold; }
                    .meta-label { text-transform: uppercase; }
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
                    th { background: #003366; color: white; padding: 4px; text-align: center; font-weight: bold; border: 1px solid #999; }
                    td { padding: 3px 5px; border: 1px solid #ccc; }
                    
                    .green-bar { background: #66ff66; padding: 5px 10px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; border: 1px solid #999; margin: 10px 0 20px 0; }
                    
                    .green-header th { background: #00cc00; color: black; border: 1px solid #666; }
                    
                    .discards-table th { background: #666633; color: white; }
                    .footer-note { font-size: 9px; color: #666; margin-top: 20px; font-style: italic; border-top: 1px solid #ccc; padding-top: 5px;}
                    .direct-note { margin-bottom: 15px; font-size: 11px; color: #444; border: 1px dashed #999; padding: 5px; background: #f9f9f9; }
                </style>
            </head>
            <body>
                <div class="header">
                     <!-- Placeholder for Logo -->
                    <div class="logo" style="font-weight:bold; font-size:14px; color:#001f3f;">RIO DONGUIL SPA.<br/><span style="font-size:10px; color:#666;">AGROINDUSTRIAL</span></div>
                    <div class="title-bar">Informe Proceso</div>
                    <div class="lot-info">
                        <div><span>LOTE DE PROCESO:</span> <span>${lot.id}</span></div>
                        <div><span>GUIA:</span> <span>${guideNumbers || '-'}</span></div>
                    </div>
                </div>

                <div class="section-title">RECEPCION</div>
                <div class="meta-grid">
                    <div class="meta-label">NOMBRE PRODUCTOR:</div> <div>${lot.lotProducer}</div>
                    <div class="meta-label">NOMBRE VARIEDAD:</div> <div>${lot.lotVariety}</div>
                    <div class="meta-label">PROCESO:</div> <div>ORGANICO</div> 
                </div>

                <div class="section-title">FRUTA A PROCESO (LÍNEA)</div>
                <table>
                    <thead>
                        <tr>
                            <th>FECHA COSECHA</th>
                            <th>BANDEJAS</th>
                            <th>PALLET GRANEL</th>
                            <th>KILOS</th>
                            <th>PROM. BANDEJAS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inputRows}
                        <tr style="font-weight:bold; background:#f0f0f0;">
                            <td>TOTAL ENTRADA (PROCESO)</td>
                            <td style="text-align:right;">${totalProcessTrays}</td>
                            <td></td>
                            <td style="text-align:right;">${totalProcessNet.toFixed(1)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
                
                ${totalDirectSum > 0 ? `
                <div class="direct-note">
                    <strong>NOTA IMPORTANTE:</strong> Se han segregado <strong>${totalDirectSum.toFixed(1)} kg</strong> como Directo a IQF/Merma (Sin Proceso).<br/>
                    (IQF: ${directIqfSum.toFixed(1)} kg | Merma: ${directMermaSum.toFixed(1)} kg | Desecho: ${directDesechoSum.toFixed(1)} kg)
                </div>
                ` : ''}

                <div class="green-bar">
                    <span>KILOS A PROCESAR (LÍNEA):</span>
                    <span>${totalProcessNet.toFixed(1)}</span>
                </div>

                <div class="section-title" style="background: #00cc00; color: black;">DETALLE DEL PROCESO</div>
                <table>
                    <thead class="green-header">
                        <tr>
                            <th>Nombre Embalaje</th>
                            <th>Peso Unitario (Kg)</th>
                            <th>Cajas</th>
                            <th>* Peso (Kg)</th>
                            <th>Fecha Embalaje</th>
                            <th>N° PALLET</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${outputRows}
                        <tr style="font-weight:bold;">
                            <td>SUBTOTALES</td>
                            <td></td>
                            <td style="text-align:right;">${lot.details.reduce((s,d)=>s+d.units,0)}</td>
                            <td style="text-align:right;">${lot.producedKilos.toFixed(2)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
                
                <table style="width:50%; margin-left: auto;">
                    <tr>
                        <td style="background:#ccc; font-weight:bold;">Porcentaje Embalado (s/ Total)</td>
                        <td style="background:#99ccff; text-align:center; font-weight:bold;">${pct(lot.producedKilos)}</td>
                    </tr>
                </table>

                <div class="section-title" style="background: #666633;">DESCARTES (TOTAL)</div>
                <table style="width: 70%;">
                    <thead class="discards-table">
                        <tr>
                            <th>TIPO DESCARTE</th>
                            <th>Proceso (Kg)</th>
                            <th>Directo (Kg)</th>
                            <th>Total (Kg)</th>
                            <th>% del Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>IQF (Congelado)</td>
                            <td style="text-align:right;">${manualIqf.toFixed(2)}</td>
                            <td style="text-align:right; color: #666;">${directIqfSum.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:bold;">${totalIqf.toFixed(2)}</td>
                            <td style="text-align:right;">${pct(totalIqf)}</td>
                        </tr>
                        <tr>
                            <td>Desecho (Basura)</td>
                            <td style="text-align:right;">${manualDesecho.toFixed(2)}</td>
                            <td style="text-align:right; color: #666;">${directDesechoSum.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:bold;">${totalDesecho.toFixed(2)}</td>
                            <td style="text-align:right;">${pct(totalDesecho)}</td>
                        </tr>
                        <tr>
                            <td>Merma</td>
                            <td style="text-align:right;">${manualMerma.toFixed(2)}</td>
                            <td style="text-align:right; color: #666;">${directMermaSum.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:bold;">${totalMerma.toFixed(2)}</td>
                            <td style="text-align:right;">${pct(totalMerma)}</td>
                        </tr>
                         <tr style="font-weight:bold; border-top:2px solid black;">
                            <td>SUBTOTALES</td>
                            <td style="text-align:right;">${(manualIqf+manualDesecho+manualMerma).toFixed(2)}</td>
                            <td style="text-align:right;">${totalDirectSum.toFixed(2)}</td>
                            <td style="text-align:right;">${discardsSubtotal.toFixed(2)}</td>
                            <td style="text-align:right;">${pct(discardsSubtotal)}</td>
                        </tr>
                    </tbody>
                </table>
                
                 <table style="width:30%; margin-left: auto;">
                    <tr>
                        <td style="background:#eee; font-weight:bold;">Porcentaje Global</td>
                        <td style="background:#99ccff; text-align:center; font-weight:bold;">100%</td>
                    </tr>
                </table>

                <div class="footer-note">
                    * Peso (Kg) incluye el 4 % de deshidratado.<br/>
                    NOTA: El informe considera la totalidad de la fruta recepcionada (Directa + Proceso).
                </div>

                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };


    // --- RENDER HELPERS ---
    const renderStep0 = () => (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Layers className="text-primary"/> Selección de Fruta (Stock Disponible)
                </h3>
                
                {/* Filters? Search? (Omitted for brevity but good to have) */}

                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs sticky top-0">
                            <tr>
                                <th className="p-3 w-10">
                                    {/* Select All logic could go here */}
                                </th>
                                <th className="p-3">Recepción / Folio</th>
                                <th className="p-3">Productor</th>
                                <th className="p-3">Variedad</th>
                                <th className="p-3 text-center">Bandejas</th>
                                {/* Removed Gross Weight Column */}
                                <th className="p-3 text-right">Peso Neto</th>
                                <th className="p-3 text-center">Clasificación</th>
                                <th className="p-3 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stockItems.map(item => (
                                <tr 
                                    key={item.uniqueId} 
                                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedItemIds.includes(item.uniqueId) ? 'bg-green-50' : ''}`}
                                    onClick={() => toggleSelection(item.uniqueId)}
                                >
                                    <td className="p-3 text-center">
                                        <input 
                                            type="checkbox"
                                            checked={selectedItemIds.includes(item.uniqueId)}
                                            onChange={() => toggleSelection(item.uniqueId)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <div className="font-bold text-gray-800">{item.folio}</div>
                                        <div className="text-xs text-gray-500">Guía: {item.guideNumber}</div>
                                    </td>
                                    <td className="p-3 text-xs font-medium text-gray-600">{item.producer}</td>
                                    <td className="p-3 text-xs text-gray-500">{item.variety}</td>
                                    <td className="p-3 text-center">{item.trays}</td>
                                    <td className="p-3 text-right font-bold text-gray-700">{item.netWeight.toFixed(1)}</td>
                                    <td className="p-3 text-center">
                                        {item.classification === 'IQF DIRECTO' && <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-1 rounded font-bold">IQF DIR</span>}
                                        {item.classification === 'MERMA DIRECTA' && <span className="bg-orange-100 text-orange-800 text-[10px] px-2 py-1 rounded font-bold">MERMA DIR</span>}
                                        {item.classification === 'DESECHO DIRECTO' && <span className="bg-red-100 text-red-800 text-[10px] px-2 py-1 rounded font-bold">DESECHO DIR</span>}
                                        {(!item.classification || item.classification === 'PROCESO') && <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded">Proceso</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                        {item.isIndividual && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openEditStockModal(item); }}
                                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-green-50 rounded transition-colors"
                                                title="Editar / Dividir Pallet"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {stockItems.length === 0 && (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-400">No hay fruta disponible.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-between items-center border-t pt-4">
                    <div className="text-sm">
                        <span className="text-gray-500">Seleccionado:</span> 
                        <strong className="ml-2 text-gray-800">{selectedItemIds.length} items</strong>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="text-gray-500">Total Kilos:</span>
                        <strong className="ml-2 text-primary">{totalSelectedInputKilos.toFixed(1)} kg</strong>
                        {assignedInputKilos > 0 && <span className="ml-2 text-amber-600 text-xs">(Pendiente en cola: {assignedInputKilos.toFixed(1)} kg)</span>}
                    </div>
                    
                    <button 
                        disabled={remainingInputKilos <= 0}
                        onClick={handleNextStep}
                        className="bg-primary text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        Siguiente <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            {/* HISTORIAL DE PROCESOS - RESTORED SECTION */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Historial de Procesos</h3>
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">{lots.length} lotes</span>
                </div>
                <div className="divide-y divide-gray-100">
                    {lots.slice().reverse().map(lot => (
                        <div key={lot.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                {/* Header Info */}
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{lot.id}</span>
                                        <span className="text-xs text-gray-500">{new Date(lot.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex flex-col text-xs text-gray-600">
                                        <span className="font-bold">{lot.lotProducer}</span>
                                        <span>{lot.lotVariety}</span>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-4 text-center">
                                    <div>
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">Entrada</div>
                                        <div className="text-sm font-bold text-gray-800">{lot.totalInputNetWeight.toFixed(0)} kg</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">Salida</div>
                                        <div className="text-sm font-bold text-green-600">{lot.producedKilos.toFixed(0)} kg</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">Rend.</div>
                                        <div className="text-sm font-bold text-blue-600">{lot.yieldPercentage.toFixed(1)}%</div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handlePrintProcessReport(lot)} className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg" title="Imprimir Informe Proceso">
                                        <Printer size={18}/>
                                    </button>
                                    <button onClick={() => handleStartEdit(lot)} className="text-gray-400 hover:text-amber-600 p-2 hover:bg-amber-50 rounded-lg" title="Editar / Corregir Lote">
                                        <Edit size={18}/>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Finished Products Preview */}
                            {lot.details.length > 0 && (
                                <div className="mt-3 pl-4 border-l-2 border-gray-200">
                                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Producto Terminado</div>
                                    <div className="flex flex-wrap gap-2">
                                        {lot.details.map((d, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1 shadow-sm">
                                                <button onClick={() => handlePrintFinishedProduct(d, lot)} className="text-gray-400 hover:text-blue-600"><Printer size={12}/></button>
                                                <div className="text-xs">
                                                    <span className="font-bold">{d.manualFolio}</span> <span className="text-gray-500">|</span> {d.units} cj <span className="text-[10px] text-gray-400">({d.formatName})</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {lots.length === 0 && <div className="p-8 text-center text-gray-400">No hay lotes registrados.</div>}
                </div>
            </div>
        </div>
    );

    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                    <Factory className="text-primary"/> {isUpdateMode ? 'Actualizar Lote' : 'Generar Lotes de Salida'}
                 </h2>
                 <div className="text-sm font-bold bg-green-50 text-green-700 px-3 py-1 rounded-lg border border-green-200">
                    ID: {processId}
                 </div>
            </div>

            {/* Metadata Form */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Productor Lote</label>
                    <div className="relative">
                        <User size={14} className="absolute left-2 top-2.5 text-gray-400" />
                        <input 
                            type="text" 
                            className="w-full pl-7 p-2 bg-gray-50 text-gray-500 border border-gray-200 rounded cursor-not-allowed text-sm font-bold"
                            value={customProducer} 
                            readOnly 
                        />
                        <Lock size={12} className="absolute right-2 top-3 text-gray-400"/>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Variedad Lote</label>
                    <div className="relative">
                        <Tag size={14} className="absolute left-2 top-2.5 text-gray-400" />
                        <input 
                            type="text" 
                            className="w-full pl-7 p-2 bg-gray-50 text-gray-500 border border-gray-200 rounded cursor-not-allowed text-sm font-bold"
                            value={customVariety} 
                            readOnly
                        />
                         <Lock size={12} className="absolute right-2 top-3 text-gray-400"/>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Proceso</label>
                    <div className="relative">
                        <Calendar size={14} className="absolute left-2 top-2.5 text-gray-400" />
                        <input 
                            type="date" 
                            className="w-full pl-7 p-2 border border-gray-300 rounded text-sm bg-black text-white border-gray-600"
                            value={customDate} onChange={e => setCustomDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* MAIN 3-COLUMN LAYOUT (Stacked Full Width) */}
            <div className="space-y-6">
                
                {/* COLUMN 1: INPUT DETAILS (Full Width) */}
                <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4">
                    <div className="flex justify-between items-center mb-3">
                         <h3 className="text-sm font-bold text-blue-800 uppercase flex items-center gap-2">
                            <ListPlus size={16}/> Detalle Fruta a Procesar
                        </h3>
                        <button 
                            onClick={() => setIsAddBulkModalOpen(true)}
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-200 flex items-center gap-1"
                        >
                            <Plus size={12} /> Agregar Pallets Granel
                        </button>
                    </div>
                    
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-blue-50 text-blue-600 font-bold">
                                <tr>
                                    <th className="p-2">Folio Pallet</th>
                                    <th className="p-2">Productor</th>
                                    <th className="p-2">Variedad</th>
                                    <th className="p-2">Clasificación</th>
                                    <th className="p-2 text-right">Peso Neto</th>
                                    <th className="p-2 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeInputItems.filter(i => !i.classification || i.classification === 'PROCESO').map(item => (
                                    <tr key={item.uniqueId}>
                                        <td className="p-2 font-mono">{item.folio}</td>
                                        <td className="p-2 truncate max-w-[100px]">{item.producer}</td>
                                        <td className="p-2">{item.variety}</td>
                                        <td className="p-2">
                                            <span className="bg-gray-100 text-gray-600 px-1 py-0.5 rounded text-[10px]">{item.classification || 'PROCESO'}</span>
                                        </td>
                                        <td className="p-2 text-right font-bold">{item.netWeight.toFixed(1)}</td>
                                        <td className="p-2 text-center">
                                            <button 
                                                onClick={() => handleRemoveInputItem(item.uniqueId)}
                                                className="text-red-400 hover:text-red-600"
                                                title="Quitar pallet"
                                            >
                                                <X size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold">
                                <tr>
                                    <td colSpan={4} className="p-2 text-right text-gray-600">Total a Proceso:</td>
                                    <td className="p-2 text-right text-blue-700">{inputKilosToUse.toFixed(1)} kg</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* COLUMN 2: PRODUCTION LINES (Full Width) */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 relative">
                    {/* Header */}
                    <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2">
                        <Package size={16}/> Líneas de Producción (Producto Terminado)
                    </h3>
                    
                    {/* Lines List - Full Width Column */}
                    <div className="flex flex-col gap-4 mb-4">
                        {productionLines.map((line, index) => {
                            // Generate a unique datalist ID for this row
                            const dataListId = `existing-folios-${index}`;
                            
                            // Filter existing folios to match CURRENT FORMAT ONLY
                            const relevantFolios = existingFolios.filter(f => {
                                const info = existingFolioMap.get(f);
                                return info && info.format === line.formatName;
                            });

                            // Check if manual folio exists in map
                            const existingInfo = line.manualFolio ? existingFolioMap.get(line.manualFolio) : null;
                            
                            return (
                            <div key={index} className="bg-gray-700 p-4 rounded-xl border border-gray-600 relative animate-fade-in shadow-sm">
                                {/* Unique Datalist for this row */}
                                <datalist id={dataListId}>
                                    {relevantFolios.map((f, i) => {
                                        const info = existingFolioMap.get(f);
                                        // Include producer, variety, and units in the label
                                        const label = info ? `${info.format} | ${info.producer} | ${info.units} cj` : '';
                                        return <option key={i} value={f} label={label}>{label}</option>;
                                    })}
                                </datalist>

                                <button 
                                    onClick={() => removeProductionLine(index)}
                                    className="absolute top-2 right-2 text-gray-400 hover:text-red-400 p-1"
                                >
                                    <X size={16}/>
                                </button>
                                
                                <div className="space-y-3">
                                    {/* Row 1: Format - Full Width (Thinner) */}
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Formato de Embalaje</label>
                                        <select 
                                            className="w-full py-0.5 px-2 bg-black border border-gray-500 rounded text-white text-xs focus:border-green-500 transition-colors h-6"
                                            value={line.formatName}
                                            onChange={e => {
                                                const fmt = PACKING_FORMATS.find(f => f.name === e.target.value);
                                                updateProductionLine(index, 'formatName', e.target.value);
                                                if(fmt) updateProductionLine(index, 'weightPerUnit', fmt.weight);
                                            }}
                                        >
                                            {PACKING_FORMATS.map(f => (
                                                <option key={f.name} value={f.name}>{f.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Row 2: Combined Operational Grid */}
                                    <div className="grid grid-cols-12 gap-2 items-end">
                                        {/* LEFT: Line & Boxes */}
                                        <div className="col-span-2">
                                             <label className="block text-[9px] text-gray-400 uppercase font-bold mb-1">Línea</label>
                                             <select
                                                className="w-full p-1.5 bg-black border border-gray-500 rounded text-white text-sm focus:border-green-500 transition-colors"
                                                value={line.productionLine || 'LINEA 1'}
                                                onChange={e => updateProductionLine(index, 'productionLine', e.target.value)}
                                             >
                                                <option value="LINEA 1">LÍNEA 1</option>
                                                <option value="LINEA 2">LÍNEA 2</option>
                                             </select>
                                        </div>
                                        <div className="col-span-3">
                                            <label className="block text-[9px] text-gray-400 uppercase font-bold mb-1">Cajas</label>
                                            <input 
                                                type="number" placeholder="0"
                                                className="w-full p-1.5 bg-black border border-gray-500 rounded text-white text-sm text-center font-bold focus:border-green-500"
                                                value={line.units || ''} onChange={e => updateProductionLine(index, 'units', parseInt(e.target.value) || 0)}
                                            />
                                        </div>

                                        {/* CENTER: Weight, Check, Print */}
                                        <div className="col-span-1">
                                            <label className="block text-[9px] text-gray-400 uppercase font-bold mb-1 text-center">Peso</label>
                                            <div className="text-white font-bold text-sm text-center py-1.5">{line.weightPerUnit}</div>
                                        </div>
                                        <div className="col-span-1 flex justify-center pb-1.5">
                                            <label className="text-[9px] text-gray-400 cursor-pointer select-none flex flex-col items-center gap-0.5" onClick={() => updateProductionLine(index, 'isFullPallet', !line.isFullPallet)}>
                                                {line.isFullPallet ? <CheckSquare size={16} className="text-green-500"/> : <Square size={16}/>}
                                                (Full)
                                            </label>
                                        </div>
                                        <div className="col-span-1 text-center pb-1.5">
                                            <button 
                                                onClick={() => handlePrintTransientLine(line)}
                                                className="text-gray-400 hover:text-blue-400"
                                                title="Imprimir"
                                            >
                                                <Printer size={18} />
                                            </button>
                                        </div>

                                        {/* RIGHT SIDE: Folio & Search */}
                                        
                                        {/* N° Pallet (Folio ID) - SWAPPED ORDER */}
                                        <div className="col-span-2">
                                             <label className="block text-[9px] text-gray-400 uppercase font-bold mb-1 truncate" title="N° Pallet (Folio)">N° Pallets</label>
                                             <input 
                                                type="text" 
                                                className="w-full py-1.5 px-1 bg-black text-white border border-gray-500 rounded text-xs text-center font-bold focus:border-green-500 shadow-inner"
                                                value={line.manualFolio || ''} 
                                                onChange={e => updateProductionLine(index, 'manualFolio', e.target.value)}
                                            />
                                        </div>
                                        
                                        {/* Search Incomplete Pallets - Using Row Specific Datalist */}
                                        <div className="col-span-2">
                                            <label className="block text-[9px] text-gray-400 uppercase font-bold mb-1 truncate" title="Buscar Incompleto">Pallets Existente</label>
                                            <input 
                                                type="text" 
                                                list={dataListId}
                                                placeholder="Buscar..."
                                                className={`w-full py-1.5 px-1 border rounded text-xs text-center font-mono font-bold shadow-inner ${existingInfo ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-black text-white border-gray-500 focus:border-green-500'}`}
                                                onChange={e => updateProductionLine(index, 'manualFolio', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end pt-1">
                                        {existingInfo && (
                                            <div className="bg-blue-100 text-blue-800 text-[9px] px-2 py-1 rounded animate-fade-in">
                                                <span className="font-bold">LINK:</span> {existingInfo.units} cj (Prod: {existingInfo.producer})
                                            </div>
                                        )}
                                        <div className="ml-auto text-right">
                                            <span className="text-sm text-gray-400">Total: <span className="text-green-400 font-bold">{line.totalKilos.toFixed(2)} kg</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )})}
                        {productionLines.length === 0 && (
                            <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                                No hay líneas de producción activas.
                            </div>
                        )}
                    </div>

                    {/* ADD BUTTON */}
                    <button 
                        onClick={addProductionLine}
                        className="w-full py-3 mb-6 border-2 border-dashed border-green-200 rounded-xl text-green-600 font-bold hover:bg-green-50 flex items-center justify-center gap-2 transition-colors"
                    >
                        <Plus size={20}/> Agregar Formato
                    </button>

                    {/* DASHBOARD BALANCE (Moved to Bottom) */}
                    <div className={`p-4 rounded-xl border ${currentLotBalance < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-800 border-gray-700 text-white'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <p className={`text-[10px] uppercase font-bold ${currentLotBalance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    Kilos por Cuadrar (Balance)
                                </p>
                                <div className="flex items-end gap-2">
                                    <h2 className={`text-2xl font-bold ${currentLotBalance < 0 ? 'text-red-600' : 'text-white'}`}>
                                        {currentLotBalance.toFixed(2)} <span className="text-sm">kg</span>
                                    </h2>
                                    {exportPercentage > 0 && (
                                        <span className="text-sm font-bold text-green-400 mb-1">
                                            ({exportPercentage.toFixed(1)}% Exp.)
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] opacity-70">Entrada: {inputKilosToUse.toFixed(1)}</div>
                                <div className="text-[10px] opacity-70">Salida: {(currentOutputKilos + currentDiscardKilos + customDiscardTotal).toFixed(1)}</div>
                            </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-600 h-1.5 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${currentLotBalance < 0 ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(((currentOutputKilos + currentDiscardKilos + customDiscardTotal) / inputKilosToUse) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* COLUMN 3: DISCARDS (Full Width, Horizontal Layout) */}
                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-red-800 uppercase mb-3 flex items-center gap-2">
                        <Trash2 size={16}/> Registro de Descartes
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* IQF */}
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Congelado (IQF)</label>
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                    <span className="block text-[9px] text-blue-500 font-bold uppercase mb-1">Directo (S.0)</span>
                                    <div className="w-full p-2 bg-blue-100 text-blue-800 font-bold text-sm rounded border border-blue-200 text-right">
                                        {directIqf.toFixed(1)}
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-[9px] text-blue-500 font-bold uppercase mb-1">Proceso (Manual)</span>
                                    <input 
                                        type="number"
                                        className="w-full p-2 bg-black border border-blue-300 rounded text-right font-bold text-sm focus:ring-1 focus:ring-blue-500 text-white"
                                        value={iqfKilos || ''} onChange={e => setIqfKilos(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="text-[10px] text-right text-blue-500 font-bold">
                                {getPercentage(directIqf + iqfKilos)} del Total
                            </div>
                        </div>
                        
                        {/* MERMA */}
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                            <label className="block text-xs font-bold text-orange-800 uppercase mb-2">Merma (Pérdida)</label>
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                    <span className="block text-[9px] text-orange-500 font-bold uppercase mb-1">Directo (S.0)</span>
                                    <div className="w-full p-2 bg-orange-100 text-orange-800 font-bold text-sm rounded border border-orange-200 text-right">
                                        {directMerma.toFixed(1)}
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-[9px] text-orange-500 font-bold uppercase mb-1">Proceso (Manual)</span>
                                    <input 
                                        type="number"
                                        className="w-full p-2 bg-black border border-orange-300 rounded text-right font-bold text-sm focus:ring-1 focus:ring-orange-500 text-white"
                                        value={mermaKilos || ''} onChange={e => setMermaKilos(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="text-[10px] text-right text-orange-500 font-bold">
                                {getPercentage(directMerma + mermaKilos)} del Total
                            </div>
                        </div>

                        {/* DESECHO */}
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                            <label className="block text-xs font-bold text-red-800 uppercase mb-2">Desecho (Basura)</label>
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                    <span className="block text-[9px] text-red-500 font-bold uppercase mb-1">Directo (S.0)</span>
                                    <div className="w-full p-2 bg-red-100 text-red-800 font-bold text-sm rounded border border-red-200 text-right">
                                        {directDesecho.toFixed(1)}
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-[9px] text-red-500 font-bold uppercase mb-1">Proceso (Manual)</span>
                                    <input 
                                        type="number"
                                        className="w-full p-2 bg-black border border-red-300 rounded text-right font-bold text-sm focus:ring-1 focus:ring-red-500 text-white"
                                        value={wasteKilos || ''} onChange={e => setWasteKilos(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="text-[10px] text-right text-red-500 font-bold">
                                {getPercentage(directDesecho + wasteKilos)} del Total
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Actions Footer (Outside the grid) */}
            <div className="flex justify-end gap-3 pt-4 border-t mt-6 bg-gray-50 p-4 rounded-xl">
                <button 
                    onClick={() => {
                        if (isUpdateMode) {
                            setIsUpdateMode(false);
                            setStep(0);
                            setProductionLines([]);
                            setProcessId('');
                        } else {
                            setStep(0);
                        }
                    }}
                    className="px-6 py-3 text-gray-500 hover:bg-gray-200 rounded-xl font-bold transition-colors"
                >
                    {isUpdateMode ? 'Cancelar Edición' : 'Cancelar'}
                </button>
                <button 
                    onClick={handleSaveOrQueue}
                    className="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-green-700 hover:shadow-xl transition-all flex items-center gap-2"
                >
                    <Save size={20} /> {isUpdateMode ? 'Guardar Cambios' : 'Finalizar Lote'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
             <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Proceso de Fruta</h1>
                <p className="text-gray-500">Gestión de lotes de producción, clasificación y trazabilidad.</p>
            </header>

            {/* STEPS RENDERER */}
            {step === 0 && renderStep0()}
            {step === 1 && renderStep1()}

            {/* EDIT STOCK MODAL */}
            {editingStockItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Edit size={20} className="text-blue-600"/> Editar Pallet {editingStockItem.folio}
                            </h3>
                            <button onClick={() => setEditingStockItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        
                        <div className="mb-4">
                            <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => setIsSplitMode(false)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${!isSplitMode ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}
                                >
                                    Edición Simple
                                </button>
                                <button 
                                    onClick={() => setIsSplitMode(true)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${isSplitMode ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}
                                >
                                    <Split size={14}/> Dividir Pallet
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {/* PART 1 (Original / Main) */}
                                <div className={`p-3 rounded-lg border ${isSplitMode ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 col-span-2'}`}>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{isSplitMode ? 'Parte 1 (Original)' : 'Detalle Pallet'}</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Peso Neto (kg)</label>
                                            <input 
                                                type="number" className="w-full p-2 border rounded font-bold text-white bg-black border-gray-600"
                                                value={editStockForm.netWeight || ''} onChange={e => setEditStockForm({...editStockForm, netWeight: parseFloat(e.target.value) || 0})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bandejas</label>
                                            <input 
                                                type="number" className="w-full p-2 border rounded font-bold text-white bg-black border-gray-600"
                                                value={editStockForm.trays || ''} onChange={e => setEditStockForm({...editStockForm, trays: parseInt(e.target.value) || 0})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Clasificación</label>
                                            <select 
                                                className="w-full p-2 border rounded text-sm bg-black text-white border-gray-600"
                                                value={editStockForm.classification} onChange={e => setEditStockForm({...editStockForm, classification: e.target.value})}
                                            >
                                                <option value="PROCESO">A PROCESO</option>
                                                <option value="IQF DIRECTO">IQF DIRECTO</option>
                                                <option value="MERMA DIRECTA">MERMA DIRECTA</option>
                                                <option value="DESECHO DIRECTO">DESECHO DIRECTO</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* PART 2 (Split) */}
                                {isSplitMode && (
                                    <div className="p-3 rounded-lg border bg-amber-50 border-amber-200">
                                        <h4 className="text-xs font-bold text-amber-700 uppercase mb-2">Parte 2 (Nuevo/Descarte)</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Peso Neto (kg)</label>
                                                <input 
                                                    type="number" className="w-full p-2 border border-amber-300 rounded font-bold text-white bg-black"
                                                    value={splitStockForm.netWeight || ''} onChange={e => setSplitStockForm({...splitStockForm, netWeight: parseFloat(e.target.value) || 0})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Bandejas</label>
                                                <input 
                                                    type="number" className="w-full p-2 border border-amber-300 rounded font-bold text-white bg-black"
                                                    value={splitStockForm.trays || ''} onChange={e => setSplitStockForm({...splitStockForm, trays: parseInt(e.target.value) || 0})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Clasificación</label>
                                                <select 
                                                    className="w-full p-2 border border-amber-300 rounded text-sm bg-black text-white"
                                                    value={splitStockForm.classification} onChange={e => setSplitStockForm({...splitStockForm, classification: e.target.value})}
                                                >
                                                    <option value="IQF DIRECTO">IQF DIRECTO</option>
                                                    <option value="MERMA DIRECTA">MERMA DIRECTA</option>
                                                    <option value="DESECHO DIRECTO">DESECHO DIRECTO</option>
                                                    <option value="PROCESO">A PROCESO</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Totals Preview */}
                             <div className="mt-4 flex justify-between items-center text-xs text-gray-500 px-2">
                                <span>Original: <strong>{editingStockItem.netWeight.toFixed(1)} kg</strong></span>
                                {isSplitMode && (
                                    <span className={Math.abs((editStockForm.netWeight + splitStockForm.netWeight) - editingStockItem.netWeight) > 0.5 ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}>
                                        Suma: {(editStockForm.netWeight + splitStockForm.netWeight).toFixed(1)} kg
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setEditingStockItem(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                            <button onClick={handleSaveStockEdit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow hover:bg-blue-700">Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD BULK PALLETS MODAL */}
            {isAddBulkModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 h-[80vh] flex flex-col animate-fade-in">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Plus size={20} className="text-green-600"/> Agregar Pallets a Granel
                                </h3>
                                <p className="text-xs text-gray-500">Filtrado por: {customProducer} - {customVariety}</p>
                            </div>
                            <button onClick={() => setIsAddBulkModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-4">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2 w-10 text-center"></th>
                                        <th className="p-2">Folio</th>
                                        <th className="p-2 text-right">Kilos Neto</th>
                                        <th className="p-2 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {availableBulkItems.map(item => (
                                        <tr key={item.uniqueId} className="hover:bg-green-50 cursor-pointer" onClick={() => toggleBulkSelection(item.uniqueId)}>
                                            <td className="p-2 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={tempSelectedBulkIds.includes(item.uniqueId)}
                                                    onChange={() => {}} // Handled by row click
                                                    className="rounded text-green-600 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-2 font-mono font-bold text-gray-700">{item.folio}</td>
                                            <td className="p-2 text-right font-bold">{item.netWeight.toFixed(1)}</td>
                                            <td className="p-2 text-center">
                                                <span className="bg-gray-100 text-gray-500 px-1 py-0.5 rounded text-[10px]">{item.classification || 'Proceso'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {availableBulkItems.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-400">No hay pallets disponibles con estas características.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                            <div className="text-xs text-gray-500">
                                Seleccionados: <strong>{tempSelectedBulkIds.length}</strong> | Total Kilos: <strong>{availableBulkItems.filter(i => tempSelectedBulkIds.includes(i.uniqueId)).reduce((s, i) => s + i.netWeight, 0).toFixed(1)}</strong>
                            </div>
                            <button 
                                onClick={handleAddBulkPallets}
                                disabled={tempSelectedBulkIds.length === 0}
                                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all"
                            >
                                Agregar Seleccionados
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcessPage;
