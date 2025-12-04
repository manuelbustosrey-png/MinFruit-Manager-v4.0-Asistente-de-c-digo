
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Reception, ProductionLot, Material, Dispatch, AppState, ProcessStatus, ProductionDetail, MaterialMovement, User, UserRole, Employee, AttendanceRecord, Contract, Settlement, IqfPallet, Payroll } from '../types';
import { TARE_PALLET, TARE_TRAY } from '../constants';

interface StockUpdate {
    originalUniqueId: string; 
    targetLotId: string;
    manualFolio: string;
    units: number;
    pallets: number; 
    isFullPallet: boolean;
    delete?: boolean; 
}

interface AppContextType extends AppState {
    activeWorkCenter: string;
    switchWorkCenter: (center: string) => void;

    addReception: (rec: Reception) => void;
    updateReception: (rec: Reception) => void;
    updateReceptionPallet: (recId: string, folio: string, weight: number, trays: number, classification: string) => void;
    splitReceptionPallet: (
        recId: string, 
        originalFolio: string, 
        part1: { weight: number, trays: number, classification: string },
        part2: { weight: number, trays: number, classification: string }
    ) => void;

    createLot: (lot: ProductionLot, materialName: string, boxesUsed: number) => void;
    updateLot: (lot: ProductionLot) => void;
    
    addMaterial: (mat: Material) => void;
    updateMaterial: (mat: Material) => void;
    removeMaterial: (name: string, qty: number, reason: string) => void;
    
    addDispatch: (disp: Dispatch) => void;
    
    // IQF
    addIqfPallet: (pallet: IqfPallet) => void;
    updateIqfPallet: (pallet: IqfPallet) => void;
    removeIqfPallet: (id: string) => void;

    // RRHH
    addEmployee: (emp: Employee) => void;
    updateEmployee: (emp: Employee) => void;
    saveAttendance: (records: AttendanceRecord[]) => void;
    addContract: (contract: Contract) => void;
    addSettlement: (settlement: Settlement) => void;
    addPayroll: (payroll: Payroll) => void;

    // Stock
    bulkUpdateStockItems: (updates: StockUpdate[]) => void;

    // Auth
    login: (u: string, p: string) => boolean;
    logout: () => void;
    checkPermission: (perm: string) => boolean;
    addUser: (user: User) => void;
    updateUser: (user: User) => void;
    deleteUser: (id: string) => void;
    recoverPassword: (email: string) => boolean;

    getAvailableReceptions: () => Reception[];
    
    // System
    resetModuleData: (moduleKey: 'receptions' | 'lots' | 'inventory' | 'dispatches' | 'rrhh' | 'all') => void;
}

const INITIAL_CENTER = 'RIO DONGUIL LOS NOGALES';

// --- MOCK DATA ---
const DEFAULT_USERS: User[] = [
    { id: 'admin-01', username: 'admin', password: '123', name: 'Administrador General', role: 'ADMIN', workCenter: 'TODOS (ACCESO TOTAL)' },
    { id: 'admin-02', username: 'Manuel bustos', password: 'Mbustos.2025', name: 'Manuel Bustos', role: 'ADMIN', workCenter: 'TODOS (ACCESO TOTAL)' },
    { id: 'op-01', username: 'operador', password: '123', name: 'Operador Planta', role: 'OPERATOR', workCenter: INITIAL_CENTER, permissions: ['view_reception', 'view_process', 'view_stock'] },
    // New Users
    { 
        id: 'usr-packing', 
        username: 'packing', 
        password: '123', 
        name: 'Encargado Packing', 
        role: 'OPERATOR', 
        workCenter: INITIAL_CENTER, 
        permissions: ['view_process', 'view_stock', 'view_reports'] // Process covers IQF as well based on Sidebar logic
    },
    { 
        id: 'usr-recepcion', 
        username: 'recepcion', 
        password: '123', 
        name: 'Encargado Recepción', 
        role: 'OPERATOR', 
        workCenter: INITIAL_CENTER, 
        permissions: ['view_reception', 'view_inventory', 'view_reports'] 
    },
    { 
        id: 'usr-bodega', 
        username: 'bodega', 
        password: '123', 
        name: 'Encargado Bodega', 
        role: 'OPERATOR', 
        workCenter: INITIAL_CENTER, 
        permissions: ['view_inventory', 'view_reports'] 
    }
];

const DEFAULT_EMPLOYEES: Employee[] = [
    { id: 'EMP-001', workCenter: INITIAL_CENTER, fullName: 'JUAN PEREZ GONZALEZ', rut: '15.444.333-2', address: 'AV. PRINCIPAL 123', commune: 'GORBEA', afp: 'MODELO', healthSystem: 'FONASA', birthDate: '1985-04-12', startDate: '2023-01-01', maritalStatus: 'CASADO', active: true, email: 'juan@email.com' },
    { id: 'EMP-002', workCenter: INITIAL_CENTER, fullName: 'MARIA SOTO DIAZ', rut: '16.555.444-K', address: 'CALLE 2 #444', commune: 'GORBEA', afp: 'PROVIDA', healthSystem: 'FONASA', birthDate: '1990-08-20', startDate: '2023-03-15', maritalStatus: 'SOLTERA', active: true },
    { id: 'EMP-003', workCenter: INITIAL_CENTER, fullName: 'PEDRO RUIZ TAPIA', rut: '12.333.222-1', address: 'RURAL S/N', commune: 'PITRUFQUEN', afp: 'CAPITAL', healthSystem: 'ISAPRE', birthDate: '1980-11-05', startDate: '2022-11-01', maritalStatus: 'CASADO', active: true },
];

const DEFAULT_RECEPTIONS: Reception[] = [
    {
        id: 'REC-001',
        workCenter: INITIAL_CENTER,
        guideNumber: '5042',
        producer: 'Agricola Santa Carmen S.A.',
        variety: 'DUKE',
        originType: 'ORGANICO',
        receptionDate: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
        lotNumber: 'L-5042',
        temperature: 12,
        trays: 500,
        pallets: 5,
        grossWeight: 3100,
        netWeight: 2840, // Approx
        status: ProcessStatus.PENDING,
        palletDetails: Array.from({length: 5}).map((_, i) => ({
            folio: `000${i+1}-4052`,
            weight: 620,
            trays: 100,
            classification: 'PROCESO'
        }))
    },
    {
        id: 'REC-002',
        workCenter: INITIAL_CENTER,
        guideNumber: '9981',
        producer: 'Agrícola Malihuito SpA.',
        variety: 'LEGACY',
        originType: 'CONVENCIONAL',
        receptionDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        lotNumber: 'L-9981',
        temperature: 10,
        trays: 320,
        pallets: 3,
        grossWeight: 1950,
        netWeight: 1787,
        status: ProcessStatus.PENDING,
        palletDetails: Array.from({length: 3}).map((_, i) => ({
            folio: `001${i+1}-4050`,
            weight: 650,
            trays: 106, // approx
            classification: 'PROCESO'
        }))
    },
    {
        id: 'REC-003',
        workCenter: INITIAL_CENTER,
        guideNumber: '1025',
        producer: 'Sociedad Agrícola y Comercial Arantruf Ltda.',
        variety: 'BRIGITTA',
        originType: 'ORGANICO',
        receptionDate: new Date().toISOString(), // Today
        lotNumber: 'L-1025',
        temperature: 11,
        trays: 400,
        pallets: 4,
        grossWeight: 2500,
        netWeight: 2292,
        status: ProcessStatus.PENDING,
        palletDetails: Array.from({length: 4}).map((_, i) => ({
            folio: `000${i+1}-4057`,
            weight: 625,
            trays: 100,
            classification: 'PROCESO'
        }))
    }
];

const DEFAULT_LOTS: ProductionLot[] = [
    {
        id: 'PROC-20250126-001',
        workCenter: INITIAL_CENTER,
        receptionIds: ['REC-001'],
        usedPalletFolios: ['0001-4052', '0002-4052', '0003-4052'], // 3 Pallets Used
        totalInputNetWeight: 1704, // 3 * 568 approx
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lotProducer: 'Agricola Santa Carmen S.A.',
        lotVariety: 'DUKE',
        details: [
            { formatName: 'ARAND ORG 12x18oz ETIQ. HIPPIE', weightPerUnit: 6.3648, units: 144, pallets: 1, manualFolio: '1001000001', totalKilos: 916.53, productionLine: 'LINEA 1', isFullPallet: true },
            { formatName: 'ARAND ORG 12x6oz', weightPerUnit: 2.1216, units: 200, pallets: 1, manualFolio: '1001000002', totalKilos: 424.32, productionLine: 'LINEA 1', isFullPallet: false }
        ],
        producedKilos: 1340.85,
        iqfKilos: 200,
        mermaKilos: 100,
        wasteKilos: 63.15,
        yieldPercentage: 78.68
    }
];

const DEFAULT_MATERIALS: Material[] = [
    { id: 'MAT-001', workCenter: INITIAL_CENTER, name: 'Caja 18oz Genérica', provider: 'Cartones Chile', quantity: 4800, unitCost: 450, entryDate: '2024-01-10' },
    { id: 'MAT-002', workCenter: INITIAL_CENTER, name: 'Film Paletizador', provider: 'Insumos del Sur', quantity: 195, unitCost: 3500, entryDate: '2024-01-12' },
    { id: 'MAT-003', workCenter: INITIAL_CENTER, name: 'Esquinero Cartón', provider: 'Cartones Chile', quantity: 950, unitCost: 150, entryDate: '2024-01-15' },
    { id: 'MAT-004', workCenter: INITIAL_CENTER, name: 'Bandeja Cosechera Negra', provider: 'Plásticos Agri', quantity: 2500, unitCost: 2000, entryDate: '2024-01-01' },
];

const DEFAULT_DISPATCHES: Dispatch[] = [
    {
        id: 'DISP-001',
        workCenter: INITIAL_CENTER,
        dispatchGuide: '5501',
        clientName: 'HORTIFRUT',
        dispatchDate: new Date(Date.now() - 43200000).toISOString(),
        lotIds: ['PROC-20250126-001'],
        dispatchedFolios: ['1001000001'], // Dispatched the full pallet
        totalKilos: 916.53,
        totalUnits: 144
    }
];

// Context
const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- STATE ---
    const [activeWorkCenter, setActiveWorkCenter] = useState<string>(() => {
        return localStorage.getItem('selectedWorkCenter') || INITIAL_CENTER;
    });

    const [receptions, setReceptions] = useState<Reception[]>(() => {
        const saved = localStorage.getItem('db_receptions');
        return saved ? JSON.parse(saved) : DEFAULT_RECEPTIONS;
    });
    
    const [lots, setLots] = useState<ProductionLot[]>(() => {
        const saved = localStorage.getItem('db_lots');
        return saved ? JSON.parse(saved) : DEFAULT_LOTS;
    });
    
    const [materials, setMaterials] = useState<Material[]>(() => {
        const saved = localStorage.getItem('db_materials');
        return saved ? JSON.parse(saved) : DEFAULT_MATERIALS;
    });

    const [materialMovements, setMaterialMovements] = useState<MaterialMovement[]>(() => {
        const saved = localStorage.getItem('db_movements');
        return saved ? JSON.parse(saved) : [];
    });

    const [dispatches, setDispatches] = useState<Dispatch[]>(() => {
        const saved = localStorage.getItem('db_dispatches');
        return saved ? JSON.parse(saved) : DEFAULT_DISPATCHES;
    });

    const [iqfPallets, setIqfPallets] = useState<IqfPallet[]>(() => {
        const saved = localStorage.getItem('db_iqf_pallets');
        return saved ? JSON.parse(saved) : [];
    });

    // RRHH State
    const [employees, setEmployees] = useState<Employee[]>(() => {
        const saved = localStorage.getItem('db_employees');
        return saved ? JSON.parse(saved) : DEFAULT_EMPLOYEES;
    });

    const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
        const saved = localStorage.getItem('db_attendance');
        return saved ? JSON.parse(saved) : [];
    });
    
    const [contracts, setContracts] = useState<Contract[]>(() => {
        const saved = localStorage.getItem('db_contracts');
        return saved ? JSON.parse(saved) : [];
    });

    const [settlements, setSettlements] = useState<Settlement[]>(() => {
        const saved = localStorage.getItem('db_settlements');
        return saved ? JSON.parse(saved) : [];
    });

    const [payrolls, setPayrolls] = useState<Payroll[]>(() => {
        const saved = localStorage.getItem('db_payrolls');
        return saved ? JSON.parse(saved) : [];
    });

    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });
    
    const [users, setUsers] = useState<User[]>(() => {
        const saved = localStorage.getItem('db_users');
        return saved ? JSON.parse(saved) : DEFAULT_USERS;
    });

    // --- PERSISTENCE ---
    useEffect(() => { localStorage.setItem('db_receptions', JSON.stringify(receptions)); }, [receptions]);
    useEffect(() => { localStorage.setItem('db_lots', JSON.stringify(lots)); }, [lots]);
    useEffect(() => { localStorage.setItem('db_materials', JSON.stringify(materials)); }, [materials]);
    useEffect(() => { localStorage.setItem('db_movements', JSON.stringify(materialMovements)); }, [materialMovements]);
    useEffect(() => { localStorage.setItem('db_dispatches', JSON.stringify(dispatches)); }, [dispatches]);
    useEffect(() => { localStorage.setItem('db_iqf_pallets', JSON.stringify(iqfPallets)); }, [iqfPallets]);
    
    useEffect(() => { localStorage.setItem('db_employees', JSON.stringify(employees)); }, [employees]);
    useEffect(() => { localStorage.setItem('db_attendance', JSON.stringify(attendance)); }, [attendance]);
    useEffect(() => { localStorage.setItem('db_contracts', JSON.stringify(contracts)); }, [contracts]);
    useEffect(() => { localStorage.setItem('db_settlements', JSON.stringify(settlements)); }, [settlements]);
    useEffect(() => { localStorage.setItem('db_payrolls', JSON.stringify(payrolls)); }, [payrolls]);
    
    useEffect(() => { localStorage.setItem('db_users', JSON.stringify(users)); }, [users]);
    useEffect(() => { 
        if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser)); 
        else localStorage.removeItem('currentUser');
    }, [currentUser]);

    useEffect(() => {
        localStorage.setItem('selectedWorkCenter', activeWorkCenter);
    }, [activeWorkCenter]);

    // --- FILTERED DATA (BY WORK CENTER) ---
    // Helper to filter generic arrays by workCenter property
    const filterByCenter = <T extends { workCenter?: string }>(data: T[]) => {
        if (activeWorkCenter === 'TODOS (ACCESO TOTAL)') return data;
        return data.filter(item => item.workCenter === activeWorkCenter);
    };

    const switchWorkCenter = (center: string) => {
        setActiveWorkCenter(center);
    };

    // --- ACTIONS ---

    const addReception = (rec: Reception) => setReceptions(prev => [...prev, { ...rec, workCenter: activeWorkCenter }]);
    
    const updateReception = (updatedRec: Reception) => {
        setReceptions(prev => prev.map(r => r.id === updatedRec.id ? updatedRec : r));
    };

    const updateReceptionPallet = (recId: string, folio: string, weight: number, trays: number, classification: string) => {
        setReceptions(prev => prev.map(rec => {
            if (rec.id === recId && rec.palletDetails) {
                const updatedPallets = rec.palletDetails.map(p => {
                    if (p.folio === folio) {
                        return { ...p, weight, trays, classification };
                    }
                    return p;
                });
                
                // Recalculate Totals
                const newGross = updatedPallets.reduce((s, p) => s + p.weight, 0);
                const newTrays = updatedPallets.reduce((s, p) => s + p.trays, 0);
                const tare = (newTrays * TARE_TRAY) + (rec.pallets * TARE_PALLET);
                const newNet = Math.max(0, newGross - tare);

                return { ...rec, palletDetails: updatedPallets, grossWeight: newGross, trays: newTrays, netWeight: newNet };
            }
            return rec;
        }));
    };

    const splitReceptionPallet = (
        recId: string, 
        originalFolio: string, 
        part1: { weight: number, trays: number, classification: string },
        part2: { weight: number, trays: number, classification: string }
    ) => {
        setReceptions(prev => prev.map(rec => {
            if (rec.id === recId && rec.palletDetails) {
                const originalIndex = rec.palletDetails.findIndex(p => p.folio === originalFolio);
                if (originalIndex === -1) return rec;

                const newDetails = [...rec.palletDetails];
                // Remove original
                newDetails.splice(originalIndex, 1);
                
                // Add two parts
                newDetails.splice(originalIndex, 0, 
                    { folio: `${originalFolio}`, weight: part1.weight, trays: part1.trays, classification: part1.classification, isUsed: false },
                    { folio: `${originalFolio}-B`, weight: part2.weight, trays: part2.trays, classification: part2.classification, isUsed: false }
                );

                // Recalc
                const newGross = newDetails.reduce((s, p) => s + p.weight, 0);
                const newTrays = newDetails.reduce((s, p) => s + p.trays, 0);
                const newPalletCount = rec.pallets + 1;
                
                const tare = (newTrays * TARE_TRAY) + (newPalletCount * TARE_PALLET);
                const newNet = Math.max(0, newGross - tare);

                return { 
                    ...rec, 
                    palletDetails: newDetails, 
                    grossWeight: newGross, 
                    trays: newTrays, 
                    pallets: newPalletCount,
                    netWeight: newNet 
                };
            }
            return rec;
        }));
    };

    const createLot = (lot: ProductionLot, materialName: string, boxesUsed: number) => {
        const stampedLot = { ...lot, workCenter: activeWorkCenter };
        setLots(prev => [...prev, stampedLot]);
        
        // Mark used pallets in receptions
        if (lot.usedPalletFolios && lot.usedPalletFolios.length > 0) {
            setReceptions(prev => prev.map(rec => {
                if (rec.palletDetails && lot.receptionIds.includes(rec.id)) {
                    const updatedDetails = rec.palletDetails.map(p => {
                        if (lot.usedPalletFolios?.includes(p.folio)) {
                            return { ...p, isUsed: true };
                        }
                        return p;
                    });
                    
                    // Check if all pallets are used to mark reception as Processed
                    const allUsed = updatedDetails.every(p => p.isUsed);
                    
                    return { 
                        ...rec, 
                        palletDetails: updatedDetails,
                        status: allUsed ? ProcessStatus.PROCESSED : rec.status
                    };
                }
                return rec;
            }));
        } else {
            // Legacy / Packed Mode support
            setReceptions(prev => prev.map(rec => 
                lot.receptionIds.includes(rec.id) ? { ...rec, status: ProcessStatus.PROCESSED } : rec
            ));
        }
    };
    
    const updateLot = (updatedLot: ProductionLot) => {
        setLots(prev => prev.map(l => l.id === updatedLot.id ? updatedLot : l));
    };

    const addMaterial = (mat: Material) => {
        setMaterials(prev => [...prev, { ...mat, workCenter: activeWorkCenter }]);
        setMaterialMovements(prev => [...prev, {
            id: `MOV-${Date.now()}`,
            workCenter: activeWorkCenter,
            date: new Date().toISOString(),
            type: 'IN',
            materialName: mat.name,
            quantity: mat.quantity,
            reason: 'Ingreso Inicial'
        }]);
    };

    const updateMaterial = (mat: Material) => {
        setMaterials(prev => prev.map(m => m.id === mat.id ? mat : m));
    };

    const removeMaterial = (name: string, qty: number, reason: string) => {
        // FIFO Logic: Deduct from oldest batches first
        let remaining = qty;
        
        setMaterials(prev => {
            // Sort by entry date (oldest first)
            const sorted = [...prev].filter(m => m.name === name && m.workCenter === activeWorkCenter).sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
            const otherMaterials = prev.filter(m => m.name !== name || m.workCenter !== activeWorkCenter);
            
            const updatedBatch: Material[] = [];

            for (const batch of sorted) {
                if (remaining <= 0) {
                    updatedBatch.push(batch);
                    continue;
                }

                if (batch.quantity > remaining) {
                    updatedBatch.push({ ...batch, quantity: batch.quantity - remaining });
                    remaining = 0;
                } else {
                    // Consume entire batch
                    updatedBatch.push({ ...batch, quantity: 0 }); 
                    remaining -= batch.quantity;
                }
            }
            return [...otherMaterials, ...updatedBatch];
        });

        if (remaining < qty) { 
             setMaterialMovements(prev => [...prev, {
                id: `MOV-${Date.now()}`,
                workCenter: activeWorkCenter,
                date: new Date().toISOString(),
                type: 'OUT',
                materialName: name,
                quantity: qty - remaining, // Actual deducted
                reason
            }]);
        }
    };

    const addDispatch = (disp: Dispatch) => {
        setDispatches(prev => [...prev, { ...disp, workCenter: activeWorkCenter }]);
    };

    // --- IQF ---
    const addIqfPallet = (pallet: IqfPallet) => setIqfPallets(prev => [...prev, { ...pallet, workCenter: activeWorkCenter }]);
    const updateIqfPallet = (pallet: IqfPallet) => setIqfPallets(prev => prev.map(p => p.id === pallet.id ? pallet : p));
    const removeIqfPallet = (id: string) => setIqfPallets(prev => prev.filter(p => p.id !== id));

    // --- RRHH ---
    const addEmployee = (emp: Employee) => setEmployees(prev => [...prev, { ...emp, workCenter: activeWorkCenter }]);
    const updateEmployee = (emp: Employee) => setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
    const saveAttendance = (records: AttendanceRecord[]) => {
        // Filter out existing records for this date/center to overwrite
        const stampedRecords = records.map(r => ({ ...r, workCenter: activeWorkCenter }));
        setAttendance(prev => {
            const others = prev.filter(a => !stampedRecords.some(r => r.date === a.date && r.employeeId === a.employeeId));
            return [...others, ...stampedRecords];
        });
    };
    const addContract = (c: Contract) => setContracts(prev => [...prev, { ...c, workCenter: activeWorkCenter }]);
    const addSettlement = (s: Settlement) => {
        const stamped = { ...s, workCenter: activeWorkCenter };
        setSettlements(prev => [...prev, stamped]);
        // Auto deactivate employee
        setEmployees(prev => prev.map(e => e.id === s.employeeId ? { ...e, active: false } : e));
        // Auto deactivate contract
        setContracts(prev => prev.map(c => c.employeeId === s.employeeId && c.active ? { ...c, active: false, endDate: s.date } : c));
    };

    const addPayroll = (payroll: Payroll) => {
        setPayrolls(prev => [...prev, { ...payroll, workCenter: activeWorkCenter }]);
    };

    // --- STOCK MANAGEMENT ---
    const bulkUpdateStockItems = (updates: StockUpdate[]) => {
        setLots(prevLots => {
            let newLots = JSON.parse(JSON.stringify(prevLots)) as ProductionLot[]; // Deep copy

            updates.forEach(update => {
                // Find source lot
                const sourceLot = newLots.find(l => {
                    return update.originalUniqueId.startsWith(l.id);
                });

                if (sourceLot) {
                    const detailIndexStr = update.originalUniqueId.split('-').pop(); // Get last part
                    const detailIndex = parseInt(detailIndexStr || '-1');

                    if (detailIndex >= 0 && sourceLot.details[detailIndex]) {
                        if (update.delete) {
                            sourceLot.details.splice(detailIndex, 1);
                        } else if (update.targetLotId !== sourceLot.id) {
                            // Move to another lot
                            const itemToMove = { ...sourceLot.details[detailIndex] };
                            
                            // Remove from source
                            sourceLot.details.splice(detailIndex, 1);
                            
                            // Add to target
                            const targetLot = newLots.find(l => l.id === update.targetLotId);
                            if (targetLot) {
                                targetLot.details.push({
                                    ...itemToMove,
                                    manualFolio: update.manualFolio,
                                    units: update.units,
                                    pallets: update.pallets,
                                    isFullPallet: update.isFullPallet,
                                    totalKilos: update.units * itemToMove.weightPerUnit
                                });
                            }
                        } else {
                            // Update in place
                            const detail = sourceLot.details[detailIndex];
                            detail.manualFolio = update.manualFolio;
                            detail.units = update.units;
                            detail.pallets = update.pallets;
                            detail.isFullPallet = update.isFullPallet;
                            detail.totalKilos = detail.units * detail.weightPerUnit;
                        }

                        // Recalculate Lot Totals
                        sourceLot.producedKilos = sourceLot.details.reduce((s, d) => s + d.totalKilos, 0);
                        // Re-calc yield
                        sourceLot.yieldPercentage = sourceLot.totalInputNetWeight > 0 
                            ? (sourceLot.producedKilos / sourceLot.totalInputNetWeight) * 100 
                            : 0;
                    }
                }
            });

            return newLots;
        });
    };


    // --- AUTH ---
    const login = (u: string, p: string) => {
        const found = users.find(user => user.username === u && user.password === p);
        if (found) {
            setCurrentUser(found);
            if (found.workCenter && found.workCenter !== 'TODOS (ACCESO TOTAL)') {
                setActiveWorkCenter(found.workCenter);
            }
            return true;
        }
        return false;
    };
    
    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('selectedWorkCenter'); 
    };

    const checkPermission = (perm: string) => {
        if (!currentUser) return false;
        if (currentUser.role === 'ADMIN') return true;
        return currentUser.permissions?.includes(perm) || false;
    };

    const addUser = (user: User) => setUsers(prev => [...prev, user]);
    const updateUser = (user: User) => setUsers(prev => prev.map(u => u.id === user.id ? user : u));
    const deleteUser = (id: string) => setUsers(prev => prev.filter(u => u.id !== id));
    
    const recoverPassword = (email: string) => {
        const exists = users.find(u => u.email === email);
        return !!exists;
    };

    const getAvailableReceptions = useCallback(() => {
        const centerReceptions = filterByCenter<Reception>(receptions);
        return centerReceptions.filter(r => 
            r.status === ProcessStatus.PENDING || 
            (r.palletDetails && r.palletDetails.some(p => !p.isUsed))
        );
    }, [receptions, activeWorkCenter]);

    // --- RESET ---
    const resetModuleData = (moduleKey: 'receptions' | 'lots' | 'inventory' | 'dispatches' | 'rrhh' | 'all') => {
        const isGlobal = activeWorkCenter === 'TODOS (ACCESO TOTAL)';

        const filterOutCurrent = <T extends { workCenter?: string }>(list: T[]) => {
            if (isGlobal) return [];
            return list.filter(item => item.workCenter !== activeWorkCenter);
        };

        if (moduleKey === 'all' || moduleKey === 'receptions') {
             setReceptions(prev => filterOutCurrent(prev));
        }
        if (moduleKey === 'all' || moduleKey === 'lots') {
             setLots(prev => filterOutCurrent(prev));
        }
        if (moduleKey === 'all' || moduleKey === 'inventory') {
             setMaterials(prev => filterOutCurrent(prev));
             setMaterialMovements(prev => filterOutCurrent(prev));
        }
        if (moduleKey === 'all' || moduleKey === 'dispatches') {
             setDispatches(prev => filterOutCurrent(prev));
        }
        if (moduleKey === 'all' || moduleKey === 'rrhh') {
             setEmployees(prev => filterOutCurrent(prev));
             setAttendance(prev => filterOutCurrent(prev));
             setContracts(prev => filterOutCurrent(prev));
             setSettlements(prev => filterOutCurrent(prev));
             setPayrolls(prev => filterOutCurrent(prev));
        }
        if (moduleKey === 'all') { 
             setIqfPallets(prev => filterOutCurrent(prev));
        }
    };

    // Filter Data for Consumers based on Active Work Center
    const filteredReceptions = filterByCenter(receptions);
    const filteredLots = filterByCenter(lots);
    const filteredMaterials = filterByCenter(materials);
    const filteredMovements = filterByCenter(materialMovements);
    const filteredDispatches = filterByCenter(dispatches);
    const filteredIqf = filterByCenter(iqfPallets);
    const filteredEmployees = filterByCenter(employees);
    const filteredAttendance = filterByCenter(attendance);
    const filteredContracts = filterByCenter(contracts);
    const filteredSettlements = filterByCenter(settlements);
    const filteredPayrolls = filterByCenter(payrolls);

    return (
        <AppContext.Provider value={{
            receptions: filteredReceptions,
            lots: filteredLots,
            materials: filteredMaterials,
            materialMovements: filteredMovements,
            dispatches: filteredDispatches,
            iqfPallets: filteredIqf,
            employees: filteredEmployees,
            attendance: filteredAttendance,
            contracts: filteredContracts,
            settlements: filteredSettlements,
            payrolls: filteredPayrolls,
            currentUser,
            users,
            
            activeWorkCenter,
            switchWorkCenter,

            addReception,
            updateReception,
            updateReceptionPallet,
            splitReceptionPallet,
            createLot,
            updateLot,
            addMaterial,
            updateMaterial,
            removeMaterial,
            addDispatch,
            addIqfPallet,
            updateIqfPallet,
            removeIqfPallet,
            addEmployee,
            updateEmployee,
            saveAttendance,
            addContract,
            addSettlement,
            addPayroll,
            
            bulkUpdateStockItems,

            login,
            logout,
            checkPermission,
            addUser,
            updateUser,
            deleteUser,
            recoverPassword,
            getAvailableReceptions,
            resetModuleData
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within an AppProvider');
    return context;
};
