
import React from 'react';

interface IntroModalProps { isOpen: boolean; onClose: () => void; }

export const IntroModal: React.FC<IntroModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">关于 PipePerform</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
        <div className="p-6 space-y-4 text-slate-600 text-sm leading-relaxed">
          <p><strong>PipePerform</strong> 是一款专为内衬管道与容器制造企业设计的智能业绩管理工具。它利用先进的 AI 技术，能够从合同或图纸中自动提取关键数据，极大提高投标效率。</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 p-3 rounded border border-indigo-100">
              <h4 className="font-bold text-indigo-800 mb-1">主要功能</h4>
              <ul className="list-disc pl-4 space-y-1 text-xs text-indigo-700">
                <li>AI 智能提取 (Gemini/OpenAI)</li>
                <li>自动解析复杂设备清单</li>
                <li>一键导出 Word/PDF 投标报告</li>
              </ul>
            </div>
            <div className="bg-teal-50 p-3 rounded border border-teal-100">
              <h4 className="font-bold text-teal-800 mb-1">隐私安全</h4>
              <ul className="list-disc pl-4 space-y-1 text-xs text-teal-700">
                <li>本地 IndexedDB 存储</li>
                <li>离线优先架构</li>
                <li>API 密钥加密传输</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center pt-4">版本 1.3.0 | 现代工程 UI</p>
        </div>
      </div>
    </div>
  );
};
