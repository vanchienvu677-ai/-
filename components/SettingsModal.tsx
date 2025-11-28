
import React, { useState, useEffect, useRef } from 'react';
import { AISettings, DEFAULT_AI_SETTINGS } from '../types';
import { getAllRecords, bulkImportRecords } from '../services/db';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
  onDataRestore?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, onDataRestore }) => {
  const [formData, setFormData] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isOpen) setFormData(settings); }, [isOpen, settings]);
  if (!isOpen) return null;

  const handleBackup = async () => {
    try {
      const records = await getAllRecords();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
      link.download = `Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    } catch { alert("备份失败"); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const records = JSON.parse(event.target?.result as string);
        if (Array.isArray(records) && window.confirm(`确认恢复 ${records.length} 条记录吗？`)) {
           await bulkImportRecords(records);
           if (onDataRestore) onDataRestore();
           alert("恢复成功！");
        }
      } catch { alert("文件无效"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">系统设置</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">AI 服务商</label>
            <select className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm" value={formData.provider} onChange={(e) => {
              const val = e.target.value as any;
              setFormData(p => ({ ...p, provider: val, baseUrl: val==='local'?'http://localhost:11434/v1':val==='openai'?'https://api.openai.com/v1':'', modelName: val==='gemini'?'gemini-2.5-flash':val==='local'?'llama3-vision':'gpt-4o-mini' }));
            }}>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI / DeepSeek</option>
              <option value="local">Local (Ollama)</option>
            </select>
          </div>
          {formData.provider !== 'gemini' && (
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">接口地址 (Base URL)</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" value={formData.baseUrl} onChange={(e) => setFormData({...formData, baseUrl: e.target.value})} /></div>
          )}
          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">API 密钥</label><input type="password" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" value={formData.apiKey} onChange={(e) => setFormData({...formData, apiKey: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">模型名称</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" value={formData.modelName} onChange={(e) => setFormData({...formData, modelName: e.target.value})} /></div>
          
          <div className="pt-4 border-t">
             <div className="flex gap-2">
               <button onClick={handleBackup} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded border border-slate-200 hover:bg-slate-200">备份数据</button>
               <button onClick={() => fileInputRef.current?.click()} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded border border-slate-200 hover:bg-slate-200">恢复数据</button>
               <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
             </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold text-sm">取消</button>
          <button onClick={() => { onSave(formData); onClose(); }} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700">保存</button>
        </div>
      </div>
    </div>
  );
};
