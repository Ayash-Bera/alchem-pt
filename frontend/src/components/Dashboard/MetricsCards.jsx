import React from 'react';
import {
    Activity,
    DollarSign,
    Clock,
    Zap,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    PlayCircle
} from 'lucide-react';

const MetricsCards = ({ metrics = {} }) => {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 4
        }).format(amount || 0);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-US').format(num || 0);
    };

    const calculateSuccessRate = (completed, total) => {
        if (!total) return 0;
        return ((completed / total) * 100).toFixed(1);
    };

    const cards = [
        {
            title: 'Total Jobs',
            value: formatNumber(metrics.totalJobs),
            icon: Activity,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20',
            change: metrics.jobsChange || '+0%'
        },
        {
            title: 'Running Jobs',
            value: formatNumber(metrics.runningJobs),
            icon: PlayCircle,
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/20',
            subtitle: 'Currently active'
        },
        {
            title: 'Success Rate',
            value: `${calculateSuccessRate(metrics.completedJobs, metrics.totalJobs)}%`,
            icon: CheckCircle,
            color: 'text-green-400',
            bgColor: 'bg-green-500/20',
            subtitle: `${metrics.completedJobs || 0} completed`
        },
        {
            title: 'Failed Jobs',
            value: formatNumber(metrics.failedJobs),
            icon: AlertTriangle,
            color: 'text-red-400',
            bgColor: 'bg-red-500/20',
            subtitle: 'Need attention'
        },
        {
            title: 'Total Cost',
            value: formatCurrency(metrics.totalCost),
            icon: DollarSign,
            color: 'text-green-400',
            bgColor: 'bg-green-500/20',
            change: metrics.costChange || '+0%',
            subtitle: '24h period'
        },
        {
            title: 'Avg Duration',
            value: `${Math.round(metrics.avgDuration / 1000 / 60) || 0}m`,
            icon: Clock,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/20',
            subtitle: 'Per job'
        },
        {
            title: 'Total Tokens',
            value: formatNumber(metrics.totalTokens),
            icon: Zap,
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/20',
            change: metrics.tokensChange || '+0%'
        },
        {
            title: 'Cost/Token',
            value: `$${(metrics.costPerToken || 0).toFixed(6)}`,
            icon: TrendingUp,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/20',
            subtitle: 'Efficiency'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, index) => {
                const Icon = card.icon;

                return (
                    <div key={index} className="glass p-6 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-lg ${card.bgColor}`}>
                                <Icon className={`w-6 h-6 ${card.color}`} />
                            </div>
                            {card.change && (
                                <span className={`text-xs px-2 py-1 rounded ${card.change.startsWith('+') ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'
                                    }`}>
                                    {card.change}
                                </span>
                            )}
                        </div>

                        <div>
                            <h3 className="text-2xl font-bold text-white mb-1">
                                {card.value}
                            </h3>
                            <p className="text-sm text-gray-400 mb-1">
                                {card.title}
                            </p>
                            {card.subtitle && (
                                <p className="text-xs text-gray-500">
                                    {card.subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MetricsCards;