import React from 'react';
import {
    Activity,
    DollarSign,
    Clock,
    Zap,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    PlayCircle,
    Users,
    Target,
    Award
} from 'lucide-react';

const MetricsCards = ({ metrics = {} }) => {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 4,
            maximumFractionDigits: 6
        }).format(amount || 0);
    };

    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return new Intl.NumberFormat('en-US').format(num || 0);
    };

    const formatDuration = (ms) => {
        if (!ms) return '0s';
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    };

    const calculateSuccessRate = (completed, total) => {
        if (!total) return 0;
        return ((completed / total) * 100).toFixed(1);
    };

    const getChangeIndicator = (change) => {
        if (!change) return null;
        const isPositive = change.startsWith('+');
        const isNegative = change.startsWith('-');

        if (isPositive) {
            return {
                icon: TrendingUp,
                color: 'text-green-400 bg-green-500/20',
                text: change
            };
        } else if (isNegative) {
            return {
                icon: TrendingDown,
                color: 'text-red-400 bg-red-500/20',
                text: change
            };
        }
        return null;
    };

    const successRate = calculateSuccessRate(metrics.completedJobs, metrics.totalJobs);
    const efficiency = metrics.totalTokens && metrics.totalCost
        ? (metrics.totalTokens / metrics.totalCost).toFixed(0)
        : 0;

    const cards = [
        {
            title: 'Total Jobs',
            value: formatNumber(metrics.totalJobs),
            icon: Activity,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20',
            gradient: 'from-blue-500 to-cyan-500',
            change: metrics.jobsChange || null,
            subtitle: 'All time',
            trend: 'up'
        },
        {
            title: 'Active Jobs',
            value: formatNumber(metrics.runningJobs),
            icon: PlayCircle,
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/20',
            gradient: 'from-amber-500 to-orange-500',
            subtitle: 'Currently running',
            pulse: metrics.runningJobs > 0
        },
        {
            title: 'Success Rate',
            value: `${successRate}%`,
            icon: successRate >= 90 ? Award : Target,
            color: successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400',
            bgColor: successRate >= 90 ? 'bg-green-500/20' : successRate >= 70 ? 'bg-yellow-500/20' : 'bg-red-500/20',
            gradient: successRate >= 90 ? 'from-green-500 to-emerald-500' : successRate >= 70 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-pink-500',
            subtitle: `${metrics.completedJobs || 0} completed`,
            badge: successRate >= 95 ? 'Excellent' : successRate >= 85 ? 'Good' : 'Needs Attention'
        },
        {
            title: 'Failed Jobs',
            value: formatNumber(metrics.failedJobs),
            icon: AlertTriangle,
            color: 'text-red-400',
            bgColor: 'bg-red-500/20',
            gradient: 'from-red-500 to-pink-500',
            subtitle: 'Need attention',
            warning: metrics.failedJobs > 0
        },
        {
            title: 'Total Cost',
            value: formatCurrency(metrics.totalCost),
            icon: DollarSign,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/20',
            gradient: 'from-emerald-500 to-green-500',
            change: metrics.costChange || null,
            subtitle: '24h period',
            trend: 'cost'
        },
        {
            title: 'Avg Duration',
            value: formatDuration(metrics.avgDuration),
            icon: Clock,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/20',
            gradient: 'from-purple-500 to-violet-500',
            subtitle: 'Per job completion',
            benchmark: metrics.avgDuration < 300000 ? 'Fast' : metrics.avgDuration < 600000 ? 'Normal' : 'Slow'
        },
        {
            title: 'Total Tokens',
            value: formatNumber(metrics.totalTokens),
            icon: Zap,
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/20',
            gradient: 'from-orange-500 to-red-500',
            change: metrics.tokensChange || null,
            subtitle: 'Processing power'
        },
        {
            title: 'Efficiency',
            value: `${efficiency} T/$`,
            icon: TrendingUp,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/20',
            gradient: 'from-cyan-500 to-blue-500',
            subtitle: 'Tokens per dollar',
            badge: efficiency > 1000 ? 'High' : efficiency > 500 ? 'Medium' : 'Low'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {cards.map((card, index) => {
                const Icon = card.icon;
                const changeIndicator = getChangeIndicator(card.change);
                const ChangeIcon = changeIndicator?.icon;

                return (
                    <div
                        key={index}
                        className="glass p-6 rounded-2xl hover:scale-105 transition-all duration-300 group relative overflow-hidden"
                    >
                        {/* Background gradient effect */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                        {/* Header with icon and badge/change */}
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className={`p-3 rounded-xl ${card.bgColor} relative`}>
                                <Icon className={`w-6 h-6 ${card.color} ${card.pulse ? 'animate-pulse' : ''}`} />
                                {card.warning && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                )}
                            </div>

                            <div className="flex flex-col items-end space-y-1">
                                {changeIndicator && (
                                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${changeIndicator.color}`}>
                                        <ChangeIcon className="w-3 h-3" />
                                        <span>{changeIndicator.text}</span>
                                    </div>
                                )}

                                {card.badge && (
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${card.badge === 'Excellent' || card.badge === 'High' ? 'text-green-400 bg-green-500/20' :
                                            card.badge === 'Good' || card.badge === 'Medium' ? 'text-yellow-400 bg-yellow-500/20' :
                                                'text-red-400 bg-red-500/20'
                                        }`}>
                                        {card.badge}
                                    </span>
                                )}

                                {card.benchmark && (
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${card.benchmark === 'Fast' ? 'text-green-400 bg-green-500/20' :
                                            card.benchmark === 'Normal' ? 'text-blue-400 bg-blue-500/20' :
                                                'text-orange-400 bg-orange-500/20'
                                        }`}>
                                        {card.benchmark}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Main content */}
                        <div className="relative z-10">
                            <div className="mb-2">
                                <h3 className="text-3xl font-bold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 group-hover:bg-clip-text transition-all duration-300">
                                    {card.value}
                                </h3>
                            </div>

                            <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                    {card.title}
                                </p>

                                {card.subtitle && (
                                    <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                                        {card.subtitle}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Progress bar for success rate */}
                        {card.title === 'Success Rate' && (
                            <div className="mt-3 relative z-10">
                                <div className="w-full bg-gray-700 rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full transition-all duration-500 bg-gradient-to-r ${card.gradient}`}
                                        style={{ width: `${successRate}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Hover glow effect */}
                        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur-xl`} />
                    </div>
                );
            })}
        </div>
    );
};

export default MetricsCards;