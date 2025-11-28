
import React, { useState, useEffect } from 'react';
import { IndustryType, ProductType, PerformanceRecord, ExtractionResult, EquipmentItem, AISettings } from '../types';
import { generateDescriptionFromItems, suggestProjectNames } from '../services/geminiService';

interface RecordEditorProps {
  initialData: Partial<PerformanceRecord> | ExtractionResult;
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: PerformanceRecord) => void;
  onDelete?: (id: string) => void;
  isNew: boolean;
  aiSettings: AISettings;
}

const getLabel = (str: string) => str.match(/\((.*?)\)/)?.[1] || str;

export const RecordEditor: React.FC<RecordEditorProps> = ({ initialData, isOpen, onClose, onSave, onDelete, isNew, aiSettings }) => {
  const [formData, setFormData] = useState<Partial<PerformanceRecord>>({});
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isGenDesc, setIsGenDesc] = useState(false);
  const [isGenProj, setIsGenProj] = useState(false);
  const [projectSuggestions, setProjectSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const data = initialData as Partial<PerformanceRecord>;
      setWarnings((initialData as ExtractionResult).validationWarnings || []);
      setProjectSuggestions([]);
      setFormData({
        id: data.id || crypto.randomUUID(),
        projectName: data.projectName || '',
        clientName: data.clientName || '',
        amount: data.amount || 0,
        currency: data.currency || 'CNY',
        industry: data.industry as IndustryType || IndustryType.OTHER,
        productType: data.productType as ProductType || ProductType.OTHER,
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description || '',
        tags: data.tags || [],
      });
      setItems(data.items || []);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, items } as PerformanceRecord);
    onClose();
  };

  const handleAddItem = () => setItems([...items, { name: '', specifications: '', material: '', quantity: '', vesselCategory: '' }]);
  const handleRemoveItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const handleUpdateItem = (i: number, f: keyof EquipmentItem, v: string) => {
    const n = [...items]; n[i] = { ...n[i], [f]: v }; setItems(n);
  };

  const handleGenerateDescription = async () => {
    if (items.length === 0) return alert("请先添加设备清单。");
    setIsGenDesc(true);
    try { 
      const description = await generateDescriptionFromItems(items, aiSettings);
      setFormData(p => ({ ...p, description })); 
    }
    catch { alert("生成失败。"); } finally { setIsGenDesc(false); }
  };

  const handleSuggestProjects = async () => {
    if (!formData.clientName) return alert("请先填写客户名称。");
    setIsGenProj(true);
    try { setProjectSuggestions(await suggestProjectNames(formData.clientName, items, aiSettings)); }
    catch { alert("生成失败。"); } finally { setIsGenProj(false); }
  };

  const isVesselType = formData.productType === ProductType.VESSEL;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {isNew ? <span className="text-teal-400">✚ 新增业绩</span> : <span className="text-indigo-400">✎ 编辑业绩</span>}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-slate-50">
          {warnings.length > 0 && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r text-sm text-amber-800">
              <strong>⚠ 数据质量提示：</strong>
              <ul className="list-disc pl-5 mt-1">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">项目名称</label>
              <div className="flex gap-2">
                  <input type="text" required className="flex-1 px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} />
                  <button type="button" onClick={handleSuggestProjects} disabled={isGenProj} className="px-3 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 text-xs font-bold whitespace-nowrap">{isGenProj ? '...' : 'AI 猜项目'}</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">{projectSuggestions.map((n, i) => <button key={i} type="button" onClick={() => setFormData({...formData, projectName: n})} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full hover:bg-indigo-200">{n}</button>)}</div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">客户名称</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">金额</label><input type="number" className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-mono" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} /></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">货币</label><select className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}><option value="CNY">CNY (¥)</option><option value="USD">USD ($)</option></select></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">日期</label><input type="date" className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-mono" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">行业分类</label><select className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value as IndustryType})}>{Object.values(IndustryType).map(t => <option key={t} value={t}>{getLabel(t)}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">产品大类</label><select className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.productType} onChange={e => setFormData({...formData, productType: e.target.value as ProductType})}>{Object.values(ProductType).map(t => <option key={t} value={t}>{getLabel(t)}</option>)}</select></div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase">设备清单</h3>
              <button type="button" onClick={handleAddItem} className="text-xs bg-teal-50 text-teal-600 font-bold px-2 py-1 rounded border border-teal-200 hover:bg-teal-100">+ 添加设备</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-100">
                  <input type="text" placeholder="名称" className="w-1/4 px-2 py-1 text-xs border border-slate-300 rounded" value={item.name} onChange={e => handleUpdateItem(idx, 'name', e.target.value)} />
                  <input type="text" placeholder="规格" className="w-1/4 px-2 py-1 text-xs border border-slate-300 rounded font-mono" value={item.specifications} onChange={e => handleUpdateItem(idx, 'specifications', e.target.value)} />
                  <input type="text" placeholder="材质" className="w-1/6 px-2 py-1 text-xs border border-slate-300 rounded" value={item.material} onChange={e => handleUpdateItem(idx, 'material', e.target.value)} />
                  <input type="text" placeholder="数量" className="w-1/6 px-2 py-1 text-xs border border-slate-300 rounded font-mono" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', e.target.value)} />
                  <select className="w-1/6 px-2 py-1 text-xs border border-slate-300 rounded" value={item.vesselCategory || ''} onChange={e => handleUpdateItem(idx, 'vesselCategory', e.target.value)} disabled={!isVesselType && !item.vesselCategory}><option value="">-</option><option value="一类">一类</option><option value="二类">二类</option><option value="三类">三类</option><option value="类外">类外</option><option value="ASME">ASME</option></select>
                  <button type="button" onClick={() => handleRemoveItem(idx)} className="text-rose-400 hover:text-rose-600 font-bold">×</button>
                </div>
              ))}
            </div>
          </div>

          <div>
             <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-500 uppercase">供货内容简述</label>
                <button type="button" onClick={handleGenerateDescription} disabled={isGenDesc} className="text-xs text-indigo-600 hover:underline">{isGenDesc ? '生成中...' : '✨ AI 生成'}</button>
             </div>
            <textarea rows={3} className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200">
            {onDelete && !isNew && <button type="button" onClick={() => { if(formData.id) onDelete(formData.id); }} className="px-4 py-2 text-rose-600 bg-rose-50 rounded text-sm font-bold border border-rose-200 hover:bg-rose-100">删除</button>}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded text-sm font-bold hover:bg-slate-50">取消</button>
              <button type="submit" className="px-4 py-2 text-white bg-indigo-600 rounded text-sm font-bold hover:bg-indigo-700 shadow-sm">保存</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
