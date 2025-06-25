import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

const Navbar = () => {
    const location = useLocation();

    return (
        <nav className="glass sticky top-0 z-50 border-b border-white/10 backdrop-blur-lg">
            <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
                <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                    {/* Logo and Brand Section */}
                    <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 glass rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl">
                            <Sparkles className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="text-center sm:text-left">
                            <h1 className="text-lg sm:text-2xl font-bold text-white">Alchemyst Platform</h1>
                            <p className="text-xs text-gray-400 hidden sm:block">AI Research Assistant</p>
                        </div>
                    </div>

                    {/* Navigation Section */}
                    <div className="flex space-x-1 bg-white/5 rounded-xl sm:rounded-2xl p-1 backdrop-blur-sm w-full sm:w-auto">
                        <Link
                            to="/research"
                            className={`flex-1 sm:flex-none px-4 sm:px-8 py-3 rounded-lg sm:rounded-xl transition-all font-semibold text-sm text-center ${location.pathname === '/research'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            Research
                        </Link>
                        <Link
                            to="/dashboard"
                            className={`flex-1 sm:flex-none px-4 sm:px-8 py-3 rounded-lg sm:rounded-xl transition-all font-semibold text-sm text-center ${location.pathname === '/dashboard'
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