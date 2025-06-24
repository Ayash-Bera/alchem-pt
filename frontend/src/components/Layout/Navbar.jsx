import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

const Navbar = () => {
    const location = useLocation();

    return (
        <nav className="glass sticky top-0 z-50 border-b border-white/10 backdrop-blur-lg">
            <div className="container mx-auto px-6 py-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center shadow-xl">
                            <Sparkles className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Alchemyst Platform</h1>
                            <p className="text-xs text-gray-400">AI Research Assistant</p>
                        </div>
                    </div>

                    <div className="flex space-x-1 bg-white/5 rounded-2xl p-1 backdrop-blur-sm">
                        <Link
                            to="/research"
                            className={`px-8 py-3 rounded-xl transition-all font-semibold text-sm ${location.pathname === '/research'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-300 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            Research
                        </Link>
                        <Link
                            to="/dashboard"
                            className={`px-8 py-3 rounded-xl transition-all font-semibold text-sm ${location.pathname === '/dashboard'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-300 hover:text-white hover:bg-white/10'
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