
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { PerformanceRecord, IndustryType, ProductType, AISettings, DEFAULT_AI_SETTINGS } from './types';
import { extractDataFromDocument } from './services/geminiService';
import { getAllRecords, saveRecord, deleteRecord, bulkImportRecords } from './services/db';
import { StatsCard } from './components/StatsCard';
import { RecordEditor } from './components/RecordEditor';
import { SettingsModal } from './components/SettingsModal';
import { IntroModal } from './components/IntroModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ExportModal } from './components/ExportModal';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, HeadingLevel, AlignmentType, PageOrientation, TextRun } from 'docx';

// Mock initial data if empty (Chinese Context)
const MOCK_DATA: PerformanceRecord[] = [
  {
    id: '1',
    projectName: '二期乙烯管网改造工程',
    clientName: '中国石化镇海炼化',
    amount: 1250000,
    currency: 'CNY',
    industry: IndustryType.PETROLEUM,
    productType: ProductType.LINED_PIPE,
    date: '2023-05-15',
    description: '供应 DN50-DN300 PTFE 内衬直管及管件，用于酸性介质输送。',
    items: [
        { name: '内衬直管', specifications: 'DN50-DN300', material: 'CS/PTFE', quantity: '2000米' },
        { name: '内衬弯头', specifications: 'DN50-DN300', material: 'CS/PTFE', quantity: '500件' }
    ],
    tags: ['酸性', '真空']
  },
  {
    id: '2',
    projectName: '年产5万吨聚氨酯反应釜项目',
    clientName: '万华化学集团',
    amount: 4500000,
    currency: 'CNY',
    industry: IndustryType.CHEMICAL,
    productType: ProductType.VESSEL,
    date: '2023-08-22',
    description: '制造50立方米搪玻璃反应釜及配套换热器。',
    items: [
        { name: '反应釜', specifications: 'V=50m³, P=1.0MPa', material: 'Q345R/搪玻璃', quantity: '2台', vesselCategory: '三类' },
        { name: '管壳式换热器', specifications: 'F=200m²', material: 'S30408', quantity: '4台', vesselCategory: '二类' }
    ],
    tags: ['反应釜', '搪玻璃']
  },
  {
    id: '3',
    projectName: '工业废水处理管线',
    clientName: '威立雅水务技术',
    amount: 850000,
    currency: 'CNY',
    industry: IndustryType.WATER_TREATMENT,
    productType: ProductType.LINED_PIPE,
    date: '2023-11-10',
    description: 'PO 内衬钢管一批，用于腐蚀性废水处理车间。',
    items: [
        { name: 'PO内衬管', specifications: 'DN150', material: 'Q235B/PO', quantity: '500米' }
    ],
    tags: ['废水', 'PO']
  },
  {
    id: '4',
    projectName: '纯水储存系统扩建',
    clientName: '某知名电子厂',
    amount: 320000,
    currency: 'CNY',
    industry: IndustryType.OTHER,
    productType: ProductType.VESSEL,
    date: '2024-01-15',
    description: '供应100立方不锈钢常压储罐。',
    items: [
        { name: '常压储罐', specifications: 'V=100m³', material: 'S30408', quantity: '3台', vesselCategory: '类外' }
    ],
    tags: ['储罐', '常压']
  }
];

// Helper to extract Chinese label from enum "English (Chinese)"
const getLabel = (str: string) => str.match(/\((.*?)\)/)?.[1] || str;
const getShortLabel = (str: string) => getLabel(str).split(' ')[0];

// Chart Colors
const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

export default function App() {
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Settings & Modals State
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<Partial<PerformanceRecord>>({});
  const [isNewRecord, setIsNewRecord] = useState(false);

  // Delete Dialog State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // Filters & Sorting
  const [filterIndustry, setFilterIndustry] = useState<string>('All');
  const [filterProduct, setFilterProduct] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting Configuration
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  // View Scaling & Layout
  const [tableScale, setTableScale] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default sidebar width
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    index: 60,
    date: 110,
    client: 160,
    project: 180,
    industry: 120,
    type: 120, // Increased for filter
    amount: 130, // Increased for sort arrow
    content: 350,
    action: 80
  });

  // Resizing Logic (Column)
  const resizingRef = useRef<{ key: string, startX: number, startWidth: number } | null>(null);
  // Resizing Logic (Sidebar)
  const sidebarResizeRef = useRef<{ startX: number, startWidth: number } | null>(null);

  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    resizingRef.current = { key, startX: e.clientX, startWidth: columnWidths[key] };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    setColumnWidths(prev => ({ ...prev, [key]: Math.max(50, startWidth + diff) }));
  }, []);

  const handleResizeUp = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeUp);
    document.body.style.cursor = '';
  }, [handleResizeMove]);

  // Sidebar Resize Handlers
  const startResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    document.addEventListener('mousemove', handleSidebarMove);
    document.addEventListener('mouseup', handleSidebarUp);
    document.body.style.cursor = 'ew-resize';
  };

  const handleSidebarMove = useCallback((e: MouseEvent) => {
    if (!sidebarResizeRef.current) return;
    const { startX, startWidth } = sidebarResizeRef.current;
    const diff = e.clientX - startX;
    setSidebarWidth(Math.min(Math.max(250, startWidth + diff), 500)); // Min 250, Max 500
  }, []);

  const handleSidebarUp = useCallback(() => {
    sidebarResizeRef.current = null;
    document.removeEventListener('mousemove', handleSidebarMove);
    document.removeEventListener('mouseup', handleSidebarUp);
    document.body.style.cursor = '';
  }, [handleSidebarMove]);


  useEffect(() => {
    const savedSettings = localStorage.getItem('pipe_perform_settings');
    if (savedSettings) setAiSettings(JSON.parse(savedSettings));
    else if (process.env.API_KEY) setAiSettings(prev => ({ ...prev, apiKey: process.env.API_KEY || '' }));

    const initData = async () => {
      try {
        let dbRecords = await getAllRecords();
        if (dbRecords.length === 0) {
           await bulkImportRecords(MOCK_DATA);
           dbRecords = await getAllRecords();
        }
        setRecords(dbRecords);
      } catch (err) { console.error(err); setRecords([]); }
    };
    initData();
  }, []);

  const handleSaveSettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    localStorage.setItem('pipe_perform_settings', JSON.stringify(newSettings));
  };
  
  const refreshRecords = async () => { setRecords(await getAllRecords()); };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError("不支持的文件格式。"); return;
    }
    setLoading(true); setError(null);
    try {
      const extractedData = await extractDataFromDocument(file, aiSettings);
      setCurrentEditRecord(extractedData);
      setIsNewRecord(true);
      setIsEditorOpen(true);
    } catch (err: any) { setError(err.message || "错误"); } finally { setLoading(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleSaveRecord = async (record: PerformanceRecord) => {
    try {
        await saveRecord(record);
        setRecords(await getAllRecords());
    } catch { alert("保存失败"); }
  };

  const requestDelete = (id: string) => { setRecordToDelete(id); setIsDeleteConfirmOpen(true); };
  const confirmDeleteAction = async () => {
    if (recordToDelete) {
      await deleteRecord(recordToDelete);
      setRecords(await getAllRecords());
      setRecordToDelete(null);
      setIsEditorOpen(false);
    }
  };

  const handleSort = (key: 'date' | 'amount') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const filteredRecords = useMemo(() => {
    let result = records.filter(r => {
      const matchInd = filterIndustry === 'All' || r.industry === filterIndustry;
      const matchProd = filterProduct === 'All' || r.productType === filterProduct;
      const matchSearch = r.projectName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchInd && matchSearch && matchProd;
    });

    result = result.sort((a, b) => {
      if (sortConfig.key === 'amount') {
        return sortConfig.direction === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      } else {
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });

    return result;
  }, [records, filterIndustry, filterProduct, searchTerm, sortConfig]);

  const stats = useMemo(() => {
    const totalAmount = filteredRecords.reduce((sum, r) => sum + r.amount, 0);
    
    // Group by Industry
    const industryMap = new Map<string, number>();
    filteredRecords.forEach(r => {
       const label = getShortLabel(r.industry);
       industryMap.set(label, (industryMap.get(label) || 0) + 1);
    });
    const industryData = Array.from(industryMap.entries()).map(([name, value]) => ({ name, value }));

    // Group by Product
    const typeMap = new Map<string, number>();
    filteredRecords.forEach(r => {
       const label = getShortLabel(r.productType);
       typeMap.set(label, (typeMap.get(label) || 0) + 1);
    });
    const typeData = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));

    // Top Clients by Amount
    const clientMap = new Map<string, number>();
    filteredRecords.forEach(r => {
        const name = r.clientName.length > 6 ? r.clientName.substring(0,6)+'...' : r.clientName;
        clientMap.set(name, (clientMap.get(name) || 0) + r.amount);
    });
    const clientData = Array.from(clientMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 5);

    return { totalAmount, count: filteredRecords.length, industryData, typeData, clientData };
  }, [filteredRecords]);

  const handleExportCSV = () => { /* ... existing csv logic ... */ };
  const handleExportDOCX = () => { /* ... existing docx logic ... */ }; 
  const handleExportPrint = () => { /* ... existing print logic ... */ };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside 
        className="bg-slate-900 flex-none flex flex-col border-r border-slate-800 text-slate-100 shadow-xl z-20 relative"
        style={{ width: sidebarWidth }}
      >
         {/* Resizer Handle */}
         <div 
           className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-indigo-500 z-50 opacity-0 hover:opacity-100 transition-opacity"
           onMouseDown={startResizeSidebar}
         />

         {/* 1. App Title */}
         <div className="h-16 flex items-center px-5 border-b border-slate-800 flex-none">
            <div className="bg-indigo-600 text-white p-1.5 rounded mr-3">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h1 className="text-lg font-bold tracking-wide font-mono truncate">PipePerform<span className="text-indigo-400">.AI</span></h1>
         </div>

         <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {/* Primary Action */}
            <button onClick={() => { setIsNewRecord(true); setCurrentEditRecord({}); setIsEditorOpen(true); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg text-sm font-bold shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2 transition-all active:scale-95">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
               新增业绩
            </button>

            {/* Upload Zone */}
            <div className={`relative border-2 border-dashed rounded-xl transition-all p-4 text-center ${dragActive ? 'border-indigo-500 bg-slate-800' : 'border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50'}`} onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }} onDragOver={(e) => { e.preventDefault(); }} onDrop={handleDrop}>
               <input type="file" id="file-upload" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e.target.files)} />
               {loading ? (
                  <div className="py-2 flex flex-col items-center gap-2">
                     <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-[10px] text-indigo-300 animate-pulse">AI 分析中...</span>
                  </div>
               ) : (
                  <>
                    <svg className="w-6 h-6 mx-auto text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <label htmlFor="file-upload" className="inline-block cursor-pointer text-[10px] bg-slate-800 text-indigo-300 border border-indigo-900/50 px-2 py-1 rounded hover:text-white transition-colors">上传合同/图纸</label>
                  </>
               )}
               {error && <div className="mt-2 text-[10px] text-rose-400">{error}</div>}
            </div>

            {/* Basic Stats */}
            <div className="grid grid-cols-2 gap-2">
               <StatsCard variant="dark" title="累计金额" value={`¥${(stats.totalAmount / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}w`} icon={null} color="indigo"/>
               <StatsCard variant="dark" title="业绩数量" value={stats.count} icon={null} color="teal"/>
            </div>

            {/* CHARTS SECTION */}
            <div className="space-y-6 pt-2">
                {/* Industry Pie */}
                <div>
                   <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 pl-1">行业分布</h4>
                   <div className="h-32 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                         <Pie data={stats.industryData} cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={5} dataKey="value">
                           {stats.industryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />)}
                         </Pie>
                         <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor:'#334155', borderRadius:'4px', fontSize:'10px', color:'#f8fafc'}} itemStyle={{color:'#f8fafc'}} />
                       </PieChart>
                     </ResponsiveContainer>
                   </div>
                   <div className="flex flex-wrap gap-2 justify-center">
                      {stats.industryData.slice(0,3).map((d,i) => <div key={i} className="flex items-center text-[10px] text-slate-400 gap-1"><span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i]}}></span>{d.name}</div>)}
                   </div>
                </div>

                {/* Product Type Pie */}
                <div>
                   <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 pl-1">产品类型占比</h4>
                   <div className="h-32 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                         <Pie data={stats.typeData} cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={5} dataKey="value">
                           {stats.typeData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} stroke="rgba(0,0,0,0.2)" />)}
                         </Pie>
                         <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor:'#334155', borderRadius:'4px', fontSize:'10px', color:'#f8fafc'}} />
                       </PieChart>
                     </ResponsiveContainer>
                   </div>
                   <div className="flex flex-wrap gap-2 justify-center">
                      {stats.typeData.map((d,i) => <div key={i} className="flex items-center text-[10px] text-slate-400 gap-1"><span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[(i+3)%COLORS.length]}}></span>{d.name}</div>)}
                   </div>
                </div>

                {/* Top Clients Bar */}
                <div>
                   <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 pl-1">客户价值 TOP 5</h4>
                   <div className="h-32 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={stats.clientData} layout="vertical" margin={{top:0, left:0, right:10, bottom:0}}>
                         <XAxis type="number" hide />
                         <YAxis type="category" dataKey="name" width={70} tick={{fontSize: 9, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                         <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#1e293b', borderColor:'#334155', borderRadius:'4px', fontSize:'10px'}} />
                         <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={10} />
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                </div>
            </div>

            {/* Search */}
            <div className="pt-4 border-t border-slate-800">
               <input type="text" placeholder="搜索项目/客户..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 outline-none placeholder-slate-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
         </div>

         {/* Footer */}
         <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2 flex-none">
            <button onClick={() => setIsExportOpen(true)} className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-2 rounded transition-colors group">
               <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> 导出数据</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => setIsSettingsOpen(true)} className="text-xs text-slate-500 hover:text-indigo-400 py-1 text-center">设置</button>
               <button onClick={() => setIsIntroOpen(true)} className="text-xs text-slate-500 hover:text-indigo-400 py-1 text-center">关于</button>
            </div>
         </div>
      </aside>

      {/* WORKSPACE */}
      <main className="flex-1 overflow-hidden relative bg-white shadow-inner">
         <div className="absolute inset-0 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 bg-slate-50 shadow-sm z-10 text-slate-600 text-[11px] uppercase tracking-wider font-bold border-b border-slate-300">
                <tr>
                  {[
                    { k: 'index', l: '序号' }, 
                    { k: 'date', l: `日期 ${sortConfig.key==='date'?(sortConfig.direction==='asc'?'↑':'↓'):''}`, click: () => handleSort('date') },
                    { k: 'client', l: '客户名称' }, 
                    { k: 'project', l: '项目名称' }, 
                    // Industry Filter
                    { k: 'industry', l: '行业', render: () => (
                      <div className="flex items-center justify-between">
                         <span>行业</span>
                         <select 
                           className="ml-1 bg-white border border-slate-300 text-[10px] rounded px-1 py-0.5 outline-none focus:border-indigo-500 w-16"
                           value={filterIndustry} onClick={(e) => e.stopPropagation()} onChange={(e) => setFilterIndustry(e.target.value)}
                         >
                           <option value="All">所有</option>
                           {Object.values(IndustryType).map(t => <option key={t} value={t}>{getShortLabel(t)}</option>)}
                         </select>
                      </div>
                    ) }, 
                    // Product Type Filter
                    { k: 'type', l: '类型', render: () => (
                        <div className="flex items-center justify-between">
                           <span>类型</span>
                           <select 
                             className="ml-1 bg-white border border-slate-300 text-[10px] rounded px-1 py-0.5 outline-none focus:border-indigo-500 w-16"
                             value={filterProduct} onClick={(e) => e.stopPropagation()} onChange={(e) => setFilterProduct(e.target.value)}
                           >
                             <option value="All">所有</option>
                             {Object.values(ProductType).map(t => <option key={t} value={t}>{getShortLabel(t)}</option>)}
                           </select>
                        </div>
                      ) },
                    // Amount Sort
                    { k: 'amount', l: `金额 ${sortConfig.key==='amount'?(sortConfig.direction==='asc'?'↑':'↓'):''}`, click: () => handleSort('amount') }, 
                    { k: 'content', l: '供货内容 & 设备清单' }, 
                    { k: 'action', l: '操作' }
                  ].map(col => (
                    <th key={col.k} className="p-3 relative group select-none border-r border-slate-100 last:border-0 align-middle" style={{ width: columnWidths[col.k] * tableScale }}>
                       {col.render ? col.render() : <span className={col.click ? "cursor-pointer hover:text-indigo-600 flex items-center gap-1" : ""} onClick={col.click}>{col.l}</span>}
                       <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 group-hover:bg-slate-300 transition-colors z-20" onMouseDown={(e) => startResize(col.k, e)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs text-slate-700" style={{ fontSize: `${12 * tableScale}px` }}>
                {filteredRecords.length === 0 ? (
                   <tr><td colSpan={9} className="p-10 text-center text-slate-400">暂无记录，请点击左侧“新增业绩”或拖拽上传文件。</td></tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record.id} className="hover:bg-indigo-50 transition-colors group border-b border-slate-300 even:bg-slate-50">
                      <td className="p-3 text-center text-slate-400 font-mono border-r border-slate-200/50 truncate" style={{ width: columnWidths.index * tableScale }}>{index + 1}</td>
                      <td className="p-3 text-slate-500 font-mono whitespace-nowrap border-r border-slate-200/50 truncate" style={{ width: columnWidths.date * tableScale }}>{record.date}</td>
                      <td className="p-3 align-top border-r border-slate-200/50" style={{ width: columnWidths.client * tableScale }}>
                         <div className="font-bold text-slate-900 truncate" title={record.clientName}>{record.clientName}</div>
                      </td>
                      <td className="p-3 align-top border-r border-slate-200/50" style={{ width: columnWidths.project * tableScale }}>
                         <div className="text-slate-700 truncate" title={record.projectName}>{record.projectName}</div>
                      </td>
                      <td className="p-3 align-top border-r border-slate-200/50" style={{ width: columnWidths.industry * tableScale }}><span className="px-1.5 py-0.5 rounded-sm bg-white text-slate-600 font-medium text-[10px] border border-slate-300 shadow-sm">{getShortLabel(record.industry)}</span></td>
                      <td className="p-3 align-top border-r border-slate-200/50" style={{ width: columnWidths.type * tableScale }}><span className={`px-1.5 py-0.5 rounded-sm font-medium text-[10px] border shadow-sm ${record.productType === ProductType.VESSEL ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>{getShortLabel(record.productType)}</span></td>
                      <td className="p-3 align-top text-right font-mono text-slate-800 font-bold border-r border-slate-200/50 truncate" style={{ width: columnWidths.amount * tableScale }}>{record.amount.toLocaleString()}</td>
                      <td className="p-3 align-top text-slate-600 border-r border-slate-200/50" style={{ width: columnWidths.content * tableScale }}>
                         {record.description && <div className="font-semibold text-slate-900 mb-1.5 leading-tight line-clamp-2" title={record.description}>{record.description}</div>}
                         <div className="flex flex-wrap gap-1.5">
                            {record.items?.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-[10px] bg-white border border-slate-300 px-1.5 py-0.5 rounded-sm shadow-sm whitespace-nowrap" style={{ fontSize: `${10 * tableScale}px` }}>
                                    <span className="font-bold text-slate-800">{item.name}</span>
                                    {item.vesselCategory && <span className="text-amber-700 font-mono font-bold">[{item.vesselCategory}]</span>}
                                    {item.specifications && <span className="text-slate-500 font-mono">{item.specifications}</span>}
                                    {item.material && <span className="text-indigo-700 font-medium">{item.material}</span>}
                                    <span className="text-teal-700 font-bold font-mono">x{item.quantity}</span>
                                </div>
                            ))}
                         </div>
                      </td>
                      <td className="p-3 text-right" style={{ width: columnWidths.action * tableScale }}>
                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setIsNewRecord(false); setCurrentEditRecord(record); setIsEditorOpen(true); }} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded relative z-20"><svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                          <button onClick={(e) => { e.stopPropagation(); requestDelete(record.id); }} className="text-rose-500 hover:bg-rose-50 p-1 rounded relative z-20"><svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
         </div>
      </main>

      {/* Modals */}
      <RecordEditor key={isEditorOpen ? (currentEditRecord.id || 'new') : 'closed'} isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} initialData={currentEditRecord} onSave={handleSaveRecord} onDelete={requestDelete} isNew={isNewRecord} aiSettings={aiSettings} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={aiSettings} onSave={handleSaveSettings} onDataRestore={refreshRecords} />
      <IntroModal isOpen={isIntroOpen} onClose={() => setIsIntroOpen(false)} />
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} onExportPrint={handleExportPrint} onExportCSV={handleExportCSV} onExportDOCX={handleExportDOCX} />
      <ConfirmDialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={confirmDeleteAction} message="此操作无法撤销，确定要继续吗？" />
    </div>
  );
}
