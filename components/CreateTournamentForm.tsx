import React, { useState, useEffect, useMemo } from 'react';
import { Tournament, TournamentType, Team, Stadium, TournamentConfig, TournamentHeader } from '../types';
import BrutalistCard from './BrutalistCard';
import BrutalistButton from './BrutalistButton';

const AI_TEAM_NAMES = ["Thunder Gods", "Shadow Strikers", "Neon Knights", "Cyber Challengers", "Void Vipers", "Pixel Pirates", "Binary Batters", "Glitch Guardians", "Discord Dynamos", "Circuit Kings", "Logic Lions", "Server Smashers"];
const AI_STADIUMS = ["The Grid Arena", "Discord Dome", "Vertex Oval", "Fragment Field", "Matrix Stadium", "Buffer Bowl", "Packet Park", "Gateway Grounds"];
const SITE_LOGO = "https://i.ibb.co/W4YnxfBP/file-00000000743071f488fdc3b85eadcd3d.png";

interface CreateTournamentFormProps {
  onCreate: (tournament: Tournament) => void;
}

const CreateTournamentForm: React.FC<CreateTournamentFormProps> = ({ onCreate }) => {
  // Panel 1 & 2
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [type] = useState<TournamentType>('LIMITED_OVERS');

  // Panel 3
  const [overs, setOvers] = useState('20');
  const [customOvers, setCustomOvers] = useState('');
  const [seriesLength, setSeriesLength] = useState('1-1');

  // Panel 4
  const [numTeams, setNumTeams] = useState(8);
  const [teams, setTeams] = useState<Team[]>([]);

  // Panel 5
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [currentStadium, setCurrentStadium] = useState('');

  // Panel 6
  const [scheduleFormat, setScheduleFormat] = useState('SINGLE ROUND ROBIN (SRR)');
  const [playoffSystem, setPlayoffSystem] = useState('SEMI-FINAL SYSTEM (TOP 4)');
  const [groupCount, setGroupCount] = useState(2);

  // Panel 8
  const [winPts, setWinPts] = useState(2);
  const [drawPts, setDrawPts] = useState(1);
  const [lossPts, setLossPts] = useState(0);

  // Panel 9/Header State (Kept for submission logic even if UI panel removed)
  const [headerConfirmed, setHeaderConfirmed] = useState(true);

  // Auto-fill Logic
  useEffect(() => {
    const newTeams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
      id: `team-${i}-${Date.now()}`,
      name: teams[i]?.name || '',
      logoUrl: teams[i]?.logoUrl || '',
      owner: teams[i]?.owner || '',
      seriesPlayed: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchesDrawn: 0,
      matchesTie: 0,
      matchesNR: 0,
      basePoints: 0,
      bonusPoints: 0,
      penaltyPoints: 0,
      totalPoints: 0,
      pct: 0,
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
    }));
    setTeams(newTeams);
  }, [numTeams]);

  const handleImageUpload = (file: File | null, callback: (base64: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => callback(reader.result as string);
    reader.readAsDataURL(file);
  };

  const fillAiTeams = () => {
    setTeams(teams.map((t, i) => ({
      ...t,
      name: AI_TEAM_NAMES[i % AI_TEAM_NAMES.length] + " " + (Math.floor(i / AI_TEAM_NAMES.length) + 1)
    })));
  };

  const fillAiStadiums = () => {
    setStadiums(AI_STADIUMS.map(s => ({ id: Math.random().toString(), name: s })));
  };

  const addStadium = () => {
    if (currentStadium.trim()) {
      setStadiums([...stadiums, { id: Date.now().toString(), name: currentStadium.toUpperCase() }]);
      setCurrentStadium('');
    }
  };

  const matchCalculation = useMemo(() => {
    const N = numTeams;
    let base = 0;
    if (scheduleFormat.includes('SINGLE ROUND ROBIN')) base = (N * (N - 1)) / 2;
    else if (scheduleFormat.includes('DOUBLE ROUND ROBIN')) base = N * (N - 1);
    else if (scheduleFormat.includes('1.5 ROUND ROBIN')) base = ((N * (N - 1)) / 2) + (N / 2);
    else if (scheduleFormat.includes('GROUP STAGE')) {
      const perGroup = Math.ceil(N / groupCount);
      base = groupCount * (perGroup * (perGroup - 1) / 2);
    }
    else if (scheduleFormat.includes('KNOCKOUT')) base = N - 1;
    else if (scheduleFormat.includes('DOUBLE ELIMINATION')) base = (2 * N) - 2;

    let playoffs = 0;
    if (playoffSystem.includes('SEMI-FINAL')) playoffs = 3;
    else if (playoffSystem.includes('PAGE PLAYOFF')) playoffs = 4;
    else if (playoffSystem.includes('FINAL ONLY')) playoffs = 1;
    else if (playoffSystem.includes('TOP 8')) playoffs = 7;
    else if (playoffSystem.includes('STEPLADDER')) playoffs = 3;

    return base + playoffs;
  }, [numTeams, scheduleFormat, playoffSystem, groupCount]);

  const isValid = name.trim() && teams.every(t => t.name.trim()) && stadiums.length > 0;

  const handleSubmit = () => {
    if (!isValid) return alert("Please fill all required fields (*)");

    const finalTournament: Tournament = {
      id: Date.now().toString(),
      name: name.toUpperCase(),
      type: 'LIMITED_OVERS',
      createdDate: new Date().toLocaleDateString(),
      teams,
      stadiums,
      matches: [],
      penalties: [],
      teamsCount: teams.length,
      header: {
        siteLogoUrl: SITE_LOGO,
        tournamentName: name.toUpperCase(),
        tournamentLogoUrl: logoUrl,
        confirmed: true
      },
      config: {
        seriesLength,
        oversPerMatch: overs === 'Custom' ? customOvers : (overs === 'TheHundreds' ? '100 Balls' : overs),
        scheduleFormat,
        playoffSystem,
        pointsForWin: winPts,
        pointsForDraw: drawPts,
        pointsForLoss: lossPts,
        countSeriesBonus: false,
        pointsForSeriesWin: 0,
        pointsForSeriesDraw: 0,
        officials: [],
        groupCount: scheduleFormat.includes('GROUP') ? groupCount : undefined
      }
    };
    onCreate(finalTournament);
  };

  return (
    <div className="space-y-12 pb-40 max-w-6xl mx-auto">
      
      {/* PANEL 1: TOURNAMENT BASIC INFORMATION */}
      <BrutalistCard title="PANEL 1: TOURNAMENT BASIC INFORMATION" variant="yellow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block font-black text-xl mb-2">TOURNAMENT NAME *</label>
              <input 
                className="w-full brutalist-border p-4 text-2xl font-black uppercase outline-none focus:bg-white bg-white/50" 
                value={name} onChange={e => setName(e.target.value)} placeholder="E.G. PREMIER LEAGUE"
              />
            </div>
            <div>
              <label className="block font-black text-sm mb-2 uppercase">Tournament Logo * (Upload Only)</label>
              <div className="flex gap-4">
                <input 
                  type="file" id="t-logo-up" className="hidden" accept="image/*"
                  onChange={e => handleImageUpload(e.target.files?.[0] || null, setLogoUrl)}
                />
                <label htmlFor="t-logo-up" className="w-full brutalist-border bg-white p-6 font-black text-center cursor-pointer hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_black]">
                  {logoUrl ? "CHANGE LOGO IMAGE" : "UPLOAD TOURNAMENT LOGO"}
                </label>
              </div>
            </div>
          </div>
          <div className="brutalist-border bg-white flex items-center justify-center p-4 min-h-[180px] shadow-[8px_8px_0px_black]">
            {logoUrl ? (
              <div className="relative group">
                <img src={logoUrl} alt="Preview" className="max-h-32 object-contain" />
                <button onClick={() => setLogoUrl('')} className="absolute -top-2 -right-2 bg-rose-500 text-white w-6 h-6 rounded-full font-black text-xs brutalist-border shadow-[2px_2px_0px_black]">X</button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-4xl opacity-20 mb-2">🖼️</div>
                <span className="font-black text-gray-300 uppercase italic">Logo Preview Area</span>
              </div>
            )}
          </div>
        </div>
      </BrutalistCard>

      {/* PANEL 2: TOURNAMENT TYPE */}
      <BrutalistCard title="PANEL 2: TOURNAMENT TYPE SELECTION" variant="cyan">
        <div className="grid grid-cols-2 gap-4">
          <button disabled className="p-10 brutalist-border text-2xl font-black uppercase bg-gray-200 text-gray-400 cursor-not-allowed opacity-50 relative overflow-hidden">
            TEST MATCH
            <span className="absolute top-2 right-2 bg-black text-white px-2 py-0.5 text-[8px]">DISABLED</span>
          </button>
          <button className="p-10 brutalist-border text-2xl font-black uppercase bg-black text-white shadow-none translate-x-1 translate-y-1">
            LIMITED OVERS
            <span className="block text-xs text-yellow-400 mt-2 font-mono">SELECTED MODE</span>
          </button>
        </div>
      </BrutalistCard>

      {/* PANEL 3: FORMAT CONFIGURATION */}
      <BrutalistCard title="PANEL 3: FORMAT CONFIGURATION" variant="magenta">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <label className="block font-black text-xl mb-2">OVERS PER MATCH</label>
            <div className="grid grid-cols-2 gap-2">
              {['5', '10', '15', 'TheHundreds', '20', 'Custom'].map(o => (
                <button 
                  key={o} onClick={() => setOvers(o)}
                  className={`p-3 brutalist-border font-black uppercase text-sm ${overs === o ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                >
                  {o === 'TheHundreds' ? 'THE HUNDREDS' : (o === 'Custom' ? 'CUSTOM' : `${o} OVERS`)}
                </button>
              ))}
            </div>
            {overs === 'Custom' && (
              <input 
                className="w-full brutalist-border p-4 font-black uppercase bg-white mt-2 animate-in slide-in-from-top-2" 
                placeholder="WRITE OVERS (E.G. 50)" value={customOvers} onChange={e => setCustomOvers(e.target.value)} 
              />
            )}
          </div>
          <div className="space-y-4">
            <label className="block font-black text-xl mb-2">SERIES LENGTH</label>
            <select className="w-full brutalist-border p-4 font-black text-xl uppercase bg-white outline-none" value={seriesLength} onChange={e => setSeriesLength(e.target.value)}>
              <option value="1-1">SINGLE MATCH (1-1)</option>
              <option value="2-3">3 MATCH SERIES (2-3)</option>
              <option value="3-5">5 MATCH SERIES (3-5)</option>
              <option value="Custom">CUSTOM SERIES</option>
            </select>
          </div>
        </div>
      </BrutalistCard>

      {/* PANEL 4: TEAMS CONFIGURATION */}
      <BrutalistCard title="PANEL 4: TEAMS CONFIGURATION" variant="lime">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center gap-6 justify-between bg-black/5 p-4 brutalist-border">
            <div className="flex items-center gap-4">
              <label className="font-black text-xl">NUM OF TEAMS (8-32):</label>
              <input 
                type="number" min="8" max="32" value={numTeams} 
                onChange={e => setNumTeams(Number(e.target.value))}
                className="brutalist-border p-3 w-24 text-center font-black text-2xl bg-white"
              />
            </div>
            <BrutalistButton variant="secondary" onClick={fillAiTeams}>FILL AI TEAM NAMES</BrutalistButton>
          </div>
          
          <div className="brutalist-border bg-white overflow-hidden shadow-[10px_10px_0px_black]">
            <table className="w-full text-left">
              <thead className="bg-black text-white text-[10px] uppercase font-black">
                <tr>
                  <th className="p-4 border-r border-white/20 w-16 text-center">#</th>
                  <th className="p-4 border-r border-white/20">TEAM NAME *</th>
                  <th className="p-4 border-r border-white/20">LOGO (UPLOAD ONLY)</th>
                  <th className="p-4">OWNER NAME</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {teams.map((t, i) => (
                  <tr key={t.id} className="hover:bg-yellow-50">
                    <td className="p-4 font-black mono text-center bg-gray-50 border-r-2 border-black">{i+1}</td>
                    <td className="p-2 border-r-2 border-black">
                      <input 
                        className="w-full p-2 uppercase font-black outline-none focus:bg-white bg-transparent" 
                        value={t.name} placeholder={`TEAM ${i+1} NAME`}
                        onChange={e => {
                          const nt = [...teams]; nt[i].name = e.target.value; setTeams(nt);
                        }}
                      />
                    </td>
                    <td className="p-2 border-r-2 border-black">
                      <div className="flex items-center gap-2">
                        {t.logoUrl ? (
                          <div className="flex items-center gap-2">
                             <img src={t.logoUrl} className="w-8 h-8 brutalist-border bg-white cursor-pointer" alt="L" onClick={() => { const nt = [...teams]; nt[i].logoUrl = ''; setTeams(nt); }} />
                             <span className="text-[8px] font-black opacity-40 uppercase">Click to remove</span>
                          </div>
                        ) : (
                          <>
                            <input 
                              type="file" id={`team-logo-${i}`} className="hidden" accept="image/*"
                              onChange={e => handleImageUpload(e.target.files?.[0] || null, (b64) => {
                                const nt = [...teams]; nt[i].logoUrl = b64; setTeams(nt);
                              })}
                            />
                            <label htmlFor={`team-logo-${i}`} className="w-full brutalist-border bg-white p-2 font-black text-[10px] text-center cursor-pointer hover:bg-black hover:text-white transition-all">
                              UPLOAD IMAGE
                            </label>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <input 
                        className="w-full p-2 uppercase font-bold text-xs bg-transparent outline-none" 
                        value={t.owner} placeholder="OWNER (OPTIONAL)"
                        onChange={e => {
                          const nt = [...teams]; nt[i].owner = e.target.value; setTeams(nt);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </BrutalistCard>

      {/* PANEL 5: STADIUM / VENUE SETUP */}
      <BrutalistCard title="PANEL 5: STADIUM / VENUE SETUP" variant="pink">
        <div className="space-y-6">
          <div className="flex gap-4">
            <input 
              className="flex-grow brutalist-border p-4 font-black uppercase outline-none focus:bg-white bg-white/50" 
              placeholder="ENTER STADIUM NAME" value={currentStadium} onChange={e => setCurrentStadium(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStadium()}
            />
            <BrutalistButton variant="success" onClick={addStadium}>ADD VENUE</BrutalistButton>
            <BrutalistButton variant="primary" onClick={fillAiStadiums}>FILL AI VENUES</BrutalistButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stadiums.map((s, i) => (
              <div key={s.id} className="brutalist-border p-3 bg-white flex justify-between items-center group shadow-[4px_4px_0px_black] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                <span className="font-black uppercase text-[10px] tracking-tight truncate">{i+1}. {s.name}</span>
                <button onClick={() => setStadiums(stadiums.filter(st => st.id !== s.id))} className="text-rose-600 font-black text-[8px] hover:underline">REMOVE</button>
              </div>
            ))}
            {stadiums.length === 0 && <div className="col-span-4 p-8 text-center text-gray-400 italic font-black uppercase">No stadiums added yet *</div>}
          </div>
        </div>
      </BrutalistCard>

      {/* PANEL 6: STRUCTURE & PLAYOFF SELECTION */}
      <BrutalistCard title="PANEL 6: STRUCTURE & PLAYOFF SELECTION" variant="cyan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block font-black text-xl">SCHEDULE FORMAT</label>
              <select className="w-full brutalist-border p-4 font-black uppercase bg-white outline-none" value={scheduleFormat} onChange={e => setScheduleFormat(e.target.value)}>
                <option>SINGLE ROUND ROBIN (SRR)</option>
                <option>DOUBLE ROUND ROBIN (DRR)</option>
                <option>1.5 ROUND ROBIN</option>
                <option>PARTIAL / UNBALANCED ROUND ROBIN</option>
                <option>GROUP STAGE ROUND ROBIN</option>
                <option>SUPER STAGE (SUPER 6 / 8)</option>
                <option>ROUND ROBIN + FINAL</option>
                <option>ROUND ROBIN + PLAYOFFS (TOP 4)</option>
                <option>PAGE PLAYOFF SYSTEM (IPL STYLE)</option>
                <option>KNOCKOUT (SINGLE ELIMINATION)</option>
                <option>DOUBLE ELIMINATION</option>
              </select>
            </div>
            
            {scheduleFormat === 'GROUP STAGE ROUND ROBIN' && (
              <div className="p-4 brutalist-border bg-white animate-in slide-in-from-top-4 space-y-4">
                 <label className="block font-black text-xs uppercase">Select Groups (1 to 10)</label>
                 <div className="flex gap-2">
                   {[2, 3, 4, 6, 8].map(g => (
                     <button key={g} onClick={() => setGroupCount(g)} className={`flex-1 p-2 brutalist-border font-black ${groupCount === g ? 'bg-black text-white' : 'bg-gray-50'}`}>{g}</button>
                   ))}
                 </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block font-black text-xl">PLAYOFF SYSTEM</label>
              <select className="w-full brutalist-border p-4 font-black uppercase bg-white outline-none" value={playoffSystem} onChange={e => setPlayoffSystem(e.target.value)}>
                <option>FINAL ONLY (TOP 2 FINAL)</option>
                <option>SEMI-FINAL SYSTEM (TOP 4)</option>
                <option>PAGE PLAYOFF SYSTEM (IPL STYLE)</option>
                <option>KNOCKOUT PLAYOFF (TOP 8 / 16)</option>
                <option>DOUBLE ELIMINATION PLAYOFF</option>
                <option>SUPER LEAGUE PLAYOFF</option>
                <option>STEPLADDER PLAYOFF</option>
                <option>QUALIFIER + FINAL (TOP 3)</option>
                <option>SUPER OVER PLAYOFF (TIE-BREAK)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col justify-center">
             <div className="bg-black text-white p-8 brutalist-border shadow-[10px_10px_0px_#22d3ee]">
                <h4 className="mono text-[10px] font-black text-cyan-400 mb-2 uppercase">PANEL 6.1: AUTO MATCHES CALCULATOR</h4>
                <div className="text-6xl font-black italic tracking-tighter leading-none">{matchCalculation}</div>
                <p className="font-black text-sm mt-2 uppercase">Total Estimated Matches</p>
                <div className="mt-6 space-y-1 opacity-60 mono text-[9px] uppercase">
                  <p>• Teams: {numTeams}</p>
                  <p>• Format: {scheduleFormat.substring(0, 20)}...</p>
                  <p>• Calculations: Dynamic Combination Logic</p>
                </div>
             </div>
          </div>
        </div>
      </BrutalistCard>

      {/* PANEL 8: POINTS FORMULA */}
      <BrutalistCard title="PANEL 8: POINTS FORMULA" variant="blue">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="space-y-2">
             <label className="block font-black text-xs uppercase text-gray-400">Points for Win</label>
             <input type="number" className="w-full brutalist-border p-4 font-black text-3xl bg-white" value={winPts} onChange={e => setWinPts(Number(e.target.value))} />
           </div>
           <div className="space-y-2">
             <label className="block font-black text-xs uppercase text-gray-400">Points for Draw/NR</label>
             <input type="number" className="w-full brutalist-border p-4 font-black text-3xl bg-white" value={drawPts} onChange={e => setDrawPts(Number(e.target.value))} />
           </div>
           <div className="space-y-2">
             <label className="block font-black text-xs uppercase text-gray-400">Points for Loss</label>
             <input type="number" className="w-full brutalist-border p-4 font-black text-3xl bg-white" value={lossPts} onChange={e => setLossPts(Number(e.target.value))} />
           </div>
        </div>
      </BrutalistCard>

      {/* CREATE ACTION */}
      <div className="sticky bottom-8 z-[60] px-4">
        <button 
          disabled={!isValid}
          onClick={handleSubmit}
          className={`w-full brutalist-border p-8 text-4xl font-black uppercase tracking-tighter transition-all shadow-[12px_12px_0px_black] active:shadow-none active:translate-x-2 active:translate-y-2 
            ${isValid ? 'bg-emerald-400 hover:bg-yellow-400 text-black cursor-pointer' : 'bg-gray-300 text-gray-400 cursor-not-allowed shadow-none'}`}
        >
          {isValid ? 'CREATE TOURNAMENT NOW' : 'COMPLETE REQUIRED FIELDS *'}
        </button>
      </div>

    </div>
  );
};

export default CreateTournamentForm;