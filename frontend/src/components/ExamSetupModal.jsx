import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';

export default function ExamSetupModal({ isOpen, onClose, onUploadSheet }) {
  const [studentName, setStudentName] = useState('');
  const [rollNumber, setRollNumber] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!studentName.trim() || !rollNumber.trim()) return;
    onUploadSheet({ student_name: studentName.trim(), roll_number: rollNumber.trim() });
    setStudentName('');
    setRollNumber('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0E131F] border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-sm">Upload Student Handwritten Answer Sheet</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Student Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Siddharth Mehta"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">University Roll Number</label>
            <input
              type="text"
              required
              placeholder="e.g. CSE26-064"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-3 py-2 text-xs text-white font-mono"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Run AI Marking Evaluation</span>
          </button>
        </form>
      </div>
    </div>
  );
}
