import React, { useState } from 'react';
import { Tournament } from '../types';
import BrutalistButton from './BrutalistButton';
import BrutalistCard from './BrutalistCard';

interface ManageTournamentListProps {
  tournaments: Tournament[];
  onDelete: (id: string) => void;
  onEnter: (tournament: Tournament) => void;
}

const ManageTournamentList: React.FC<ManageTournamentListProps> = ({ tournaments, onDelete, onEnter }) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const handleDeleteAttempt = (t: Tournament) => {
    setDeleteConfirmId(t.id);
    setConfirmName('');
  };

  const finalizeDelete = (t: Tournament) => {
    if (confirmName === t.name) {
      onDelete(t.id);
      setDeleteConfirmId(null);
    } else {
      alert("Name mismatch! Type the tournament name exactly to delete.");
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <BrutalistCard title="SAVED TOURNAMENTS (EXCEL-STYLE LOG)" variant="white" compact>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-black text-white uppercase mono">
              <tr>
                <th className="p-4 border-r border-white/20 w-16 text-center">S.NO</th>
                <th className="p-4 border-r border-white/20">TOURNAMENT NAME</th>
                <th className="p-4 border-r border-white/20">TYPE</th>
                <th className="p-4 border-r border-white/20">OVERS</th>
                <th className="p-4 border-r border-white/20">TEAMS</th>
                <th className="p-4 border-r border-white/20">STATUS</th>
                <th className="p-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {tournaments.length > 0 ? tournaments.map((t, idx) => {
                const completed = t.matches.filter(m => m.status === 'COMPLETED').length;
                const statusColors = {
                  Upcoming: 'bg-gray-100 text-gray-400',
                  Ongoing: 'bg-sky-100 text-sky-600',
                  Completed: 'bg-emerald-100 text-emerald-600'
                };
                
                const status: keyof typeof statusColors = completed === 0 ? 'Upcoming' : (completed === t.matches.length ? 'Completed' : 'Ongoing');

                return (
                  <tr 
                    key={t.id} 
                    className="group hover:bg-yellow-50 transition-all bg-white/40 backdrop-blur-sm"
                  >
                    <td className="p-4 font-black mono border-r-2 border-black text-center">{idx + 1}</td>
                    <td className="p-4 font-black uppercase border-r-2 border-black text-sm relative group">
                      {t.name}
                      <div className="absolute left-full top-0 ml-4 hidden group-hover:block z-50 bg-black text-white p-4 text-[10px] w-48 brutalist-border shadow-[4px_4px_0px_white]">
                        <p className="font-black uppercase mb-1">METADATA LOG</p>
                        <p className="opacity-70">Created: {t.createdDate}</p>
                        <p className="opacity-70">Matches: {t.matches.length}</p>
                        <p className="opacity-70">Venues: {t.stadiums.length}</p>
                      </div>
                    </td>
                    <td className="p-4 border-r-2 border-black font-black uppercase text-rose-600">
                      LIMITED OVER
                    </td>
                    <td className="p-4 border-r-2 border-black font-black mono">
                      {t.config.oversPerMatch || 'N/A'}
                    </td>
                    <td className="p-4 border-r-2 border-black font-bold mono text-center">
                      <span className="bg-black text-white px-2 py-0.5">{t.teams.length}</span>
                    </td>
                    <td className="p-4 border-r-2 border-black">
                      <span className={`px-2 py-1 brutalist-border font-black text-[9px] uppercase ${statusColors[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      <BrutalistButton onClick={() => onEnter(t)} variant="success" compact>ENTER</BrutalistButton>
                      <BrutalistButton onClick={() => handleDeleteAttempt(t)} variant="danger" compact>DELETE</BrutalistButton>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="p-20 text-center bg-gray-50/30">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-7xl opacity-20">🏏</span>
                      <p className="font-black uppercase text-xl text-gray-400 italic">No Limited Overs tournaments found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BrutalistCard>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <BrutalistCard title="⚠️ SECURITY OVERRIDE" className="max-w-md w-full bg-white">
            <div className="space-y-6">
              <p className="font-black uppercase text-xs text-rose-600">This action is destructive and irreversible.</p>
              <div className="bg-rose-50 p-4 brutalist-border border-rose-600">
                 <p className="text-[10px] uppercase font-black opacity-50 mb-1">Target Identity:</p>
                 <p className="text-2xl font-black uppercase text-rose-700">{tournaments.find(t => t.id === deleteConfirmId)?.name}</p>
              </div>
              <div>
                <label className="block font-black text-[10px] uppercase mb-2">Type tournament name exactly to authorize:</label>
                <input 
                  className="w-full brutalist-border p-4 font-black uppercase outline-none focus:bg-rose-50 border-rose-600"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="AUTHORIZE DELETION"
                />
              </div>
              <div className="flex gap-4">
                <BrutalistButton variant="danger" className="flex-1 py-4" onClick={() => finalizeDelete(tournaments.find(t => t.id === deleteConfirmId)!)}>PERMANENT DELETE</BrutalistButton>
                <BrutalistButton variant="secondary" className="flex-1 py-4" onClick={() => setDeleteConfirmId(null)}>ABORT</BrutalistButton>
              </div>
            </div>
          </BrutalistCard>
        </div>
      )}
    </div>
  );
};

export default ManageTournamentList;