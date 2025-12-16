import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Activity, PieChart, BarChart2, Shield, 
  AlertTriangle, CheckCircle, Search, Database, Calculator, 
  ArrowUpRight, ArrowDownRight, Layers, Wallet, Zap, Briefcase, Hash,
  CalendarClock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const API_URL = "http://127.0.0.1:8000";

const SECTORS = [
  "Financials", "Consumer Non-Cyclicals", "Technology", "Basic Materials", 
  "Energy", "Infrastructures", "Healthcare", "Properties & Real Estate", 
  "Transportation & Logistic", "Industrials"
];

// Helper: Hitung % ARA/ARB Sesuai Aturan BEI (Dinamis per level harga)
const getLimitPercentage = (price) => {
  if (price < 200) return 0.35; // 35%
  if (price <= 5000) return 0.25; // 25%
  return 0.20; // 20%
};

function App() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [marketData, setMarketData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    ticker: 'SUPA', final_price: 635, shares_offered: 4400000000,
    low_price: 525, high_price: 695, has_warrant: false,
    lead_underwriter: 'CC', sector: 'Financials', is_oversubscribed: true
  });

  // State Simulasi
  const [userLot, setUserLot] = useState(4);     // Jumlah Lot
  const [araDays, setAraDays] = useState(3);     // Input Hari ARA (Default 3)
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/ipo-data`)
      .then(res => res.json())
      .then(data => { if(data.status === 'success') setMarketData(data.data); })
      .catch(err => console.error("Gagal load market data:", err));
  }, []);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const analyzeIPO = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          final_price: Number(formData.final_price),
          shares_offered: Number(formData.shares_offered),
          low_price: Number(formData.low_price),
          high_price: Number(formData.high_price)
        })
      });
      if (!response.ok) throw new Error("Gagal koneksi API");
      const data = await response.json();
      setResult(data);
    } catch (err) { setError("Backend mati? Cek port 8000."); }
    setLoading(false);
  };

  // --- LOGIKA MULTI-DAY SCENARIO (COMPOUNDING) ---
  const modalAwal = userLot * 100 * formData.final_price;

  const calculateScenarios = () => {
    let currentPriceARA = Number(formData.final_price);
    let currentPriceARB = Number(formData.final_price);
    
    let araList = [];
    let arbList = [];

    // Loop sesuai input hari user (Maks 15 biar UI ga pecah)
    const daysToCalc = Math.min(Math.max(1, araDays), 15); 

    for (let i = 1; i <= daysToCalc; i++) {
      // 1. Logic ARA (Compounding Up)
      // Cek limit % berdasarkan harga pembukaan hari itu (previous close)
      const limitARA = getLimitPercentage(currentPriceARA);
      const nextARA = Math.floor(currentPriceARA * (1 + limitARA));
      const profit = (nextARA - formData.final_price) * 100 * userLot;
      
      araList.push({ 
        day: i, 
        price: nextARA, 
        profit: profit, 
        pct: limitARA 
      });
      currentPriceARA = nextARA; // Update harga untuk hari esok

      // 2. Logic ARB (Compounding Down)
      const limitARB = getLimitPercentage(currentPriceARB);
      let nextARB = Math.floor(currentPriceARB * (1 - limitARB));
      if (nextARB < 50) nextARB = 50; // Mentok gocap
      const loss = (nextARB - formData.final_price) * 100 * userLot;

      arbList.push({ 
        day: i, 
        price: nextARB, 
        loss: loss,
        pct: limitARB
      });
      currentPriceARB = nextARB;
    }
    return { araList, arbList };
  };

  const { araList, arbList } = calculateScenarios();

  // Chart Data untuk Visualisasi AI
  const chartData = result ? [
    { name: 'Loss', value: (result.probabilities.loss * 100).toFixed(1), color: '#ef4444' },
    { name: 'Profit', value: (result.probabilities.profit * 100).toFixed(1), color: '#22c55e' },
    { name: 'ARA', value: (result.probabilities.ara * 100).toFixed(1), color: '#eab308' },
  ] : [];

  const filteredMarket = marketData.filter(item => 
    (item['Ticker Code']?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item['Company Name']?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-cyan-500/30">
      
      {/* NAVBAR */}
      <nav className="border-b border-slate-800/50 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="bg-gradient-to-br from-cyan-600 to-blue-600 p-2 rounded-xl shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
              <Zap size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                IPO HUNTER
              </span>
              <span className="text-[10px] text-cyan-500 font-mono tracking-widest">PRO ANALYTICS</span>
            </div>
          </div>

          <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            {['analysis', 'market'].map((tab) => (
              <button key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 capitalize
                  ${activeTab === tab ? 'bg-slate-800 text-white shadow ring-1 ring-slate-700' : 'text-slate-400 hover:text-white'}`}>
                {tab === 'analysis' ? <Calculator size={14} /> : <Database size={14} />} {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-20">
        
        {/* === TAB ANALISIS === */}
        {activeTab === 'analysis' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            
            {/* INPUT SECTION */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl"></div>
                
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Activity size={16} className="text-cyan-400" /> Input Parameters
                </h2>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Ticker</label>
                      <input type="text" name="ticker" value={formData.ticker} onChange={handleChange}
                        className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-bold text-center uppercase focus:border-cyan-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Price (Rp)</label>
                      <input type="number" name="final_price" value={formData.final_price} onChange={handleChange}
                        className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono text-center focus:border-cyan-500 outline-none transition" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Total Shares</label>
                    <input type="number" name="shares_offered" value={formData.shares_offered} onChange={handleChange}
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-cyan-500 outline-none transition" />
                  </div>

                  <div className="p-3 bg-[#1e293b]/50 rounded-lg border border-slate-800">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block text-center">Range Harga</label>
                    <div className="flex gap-2">
                      <input type="number" name="low_price" value={formData.low_price} onChange={handleChange} className="w-full bg-[#0f172a] border border-slate-700 rounded p-1.5 text-xs text-center" />
                      <span className="text-slate-600">-</span>
                      <input type="number" name="high_price" value={formData.high_price} onChange={handleChange} className="w-full bg-[#0f172a] border border-slate-700 rounded p-1.5 text-xs text-center" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Underwriter</label>
                      <input type="text" name="lead_underwriter" value={formData.lead_underwriter} onChange={handleChange} className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-center uppercase" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Sector</label>
                      <select name="sector" value={formData.sector} onChange={handleChange} className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-xs">
                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <label className="flex-1 cursor-pointer bg-[#1e293b] p-3 rounded-lg border border-slate-700 flex items-center gap-2 hover:border-cyan-500/50 transition">
                      <input type="checkbox" name="has_warrant" checked={formData.has_warrant} onChange={handleChange} className="accent-cyan-500" />
                      <span className="text-xs font-medium text-slate-300">Warrant</span>
                    </label>
                    <label className="flex-1 cursor-pointer bg-[#1e293b] p-3 rounded-lg border border-slate-700 flex items-center gap-2 hover:border-green-500/50 transition">
                      <input type="checkbox" name="is_oversubscribed" checked={formData.is_oversubscribed} onChange={handleChange} className="accent-green-500" />
                      <span className="text-xs font-medium text-green-400">Oversubscribed</span>
                    </label>
                  </div>

                  <button onClick={analyzeIPO} disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-900/20 transition-all flex items-center justify-center gap-2 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? "PROCESSING..." : <>RUN AI PREDICTION <BarChart2 size={16} /></>}
                  </button>
                  {error && <div className="text-xs text-red-400 text-center bg-red-950/30 p-2 rounded border border-red-900">{error}</div>}
                </div>
              </div>
            </div>

            {/* RESULTS SECTION */}
            <div className="lg:col-span-8 space-y-6">
              {!result ? (
                <div className="h-full min-h-[500px] bg-[#0f172a] rounded-3xl border border-slate-800 border-dashed flex flex-col items-center justify-center text-slate-600 p-8">
                  <div className="bg-slate-900 p-4 rounded-full mb-4"><PieChart size={32} /></div>
                  <p className="text-sm">Siap menganalisis. Masukkan data di panel kiri.</p>
                </div>
              ) : (
                <>
                  {/* PREDISKI CARD */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden group">
                      <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[100px] opacity-20 
                        ${result.prediction.includes('Profit') ? 'bg-green-500' : result.prediction.includes('ARA') ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                      
                      <div className="relative z-10">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">AI Verdict</div>
                        <div className={`text-4xl font-black tracking-tight mb-6 
                          ${result.prediction.includes('Profit') ? 'text-green-400' : result.prediction.includes('ARA') ? 'text-yellow-400' : 'text-red-400'}`}>
                          {result.prediction.toUpperCase()}
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                            <span className="text-slate-400">Emission</span>
                            <span className="font-mono text-white">Rp {result.metrics.size_billion.toFixed(2)} M</span>
                          </div>
                          <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                            <span className="text-slate-400">Position</span>
                            <span className={`font-mono font-bold ${result.metrics.price_pos > 0.8 ? 'text-red-400' : 'text-green-400'}`}>{(result.metrics.price_pos * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-6 shadow-xl flex flex-col">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Confidence</div>
                      <div className="flex-1 w-full min-h-[120px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={chartData} margin={{ left: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={40} tick={{fill: '#64748b', fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                              {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* === SIMULASI MULTI-SCENARIO (ARA BERJILID) === */}
                  <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-500/5"></div>
                    <div className="relative z-10">
                      
                      {/* Control Panel: Modal & Input */}
                      <div className="flex flex-col md:flex-row items-center justify-between mb-6 pb-6 border-b border-slate-800/50 gap-4">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                          <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400"><Wallet size={20} /></div>
                          <div>
                            <h3 className="font-bold text-white text-base">Profit Simulator</h3>
                            <div className="text-xs text-slate-500">
                              Modal: <span className="text-slate-300 font-mono">Rp {modalAwal.toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Input Control Group */}
                        <div className="flex gap-3 w-full md:w-auto">
                          {/* Input Lot */}
                          <div className="flex-1 flex items-center gap-2 bg-[#1e293b] p-1.5 rounded-lg border border-slate-700 shadow-sm">
                            <div className="bg-slate-800/50 px-2 py-1.5 rounded text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <Hash size={12} /> LOT
                            </div>
                            <input 
                              type="number" min="1" value={userLot} onChange={(e) => setUserLot(e.target.value)}
                              className="bg-transparent text-right font-mono font-bold text-cyan-400 outline-none w-full md:w-16 px-1 placeholder-slate-600 focus:text-cyan-300 transition" 
                            />
                          </div>

                          {/* Input Hari (FITUR BARU) */}
                          <div className="flex-1 flex items-center gap-2 bg-[#1e293b] p-1.5 rounded-lg border border-slate-700 shadow-sm">
                            <div className="bg-slate-800/50 px-2 py-1.5 rounded text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <CalendarClock size={12} /> HARI
                            </div>
                            <input 
                              type="number" min="1" max="15" value={araDays} onChange={(e) => setAraDays(e.target.value)}
                              className="bg-transparent text-right font-mono font-bold text-yellow-400 outline-none w-full md:w-12 px-1 placeholder-slate-600 focus:text-yellow-300 transition" 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Scenario Grid (Scrollable jika input hari banyak) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* SKENARIO ARA (HIJAU) */}
                        <div className="bg-emerald-950/10 rounded-2xl border border-emerald-500/20 overflow-hidden flex flex-col h-[320px]">
                          <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between shrink-0">
                            <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2"><ArrowUpRight size={16} /> Prediksi ARA</h4>
                            <span className="text-[10px] text-emerald-500/70 font-mono">BULLISH</span>
                          </div>
                          <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
                            {araList.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-[#020617]/40 p-3 rounded-xl border border-emerald-500/10 hover:border-emerald-500/30 transition">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">HARI {item.day}</span>
                                    <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">+{item.pct * 100}%</span>
                                  </div>
                                  <span className="text-lg font-mono font-bold text-white">Rp {item.price}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-emerald-500/70 block mb-0.5">Profit</span>
                                  <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">+Rp {item.profit.toLocaleString('id-ID')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SKENARIO ARB (MERAH) */}
                        <div className="bg-red-950/10 rounded-2xl border border-red-500/20 overflow-hidden flex flex-col h-[320px]">
                          <div className="bg-red-500/10 px-4 py-3 border-b border-red-500/20 flex items-center justify-between shrink-0">
                            <h4 className="text-sm font-bold text-red-400 flex items-center gap-2"><ArrowDownRight size={16} /> Prediksi ARB</h4>
                            <span className="text-[10px] text-red-500/70 font-mono">BEARISH</span>
                          </div>
                          <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
                            {arbList.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-[#020617]/40 p-3 rounded-xl border border-red-500/10 hover:border-red-500/30 transition">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">HARI {item.day}</span>
                                    <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">-{item.pct * 100}%</span>
                                  </div>
                                  <span className="text-lg font-mono font-bold text-white">Rp {item.price}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-red-500/70 block mb-0.5">Loss</span>
                                  <span className="text-sm font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">-Rp {Math.abs(item.loss).toLocaleString('id-ID')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* REKOMENDASI */}
                  <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <Shield size={18} className="text-cyan-400" />
                      <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide">AI Recommendation</h3>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-sm text-slate-300 flex gap-4">
                      {result.prediction.includes('Profit') && <CheckCircle className="text-green-500 shrink-0" />}
                      {result.prediction.includes('Loss') && <AlertTriangle className="text-red-500 shrink-0" />}
                      {result.prediction.includes('ARA') && <TrendingUp className="text-yellow-500 shrink-0" />}
                      <div>
                        {result.prediction.includes('Profit') && "Model memprediksi potensi kenaikan moderat. Cocok untuk strategi 'Hit and Run'. Pasang Trailing Stop di harga IPO."}
                        {result.prediction.includes('Loss') && "Risiko tinggi! Model mendeteksi pola stagnasi. Pertimbangkan untuk menghindari atau jual cepat jika sudah punya barang."}
                        {result.prediction.includes('ARA') && "Sinyal Kuat! Potensi ARA tinggi. Tahan posisi (Hold) sampai antrian beli menipis di sesi berikutnya."}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* === TAB MARKET DATA === */}
        {activeTab === 'market' && (
          <div className="animate-slide-up bg-[#0f172a] rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Layers size={18} className="text-blue-500" /> Historical Data</h2>
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-3.5 text-slate-500" />
                <input type="text" placeholder="Search ticker..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-cyan-500 outline-none transition" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Ticker</th>
                    <th className="px-6 py-4">Company</th>
                    <th className="px-6 py-4 text-center">Price</th>
                    <th className="px-6 py-4 text-center">UW</th>
                    <th className="px-6 py-4 text-right">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredMarket.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50 transition">
                      <td className="px-6 py-4 font-bold text-cyan-400">{item['Ticker Code']}</td>
                      <td className="px-6 py-4 text-slate-300">{item['Company Name']}</td>
                      <td className="px-6 py-4 font-mono text-center">Rp {item['Final Price (Rp)']}</td>
                      <td className="px-6 py-4 text-center"><span className="bg-slate-800 px-2 py-1 rounded text-xs text-slate-400 font-mono">{item['Lead_UW'] || '-'}</span></td>
                      <td className={`px-6 py-4 font-bold text-right ${item['Return D1'] > 0 ? 'text-green-400' : item['Return D1'] < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {(item['Return D1'] * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;