
import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { Employee, Contract, Settlement, AttendanceRecord, Payroll } from '../types';
import { Users, Calendar, FileText, UserMinus, Plus, Save, Edit, Briefcase, Clock, Printer, DollarSign, Calculator, CreditCard, FileSpreadsheet } from 'lucide-react';
import { APP_NAME } from '../constants';

// Helper for RUT formatting
const formatRut = (value: string) => {
    if (!value) return '';
    // Clean: Remove anything that is not a number or K
    const clean = value.replace(/[^0-9kK]/g, '');
    
    // Limit length to avoid infinite strings (typical max is 9 chars: 99999999K)
    if (clean.length > 9) return value.slice(0, 12); // Fallback limit

    // Formatting logic
    if (clean.length <= 1) return clean;
    
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1).toUpperCase();
    
    // Add dots to body
    const bodyWithDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    return `${bodyWithDots}-${dv}`;
};

const RRHHPage: React.FC = () => {
    const { employees, attendance, contracts, settlements, payrolls, addEmployee, updateEmployee, saveAttendance, addContract, addSettlement, addPayroll, activeWorkCenter } = useApp();
    const [activeTab, setActiveTab] = useState<'PERSONAL' | 'ASISTENCIA' | 'CONTRATO' | 'LIQUIDACIONES' | 'FINIQUITO'>('PERSONAL');

    // --- STATES ---
    const [empForm, setEmpForm] = useState<Partial<Employee>>({
        active: true,
        healthSystem: 'FONASA',
        maritalStatus: 'SOLTERO'
    });
    const [isEditingEmp, setIsEditingEmp] = useState(false);

    // Attendance
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
    // Store status AND overtime
    const [tempAttendance, setTempAttendance] = useState<Record<string, { status: 'PRESENTE' | 'AUSENTE' | 'LICENCIA' | 'VACACIONES', overtime: number }>>({});

    // Contract
    const [contractForm, setContractForm] = useState<Partial<Contract>>({ type: 'PLAZO FIJO', active: true });

    // Settlement
    const [settlementForm, setSettlementForm] = useState<Partial<Settlement>>({});
    const [settlementCalc, setSettlementCalc] = useState<any>(null); // To store preview

    // Payroll
    const [payrollForm, setPayrollForm] = useState<{
        employeeId: string;
        period: string; // YYYY-MM
        workedDays: number;
        overtimeHours: number;
        bonusTaxable: number;
        bonusNonTaxable: number;
        baseSalaryOverride?: number; // New field for manual override
    }>({
        employeeId: '',
        period: new Date().toISOString().slice(0, 7),
        workedDays: 30,
        overtimeHours: 0,
        bonusTaxable: 0,
        bonusNonTaxable: 0
    });
    const [payrollPreview, setPayrollPreview] = useState<Payroll | null>(null);

    // --- CONSTANTS FOR CALCULATION ---
    const MINIMUM_WAGE = 500000; // Approx CLP
    const GRATIFICATION_CAP = (4.75 * MINIMUM_WAGE) / 12; // Monthly cap
    const AFP_RATE = 0.11; // Approx avg
    const HEALTH_RATE = 0.07;
    const AFC_RATE = 0.006; // Worker share

    // Bank Constants
    const BANKS = [
        "BANCO ESTADO", "BANCO DE CHILE", "SANTANDER", "BCI", "SCOTIABANK", 
        "ITAÚ", "BANCO FALABELLA", "BANCO RIPLEY", "BANCO CONSORCIO", "BANCO SECURITY", 
        "BANCO BICE", "CAJA LOS ANDES", "COOPERATIVA COOPEUCH",
        // Virtual Banks
        "TENPO", "MERCADO PAGO", "MACH", "CHEK", "TAPP", "GLOBAL66"
    ];
    const ACCOUNT_TYPES = ["CUENTA RUT", "CUENTA CORRIENTE", "CUENTA VISTA", "CUENTA DE AHORRO"];

    // --- EFFECTS ---
    
    // Auto-calculate Vacation Days when Settlement Date or Employee changes
    useEffect(() => {
        if (activeTab === 'FINIQUITO' && settlementForm.employeeId && settlementForm.date) {
            const contract = contracts.find(c => c.employeeId === settlementForm.employeeId && c.active);
            if (contract && contract.startDate) {
                const start = new Date(contract.startDate);
                const end = new Date(settlementForm.date);
                
                // Calculate difference in months
                // One full month = 30 days approximation or strictly calendar
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                // Approx 30 days per month for calculation
                const monthsWorked = diffDays / 30;
                
                // Formula: 1.25 days per month worked
                const vacationDays = parseFloat((monthsWorked * 1.25).toFixed(2));
                
                setSettlementForm(prev => ({ ...prev, vacationDays }));
            }
        }
    }, [settlementForm.employeeId, settlementForm.date, activeTab, contracts]);

    // Auto-calculate Payroll Data (Worked Days & Overtime) from Attendance History
    useEffect(() => {
        if (activeTab === 'LIQUIDACIONES' && payrollForm.employeeId && payrollForm.period) {
            // Filter attendance records for this employee in the selected period (Month)
            const monthlyRecords = attendance.filter(a => 
                a.employeeId === payrollForm.employeeId && 
                a.date.startsWith(payrollForm.period)
            );

            // Try to find contract to auto-fill base salary override if empty
            const contract = contracts.find(c => c.employeeId === payrollForm.employeeId && c.active);
            const contractSalary = contract ? contract.baseSalary : undefined;

            if (monthlyRecords.length > 0) {
                // Calculate Absences
                const absences = monthlyRecords.filter(r => r.status === 'AUSENTE').length;
                const licenses = monthlyRecords.filter(r => r.status === 'LICENCIA').length;
                const calculatedDays = Math.max(0, 30 - absences - licenses);

                // Calculate Total Overtime
                const totalOvertime = monthlyRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

                setPayrollForm(prev => ({
                    ...prev,
                    workedDays: calculatedDays,
                    overtimeHours: totalOvertime,
                    baseSalaryOverride: prev.baseSalaryOverride || contractSalary
                }));
            } else {
                setPayrollForm(prev => ({
                    ...prev,
                    workedDays: 30,
                    overtimeHours: 0,
                    baseSalaryOverride: prev.baseSalaryOverride || contractSalary
                }));
            }
        }
    }, [payrollForm.employeeId, payrollForm.period, activeTab, attendance, contracts]);

    // --- HANDLERS ---

    const handleEmployeeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!empForm.fullName || !empForm.rut) return;

        const emp: Employee = {
            id: empForm.id || `EMP-${Date.now()}`,
            fullName: empForm.fullName,
            rut: empForm.rut,
            address: empForm.address || '',
            commune: empForm.commune || '',
            afp: empForm.afp || '',
            healthSystem: empForm.healthSystem || 'FONASA',
            birthDate: empForm.birthDate || '',
            startDate: empForm.startDate || '', // Added Start Date
            maritalStatus: empForm.maritalStatus || 'SOLTERO',
            active: empForm.active !== undefined ? empForm.active : true,
            email: empForm.email,
            phone: empForm.phone,
            workCenter: activeWorkCenter,
            bankName: empForm.bankName,
            accountType: empForm.accountType,
            accountNumber: empForm.accountNumber
        };

        if (isEditingEmp) {
            updateEmployee(emp);
            setIsEditingEmp(false);
        } else {
            addEmployee(emp);
        }
        setEmpForm({ active: true, healthSystem: 'FONASA', maritalStatus: 'SOLTERO' });
    };

    const handleEditEmp = (emp: Employee) => {
        setEmpForm(emp);
        setIsEditingEmp(true);
        setActiveTab('PERSONAL');
    };

    const handleDownloadEmployees = () => {
        const headers = [
            "Nombre Completo", "RUT", "Fecha Ingreso", "Dirección", "Comuna", 
            "Teléfono", "Email", "AFP", "Salud", "Estado Civil", 
            "Banco", "Tipo Cuenta", "N° Cuenta", "Estado"
        ];

        const rows = employees.map(e => [
            `"${e.fullName}"`,
            e.rut,
            e.startDate || '',
            `"${e.address}"`,
            `"${e.commune}"`,
            e.phone || '',
            e.email || '',
            e.afp,
            e.healthSystem,
            e.maritalStatus,
            `"${e.bankName || ''}"`,
            `"${e.accountType || ''}"`,
            `"${e.accountNumber || ''}"`,
            e.active ? "ACTIVO" : "INACTIVO"
        ]);

        const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Personal_RioDonguil_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper to update temp attendance safely, preserving DB values if not yet in temp
    const updateTempAttendance = (empId: string, field: 'status' | 'overtime', value: any) => {
        setTempAttendance(prev => {
            // Check if we already have a temp record, if not, grab from DB or default
            let current = prev[empId];
            
            if (!current) {
                const dbRecord = attendance.find(a => a.employeeId === empId && a.date === attendanceDate);
                current = { 
                    status: dbRecord?.status || 'PRESENTE', 
                    overtime: dbRecord?.overtimeHours || 0 
                };
            }

            return {
                ...prev,
                [empId]: { ...current, [field]: value }
            };
        });
    };

    const handleAttendanceSave = () => {
        const records: AttendanceRecord[] = Object.entries(tempAttendance).map(([empId, data]) => {
            const d = data as { status: 'PRESENTE' | 'AUSENTE' | 'LICENCIA' | 'VACACIONES', overtime: number };
            return {
                id: `${attendanceDate}-${empId}`,
                date: attendanceDate,
                employeeId: empId,
                status: d.status,
                overtimeHours: d.overtime,
                workCenter: activeWorkCenter
            };
        });
        saveAttendance(records);
        alert("Asistencia y Horas Extras Guardadas");
        setTempAttendance({});
    };

    // Linked Date Logic: When selecting employee, auto-fill start date
    const handleContractEmployeeChange = (empId: string) => {
        const selectedEmp = employees.find(e => e.id === empId);
        setContractForm(prev => ({
            ...prev,
            employeeId: empId,
            startDate: selectedEmp?.startDate || prev.startDate || ''
        }));
    };

    const handleContractSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractForm.employeeId || !contractForm.startDate || !contractForm.baseSalary) return;

        const newContract: Contract = {
            id: `CON-${Date.now()}`,
            employeeId: contractForm.employeeId,
            startDate: contractForm.startDate,
            endDate: contractForm.endDate,
            type: contractForm.type as any,
            position: contractForm.position || 'Operario',
            baseSalary: Number(contractForm.baseSalary),
            active: true,
            workCenter: activeWorkCenter
        };
        addContract(newContract);
        setContractForm({ type: 'PLAZO FIJO', active: true });
        alert("Contrato Registrado");
    };

    // --- PAYROLL LOGIC ---
    const calculatePayroll = () => {
        if (!payrollForm.employeeId) return;
        
        // Use Override from form if available, otherwise find contract
        let baseSalary = payrollForm.baseSalaryOverride;
        
        if (!baseSalary) {
            const contract = contracts.find(c => c.employeeId === payrollForm.employeeId && c.active);
            if (!contract) {
                alert("Ingrese el Sueldo Base manualmente si no hay contrato activo.");
                return;
            }
            baseSalary = contract.baseSalary;
        }
        
        // 1. Proportional Base Salary
        const dailyBase = baseSalary / 30;
        const baseSalaryCalculated = Math.round(dailyBase * payrollForm.workedDays);

        // 2. Overtime (Factor 0.0077777 for 45hrs)
        const overtimeValue = Math.round(baseSalary * 0.0077777 * payrollForm.overtimeHours);

        // 3. Gratification (25% capped)
        const taxableIncomePreGrat = baseSalaryCalculated + overtimeValue + payrollForm.bonusTaxable;
        const rawGratification = taxableIncomePreGrat * 0.25;
        const gratification = Math.min(Math.round(rawGratification), Math.round(GRATIFICATION_CAP));

        // 4. Totals
        const totalTaxable = taxableIncomePreGrat + gratification;
        
        // 5. Deductions
        const afpAmount = Math.round(totalTaxable * AFP_RATE);
        const healthAmount = Math.round(totalTaxable * HEALTH_RATE);
        const afcAmount = Math.round(totalTaxable * AFC_RATE);
        const totalDeductions = afpAmount + healthAmount + afcAmount;

        // 6. Net Pay
        const netPay = totalTaxable - totalDeductions + payrollForm.bonusNonTaxable;

        const preview: Payroll = {
            id: `LIQ-${Date.now()}`,
            workCenter: activeWorkCenter,
            employeeId: payrollForm.employeeId,
            period: payrollForm.period,
            workedDays: payrollForm.workedDays,
            overtimeHours: payrollForm.overtimeHours,
            baseSalaryCalculated,
            overtimePay: overtimeValue,
            gratification,
            bonusTaxable: payrollForm.bonusTaxable,
            bonusNonTaxable: payrollForm.bonusNonTaxable,
            totalTaxable,
            afpAmount,
            healthAmount,
            afcAmount,
            totalDeductions,
            netPay
        };

        setPayrollPreview(preview);
    };

    const handlePayrollSubmit = () => {
        if (!payrollPreview) return;
        addPayroll(payrollPreview);
        alert("Liquidación Guardada");
        setPayrollPreview(null);
        setPayrollForm(prev => ({ ...prev, workedDays: 30, overtimeHours: 0, bonusTaxable: 0, bonusNonTaxable: 0 }));
    };

    // --- SETTLEMENT LOGIC ---
    const calculateSettlement = () => {
        if (!settlementForm.employeeId || !settlementForm.date) {
            alert("Seleccione empleado y fecha de término.");
            return;
        }

        const contract = contracts.find(c => c.employeeId === settlementForm.employeeId && c.active);
        if (!contract) {
             alert("El empleado no tiene contrato activo para calcular base.");
             return;
        }
        
        // Basic inputs
        const baseSalary = contract.baseSalary;
        const vacationDays = settlementForm.vacationDays || 0;
        
        // 1. Pending Salary (Last month worked days)
        // Assume date implies days worked in that month. e.g. 2025-01-15 -> 15 days
        const endDate = new Date(settlementForm.date);
        const daysWorkedMonth = endDate.getDate(); // Simple assumption
        const dailySalary = baseSalary / 30;
        const pendingSalary = Math.round(dailySalary * daysWorkedMonth);
        
        // Deductions on pending salary
        // Estimate Gratification for pending salary to get taxable base
        const pendingGrat = Math.min(Math.round((pendingSalary) * 0.25), Math.round(GRATIFICATION_CAP));
        const pendingTaxable = pendingSalary + pendingGrat;
        const deductions = Math.round(pendingTaxable * (AFP_RATE + HEALTH_RATE + AFC_RATE));
        
        // 2. Vacation Indemnity (Holiday Pay)
        // Formula: (Base + Grat + PromedioVariable) / 30 * VacationDays
        // Simplification: (Base + GratCap) / 30
        const monthlyTaxableFull = baseSalary + Math.min(baseSalary * 0.25, GRATIFICATION_CAP);
        const dailyVacationValue = monthlyTaxableFull / 30;
        const vacationTotal = Math.round(dailyVacationValue * vacationDays);

        // 3. Years of Service
        let yearsService = 0;
        let serviceIndemnity = 0;
        if (contract.startDate) {
            const start = new Date(contract.startDate);
            const end = new Date(settlementForm.date);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
            
            // Chilean Law: > 1 year + 6 months rounds up.
            if (diffYears >= 1) {
                const years = Math.floor(diffYears);
                const remainder = diffYears - years;
                yearsService = remainder > 0.5 ? years + 1 : years;
                
                // Indemnity = (Base + Grat) * Years
                if (settlementForm.reason === 'Necesidades de la Empresa') {
                     serviceIndemnity = Math.round(monthlyTaxableFull * yearsService);
                }
            }
        }

        // 4. Notice Period (Mes de Aviso)
        const noticeIndemnity = 0; // Placeholder

        const totalAmount = (pendingSalary + pendingGrat - deductions) + vacationTotal + serviceIndemnity + noticeIndemnity;

        const calc = {
            daysWorkedMonth,
            pendingSalary,
            pendingGrat,
            deductions,
            vacationTotal,
            yearsService,
            serviceIndemnity,
            noticeIndemnity,
            totalAmount
        };

        setSettlementCalc(calc);
        setSettlementForm(prev => ({ ...prev, totalAmount: Math.round(totalAmount) }));
    };

    const handleSettlementSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!settlementForm.employeeId || !settlementForm.date || !settlementForm.totalAmount) return;

        if (window.confirm("¿Confirmar finiquito? Esto desactivará al empleado y su contrato vigente.")) {
            const newSettlement: Settlement = {
                id: `FIN-${Date.now()}`,
                employeeId: settlementForm.employeeId,
                date: settlementForm.date,
                reason: settlementForm.reason || 'Renuncia Voluntaria',
                workCenter: activeWorkCenter,
                
                // Detailed Breakdown
                daysWorkedMonth: settlementCalc?.daysWorkedMonth || 0,
                pendingSalary: (settlementCalc?.pendingSalary || 0) + (settlementCalc?.pendingGrat || 0),
                vacationDays: settlementForm.vacationDays || 0,
                vacationTotal: settlementCalc?.vacationTotal || 0,
                yearsService: settlementCalc?.yearsService || 0,
                serviceIndemnity: settlementCalc?.serviceIndemnity || 0,
                noticeIndemnity: settlementCalc?.noticeIndemnity || 0,
                totalDeductions: settlementCalc?.deductions || 0,
                totalAmount: settlementCalc?.totalAmount || Number(settlementForm.totalAmount)
            };
            
            addSettlement(newSettlement);
            setSettlementForm({});
            setSettlementCalc(null);
            alert("Finiquito procesado correctamente");
        }
    };

    // --- PRINT FUNCTIONS ---
    
    const handlePrintPayroll = (payroll: Payroll) => {
        const emp = employees.find(e => e.id === payroll.employeeId);
        const contract = contracts.find(c => c.employeeId === payroll.employeeId); 
        if (!emp) return;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Date formatting helpers
        const [year, month] = payroll.period.split('-');
        const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const monthName = monthNames[parseInt(month) - 1];
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Liquidación ${emp.fullName}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; font-size: 11px; padding: 20px; max-width: 800px; margin: 0 auto; color: #000; }
                    .header-bar { background-color: #2d1b2d; color: white; text-align: center; font-weight: bold; padding: 5px; font-size: 14px; margin-bottom: 10px; border-radius: 4px; }
                    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #999; }
                    .data-table td { padding: 4px 8px; border: 1px solid #ccc; background-color: #f9f9f9; }
                    .data-table .label { font-weight: bold; width: 100px; background-color: #eee; }
                    .data-table .value { font-weight: bold; font-size: 12px; }
                    .period-bar { background-color: #e0e0e0; border: 1px solid #ccc; padding: 5px 10px; font-weight: bold; margin-bottom: 20px; display: flex; gap: 20px; }
                    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
                    .details-table th { background-color: #ffcc00; border: 1px solid #999; padding: 4px; text-align: left; }
                    .details-table td { border: 1px solid #ccc; padding: 3px 5px; }
                    .details-table td.amount { text-align: right; font-family: monospace; font-size: 12px; }
                    .section-title { font-weight: bold; margin-bottom: 5px; text-transform: uppercase; font-size: 10px; }
                    .total-row { font-weight: bold; background-color: #f0f0f0; }
                    .total-row td { border-top: 1px solid #000; }
                    .net-pay-box { border: 2px solid #000; padding: 5px; margin-top: 10px; display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; background-color: #fdfdfd; }
                    .legal-footer { margin-top: 30px; font-size: 10px; text-align: justify; border: 1px solid #ccc; padding: 10px; }
                    .signatures { display: flex; justify-content: flex-end; margin-top: 60px; }
                    .sig-block { text-align: center; width: 250px; }
                    .sig-line { border-top: 1px solid #000; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="header-bar">LIQUIDACION DE SUELDO MENSUAL</div>
                <div class="section-title">DATOS DEL TRABAJADOR</div>
                <table class="data-table">
                    <tr><td class="label">RUT:</td><td class="value">${emp.rut}</td></tr>
                    <tr><td class="label">NOMBRE:</td><td class="value">${emp.fullName.toUpperCase()}</td></tr>
                </table>
                <div class="period-bar">
                    <span>Periodo:</span> <span>Mes: ${monthName}</span> <span>Año: ${year}</span>
                </div>
                <div class="section-title">DETALLE DE REMUNERACIÓN</div>
                <table class="details-table">
                    <tr><th style="width: 70%;">Haberes del Trabajador</th><th style="width: 30%; text-align: right;">Valor</th></tr>
                    <tr><td>Sueldo Base (${payroll.workedDays} días)</td><td class="amount">$ ${payroll.baseSalaryCalculated.toLocaleString()}</td></tr>
                    ${payroll.overtimeHours > 0 ? `<tr><td>Horas Extras (${payroll.overtimeHours} hrs)</td><td class="amount">$ ${payroll.overtimePay.toLocaleString()}</td></tr>` : ''}
                    <tr><td>Gratificación Legal (25% Tope)</td><td class="amount">$ ${payroll.gratification.toLocaleString()}</td></tr>
                    <tr><td><strong>Total Remuneración Imponible</strong></td><td class="amount" style="border-top: 1px solid #000;"><strong>$ ${payroll.totalTaxable.toLocaleString()}</strong></td></tr>
                    ${payroll.bonusNonTaxable > 0 ? `<tr><td>Asignación Colación / Movilización</td><td class="amount">$ ${payroll.bonusNonTaxable.toLocaleString()}</td></tr>` : ''}
                    <tr class="total-row"><td>Total de Haberes (1)</td><td class="amount">$ ${(payroll.totalTaxable + payroll.bonusNonTaxable).toLocaleString()}</td></tr>
                </table>
                <table class="details-table">
                    <tr><th style="width: 70%;">Descuentos</th><th style="width: 30%; text-align: right;">Valor</th></tr>
                    <tr><td>Cotización Previsional AFP (${emp.afp})</td><td class="amount">$ ${payroll.afpAmount.toLocaleString()}</td></tr>
                    <tr><td>Cotización Salud (${emp.healthSystem})</td><td class="amount">$ ${payroll.healthAmount.toLocaleString()}</td></tr>
                    <tr><td>Seguro Cesantía</td><td class="amount">$ ${payroll.afcAmount.toLocaleString()}</td></tr>
                    <tr class="total-row"><td>Total Descuentos (2)</td><td class="amount" style="color: #cc0000;">$ ${payroll.totalDeductions.toLocaleString()}</td></tr>
                </table>
                <div class="net-pay-box"><span>SALDO LIQUIDO A PAGAR</span><span>$ ${payroll.netPay.toLocaleString()}</span></div>
                <div class="legal-footer">
                    Certifico que he recibido de mi Empleador: <strong>AGROINDUSTRIAL RIO DONGUIL SPA.</strong> REPRESENTANTE: MANUEL BUSTOS a mi total y entera satisfacción el saldo líquido indicado en la presente liquidación, sin tener cargo ni cobro posterior alguno que hacer, por los conceptos de esta liquidación.<br/><br/>
                    Fecha: <strong>${new Date().toLocaleDateString()}</strong>
                </div>
                <div class="signatures">
                    <div class="sig-block"><div class="sig-line"></div>Firma del Trabajador<br/><strong>${emp.fullName.toUpperCase()}</strong><br/>RUT Nº ${emp.rut}</div>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintContract = (contract: Contract) => {
        const emp = employees.find(e => e.id === contract.employeeId);
        if (!emp) return alert("Empleado no encontrado");
        
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) return;

        const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
        const startStr = new Date(contract.startDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
        const endStr = contract.endDate ? new Date(contract.endDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase() : null;
        
        // Calculations for Clause 3
        const base = contract.baseSalary;
        const grat = Math.round(base * 0.25);
        const total = base + grat;

        const contractContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Contrato de Trabajo - ${emp.fullName}</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 11px; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.3; text-align: justify; }
                    .header { text-align: center; font-weight: bold; margin-bottom: 20px; font-size: 14px; }
                    p { margin-bottom: 10px; }
                    strong { font-weight: bold; }
                    .editable-area { background-color: #fffdf0; border: 1px dashed #e0e0e0; cursor: text; }
                    .editable-area:focus { background-color: #fff; outline: none; border: 1px solid #ccc; }
                    @media print {
                        .no-print { display: none; }
                        .editable-area { background-color: transparent; border: none; }
                        body { padding: 0; }
                    }
                    .controls { position: fixed; top: 10px; right: 10px; background: #eee; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
                    .btn { background: #2e7d32; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 4px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="controls no-print">
                    <button class="btn" onclick="window.print()">IMPRIMIR PDF</button>
                </div>

                <div class="header">CONTRATO DE TRABAJO</div>

                <p contenteditable="true" class="editable-area">
                    EN GORBEA, A <strong>${dateStr}</strong> ENTRE LA EMPRESA <strong>AGROINDUSTRIAL RIO DONGUIL SPA.</strong> RUT N° <strong>77.378.925-8</strong>, REPRESENTADA POR DON <strong>CHRISTIAN MARCELO BOLOMEY SCHUSTER</strong>, CÉDULA NACIONAL DE IDENTIDAD Nº 10.939.652-4, CON DOMICILIO EN PANAMERICANA SUR KM 724, GORBEA, EN ADELANTE “EL EMPLEADOR”, POR UNA PARTE, Y DON(A) <strong>${emp.fullName.toUpperCase()}</strong>, CÉDULA NACIONAL DE IDENTIDAD Nº <strong>${emp.rut}</strong>, ESTADO CIVIL: <strong>${emp.maritalStatus}</strong>, CON DOMICILIO EN <strong>${emp.address.toUpperCase()}, ${emp.commune.toUpperCase()}</strong>, NACIDO(A) EL <strong>${new Date(emp.birthDate).toLocaleDateString('es-CL')}</strong>, EN ADELANTE “EL TRABAJADOR”, SE HA CELEBRADO EL PRESENTE CONTRATO DE TRABAJO PARA CUYOS EFECTOS LAS PARTES DECIDEN DENOMINARSE EMPLEADOR Y TRABAJADOR RESPECTIVAMENTE.-
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>PRIMERO:</strong> EL TRABAJADOR SE COMPROMETE A EJECUTAR EL TRABAJO DE <strong>${contract.position.toUpperCase()}</strong>. LOS SERVICIOS SE PRESTARÁN EN LAS INSTALACIONES DEL EMPLEADOR UBICADAS EN PANAMERICANA SUR KM. 724, GORBEA.-
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>SEGUNDO:</strong> EL TRABAJADOR SE OBLIGA POR ESTE ACTO A PRESTAR SUS SERVICIOS PERSONALES DURANTE UNA JORNADA ORDINARA DE TRABAJO DE CUARENTA Y CINCO (45) HORAS SEMANALES, DICHA JORNADA DE TRABAJO SERÁ LA SIGUIENTE: DE LUNES A SÁBADO EN 2 JORNADAS; UNA EN LA MAÑANA DE 08:30 A 13:00 HORAS, Y LA OTRA EN LA TARDE DE 14:00 A 17:00 HRS. (COLACIÓN ENTRE LAS 13:00 HRS. HASTA LAS 14:00 HRAS.:01:00 HORA)
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>TERCERO:</strong> EL EMPLEADOR PAGARÁ AL TRABAJADOR UN SUELDO BASE DE <strong>$ ${base.toLocaleString()}=</strong> MENSUALES, MÁS UN 25 % DE GRATIFICACIÓN SOBRE EL SUELDO BASE DE <strong>$${grat.toLocaleString()}=</strong> UN TOTAL IMPONIBLE DE <strong>$ ${total.toLocaleString()}.=</strong> POR CADA MES EFECTIVAMENTE TRABAJADO, LO QUE SE PAGARÁ A TRAVÉS DE TRANSFERENCIA O DEPÓSITO BANCARIO, DEDUCIDAS LAS CANTIDADES QUE CORRESPONDEN DE CONFORMIDAD A LA LEY, COMO TAMBIÉN PRÉSTAMOS O DIVIDENDOS Y OBLIGACIONES CON INSTITUCIONES DE PREVISIÓN O CAJAS DE COMPENSACIÓN Y DE LOS DÍAS EFECTIVAMENTE NO TRABAJADOS. EL PAGO DE LA REMUNERACIÓN ANTES SEÑALADA SE EFECTUARÁ EN EL LUGAR DE TRABAJO, DE LUNES A VIERNES, HASTA EL DÍA 5 DEL MES SIGUIENTE. EL EMPLEADOR SE COMPROMETE A OTORGAR Y SUMINISTRAR AL TRABAJADOR LOS SIGUENTES BENEFICIOS:
                    <br/><br/>
                    A) BONO DE ASISTENCIA MENSUAL DE $72.000 (SETENTA Y DOS MIL PESOS) SIEMPRE Y CUANDO EL TRABAJADOR CUMPLA CON EL 100% DE ASISTENCIA ESTIPULADO EN EL PRESENTE CONTRATO.-
                    <br/><br/>
                    EL TIEMPO EXTRAORDINARIO SE CANCELARÁ CON EL RECARGO LEGAL CORRESPONDIENTE CONJUNTAMENTE CON EL SUELDO CONVENIDO EN EL NÚMERO ANTERIOR LOS PRIMEROS CINCO DÍAS DEL MES SIGUIENTE AL PERÍODO TRABAJADO Y DEL MONTO DE ÉSTE, EL EMPLEADOR PODRÁ REALIZAR LAS DEDUCCIONES QUE ESTABLEZCA LA LEGISLACIÓN VIGENTE, ADEMÁS DE LAS AUTORIZADAS EXPRESAMENTE POR EL TRABAJADOR TALES COMO INASISTENCIAS, PERMISOS, ATRASOS, PRÉSTAMOS, ETC.-
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>CUARTO:</strong> LA DURACIÓN DEL PRESENTE CONTRATO: ${endStr ? `PODRÁ TERMINAR, EL <strong>${endStr}</strong> APROXIMADAMENTE` : 'SERÁ INDEFINIDA'}, O POR TÉRMINO DE FAENA PUDIENDO PONERSE TÉRMINO POR LAS CAUSALES CONTENIDAS EN LOS ARTÍCULOS 159,160 Y 161 DEL CÓDIGO DEL TRABAJO.
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>QUINTO:</strong> EL TRABAJADOR SE OBLIGA Y COMPROMETE EXPRESAMENTE A CUMPLIR LAS INSTRUCCIONES QUE SEAN IMPARTIDAS POR SU JEFE INMEDIATO O POR LA GERENCIA DE LA EMPRESA EN RELACIÓN A SU TRABAJO Y ACATAR EN TODAS SUS PARTES EL ACUERDO CONVENIDO EN EL PRESENTE CONTRATO.
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>SEXTO:</strong> SE PROHIBE AL TRABAJADOR LA EJECUCIÓN DE TRABAJOS DE TRATO Y/O TRABAJAR HORAS EXTRAS SIN LA PREVIA AUTORIZACIÓN EXPREA DEL EMPLEADOR, ASÍ MISMO, EL TRABAJADOR ACEPTA Y AUTORIZA AL EMPLEADOR PARA REALIZAR DESCUENTOS POR EL VALOR DE MATERIALES, IMPLEMENTOS O HERRAMIENTAS CONFIADAS A SU CARGO Y NO REINTEGRADAS A LA EMPRESA.- EL INFRINGIR UNA O MÁS DE LAS PROHIBICIONES MENCIONADAS, DÁ LUGAR AL TÉRMINO DE CONTRATO DE TRABAJO.-
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>SÉPTIMO:</strong> LAS PARTES DEJAN EXPRESA CONSTANCIA QUE EL TRABAJADOR PRESTARÁ SERVICIOS PARA EL EMPLEADOR A CONTAR DEL DÍA <strong>${startStr}</strong> Y QUE EL PRESENTE CONTRATO SUSTITUYE, ANULA Y EXTINGUE DEFINITIVA Y TOTALMENTE TANTO EL CONTRATO DE TRABAJO QUE EL TRABAJADOR PUEDA HABER PRECEDENTEMENTE TENIDO, CON TODOS LOS DERECHOS Y OBLIGACIONES AHÍ CONTENIDOS, ASÍ COMO TODO OTRO ACUERDO, CONTRATO O DOCUMENTO QUE EL TRABAJADOR Y EL EMPLEADOR O LOS ANTECESORES DE ESTE ÚLTIMO PUEDAN HABER ANTERIORMENTE ACORDADO O SUSCRITO EN FORMA ORAL O ESCRITA Y CON MOTIVO O EN RELACIÓN CON LAS MATERIAS LABORALES QUE AFECTEN O PUEDAN HABER AFECTADO AL TRABAJADOR.-
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>OCTAVO:</strong> SE DEJA CONSTANCIA QUE EL TRABAJADOR DECLARA PERTENECER A LA SIGUIENTE INSTITUCIÓN PREVISIONAL: <strong>A.F.P. ${emp.afp.toUpperCase()}</strong>, SISTEMA DE SALUD: <strong>${emp.healthSystem.toUpperCase()}</strong>.
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>NOVENO:</strong> PARA TODOS LOS EFECTOS DERIVADOS DE ESTE CONTRATO LAS PARTES FIJAN DOMICILIO EN GORBEA Y SE SOMETEN A LA JURISDICCIÓN DE SUS TRIBUNALES.-
                </p>

                <p contenteditable="true" class="editable-area">
                    <strong>DÉCIMO:</strong> EL PRESENTE CONTRATO SE FIRMA EN 3 EJEMPLARES, DECLARANDO EL TRABAJADOR HABER RECIBIDO UN EJEMPLAR DE EL Y QUE ÉSTE ES EL FIEL REFLEJO DE LA RELACIÓN LABORAL EXISTENTE ENTRE LAS PARTES.-
                </p>

                <br/><br/><br/><br/>

                <div style="display: flex; justify-content: space-between; margin-top: 50px;">
                    <div style="text-align: center; width: 40%; border-top: 1px solid black; padding-top: 5px;">
                        <strong>${emp.fullName.toUpperCase()}</strong><br/>
                        R.U.T. Nº ${emp.rut}<br/>
                        (TRABAJADOR)
                    </div>
                    <div style="text-align: center; width: 40%; border-top: 1px solid black; padding-top: 5px;">
                        <strong>AGROINDUSTRIAL RIO DONGUIL SPA</strong><br/>
                        R.U.T. Nº 77.378.925-8<br/>
                        REP: CHRISTIAN MARCELO BOLOMEY SCHUSTER<br/>
                        RUT 10.939.652-4<br/>
                        (EMPLEADOR)
                    </div>
                </div>
            </body>
            </html>
        `;
        
        printWindow.document.write(contractContent);
        printWindow.document.close();
    };

    const handlePreviewContract = () => {
        if (!contractForm.employeeId || !contractForm.startDate || !contractForm.baseSalary) {
            alert("Complete los campos obligatorios (Trabajador, Fecha Inicio, Sueldo) para previsualizar.");
            return;
        }
        
        // Create a temporary contract object based on form data
        const tempContract: Contract = {
            id: 'TEMP',
            employeeId: contractForm.employeeId,
            startDate: contractForm.startDate,
            endDate: contractForm.endDate,
            type: contractForm.type as any || 'PLAZO FIJO',
            position: contractForm.position || 'Operario',
            baseSalary: Number(contractForm.baseSalary),
            active: true,
            workCenter: activeWorkCenter
        };
        
        handlePrintContract(tempContract);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-white">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Recursos Humanos</h1>
                <p className="text-gray-500">Gestión de personal, contratos, liquidaciones y asistencia.</p>
            </header>

            {/* TABS */}
            <div className="flex flex-wrap gap-2 mb-8 bg-gray-50 p-2 rounded-xl border border-gray-200 w-fit">
                <button onClick={() => setActiveTab('PERSONAL')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'PERSONAL' ? 'bg-black text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Users size={18} /> Personal
                </button>
                <button onClick={() => setActiveTab('ASISTENCIA')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'ASISTENCIA' ? 'bg-black text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Calendar size={18} /> Asistencia
                </button>
                <button onClick={() => setActiveTab('CONTRATO')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'CONTRATO' ? 'bg-black text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <FileText size={18} /> Contratos
                </button>
                <button onClick={() => setActiveTab('LIQUIDACIONES')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'LIQUIDACIONES' ? 'bg-black text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <DollarSign size={18} /> Liquidaciones
                </button>
                <button onClick={() => setActiveTab('FINIQUITO')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'FINIQUITO' ? 'bg-black text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <UserMinus size={18} /> Finiquitos
                </button>
            </div>

            {/* PERSONAL TAB */}
            {activeTab === 'PERSONAL' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
                    <div className="md:col-span-1">
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 sticky top-8">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <Plus size={20} className="text-blue-600"/> {isEditingEmp ? 'Editar Ficha' : 'Nueva Ficha Personal'}
                            </h3>
                            <form onSubmit={handleEmployeeSubmit} className="space-y-3">
                                <input type="text" placeholder="Nombre Completo" required className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm placeholder-gray-400" value={empForm.fullName || ''} onChange={e => setEmpForm({...empForm, fullName: e.target.value})} />
                                <input 
                                    type="text" 
                                    placeholder="ej. 17.813.442-6" 
                                    required 
                                    className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm placeholder-gray-400" 
                                    value={empForm.rut || ''} 
                                    onChange={e => setEmpForm({...empForm, rut: formatRut(e.target.value)})} 
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Dirección" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm placeholder-gray-400" value={empForm.address || ''} onChange={e => setEmpForm({...empForm, address: e.target.value})} />
                                    <input type="text" placeholder="Comuna" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm placeholder-gray-400" value={empForm.commune || ''} onChange={e => setEmpForm({...empForm, commune: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="AFP" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm placeholder-gray-400" value={empForm.afp || ''} onChange={e => setEmpForm({...empForm, afp: e.target.value})} />
                                    <select className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={empForm.healthSystem} onChange={e => setEmpForm({...empForm, healthSystem: e.target.value})}>
                                        <option value="FONASA">FONASA</option>
                                        <option value="ISAPRE">ISAPRE</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold">Fecha Nacimiento</label>
                                        <input type="date" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={empForm.birthDate || ''} onChange={e => setEmpForm({...empForm, birthDate: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold">Estado Civil</label>
                                        <select className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={empForm.maritalStatus} onChange={e => setEmpForm({...empForm, maritalStatus: e.target.value})}>
                                            <option value="SOLTERO">SOLTERO</option>
                                            <option value="CASADO">CASADO</option>
                                            <option value="DIVORCIADO">DIVORCIADO</option>
                                            <option value="VIUDO">VIUDO</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1">
                                     <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold">Fecha Ingreso</label>
                                        <input type="date" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={empForm.startDate || ''} onChange={e => setEmpForm({...empForm, startDate: e.target.value})} />
                                    </div>
                                </div>
                                <input type="email" placeholder="Email (Opcional)" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm placeholder-gray-400" value={empForm.email || ''} onChange={e => setEmpForm({...empForm, email: e.target.value})} />
                                
                                {/* Bank Details Section */}
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 mt-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                                        <CreditCard size={14}/> Datos Bancarios
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Banco</label>
                                            <select 
                                                className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm"
                                                value={empForm.bankName || ''}
                                                onChange={e => setEmpForm({...empForm, bankName: e.target.value})}
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Tipo Cuenta</label>
                                            <select 
                                                className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm"
                                                value={empForm.accountType || ''}
                                                onChange={e => setEmpForm({...empForm, accountType: e.target.value})}
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">N° Cuenta</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm"
                                                value={empForm.accountNumber || ''}
                                                onChange={e => setEmpForm({...empForm, accountNumber: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 shadow flex items-center justify-center gap-2">
                                    <Save size={16}/> Guardar Ficha
                                </button>
                                {isEditingEmp && <button type="button" onClick={() => {setIsEditingEmp(false); setEmpForm({ active: true, healthSystem: 'FONASA', maritalStatus: 'SOLTERO' });}} className="w-full bg-gray-100 text-gray-500 py-2 rounded-lg text-xs font-bold hover:bg-gray-200">Cancelar Edición</button>}
                            </form>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                             <h3 className="font-bold text-gray-700">Nómina de Trabajadores ({employees.length})</h3>
                             <button onClick={handleDownloadEmployees} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm">
                                <FileSpreadsheet size={18} /> Descargar Excel
                             </button>
                        </div>
                        <div className="space-y-4">
                            {employees.map(emp => (
                                <div key={emp.id} className={`bg-white p-4 rounded-xl border flex justify-between items-center ${emp.active ? 'border-gray-200 shadow-sm' : 'border-red-100 bg-red-50 opacity-70'}`}>
                                    <div>
                                        <h4 className="font-bold text-gray-800">{emp.fullName}</h4>
                                        <p className="text-xs text-gray-500 font-mono">{emp.rut} | {emp.position || 'Sin Cargo'}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 rounded">{emp.afp}</span>
                                            <span className="text-[10px] bg-green-50 text-green-700 px-1.5 rounded">{emp.healthSystem}</span>
                                            {!emp.active && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded font-bold">INACTIVO</span>}
                                            {emp.bankName && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded border border-gray-200 flex items-center gap-1"><CreditCard size={10}/> {emp.bankName}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleEditEmp(emp)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                        <Edit size={18}/>
                                    </button>
                                </div>
                            ))}
                            {employees.length === 0 && <div className="text-center p-8 text-gray-400">No hay personal registrado.</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* ASISTENCIA TAB */}
            {activeTab === 'ASISTENCIA' && (
                <div className="animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 mb-6 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <Clock size={24} className="text-green-600"/>
                            <div>
                                <h3 className="font-bold text-gray-800">Registro Diario</h3>
                                <p className="text-xs text-gray-500">Seleccione la fecha y marque la asistencia.</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <input type="date" className="p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} />
                            <button onClick={handleAttendanceSave} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-700 flex items-center gap-2">
                                <Save size={16}/> Guardar
                            </button>
                         </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="p-4">Empleado</th>
                                    <th className="p-4 text-center">Estado</th>
                                    <th className="p-4 text-center">Horas Extras</th>
                                    <th className="p-4">Observaciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {employees.filter(e => e.active).map(emp => {
                                    const currentRecord = attendance.find(a => a.employeeId === emp.id && a.date === attendanceDate);
                                    const tempState = tempAttendance[emp.id];
                                    const currentStatus = tempState ? tempState.status : (currentRecord?.status || 'PRESENTE');
                                    const currentOvertime = tempState && tempState.overtime !== undefined ? tempState.overtime : (currentRecord?.overtimeHours || 0);

                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-700">{emp.fullName}</td>
                                            <td className="p-4 flex justify-center gap-2">
                                                <button 
                                                    onClick={() => updateTempAttendance(emp.id, 'status', 'PRESENTE')}
                                                    className={`px-3 py-1 rounded text-xs font-bold border ${currentStatus === 'PRESENTE' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'}`}
                                                >
                                                    Presente
                                                </button>
                                                <button 
                                                    onClick={() => updateTempAttendance(emp.id, 'status', 'AUSENTE')}
                                                    className={`px-3 py-1 rounded text-xs font-bold border ${currentStatus === 'AUSENTE' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-200'}`}
                                                >
                                                    Ausente
                                                </button>
                                                <button 
                                                    onClick={() => updateTempAttendance(emp.id, 'status', 'LICENCIA')}
                                                    className={`px-3 py-1 rounded text-xs font-bold border ${currentStatus === 'LICENCIA' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
                                                >
                                                    Licencia
                                                </button>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center">
                                                    <input 
                                                        type="number" 
                                                        min="0" 
                                                        step="0.5" 
                                                        className="w-20 p-2 text-center bg-black text-white font-bold rounded-lg border border-gray-600 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                                        value={currentOvertime}
                                                        onChange={(e) => updateTempAttendance(emp.id, 'overtime', parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <input type="text" placeholder="Nota opcional..." className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-xs placeholder-gray-400 outline-none"/>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CONTRATO TAB */}
            {activeTab === 'CONTRATO' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
                    <div className="md:col-span-1">
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-amber-100">
                             <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <Briefcase size={20} className="text-amber-600"/> Generar Contrato
                            </h3>
                            <form onSubmit={handleContractSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Trabajador</label>
                                    <select required className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={contractForm.employeeId || ''} onChange={e => handleContractEmployeeChange(e.target.value)}>
                                        <option value="">-- Seleccionar --</option>
                                        {employees.filter(e => e.active).map(e => (
                                            <option key={e.id} value={e.id}>{e.fullName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Inicio</label>
                                        <input type="date" required className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={contractForm.startDate || ''} onChange={e => setContractForm({...contractForm, startDate: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Término</label>
                                        <input type="date" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={contractForm.endDate || ''} onChange={e => setContractForm({...contractForm, endDate: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo Contrato</label>
                                    <select className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={contractForm.type} onChange={e => setContractForm({...contractForm, type: e.target.value as any})}>
                                        <option value="INDEFINIDO">INDEFINIDO</option>
                                        <option value="PLAZO FIJO">PLAZO FIJO</option>
                                        <option value="POR FAENA">POR FAENA</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo</label>
                                    <input type="text" required placeholder="ej. Operario de Packing" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm placeholder-gray-400" value={contractForm.position || ''} onChange={e => setContractForm({...contractForm, position: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sueldo Base ($)</label>
                                    <input type="number" required className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm font-bold text-right" value={contractForm.baseSalary || ''} onChange={e => setContractForm({...contractForm, baseSalary: parseInt(e.target.value)})} />
                                </div>
                                
                                <div className="flex gap-2">
                                    <button type="button" onClick={handlePreviewContract} className="flex-1 bg-white text-amber-600 border border-amber-600 py-2 rounded-lg font-bold hover:bg-amber-50 shadow flex items-center justify-center gap-2">
                                        <Printer size={16}/> Previsualizar PDF
                                    </button>
                                    <button type="submit" className="flex-1 bg-amber-600 text-white py-2 rounded-lg font-bold hover:bg-amber-700 shadow flex items-center justify-center gap-2">
                                        <Save size={16}/> Generar Contrato
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b bg-gray-50 font-bold text-gray-700">Contratos Vigentes</div>
                            <div className="divide-y divide-gray-100">
                                {contracts.filter(c => c.active).map(c => {
                                    const emp = employees.find(e => e.id === c.employeeId);
                                    return (
                                        <div key={c.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                            <div>
                                                <h4 className="font-bold text-gray-800">{emp?.fullName || 'Desconocido'}</h4>
                                                <p className="text-xs text-gray-500">{c.type} • {c.position}</p>
                                                <p className="text-xs text-gray-400">Inicio: {new Date(c.startDate).toLocaleDateString()}</p>
                                            </div>
                                            <button onClick={() => handlePrintContract(c)} className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50" title="Imprimir Contrato">
                                                <Printer size={18}/>
                                            </button>
                                        </div>
                                    );
                                })}
                                {contracts.filter(c => c.active).length === 0 && <div className="p-8 text-center text-gray-400">No hay contratos activos.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LIQUIDACIONES TAB */}
            {activeTab === 'LIQUIDACIONES' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-purple-100">
                        <h3 className="text-xl font-bold text-purple-800 mb-6 flex items-center gap-2">
                            <DollarSign size={24}/> Calculadora de Liquidaciones
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empleado</label>
                                    <select className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg text-sm" value={payrollForm.employeeId} onChange={e => setPayrollForm({...payrollForm, employeeId: e.target.value})}>
                                        <option value="">-- Seleccionar --</option>
                                        {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mes Liquidación</label>
                                    <input 
                                        type="month" 
                                        className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg text-sm font-bold" 
                                        value={payrollForm.period} 
                                        onChange={e => setPayrollForm({...payrollForm, period: e.target.value})} 
                                    />
                                </div>
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sueldo Base (Manual)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg text-sm font-bold" 
                                        value={payrollForm.baseSalaryOverride || ''} 
                                        onChange={e => setPayrollForm({...payrollForm, baseSalaryOverride: parseInt(e.target.value) || 0})}
                                        placeholder="Auto/Manual"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Días Trabajados</label>
                                    <input type="number" max="30" className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg text-sm font-bold" value={payrollForm.workedDays} onChange={e => setPayrollForm({...payrollForm, workedDays: parseInt(e.target.value) || 0})} />
                                    <p className="text-[9px] text-gray-400 mt-1">* Autocalculado por Asistencia</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Horas Extras</label>
                                    <input type="number" className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg text-sm font-bold" value={payrollForm.overtimeHours} onChange={e => setPayrollForm({...payrollForm, overtimeHours: parseInt(e.target.value) || 0})} />
                                    <p className="text-[9px] text-gray-400 mt-1">* Suma Total Mes</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bonos Imponibles</label>
                                    <input type="number" className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg text-sm" value={payrollForm.bonusTaxable} onChange={e => setPayrollForm({...payrollForm, bonusTaxable: parseInt(e.target.value) || 0})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No Imponibles</label>
                                    <input type="number" className="w-full p-3 border border-gray-600 bg-black text-white rounded-lg text-sm" value={payrollForm.bonusNonTaxable} onChange={e => setPayrollForm({...payrollForm, bonusNonTaxable: parseInt(e.target.value) || 0})} />
                                </div>
                            </div>
                            
                            <button onClick={calculatePayroll} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow hover:bg-purple-700 mt-2">
                                Calcular
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                        <h4 className="font-bold text-gray-700 mb-4">Vista Previa Liquidación</h4>
                        {payrollPreview ? (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between border-b pb-1"><span>Sueldo Base ({payrollPreview.workedDays} días):</span> <span className="font-bold">${payrollPreview.baseSalaryCalculated.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b pb-1"><span>H. Extras ({payrollPreview.overtimeHours} hrs):</span> <span className="font-bold">${payrollPreview.overtimePay.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b pb-1"><span>Gratificación:</span> <span className="font-bold">${payrollPreview.gratification.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b pb-1"><span>Total Imponible:</span> <span className="font-bold">${payrollPreview.totalTaxable.toLocaleString()}</span></div>
                                <div className="flex justify-between text-red-600 border-b pb-1"><span>Descuentos (AFP/Salud/AFC):</span> <span>-${payrollPreview.totalDeductions.toLocaleString()}</span></div>
                                <div className="flex justify-between text-green-600 border-b pb-1"><span>No Imponibles:</span> <span>+${payrollPreview.bonusNonTaxable.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xl font-bold text-blue-800 mt-4 pt-2 border-t border-gray-300">
                                    <span>Líquido a Pagar:</span>
                                    <span>${payrollPreview.netPay.toLocaleString()}</span>
                                </div>
                                
                                <div className="flex gap-2 mt-6">
                                    <button onClick={handlePayrollSubmit} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 shadow flex items-center justify-center gap-2">
                                        <Save size={16}/> Guardar Registro
                                    </button>
                                    <button onClick={() => handlePrintPayroll(payrollPreview)} className="flex-1 bg-white text-purple-600 border border-purple-600 py-2 rounded-lg font-bold hover:bg-purple-50 shadow flex items-center justify-center gap-2">
                                        <Printer size={16}/> Generar PDF Oficial
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 py-10">
                                Ingrese datos y presione "Calcular" para ver el detalle.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* FINIQUITO TAB */}
            {activeTab === 'FINIQUITO' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100">
                        <h3 className="text-xl font-bold text-red-800 mb-6 flex items-center gap-2">
                            <UserMinus size={24}/> Cálculo de Finiquito
                        </h3>
                        <form onSubmit={handleSettlementSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empleado</label>
                                <select required className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={settlementForm.employeeId || ''} onChange={e => setSettlementForm({...settlementForm, employeeId: e.target.value})}>
                                    <option value="">-- Seleccionar --</option>
                                    {employees.filter(e => e.active).map(e => (
                                        <option key={e.id} value={e.id}>{e.fullName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Término</label>
                                    <input type="date" required className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={settlementForm.date || ''} onChange={e => setSettlementForm({...settlementForm, date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo</label>
                                    <select className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={settlementForm.reason} onChange={e => setSettlementForm({...settlementForm, reason: e.target.value})}>
                                        <option value="Renuncia Voluntaria">Renuncia Voluntaria</option>
                                        <option value="Necesidades de la Empresa">Necesidades de la Empresa</option>
                                        <option value="Término de Contrato">Término de Contrato</option>
                                        <option value="Mutuo Acuerdo">Mutuo Acuerdo</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Días Vacaciones Pendientes</label>
                                <input type="number" step="0.5" className="w-full p-2 border border-gray-600 bg-black text-white rounded-lg text-sm" value={settlementForm.vacationDays || ''} onChange={e => setSettlementForm({...settlementForm, vacationDays: parseFloat(e.target.value)})} />
                                <p className="text-[9px] text-gray-400 mt-1">* Autocalculado (1.25 días/mes)</p>
                            </div>

                            <button type="button" onClick={calculateSettlement} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow hover:bg-red-700 mt-2 flex items-center justify-center gap-2">
                                <Calculator size={18}/> Calcular Finiquito
                            </button>
                        </form>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                        <h4 className="font-bold text-gray-700 mb-4">Detalle del Cálculo</h4>
                        {settlementCalc ? (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between border-b pb-1"><span>Sueldo Pendiente ({settlementCalc.daysWorkedMonth} días):</span> <span className="font-bold">${settlementCalc.pendingSalary.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b pb-1"><span>Gratificación Pendiente:</span> <span className="font-bold">${settlementCalc.pendingGrat.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b pb-1 text-red-600"><span>Descuentos Legales (Mes):</span> <span>-${settlementCalc.deductions.toLocaleString()}</span></div>
                                <div className="flex justify-between border-b pb-1 bg-yellow-50 px-2"><span>Vacaciones Proporcionales:</span> <span className="font-bold text-amber-700">+${settlementCalc.vacationTotal.toLocaleString()}</span></div>
                                {settlementCalc.serviceIndemnity > 0 && (
                                    <div className="flex justify-between border-b pb-1 bg-green-50 px-2"><span>Indemnización Años Servicio:</span> <span className="font-bold text-green-700">+${settlementCalc.serviceIndemnity.toLocaleString()}</span></div>
                                )}
                                <div className="flex justify-between text-2xl font-black text-red-800 mt-4 pt-2 border-t-2 border-red-200">
                                    <span>TOTAL A PAGAR:</span>
                                    <span>${settlementCalc.totalAmount.toLocaleString()}</span>
                                </div>
                                <button onClick={handleSettlementSubmit} className="w-full bg-red-800 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-red-900 mt-6 flex items-center justify-center gap-2">
                                    <UserMinus size={18} /> Confirmar y Desvincular
                                </button>
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 py-10">
                                Ingrese fecha y motivo para calcular.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RRHHPage;
