
import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { User, UserRole } from '../types';
import { Trash2, UserPlus, Shield, Key, User as UserIcon, Mail, Edit, X, CheckSquare, Square, Building2, AlertTriangle, RefreshCcw, Database } from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
    { key: 'view_reception', label: 'Acceso Recepción' },
    { key: 'view_process', label: 'Acceso Proceso & Loteo' },
    { key: 'view_stock', label: 'Acceso Stock P. Terminado' },
    { key: 'view_inventory', label: 'Acceso Insumos' },
    { key: 'view_dispatch', label: 'Acceso Despacho' },
    { key: 'view_reports', label: 'Acceso Reportes' },
    { key: 'view_rrhh', label: 'Acceso RRHH' },
    { key: 'manage_users', label: 'Gestionar Usuarios (Admin)' },
];

const WORK_CENTERS = [
    'TODOS (ACCESO TOTAL)',
    'RIO DONGUIL LOS NOGALES',
    'RIO DONGUIL LOS CASTAÑOS',
    'RIO DONGUIL ZARZA PARRILLA'
];

const UsersPage: React.FC = () => {
    const { users, addUser, updateUser, deleteUser, currentUser, resetModuleData, activeWorkCenter } = useApp();
    
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<User>>({
        id: '',
        username: '',
        password: '',
        name: '',
        email: '',
        role: 'OPERATOR',
        workCenter: WORK_CENTERS[1], // Default to first specific center
        permissions: []
    });

    // Reset Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        step: 1 | 2;
        moduleKey: 'receptions' | 'lots' | 'inventory' | 'dispatches' | 'rrhh' | 'all' | null;
        label: string;
    }>({ isOpen: false, step: 1, moduleKey: null, label: '' });

    const resetForm = () => {
        setFormData({
            id: '',
            username: '',
            password: '',
            name: '',
            email: '',
            role: 'OPERATOR',
            workCenter: WORK_CENTERS[1],
            permissions: []
        });
        setIsEditing(false);
    };

    const handleEdit = (user: User) => {
        setFormData({ ...user, workCenter: user.workCenter || WORK_CENTERS[1] });
        setIsEditing(true);
    };

    const togglePermission = (key: string) => {
        setFormData(prev => {
            const current = prev.permissions || [];
            if (current.includes(key)) {
                return { ...prev, permissions: current.filter(k => k !== key) };
            } else {
                return { ...prev, permissions: [...current, key] };
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.username && formData.password && formData.name) {
            if (isEditing && formData.id) {
                // Update
                updateUser(formData as User);
                alert("Usuario actualizado correctamente");
            } else {
                // Create
                const userToAdd: User = {
                    id: `usr-${Date.now()}`,
                    username: formData.username!,
                    password: formData.password!,
                    name: formData.name!,
                    email: formData.email,
                    role: formData.role as UserRole,
                    workCenter: formData.workCenter,
                    permissions: formData.permissions || []
                };
                addUser(userToAdd);
                alert("Usuario creado correctamente");
            }
            resetForm();
        }
    };

    // --- RESET LOGIC ---
    const initiateReset = (moduleKey: 'receptions' | 'lots' | 'inventory' | 'dispatches' | 'rrhh' | 'all', label: string) => {
        setConfirmModal({ isOpen: true, step: 1, moduleKey, label });
    };

    const proceedReset = () => {
        if (confirmModal.step === 1) {
            setConfirmModal(prev => ({ ...prev, step: 2 }));
        } else {
            if (confirmModal.moduleKey) {
                resetModuleData(confirmModal.moduleKey);
                alert(`Registros de ${confirmModal.label} eliminados exitosamente para el centro: ${activeWorkCenter}.`);
            }
            setConfirmModal({ isOpen: false, step: 1, moduleKey: null, label: '' });
        }
    };

    const cancelReset = () => {
        setConfirmModal({ isOpen: false, step: 1, moduleKey: null, label: '' });
    };

    if (currentUser?.role !== 'ADMIN') {
        return (
            <div className="p-8 text-center text-gray-500">
                <Shield size={48} className="mx-auto mb-4 text-gray-300"/>
                <h2 className="text-xl font-bold text-gray-700">Acceso Restringido</h2>
                <p>Solo los administradores pueden gestionar usuarios.</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
             <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h1>
                <p className="text-gray-500">Administración de cuentas de acceso, roles y permisos detallados.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* FORM */}
                <div className="md:col-span-1">
                    <div className={`p-6 rounded-2xl shadow-lg border sticky top-8 transition-colors ${isEditing ? 'bg-amber-50 border-amber-100' : 'bg-white border-blue-100'}`}>
                        <div className={`flex items-center gap-2 mb-6 ${isEditing ? 'text-amber-800' : 'text-blue-800'}`}>
                            <div className={`p-2 rounded-lg ${isEditing ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                {isEditing ? <Edit size={20}/> : <UserPlus size={20}/>}
                            </div>
                            <h2 className="text-lg font-bold">{isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h2>
                            {isEditing && (
                                <button onClick={resetForm} className="ml-auto text-gray-400 hover:text-gray-600">
                                    <X size={20}/>
                                </button>
                            )}
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
                                <div className="relative">
                                    <UserIcon size={16} className="absolute left-3 top-3 text-gray-400" />
                                    <input 
                                        type="text" required
                                        className="w-full pl-9 p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                        placeholder="ej. Juan Pérez"
                                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                            </div>

                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo (Recuperación)</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                                    <input 
                                        type="email"
                                        className="w-full pl-9 p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                        placeholder="correo@empresa.cl"
                                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Centro de Trabajo</label>
                                <div className="relative">
                                    <Building2 size={16} className="absolute left-3 top-3 text-gray-400" />
                                    <select 
                                        className="w-full pl-9 p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 appearance-none"
                                        value={formData.workCenter} onChange={e => setFormData({...formData, workCenter: e.target.value})}
                                    >
                                        {WORK_CENTERS.map(center => (
                                            <option key={center} value={center}>{center}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Usuario</label>
                                    <input 
                                        type="text" required
                                        className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                        placeholder="jperez"
                                        value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña</label>
                                    <div className="relative">
                                        <input 
                                            type="text" required
                                            className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                            placeholder="Clave"
                                            value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol Principal</label>
                                <select 
                                    className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                    value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                                >
                                    <option value="OPERATOR">Operador (Personalizado)</option>
                                    <option value="ADMIN">Administrador (Acceso Total)</option>
                                </select>
                            </div>
                            
                            {formData.role === 'OPERATOR' && (
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Permisos de Acceso</label>
                                    <div className="space-y-2">
                                        {AVAILABLE_PERMISSIONS.map(perm => (
                                            <label key={perm.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                <div 
                                                    className={`w-4 h-4 border rounded flex items-center justify-center ${formData.permissions?.includes(perm.key) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}
                                                    onClick={(e) => { e.preventDefault(); togglePermission(perm.key); }}
                                                >
                                                    {formData.permissions?.includes(perm.key) && <CheckSquare size={12} className="text-white" />}
                                                </div>
                                                <span className="text-xs text-gray-700">{perm.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button type="submit" className={`w-full text-white py-3 rounded-xl font-bold transition shadow-md mt-2 ${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                {isEditing ? 'Guardar Cambios' : 'Registrar Usuario'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* USERS LIST & SYSTEM MAINTENANCE */}
                <div className="md:col-span-2 space-y-8">
                    
                    {/* Users List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">Usuarios del Sistema</h3>
                            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">{users.length} Activos</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {users.map(u => (
                                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${u.role === 'ADMIN' ? 'bg-primary' : 'bg-gray-400'}`}>
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-800">{u.name}</h4>
                                            {u.workCenter && (
                                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                                    <Building2 size={12} /> {u.workCenter}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="font-mono">@{u.username}</span>
                                                <span className={`px-1.5 py-0.5 rounded ${u.role === 'ADMIN' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {u.role === 'ADMIN' ? 'Administrador' : 'Operador'}
                                                </span>
                                            </div>
                                            {u.role === 'OPERATOR' && u.permissions && u.permissions.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {u.permissions.slice(0,3).map(p => (
                                                        <span key={p} className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded border border-gray-200">
                                                            {AVAILABLE_PERMISSIONS.find(ap => ap.key === p)?.label.split(' ')[1] || p}
                                                        </span>
                                                    ))}
                                                    {u.permissions.length > 3 && <span className="text-[10px] text-gray-400">+{u.permissions.length - 3}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleEdit(u)}
                                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                            title="Editar Usuario"
                                        >
                                            <Edit size={18} />
                                        </button>

                                        {/* Can't delete yourself or the main admin hardcoded */}
                                        {currentUser?.id !== u.id && u.id !== 'admin-01' && (
                                            <button 
                                                onClick={() => {
                                                    if(window.confirm(`¿Eliminar usuario ${u.name}?`)) deleteUser(u.id);
                                                }}
                                                className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                                title="Eliminar Usuario"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SYSTEM MAINTENANCE / RESET ZONE */}
                    <div className="bg-red-50 rounded-2xl shadow-inner border border-red-200 overflow-hidden">
                        <div className="p-4 border-b border-red-200 bg-red-100 flex items-center gap-2">
                            <AlertTriangle size={20} className="text-red-600" />
                            <h3 className="font-bold text-red-800">Mantenimiento de Datos (Zona de Peligro)</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-red-700 mb-4 font-medium">
                                Centro Activo: <span className="font-bold underline">{activeWorkCenter}</span>. 
                                Las acciones de borrado afectarán únicamente a este centro (salvo si es "TODOS", donde se borrará todo).
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => initiateReset('receptions', 'RECEPCIONES')}
                                    className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 text-red-700 transition-colors group"
                                >
                                    <span className="flex items-center gap-2 font-bold text-sm"><RefreshCcw size={16}/> Reset Recepciones</span>
                                    <span className="text-xs bg-red-50 px-2 py-1 rounded group-hover:bg-white">Borra MP</span>
                                </button>

                                <button 
                                    onClick={() => initiateReset('lots', 'PROCESO Y LOTES')}
                                    className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 text-red-700 transition-colors group"
                                >
                                    <span className="flex items-center gap-2 font-bold text-sm"><RefreshCcw size={16}/> Reset Proceso/Lotes</span>
                                    <span className="text-xs bg-red-50 px-2 py-1 rounded group-hover:bg-white">Borra PT</span>
                                </button>

                                <button 
                                    onClick={() => initiateReset('inventory', 'INVENTARIO DE INSUMOS')}
                                    className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 text-red-700 transition-colors group"
                                >
                                    <span className="flex items-center gap-2 font-bold text-sm"><RefreshCcw size={16}/> Reset Insumos</span>
                                    <span className="text-xs bg-red-50 px-2 py-1 rounded group-hover:bg-white">Borra Materiales</span>
                                </button>

                                <button 
                                    onClick={() => initiateReset('dispatches', 'DESPACHOS')}
                                    className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 text-red-700 transition-colors group"
                                >
                                    <span className="flex items-center gap-2 font-bold text-sm"><RefreshCcw size={16}/> Reset Despachos</span>
                                    <span className="text-xs bg-red-50 px-2 py-1 rounded group-hover:bg-white">Borra Historial</span>
                                </button>

                                <button 
                                    onClick={() => initiateReset('rrhh', 'RECURSOS HUMANOS')}
                                    className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 text-red-700 transition-colors group"
                                >
                                    <span className="flex items-center gap-2 font-bold text-sm"><RefreshCcw size={16}/> Reset RRHH</span>
                                    <span className="text-xs bg-red-50 px-2 py-1 rounded group-hover:bg-white">Borra Personal</span>
                                </button>
                            </div>

                            <div className="mt-6 pt-4 border-t border-red-200">
                                <button 
                                    onClick={() => initiateReset('all', 'TODO EL SISTEMA')}
                                    className="w-full flex items-center justify-center gap-2 p-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg transition-transform active:scale-95"
                                >
                                    <Database size={20} /> RESETEAR TODO EL SISTEMA (CENTRO ACTUAL)
                                </button>
                                <p className="text-center text-[10px] text-red-500 mt-2 uppercase font-bold">
                                    * Los usuarios y cuentas de acceso NO serán eliminados.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONFIRMATION MODAL */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in border-2 border-red-500 relative overflow-hidden">
                        {/* Background warning pattern */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                        
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-red-100 p-4 rounded-full text-red-600 mb-4 animate-bounce">
                                <AlertTriangle size={32} />
                            </div>
                            
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                {confirmModal.step === 1 ? '¿Estás seguro?' : '¡Última Advertencia!'}
                            </h3>
                            
                            <p className="text-gray-600 mb-2 font-medium">
                                {confirmModal.step === 1 
                                    ? `Estás a punto de eliminar los registros de ${confirmModal.label} para el centro:`
                                    : `Esta acción es IRREVERSIBLE. Se borrarán los datos seleccionados.`
                                }
                            </p>
                            
                            <p className="text-red-600 font-bold mb-6 bg-red-50 px-3 py-1 rounded">
                                {activeWorkCenter}
                            </p>

                            <div className="flex gap-3 w-full">
                                <button onClick={cancelReset} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                                    Cancelar
                                </button>
                                <button onClick={proceedReset} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg transition-all">
                                    {confirmModal.step === 1 ? 'Sí, continuar' : 'BORRAR DEFINITIVAMENTE'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;
