import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
    const location = useLocation();

    return (
        <nav className="glass sticky top-0 z-50 border-b border-white/10">
            <div className="container mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-lg">A</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white">Alchemyst Platform</h1>
                    </div>

                    <div className="flex space-x-2">
                        <Link
                            to="/research"
                            className={`px-6 py-3 rounded-xl transition-all font-semibold ${location.pathname === '/research'
                                ? 'glass-strong text-white shadow-lg'
                                : 'text-gray-300 hover:text-white hover:glass'
                                }`}
                        >
                            Research
                        </Link>
                        <Link
                            to="/dashboard"
                            className={`px-6 py-3 rounded-xl transition-all font-semibold ${location.pathname === '/dashboard'
                                ? 'glass-strong text-white shadow-lg'
                                : 'text-gray-300 hover:text-white hover:glass'
                                }`}
                        >
                            Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;