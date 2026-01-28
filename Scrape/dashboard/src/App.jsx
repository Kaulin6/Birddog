import React, { useState, useEffect } from 'react';
import LeadCard from './components/LeadCard';
import { MapPin, Filter, RefreshCw } from 'lucide-react';

// For MVP, we'll try to fetch leads.json directly since it is in the parent folder,
// BUT Vite won't serve files outside root easily without config.
// So we will just import it if possible, or fetch from a known path if we move it or configure vite.
// Actually, simpler: I'll Paste the logic to fetch specific mock data or read it if we were doing a real backend.
// For this static demo, let's assume `leads.json` is copied to `public/leads.json` or we can just import it if it's in src.
// Since `collector.js` writes to root, let's assume we copy it to `dashboard/public` or just embed mock data if fetch fails.

function App() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, high_equity, distressed

    useEffect(() => {
        // In a real app, this would be an API call.
        // We'll try to fetch from public if we move the file there.
        fetch('/leads_real.json')
            .then(res => res.json())
            .catch(err => {
                console.error("Failed to load leads, falling back to empty", err);
                return [];
            })
            .then(data => {
                setLeads(data);
                setLoading(false);
            });
    }, []);

    const filteredLeads = leads.filter(lead => {
        if (filter === 'high_equity') return lead.financials.equity_percent > 50;
        if (filter === 'distressed') return lead.distress_flags.length > 0;
        return true;
    });

    return (
        <div className="min-h-screen text-white p-8">
            <header className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl title-gradient mb-2 tracking-tight">BirdDog OS</h1>
                    <p className="text-gray-400 text-sm tracking-widest uppercase">Residential Wholesaling Intelligence</p>
                </div>
                <div className="flex gap-4">
                    <button className="glass-card flex items-center gap-2 hover:bg-white/10 transition-all cursor-pointer">
                        <MapPin size={18} /> Map View
                    </button>
                    <button className="glass-card flex items-center gap-2 hover:bg-white/10 transition-all cursor-pointer">
                        <RefreshCw size={18} /> Refresh Data
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* Sidebar / Filters */}
                <div className="col-span-12 md:col-span-3">
                    <div className="glass-card sticky top-8">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-purple-300">
                            <Filter size={18} /> Filters
                        </h3>

                        <div className="space-y-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${filter === 'all' ? 'bg-purple-500/20 text-purple-300' : 'hover:bg-white/5'}`}
                            >
                                All Leads ({leads.length})
                            </button>
                            <button
                                onClick={() => setFilter('high_equity')}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${filter === 'high_equity' ? 'bg-purple-500/20 text-purple-300' : 'hover:bg-white/5'}`}
                            >
                                High Equity (&gt;50%)
                            </button>
                            <button
                                onClick={() => setFilter('distressed')}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${filter === 'distressed' ? 'bg-purple-500/20 text-purple-300' : 'hover:bg-white/5'}`}
                            >
                                Distressed Only
                            </button>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-700">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Quick Stats</h4>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-400">Avg Equity</span>
                                <span className="font-mono">55%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="col-span-12 md:col-span-9">
                    {loading ? (
                        <div className="text-center py-20 text-gray-500 animate-pulse">Scanning residential frequencies...</div>
                    ) : (
                        <div className="space-y-6">
                            {filteredLeads.map(lead => (
                                <LeadCard key={lead.id} lead={lead} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
