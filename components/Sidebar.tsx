
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Truck, Package, Archive, Send, ClipboardList, FileBarChart, LayoutDashboard, Globe, Users, LogOut, Briefcase, Snowflake, Building2 } from 'lucide-react';
import { useApp } from '../store/AppContext';

const Sidebar: React.FC = () => {
    const { currentUser, logout, checkPermission, activeWorkCenter, switchWorkCenter } = useApp();
    const location = useLocation();
    const navigate = useNavigate();
    
    const isActive = (path: string) => location.pathname === path ? "bg-primary text-white shadow-md" : "text-gray-600 hover:bg-green-50 hover:text-primary";

    const navItems = [
        { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} />, permission: null }, // Always visible if logged in
        { path: '/reception', label: 'Recepción', icon: <Truck size={20} />, permission: 'view_reception' },
        { path: '/process', label: 'Proceso', icon: <Package size={20} />, permission: 'view_process' },
        { path: '/stock', label: 'Paletizar', icon: <ClipboardList size={20} />, permission: 'view_stock' },
        { path: '/inventory', label: 'Insumos (FIFO)', icon: <Archive size={20} />, permission: 'view_inventory' },
        { path: '/dispatch', label: 'Despacho', icon: <Send size={20} />, permission: 'view_dispatch' },
        { path: '/iqf-management', label: 'Descarte IQF', icon: <Snowflake size={20} />, permission: 'view_process' },
        { path: '/rrhh', label: 'RRHH', icon: <Briefcase size={20} />, permission: 'view_rrhh' },
        { path: '/reports', label: 'REPORTES', icon: <FileBarChart size={20} />, permission: 'view_reports' },
        { path: '/users', label: 'Usuarios', icon: <Users size={20} />, permission: 'manage_users' },
        
        // External Link (Always visible or add permission if needed)
        { path: 'https://www.riodonguil.cl', label: 'Sitio Web', icon: <Globe size={20} />, isExternal: true, permission: null },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const WORK_CENTERS = [
        'TODOS (ACCESO TOTAL)',
        'RIO DONGUIL LOS NOGALES',
        'RIO DONGUIL LOS CASTAÑOS',
        'RIO DONGUIL ZARZA PARRILLA'
    ];

    return (
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-full">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                {/* Blueberry Logo Icon */}
                <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-md flex-shrink-0 relative overflow-hidden group">
                    {/* Realistic Blueberry SVG */}
                     <svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <radialGradient id="berryGradient" cx="30%" cy="30%" r="70%">
                                <stop offset="0%" stopColor="#60a5fa" /> {/* Light Blue highlight */}
                                <stop offset="50%" stopColor="#2563eb" /> {/* Blue body */}
                                <stop offset="100%" stopColor="#1e3a8a" /> {/* Dark Blue shadow */}
                            </radialGradient>
                             <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="2" result="blur"/>
                                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                            </filter>
                        </defs>
                        
                        {/* Berry Body */}
                        <circle cx="50" cy="55" r="45" fill="url(#berryGradient)" />
                        
                        {/* Bloom / Waxy coating texture (Subtle noise simulation via dots) */}
                        <circle cx="35" cy="40" r="5" fill="white" opacity="0.2" filter="url(#glow)" />
                        
                        {/* Crown (The star shape at the top) */}
                        <path d="M35 20 L50 35 L65 20 L58 40 L75 50 L55 55 L50 75 L45 55 L25 50 L42 40 Z" fill="#1e1b4b" opacity="0.4" /> 
                        <path d="M35 15 L50 30 L65 15" fill="none" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-lg font-extrabold text-gray-900 tracking-tight leading-tight">Rio Donguil</h1>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Agroindustrial</p>
                </div>
            </div>

            {/* Admin Work Center Switcher */}
            {currentUser?.role === 'ADMIN' && (
                <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/30">
                     <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                        <Building2 size={10} /> Centro de Trabajo Activo
                     </label>
                     <select 
                        value={activeWorkCenter}
                        onChange={(e) => switchWorkCenter(e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-lg bg-white font-bold text-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                        {WORK_CENTERS.map(center => (
                            <option key={center} value={center}>{center}</option>
                        ))}
                    </select>
                </div>
            )}
            
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                {navItems.map((item) => {
                    // Check Permission
                    if (item.permission && !checkPermission(item.permission)) {
                        return null;
                    }

                    return item.isExternal ? (
                        <a
                            key={item.path}
                            href={item.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium text-gray-600 hover:bg-green-50 hover:text-primary hover:translate-x-1"
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </a>
                    ) : (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium ${isActive(item.path)} hover:translate-x-1`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
            </nav>
            
            {/* User Profile Footer */}
            {currentUser && (
                <div className="p-4 border-t border-gray-200 bg-gray-50/50">
                    <div className="flex items-center gap-3 mb-3 px-2">
                        <div className="w-9 h-9 bg-gradient-to-br from-primary to-green-700 text-white rounded-full flex items-center justify-center font-bold shadow-sm">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
                                {currentUser.role === 'ADMIN' ? 'Administrador' : 'Operador'}
                            </p>
                            <p className="text-[9px] text-blue-600 font-bold truncate mt-0.5">
                                {activeWorkCenter === 'TODOS (ACCESO TOTAL)' ? 'VISTA GLOBAL' : activeWorkCenter.replace('RIO DONGUIL', '')}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 py-2.5 rounded-lg transition-all border border-transparent hover:border-red-100"
                    >
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
