
import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, Key, User, Mail, ArrowLeft, Building2, ChevronDown } from 'lucide-react';
import { APP_NAME } from '../constants';

const LoginPage: React.FC = () => {
    const { login, recoverPassword } = useApp();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedCenter, setSelectedCenter] = useState('RIO DONGUIL LOS NOGALES');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    
    // Recovery State
    const [showRecovery, setShowRecovery] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [recoveryMsg, setRecoveryMsg] = useState('');

    // Load saved username on mount
    useEffect(() => {
        const savedUsername = localStorage.getItem('remembered_username');
        if (savedUsername) {
            setUsername(savedUsername);
            setRememberMe(true);
        }
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (login(username, password)) {
            // Handle Remember Me
            if (rememberMe) {
                localStorage.setItem('remembered_username', username);
            } else {
                localStorage.removeItem('remembered_username');
            }

            // Optionally save selected center to local storage
            localStorage.setItem('selectedWorkCenter', selectedCenter);
            navigate('/');
        } else {
            setError('Usuario o contraseña incorrectos');
        }
    };

    const handleRecovery = (e: React.FormEvent) => {
        e.preventDefault();
        const success = recoverPassword(recoveryEmail);
        if (success) {
            setRecoveryMsg(`Se ha enviado un enlace de recuperación a ${recoveryEmail}`);
            setTimeout(() => {
                setShowRecovery(false);
                setRecoveryMsg('');
                setRecoveryEmail('');
            }, 4000);
        } else {
            setError('No se encontró un usuario con ese correo electrónico.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 relative">
                
                {/* Decorative Header */}
                <div className="bg-primary p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 10%)', backgroundSize: '10px 10px' }}></div>
                    <div className="relative z-10">
                         {/* Blueberry Logo SVG */}
                        <div className="mx-auto mb-3 w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                            <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <radialGradient id="berryGradientLogin" cx="30%" cy="30%" r="70%">
                                        <stop offset="0%" stopColor="#60a5fa" />
                                        <stop offset="50%" stopColor="#2563eb" />
                                        <stop offset="100%" stopColor="#1e3a8a" />
                                    </radialGradient>
                                </defs>
                                <circle cx="50" cy="55" r="45" fill="url(#berryGradientLogin)" />
                                <circle cx="35" cy="40" r="5" fill="white" opacity="0.2" />
                                <path d="M35 20 L50 35 L65 20 L58 40 L75 50 L55 55 L50 75 L45 55 L25 50 L42 40 Z" fill="#1e1b4b" opacity="0.4" /> 
                                <path d="M35 15 L50 30 L65 15" fill="none" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{APP_NAME}</h1>
                        <p className="text-green-100 text-sm font-medium">Acceso Seguro al Sistema</p>
                    </div>
                </div>

                <div className="p-8">
                    {!showRecovery ? (
                        <form onSubmit={handleLogin} className="space-y-5">
                            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs text-center font-bold border border-red-100">{error}</div>}
                            
                            {/* Work Center Dropdown */}
                            <div>
                                <label className="block text-xs font-bold text-gray-800 uppercase mb-1 ml-1">Centro de Trabajo</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Building2 size={18} className="text-gray-400" />
                                    </div>
                                    <select 
                                        className="w-full pl-10 pr-10 p-3 border border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm appearance-none bg-gray-700 text-white font-bold cursor-pointer"
                                        value={selectedCenter}
                                        onChange={e => setSelectedCenter(e.target.value)}
                                    >
                                        <option value="RIO DONGUIL LOS NOGALES">RIO DONGUIL LOS NOGALES</option>
                                        <option value="RIO DONGUIL LOS CASTAÑOS">RIO DONGUIL LOS CASTAÑOS</option>
                                        <option value="RIO DONGUIL ZARZA PARRILLA">RIO DONGUIL ZARZA PARRILLA</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <ChevronDown size={16} className="text-gray-400" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-800 uppercase mb-1 ml-1">Usuario</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User size={18} className="text-gray-400" />
                                    </div>
                                    <input 
                                        type="text" 
                                        className="w-full pl-10 p-3 border border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm bg-gray-700 text-white placeholder-gray-400"
                                        placeholder="Nombre de usuario"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        autoFocus={!username}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-800 uppercase mb-1 ml-1">Contraseña</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key size={18} className="text-gray-400" />
                                    </div>
                                    <input 
                                        type="password" 
                                        className="w-full pl-10 p-3 border border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm bg-gray-700 text-white placeholder-gray-400"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Remember Me Checkbox */}
                            <div className="flex items-center ml-1">
                                <input 
                                    id="remember_me" 
                                    type="checkbox" 
                                    className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2 cursor-pointer"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <label htmlFor="remember_me" className="ml-2 text-sm text-gray-600 cursor-pointer font-medium select-none">
                                    Recordar usuario
                                </label>
                            </div>

                            <button 
                                type="submit" 
                                className="w-full bg-primary text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-green-800 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                            >
                                <LogIn size={20} /> Iniciar Sesión
                            </button>

                            <div className="text-center">
                                <button 
                                    type="button"
                                    onClick={() => { setShowRecovery(true); setError(''); setRecoveryMsg(''); }}
                                    className="text-sm text-gray-400 hover:text-primary font-medium transition-colors"
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>
                        </form>
                    ) : (
                        // RECOVERY FORM
                        <form onSubmit={handleRecovery} className="space-y-5 animate-fade-in">
                             {recoveryMsg ? (
                                <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm text-center font-medium border border-green-100">
                                    {recoveryMsg}
                                </div>
                             ) : (
                                 <>
                                    <div className="text-center mb-4">
                                        <h3 className="text-gray-800 font-bold">Recuperar Contraseña</h3>
                                        <p className="text-xs text-gray-500 mt-1">Ingresa el correo electrónico asociado a tu cuenta.</p>
                                    </div>

                                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs text-center font-bold border border-red-100">{error}</div>}

                                    <div>
                                        <label className="block text-xs font-bold text-gray-800 uppercase mb-1 ml-1">Correo Electrónico</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail size={18} className="text-gray-400" />
                                            </div>
                                            <input 
                                                type="email" 
                                                required
                                                className="w-full pl-10 p-3 border border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm bg-gray-700 text-white placeholder-gray-400"
                                                placeholder="ejemplo@riodonguil.cl"
                                                value={recoveryEmail}
                                                onChange={e => setRecoveryEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                                    >
                                        Enviar Solicitud
                                    </button>
                                 </>
                             )}
                             
                             <div className="text-center pt-2">
                                <button 
                                    type="button"
                                    onClick={() => { setShowRecovery(false); setError(''); }}
                                    className="text-sm text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1 mx-auto"
                                >
                                    <ArrowLeft size={14} /> Volver al Login
                                </button>
                            </div>
                        </form>
                    )}
                </div>
                
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">© 2025 {APP_NAME} - Gestión de Planta</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
