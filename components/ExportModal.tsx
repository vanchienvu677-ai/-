
import React from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportPrint: () => void;
  onExportCSV: () => void;
  onExportDOCX: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExportPrint, onExportCSV, onExportDOCX }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          导出数据
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => { onExportDOCX(); onClose(); }} className="flex items-center p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group text-left">
            <div className="bg-blue-100 text-blue-600 p-3 rounded mr-4 group-hover:bg-blue-600 group-hover:text-white">DOCX</div>
            <div><div className="font-bold text-slate-800">Word 文档</div><div className="text-xs text-slate-500">标准 A4 报告排版</div></div>
          </button>
          <button onClick={() => { onExportPrint(); onClose(); }} className="flex items-center p-4 border border-slate-200 rounded-lg hover:border-slate-500 hover:bg-slate-50 transition-all group text-left">
            <div className="bg-slate-100 text-slate-600 p-3 rounded mr-4 group-hover:bg-slate-600 group-hover:text-white">PDF</div>
            <div><div className="font-bold text-slate-800">打印 / PDF</div><div className="text-xs text-slate-500">浏览器直接打印</div></div>
          </button>
          <button onClick={() => { onExportCSV(); onClose(); }} className="flex items-center p-4 border border-slate-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group text-left">
            <div className="bg-green-100 text-green-600 p-3 rounded mr-4 group-hover:bg-green-600 group-hover:text-white">CSV</div>
            <div><div className="font-bold text-slate-800">Excel 数据表</div><div className="text-xs text-slate-500">原始数据导出</div></div>
          </button>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 text-slate-500 text-sm hover:text-slate-800">关闭</button>
      </div>
    </div>
  );
};
