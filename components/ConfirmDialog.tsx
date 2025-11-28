
import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, onClose, onConfirm, title = "确认删除", message = "此操作无法撤销，确定要继续吗？" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 border-t-4 border-rose-500">
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 rounded text-sm font-bold hover:bg-slate-200">取消</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 text-white bg-rose-600 rounded text-sm font-bold hover:bg-rose-700 shadow-md">确认删除</button>
        </div>
      </div>
    </div>
  );
};
