

export const TARE_TRAY = 0.32; // Kg per tray (Updated from 2.5)
export const TARE_PALLET = 20.0; // Kg per pallet

export const PACKING_FORMATS = [
    { name: 'ARAND ORG 12x18oz ETIQ. HIPPIE', weight: 6.3648, materialCostPerUnit: 1 },
    { name: 'ARAND ORG 12x18oz ETIQ. GOURMET', weight: 6.3648, materialCostPerUnit: 1 },
    { name: 'ARAND ORG 12XPINTA PLANO ETIQ. HIPPIE', weight: 3.890, materialCostPerUnit: 1 },
    { name: 'ARAND ORG 12x6oz', weight: 2.1216, materialCostPerUnit: 1 },
];

export const PRODUCERS_DATA = [
    { name: "Agricola Fundo Malloco Ltda.", code: "4046" },
    { name: "Agrícola Malihuito SpA.", code: "4050" },
    { name: "Agricola Ñancul S.A.", code: "4051" },
    { name: "Agricola Santa Carmen S.A.", code: "4052" },
    { name: "Agrícola Santa Victoria Ltda.", code: "4053" },
    { name: "Alimentos Interrupción Ltda.", code: "4054" },
    { name: "Carlos Alberto Klein Koch", code: "4055" },
    { name: "Mario Enrique Talbot Jiliberto", code: "4056" },
    { name: "Sociedad Agrícola y Comercial Arantruf Ltda.", code: "4057" },
    { name: "Sociedad Agrícola y Ganadera Altué Ltda.", code: "4058" },
    { name: "Sociedad Agrícola Y Ganadera Dollinco Ltda.", code: "4059" }
];

// Helper to keep backward compatibility or simple list access
export const PRODUCERS_LIST = PRODUCERS_DATA.map(p => p.name);

export const APP_NAME = "Rio Donguil";