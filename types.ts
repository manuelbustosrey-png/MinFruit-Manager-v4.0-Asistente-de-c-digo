
export enum UnitType {
    KILOS = 'KILOS',
    UNITS = 'UNITS'
}

export enum ProcessStatus {
    PENDING = 'PENDING',
    PROCESSED = 'PROCESSED'
}

export type UserRole = 'ADMIN' | 'OPERATOR';

export interface User {
    id: string;
    username: string;
    password: string; // In a real app, this should be hashed.
    name: string;
    email?: string; // Added for recovery
    role: UserRole;
    permissions?: string[]; // List of permission keys (e.g. 'view_reception')
    workCenter?: string; // Assigned Work Center
}

// --- RRHH INTERFACES ---
export interface Employee {
    id: string;
    workCenter: string; // Separation
    fullName: string;
    rut: string;
    address: string;
    commune: string;
    afp: string;
    healthSystem: string; // Fonasa/Isapre
    birthDate: string;
    startDate?: string; // Fecha de Ingreso
    maritalStatus: string;
    active: boolean;
    phone?: string;
    email?: string;
    // Bank Details
    bankName?: string;
    accountType?: string;
    accountNumber?: string;
}

export interface AttendanceRecord {
    id: string;
    workCenter: string; // Separation
    date: string;
    employeeId: string;
    status: 'PRESENTE' | 'AUSENTE' | 'LICENCIA' | 'VACACIONES';
    overtimeHours?: number; // Added field
    checkIn?: string;
    checkOut?: string;
    notes?: string;
}

export interface Contract {
    id: string;
    workCenter: string; // Separation
    employeeId: string;
    startDate: string;
    endDate?: string; // Null if indefinite
    type: 'INDEFINIDO' | 'PLAZO FIJO' | 'POR FAENA';
    position: string;
    baseSalary: number;
    active: boolean;
}

export interface Payroll {
    id: string;
    workCenter: string;
    employeeId: string;
    period: string; // YYYY-MM
    workedDays: number;
    overtimeHours: number;
    
    // Earnings
    baseSalaryCalculated: number; // Proportional to days
    overtimePay: number;
    gratification: number;
    bonusTaxable: number; // Bonos Imponibles
    bonusNonTaxable: number; // Colación/Movilización
    totalTaxable: number; // Total Imponible
    
    // Deductions
    afpAmount: number;
    healthAmount: number; // 7%
    afcAmount: number; // Seguro Cesantía
    
    // Final
    totalDeductions: number;
    netPay: number; // Sueldo Líquido
}

export interface Settlement {
    id: string;
    workCenter: string; 
    employeeId: string;
    date: string;
    reason: string;
    
    // Calculation Details
    daysWorkedMonth: number;
    pendingSalary: number; // Sueldo pendiente mes
    
    vacationDays: number;
    vacationTotal: number; // Indemnización Vacaciones
    
    yearsService: number;
    serviceIndemnity: number; // Indemnización Años Servicio
    
    noticeIndemnity: number; // Mes de Aviso (Optional)
    
    totalDeductions: number; // Imposiciones del mes
    
    totalAmount: number; // Total a Pagar (Liquido Final)
    documentUrl?: string; 
}
// -----------------------

export interface PalletDetail {
    folio: string;
    weight: number;
    trays: number;
    isUsed?: boolean;
    classification?: string; // 'PROCESO' | 'IQF' | 'MERMA' | 'DESECHO'
}

export interface Reception {
    id: string;
    workCenter: string; // Separation
    lotNumber: string;
    guideNumber: string;
    producer: string;
    variety: string;
    originType?: string; // 'ORGANICO' | 'CONVENCIONAL'
    receptionDate: string;
    temperature: number;
    trays: number;
    pallets: number;
    grossWeight: number;
    netWeight: number;
    status: ProcessStatus;
    palletDetails?: PalletDetail[];
}

export interface ProductionDetail {
    formatName: string;
    weightPerUnit: number;
    units: number;
    pallets: number;
    isFullPallet?: boolean; 
    manualFolio: string;
    totalKilos: number;
    productionLine?: string; // 'LINEA 1' | 'LINEA 2'
    
    // Traceability Database (Persists origin info when moved)
    originLotId?: string;
    originProducer?: string;
    originVariety?: string;
    originDate?: string;
}

export interface ProductionLot {
    id: string;
    workCenter: string; // Separation
    receptionIds: string[];
    usedPalletFolios?: string[]; 
    totalInputNetWeight: number;
    createdAt: string;
    lotProducer: string;
    lotVariety: string;
    
    details: ProductionDetail[];

    producedKilos: number; 
    iqfKilos: number;
    mermaKilos: number;
    wasteKilos: number;
    
    // Dynamic Discards
    customDiscards?: { label: string; kilos: number }[];

    yieldPercentage: number;
}

export interface Material {
    id: string;
    workCenter: string; // Separation
    name: string;
    provider: string;
    entryDate: string;
    quantity: number;
    unitCost: number;
    guideNumber?: string; // Added field for Reference Guide
}

export interface MaterialMovement {
    id: string;
    workCenter: string; // Separation
    date: string;
    type: 'IN' | 'OUT' | 'ADJUST';
    materialName: string;
    quantity: number;
    reason: string; // e.g., "Compra", "Producción Lote X", "Merma"
}

export interface Dispatch {
    id: string;
    workCenter: string; // Separation
    dispatchGuide: string;
    clientName: string;
    dispatchDate: string;
    lotIds: string[];
    dispatchedFolios?: string[]; 
    totalKilos: number;
    totalUnits: number;
}

// --- IQF MANAGEMENT INTERFACES ---
export interface IqfSourceItem {
    lotId: string;
    kilos: number;
    producer: string;
    variety: string;
    guide: string;
}

export interface IqfPallet {
    id: string;
    workCenter: string; // Separation
    folio: string; // Sequential 500100001...
    creationDate: string;
    items: IqfSourceItem[];
    totalKilos: number;
    trays: number; // Manual entry for tray count
    status: 'PENDING' | 'DISPATCHED';
    formattedProducer?: string; // Consolidated or edited producer string
    formattedVariety?: string; // Consolidated or edited variety string
    dispatchGuide?: string; // Guía de Despacho
}
// --------------------------------

export interface AppState {
    receptions: Reception[];
    lots: ProductionLot[];
    materials: Material[];
    materialMovements: MaterialMovement[]; 
    dispatches: Dispatch[];
    
    // IQF State
    iqfPallets: IqfPallet[];

    // RRHH State
    employees: Employee[];
    attendance: AttendanceRecord[];
    contracts: Contract[];
    settlements: Settlement[];
    payrolls: Payroll[]; // Added

    // Auth State
    currentUser: User | null;
    users: User[];
}
