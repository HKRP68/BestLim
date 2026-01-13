import React, { useState, useMemo, useRef } from 'react';
import { Tournament, WorkspaceTab, Team, Match, MatchResultType, ResultLog } from '../types';
import BrutalistCard from './BrutalistCard';
import BrutalistButton from './BrutalistButton';
import * as htmlToImage from 'html-to-image';

interface TournamentWorkspaceProps {
  tournament: Tournament;
  onExit: () => void;
  onUpdateTournament: (updated: Tournament) => void;
}

const TournamentWorkspace: React.FC<TournamentWorkspaceProps> = ({ tournament, onExit, onUpdateTournament }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('CONTROL');
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [securityInput, setSecurityInput] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState<{ type: 'VOID' | 'LOCK' | 'GENERATE' | 'RESET'; matchId?: string } | null>(null);

  // Added missing state and toggle function for collapsible cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({ logs: false });

  const toggleCard = (key: string) => {
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  // Refs for downloads
  const controlPanelRef = useRef<HTMLDivElement>(null);
  const matchCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const resultsTabRef = useRef<HTMLDivElement>(null);
  const pointsTabRef = useRef<HTMLDivElement>(null);

  const isHundred = tournament.config.oversPerMatch === '100 Balls';
  const pointsConfig = { 
    win: isHundred ? 4 : (tournament.config.pointsForWin || 2), 
    draw: isHundred ? 2 : (tournament.config.pointsForDraw || 1), 
    loss: isHundred ? 0 : (tournament.config.pointsForLoss || 0) 
  };

  const [resultForm, setResultForm] = useState({
    t1Runs: '', t1Wickets: '', t1OversWhole: '', t1Balls: '0',
    t2Runs: '', t2Wickets: '', t2OversWhole: '', t2Balls: '0',
    notes: ''
  });

  const toDecimalOvers = (whole: number, balls: number): number => {
    return Number(whole) + (Number(balls) / 6);
  };

  const sortedMatches = useMemo(() => {
    return [...tournament.matches].sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
  }, [tournament.matches]);

  // --- LOGIC: ADVANCED DASHBOARD METRICS ---
  const standingsMap = useMemo(() => {
    const stats: Record<string, Team & { actualPoints: number; wicketsTaken: number; scoringRate: number; economyRate: number }> = {};
    tournament.teams.forEach(t => {
      stats[t.id] = { 
        ...t, 
        matchesPlayed: 0, matchesWon: 0, matchesLost: 0, matchesDrawn: 0, matchesTie: 0, matchesNR: 0,
        totalPoints: 0, runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0, nrr: 0, form: [],
        actualPoints: 0, wicketsTaken: 0, scoringRate: 0, economyRate: 0
      };
    });

    const maxOvers = isHundred ? 100 : (parseFloat(tournament.config.oversPerMatch || '20') || 20);

    tournament.matches.filter(m => m.status === 'COMPLETED').forEach(m => {
      const t1 = stats[m.team1Id];
      const t2 = stats[m.team2Id];
      if (!t1 || !t2) return;

      t1.matchesPlayed++; t2.matchesPlayed++;
      if (m.resultType === 'T1_WIN') { t1.matchesWon++; t1.actualPoints += pointsConfig.win; t2.actualPoints += pointsConfig.loss; }
      else if (m.resultType === 'T2_WIN') { t2.matchesWon++; t2.actualPoints += pointsConfig.win; t1.actualPoints += pointsConfig.loss; }
      else { t1.actualPoints += pointsConfig.draw; t2.actualPoints += pointsConfig.draw; }

      let t1VolFaced, t2VolFaced, t1VolBowled, t2VolBowled;
      if (isHundred) {
        t1VolFaced = m.t1Wickets === 10 ? 100 : (m.t1OversWhole || 0);
        t2VolFaced = m.t2Wickets === 10 ? 100 : (m.t2OversWhole || 0);
        t1VolBowled = m.t1Wickets === 10 ? 100 : (m.t1OversWhole || 0); 
        t2VolBowled = m.t2Wickets === 10 ? 100 : (m.t2OversWhole || 0);
      } else {
        t1VolFaced = m.t1Wickets === 10 ? maxOvers : toDecimalOvers(m.t1OversWhole || 0, m.t1Balls || 0);
        t2VolFaced = m.t2Wickets === 10 ? maxOvers : toDecimalOvers(m.t2OversWhole || 0, m.t2Balls || 0);
      }

      t1.runsScored += m.t1Runs || 0; t1.oversFaced += t1VolFaced; t1.runsConceded += m.t2Runs || 0; t1.oversBowled += t2VolFaced;
      t2.runsScored += m.t2Runs || 0; t2.oversFaced += t2VolFaced; t2.runsConceded += m.t1Runs || 0; t2.oversBowled += t1VolFaced;
      
      t1.wicketsTaken += m.t2Wickets || 0;
      t2.wicketsTaken += m.t1Wickets || 0;
    });

    Object.values(stats).forEach(s => {
      const rrS = s.oversFaced > 0 ? s.runsScored / s.oversFaced : 0;
      const rrC = s.oversBowled > 0 ? s.runsConceded / s.oversBowled : 0;
      s.nrr = rrS - rrC;
      s.scoringRate = rrS;
      s.economyRate = rrC;
    });
    return stats;
  }, [tournament.matches, tournament.teams, isHundred, pointsConfig]);

  const standings = useMemo(() => {
    const list = Object.values(standingsMap) as any[];
    return list.sort((a, b) => {
      if (b.actualPoints !== a.actualPoints) return b.actualPoints - a.actualPoints;
      if ((b.nrr || 0) !== (a.nrr || 0)) return (b.nrr || 0) - (a.nrr || 0);
      return b.scoringRate - a.scoringRate;
    });
  }, [standingsMap]);

  const dashMetrics = useMemo(() => {
    const completed = tournament.matches.filter(m => m.status === 'COMPLETED');
    const mostRunsTeam = [...standings].sort((a,b) => b.runsScored - a.runsScored)[0];
    const mostWicketsTeam = [...standings].sort((a,b) => b.wicketsTaken - a.wicketsTaken || a.economyRate - b.economyRate)[0];
    const highestScoringRateTeam = [...standings].sort((a,b) => b.scoringRate - a.scoringRate)[0];
    const bestEconomyTeam = [...standings].filter(s => s.oversBowled > 0).sort((a,b) => a.economyRate - b.economyRate)[0];

    const totalRounds = Math.max(0, ...tournament.matches.map(m => m.round));
    const roundProgress = Array.from({ length: totalRounds }, (_, i) => {
      const r = i + 1;
      const roundMatches = tournament.matches.filter(m => m.round === r);
      const done = roundMatches.filter(m => m.status === 'COMPLETED').length;
      return { round: r, completed: done, total: roundMatches.length };
    });

    return { mostRunsTeam, mostWicketsTeam, highestScoringRateTeam, bestEconomyTeam, roundProgress };
  }, [tournament.matches, standings]);

  const handleUpdate = (updates: Partial<Tournament>, logAction?: string) => {
    const newLogs: ResultLog[] = logAction ? [{
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      action: logAction.toUpperCase(),
      reason: 'Admin Action',
      user: 'SYSTEM_ADMIN'
    }, ...(tournament.logs || [])] : (tournament.logs || []);
    onUpdateTournament({ ...tournament, ...updates, logs: newLogs });
  };

  const handleScoreChange = (field: string, value: string) => {
    let finalValue = value;
    const num = parseInt(value);
    if (field.includes('Runs')) {
      if (num < 0) return;
      if (num > 9999) finalValue = '9999';
    } else if (field.includes('Wickets')) {
      if (num < 0) finalValue = '0';
      if (num > 10) finalValue = '10';
    } else if (field.includes('OversWhole')) {
      const limit = isHundred ? 100 : (parseInt(tournament.config.oversPerMatch || '20') || 20);
      if (num < 0) finalValue = '0';
      if (num > limit) finalValue = limit.toString();
    }
    setResultForm(prev => ({ ...prev, [field]: finalValue }));
  };

  const handleSaveResult = (matchId: string) => {
    if (tournament.isLocked) return alert("ENGINE LOCKED.");
    const m = tournament.matches.find(m => m.id === matchId);
    if (!m) return;
    const t1R = parseInt(resultForm.t1Runs) || 0;
    const t2R = parseInt(resultForm.t2Runs) || 0;
    let type: MatchResultType = 'TIE';
    let winnerId: string | undefined = undefined;
    if (t1R > t2R) { type = 'T1_WIN'; winnerId = m.team1Id; } else if (t2R > t1R) { type = 'T2_WIN'; winnerId = m.team2Id; }
    const updatedMatches = tournament.matches.map(match => match.id === matchId ? {
        ...match, status: 'COMPLETED' as const,
        t1Runs: t1R, t1Wickets: parseInt(resultForm.t1Wickets) || 0, t1OversWhole: parseInt(resultForm.t1OversWhole) || 0, t1Balls: parseInt(resultForm.t1Balls) || 0,
        t2Runs: t2R, t2Wickets: parseInt(resultForm.t2Wickets) || 0, t2OversWhole: parseInt(resultForm.t2OversWhole) || 0, t2Balls: parseInt(resultForm.t2Balls) || 0,
        resultType: type, winnerId
    } : match);
    handleUpdate({ matches: updatedMatches }, `Result Entered: Match ${matchId}`);
    setEditingMatchId(null);
  };

  const downloadElement = async (el: HTMLElement | null, filename: string) => {
    if (!el) return;
    setIsDownloading(true);
    try {
      const dataUrl = await htmlToImage.toPng(el, { backgroundColor: '#ffffff', quality: 1 });
      const link = document.createElement('a');
      link.download = `${filename}_${Date.now()}.png`;
      link.href = dataUrl; link.click();
    } catch (e) { alert("Download failed."); } finally { setIsDownloading(false); }
  };

  const generateSchedule = () => {
    if (tournament.isLocked) return alert("ENGINE LOCKED.");
    const teams = tournament.teams.map(t => t.id);
    const venues = tournament.stadiums.map(s => s.id);
    if (teams.length < 2 || venues.length === 0) return alert("Insufficient data.");
    const newMatches: Match[] = [];
    let matchIdCounter = 1;
    for (let r = 0; r < teams.length - 1; r++) {
      for (let m = 0; m < teams.length / 2; m++) {
        newMatches.push({
          id: `M-${matchIdCounter++}`,
          round: r + 1,
          seriesId: 'NONE',
          team1Id: teams[m],
          team2Id: teams[teams.length - 1 - m],
          venueId: venues[Math.floor(Math.random() * venues.length)],
          status: 'NOT_STARTED'
        });
      }
      teams.splice(1, 0, teams.pop()!);
    }
    handleUpdate({ matches: newMatches }, 'Schedule Generated');
  };

  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-[200] bg-white border-b-4 border-black px-4 py-3 flex items-center justify-between no-print brutalist-shadow">
        <div className="w-12 h-12 brutalist-border bg-white flex items-center justify-center p-1 shadow-[3px_3px_0px_black] overflow-hidden group">
            {tournament.header.tournamentLogoUrl ? (
              <img src={tournament.header.tournamentLogoUrl} className="max-h-full" alt="L" />
            ) : <span className="text-2xl">🏏</span>}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => setActiveTab('CONTROL')}>
              <span className="text-[8px] text-white font-black uppercase">Edit</span>
            </div>
        </div>
        <div className="text-center flex-grow px-4">
            <h1 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter leading-none truncate">{tournament.name}</h1>
            <p className="text-[8px] font-black uppercase opacity-60 tracking-widest mt-0.5">UNIFIED TOURNAMENT CONTROL</p>
        </div>
        <div className="w-12 h-12 brutalist-border bg-black flex items-center justify-center p-1 shadow-[3px_3px_0px_white]">
            <img src={tournament.header.siteLogoUrl} className="w-8 h-8 invert" alt="S" />
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 no-print bg-black p-2 brutalist-border shadow-[4px_4px_0px_white] sticky top-[76px] z-[150]">
        {(['CONTROL', 'SCHEDULE', 'RESULTS', 'POINTS', 'SECURITY'] as WorkspaceTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 brutalist-border font-black text-[10px] uppercase transition-all bg-white hover:bg-yellow-50 shadow-[3px_3px_0px_black] ${activeTab === tab ? 'bg-yellow-400 text-black translate-x-1 translate-y-1' : ''}`}
          >
            {tab === 'POINTS' ? 'POINT TABLE' : tab.replace('_', ' ')}
          </button>
        ))}
      </nav>

      <div className="animate-in max-w-7xl mx-auto px-4 pb-20">
        
        {/* UNIFIED CONTROL TAB */}
        {activeTab === 'CONTROL' && (
          <div className="space-y-8" ref={controlPanelRef}>
            
            {/* SECTION 1: IDENTITY */}
            <BrutalistCard title="SECTION 1: TOURNAMENT IDENTITY" variant="white">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-3 flex flex-col items-center justify-center relative group">
                  <div className="w-full aspect-square brutalist-border bg-gray-50 flex items-center justify-center p-4 overflow-hidden shadow-[8px_8px_0px_black]">
                    {tournament.header.tournamentLogoUrl ? <img src={tournament.header.tournamentLogoUrl} className="max-h-full" alt="L" /> : <span className="text-6xl opacity-20">🏏</span>}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                      <input 
                        type="file" 
                        id="workspace-logo-up" 
                        className="hidden" 
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              handleUpdate({ header: { ...tournament.header, tournamentLogoUrl: reader.result as string } }, 'Logo Updated');
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                      <label htmlFor="workspace-logo-up" className="text-[10px] p-2 bg-white brutalist-border font-black uppercase cursor-pointer hover:bg-yellow-400">UPLOAD NEW</label>
                    </div>
                  </div>
                  <p className="mt-4 text-[8px] font-black uppercase opacity-40">Hover to edit logo</p>
                </div>
                <div className="md:col-span-9 grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 brutalist-border shadow-[4px_4px_0px_black] group">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1">Name <span className="opacity-10">LOCKED</span></p>
                    <p className="font-black text-xl italic uppercase truncate">{tournament.name}</p>
                  </div>
                  <div className="p-3 bg-gray-50 brutalist-border shadow-[4px_4px_0px_black] relative">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1">Type</p>
                    <p className="font-black text-xl italic uppercase">Limited Overs</p>
                    <span className="absolute top-1 right-1 text-[6px] bg-black text-white px-1">LOCKED</span>
                  </div>
                  <div className="p-3 bg-gray-50 brutalist-border shadow-[4px_4px_0px_black]">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1">Overs Engine</p>
                    <p className="font-black text-xl italic uppercase">{tournament.config.oversPerMatch}</p>
                  </div>
                  <div className="p-3 bg-gray-50 brutalist-border shadow-[4px_4px_0px_black]">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1">Teams</p>
                    <p className="font-black text-xl italic uppercase">{tournament.teams.length}</p>
                  </div>
                  <div className="p-3 bg-gray-50 brutalist-border shadow-[4px_4px_0px_black]">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1">Venues</p>
                    <p className="font-black text-xl italic uppercase">{tournament.stadiums.length}</p>
                  </div>
                  <div className="p-3 bg-gray-50 brutalist-border shadow-[4px_4px_0px_black]">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1">Created</p>
                    <p className="font-black text-xl italic uppercase">{tournament.createdDate}</p>
                  </div>
                  <div className="col-span-2 md:col-span-3 p-3 bg-white brutalist-border border-dashed">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1">Description</p>
                    <textarea 
                      className="w-full bg-transparent font-black text-sm outline-none resize-none" 
                      rows={2} 
                      placeholder="ENTER TOURNAMENT BIO..."
                      value={tournament.description || ''}
                      onChange={(e) => onUpdateTournament({ ...tournament, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </BrutalistCard>

            {/* SECTION 2: LIVE DASHBOARD */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Card A: Status */}
                <BrutalistCard title="MATCH STATUS" variant="cyan" compact>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-center">
                      <p className="text-2xl font-black italic">{tournament.matches.length}</p>
                      <p className="text-[8px] font-black uppercase opacity-60">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black italic text-emerald-600">{tournament.matches.filter(m => m.status === 'COMPLETED').length}</p>
                      <p className="text-[8px] font-black uppercase opacity-60">Done</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black italic text-sky-600">{tournament.matches.filter(m => m.status === 'IN_PROGRESS').length}</p>
                      <p className="text-[8px] font-black uppercase opacity-60">Live</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black italic opacity-40">{tournament.matches.filter(m => m.status === 'NOT_STARTED').length}</p>
                      <p className="text-[8px] font-black uppercase opacity-60">Remains</p>
                    </div>
                  </div>
                </BrutalistCard>

                {/* Card C: Qualification */}
                <BrutalistCard title="QUALIFICATION TRACKER" variant="yellow" compact>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between items-center bg-black text-white px-2 py-1">
                      <span className="text-[8px] font-black uppercase">Playoff Spots</span>
                      <span className="font-black italic">4</span>
                    </div>
                    <div className="text-[9px] font-black uppercase space-y-1">
                      {standings.slice(0, 4).map((s, i) => (
                        <div key={s.id} className="flex justify-between border-b border-black/10">
                          <span>{i+1}. {s.name}</span>
                          <span className="mono">{s.actualPoints}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </BrutalistCard>

                {/* Card D: Round Progress */}
                <BrutalistCard title="ROUND PROGRESS" variant="white" compact>
                  <div className="mt-2 space-y-3">
                    {dashMetrics.roundProgress.slice(0, 3).map(rp => (
                      <div key={rp.round} className="space-y-1">
                        <div className="flex justify-between text-[8px] font-black uppercase italic">
                          <span>ROUND {rp.round}</span>
                          <span>{rp.completed}/{rp.total}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 brutalist-border p-[1px]">
                          <div className="h-full bg-black" style={{ width: `${(rp.completed/rp.total)*100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </BrutalistCard>
              </div>

              {/* Card B: Leaderboard Snapshot */}
              <BrutalistCard title="LEADERBOARD SNAPSHOT (COMPLETED MATCHES ONLY)" variant="white">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-6 bg-yellow-400 p-4 brutalist-border shadow-[8px_8px_0px_black] relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 text-8xl opacity-10 font-black">1</div>
                    <h4 className="font-black uppercase italic text-sm mb-4 border-b-2 border-black pb-1">🏆 TOP 4 TEAMS (POINTS)</h4>
                    <div className="space-y-2">
                      {standings.slice(0, 4).map((s, i) => (
                        <div key={s.id} className="flex justify-between items-center bg-white p-2 brutalist-border group">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black italic opacity-20">#{i+1}</span>
                            <span className="font-black uppercase text-sm">{s.name}</span>
                            {standings.some((o, idx) => idx !== i && o.actualPoints === s.actualPoints) && (
                              <span className="bg-black text-white text-[6px] px-1 font-black animate-pulse">TIE</span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-black text-lg leading-none">{s.actualPoints}</p>
                            <p className="text-[8px] font-black mono opacity-40">NRR: {s.nrr.toFixed(3)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-6 grid grid-cols-2 gap-4">
                    <div className="p-3 bg-sky-100 brutalist-border shadow-[4px_4px_0px_black] group">
                      <p className="text-[8px] font-black uppercase opacity-40 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sky-500"></span> Batting Leader
                      </p>
                      <p className="font-black text-xs uppercase mt-2">{dashMetrics.mostRunsTeam?.name || '---'}</p>
                      <p className="text-xl font-black italic">{dashMetrics.mostRunsTeam?.runsScored || 0} Runs</p>
                    </div>
                    <div className="p-3 bg-violet-100 brutalist-border shadow-[4px_4px_0px_black]">
                      <p className="text-[8px] font-black uppercase opacity-40 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-violet-500"></span> Bowling Leader
                      </p>
                      <p className="font-black text-xs uppercase mt-2">{dashMetrics.mostWicketsTeam?.name || '---'}</p>
                      <p className="text-xl font-black italic">{dashMetrics.mostWicketsTeam?.wicketsTaken || 0} Wkts</p>
                    </div>
                    <div className="p-3 bg-lime-100 brutalist-border shadow-[4px_4px_0px_black]">
                      <p className="text-[8px] font-black uppercase opacity-40 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-lime-500"></span> Efficiency
                      </p>
                      <p className="font-black text-xs uppercase mt-2">{dashMetrics.highestScoringRateTeam?.name || '---'}</p>
                      <p className="text-lg font-black italic">{dashMetrics.highestScoringRateTeam?.scoringRate.toFixed(2)} {isHundred ? 'RPB' : 'RPO'}</p>
                    </div>
                    <div className="p-3 bg-emerald-100 brutalist-border shadow-[4px_4px_0px_black]">
                      <p className="text-[8px] font-black uppercase opacity-40 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Economy
                      </p>
                      <p className="font-black text-xs uppercase mt-2">{dashMetrics.bestEconomyTeam?.name || '---'}</p>
                      <p className="text-lg font-black italic">{dashMetrics.bestEconomyTeam?.economyRate.toFixed(2)} ECON</p>
                    </div>
                  </div>
                </div>
              </BrutalistCard>
            </div>

            {/* SECTION 3: RULES SUMMARY */}
            <BrutalistCard title="SECTION 3: ACTIVE TOURNAMENT RULES" variant="blue" compact>
              <div className="flex flex-wrap gap-4 py-2">
                <div className="bg-white brutalist-border px-3 py-1 flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase opacity-40">Points</span>
                  <span className="font-black text-[10px]">{pointsConfig.win}/{pointsConfig.draw}/{pointsConfig.loss}</span>
                </div>
                <div className="bg-white brutalist-border px-3 py-1 flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase opacity-40">Overs</span>
                  <span className="font-black text-[10px]">{tournament.config.oversPerMatch}</span>
                </div>
                <div className="bg-white brutalist-border px-3 py-1 flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase opacity-40">NRR Method</span>
                  <span className="font-black text-[10px] italic">Balls Faced/Bowled</span>
                </div>
                <div className="bg-white brutalist-border px-3 py-1 flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase opacity-40">Downloads</span>
                  <span className="font-black text-[10px]">{tournament.config.downloadsEnabled ? 'ENABLED' : 'DISABLED'}</span>
                </div>
                <div className="bg-white brutalist-border px-3 py-1 flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase opacity-40">Penalties</span>
                  <span className="font-black text-[10px]">{tournament.config.penaltiesEnabled ? 'ENABLED' : 'DISABLED'}</span>
                </div>
              </div>
            </BrutalistCard>

            {/* SECTION 4: SETTINGS */}
            <BrutalistCard title="SECTION 4: CONTROLLED SETTINGS & ACTIONS" variant="magenta">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Part A: Safe Edits */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black uppercase opacity-40 border-b border-black">PART A: TOURNAMENT BRAND</h5>
                  <div>
                    <label className="text-[8px] font-black uppercase mb-1 block">Display Name</label>
                    <input className="w-full brutalist-border p-2 font-black uppercase bg-white text-black" value={tournament.name} onChange={(e) => handleUpdate({ name: e.target.value.toUpperCase() }, 'Name Edited')} />
                  </div>
                  <BrutalistButton variant="secondary" className="w-full" onClick={() => downloadElement(controlPanelRef.current, "Control_Snapshot")}>SAVE SNAPSHOT</BrutalistButton>
                </div>
                {/* Part B: Toggles */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black uppercase opacity-40 border-b border-black">PART B: FEATURE TOGGLES</h5>
                  <div className="flex items-center justify-between p-2 brutalist-border bg-white text-black">
                    <span className="text-[10px] font-black uppercase">Enable Downloads</span>
                    <input type="checkbox" className="w-4 h-4" checked={tournament.config.downloadsEnabled} onChange={() => handleUpdate({ config: { ...tournament.config, downloadsEnabled: !tournament.config.downloadsEnabled } }, 'Toggled Downloads')} />
                  </div>
                  <div className="flex items-center justify-between p-2 brutalist-border bg-white text-black">
                    <span className="text-[10px] font-black uppercase">Penalty Tracking</span>
                    <input type="checkbox" className="w-4 h-4" checked={tournament.config.penaltiesEnabled} onChange={() => handleUpdate({ config: { ...tournament.config, penaltiesEnabled: !tournament.config.penaltiesEnabled } }, 'Toggled Penalties')} />
                  </div>
                  <BrutalistButton variant={tournament.isLocked ? 'success' : 'danger'} className="w-full" onClick={() => setShowSecurityModal({ type: 'LOCK' })}>{tournament.isLocked ? 'UNLOCK SYSTEM' : 'LOCK ENGINE'}</BrutalistButton>
                </div>
                {/* Part C: Security */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black uppercase opacity-40 border-b border-black">PART C: DATA SECURITY</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <BrutalistButton variant="secondary" compact onClick={() => {
                      const blob = new Blob([JSON.stringify(tournament)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `${tournament.name}_BACKUP.json`; a.click();
                    }}>EXPORT JSON</BrutalistButton>
                    <BrutalistButton variant="secondary" compact onClick={() => alert("Ready for Import (Mock)")}>IMPORT DATA</BrutalistButton>
                  </div>
                  <BrutalistButton variant="danger" className="w-full py-4 text-xs" onClick={() => setShowSecurityModal({ type: 'RESET' })}>FACTORY SYSTEM RESET</BrutalistButton>
                </div>
              </div>
            </BrutalistCard>

            {/* SECTION 5: AUDIT LOG */}
            <div className="brutalist-border bg-black text-white overflow-hidden">
              <div className="p-3 font-black uppercase flex justify-between items-center cursor-pointer" onClick={() => toggleCard('logs')}>
                <span className="text-sm">SECTION 5: SYSTEM ACTIVITY AUDIT LOG</span>
                <span>{expandedCards.logs ? '▼' : '▲'}</span>
              </div>
              {expandedCards.logs && (
                <div className="max-h-64 overflow-y-auto p-4 space-y-2 bg-zinc-900 mono text-[9px] uppercase">
                  {tournament.logs?.map(log => (
                    <div key={log.id} className="flex gap-4 border-b border-white/10 pb-1">
                      <span className="text-emerald-400">[{log.timestamp}]</span>
                      <span className="text-yellow-400">{log.action}</span>
                      <span className="opacity-40">{log.reason}</span>
                    </div>
                  ))}
                  {(!tournament.logs || tournament.logs.length === 0) && <p className="opacity-20 italic">No activity recorded yet.</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RESULTS TAB */}
        {activeTab === 'RESULTS' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-black text-white p-4 brutalist-border shadow-[4px_4px_0px_magenta]">
                <h3 className="text-xl font-black italic uppercase leading-none">Official Results Database</h3>
                <BrutalistButton variant="secondary" compact onClick={() => downloadElement(resultsTabRef.current, "All_Match_Results")}>EXPORT ALL RESULTS</BrutalistButton>
            </div>
            
            <div className="space-y-8" ref={resultsTabRef}>
              {sortedMatches.map((m) => {
                const t1 = tournament.teams.find(t => t.id === m.team1Id);
                const t2 = tournament.teams.find(t => t.id === m.team2Id);
                const t1Stats = standingsMap[m.team1Id];
                const t2Stats = standingsMap[m.team2Id];
                const isExp = editingMatchId === m.id;
                const isComp = m.status === 'COMPLETED';
                
                const t1Win = m.resultType === 'T1_WIN';
                const t2Win = m.resultType === 'T2_WIN';
                const isTie = m.resultType === 'TIE';

                // Winner / Loser colors as requested
                const t1Earned = t1Win ? pointsConfig.win : (isTie ? pointsConfig.draw : pointsConfig.loss);
                const t2Earned = t2Win ? pointsConfig.win : (isTie ? pointsConfig.draw : pointsConfig.loss);

                return (
                  <div key={m.id} ref={el => matchCardRefs.current[m.id] = el} className="brutalist-border bg-black shadow-[8px_8px_0px_black] overflow-hidden text-black">
                    {/* Header bar as per image */}
                    <div className="bg-white p-4 flex justify-between items-center border-b-4 border-black">
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-40 leading-none mb-1">ROUND {m.round}</p>
                        <h4 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-none">
                          {t1?.name} V {t2?.name}
                        </h4>
                      </div>
                      <div className="flex gap-2">
                        {isComp && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); downloadElement(matchCardRefs.current[m.id], `Result_${m.id}`); }}
                            className="w-12 h-12 brutalist-border bg-white hover:bg-yellow-400 flex items-center justify-center shadow-[4px_4px_0px_black] active:translate-y-1 active:shadow-none transition-all"
                          >
                            <span className="text-2xl">📸</span>
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            if (isExp) setEditingMatchId(null);
                            else {
                              setEditingMatchId(m.id);
                              setResultForm({ t1Runs: m.t1Runs?.toString() || '', t1Wickets: m.t1Wickets?.toString() || '', t1OversWhole: m.t1OversWhole?.toString() || '', t1Balls: m.t1Balls?.toString() || '0', t2Runs: m.t2Runs?.toString() || '', t2Wickets: m.t2Wickets?.toString() || '', t2OversWhole: m.t2OversWhole?.toString() || '', t2Balls: m.t2Balls?.toString() || '0', notes: m.notes || '' });
                            }
                          }}
                          className={`px-4 h-12 brutalist-border font-black uppercase text-xs shadow-[4px_4px_0px_black] active:translate-y-1 active:shadow-none transition-all ${isComp ? 'bg-emerald-400' : 'bg-yellow-400'}`}
                        >
                          {m.status}
                        </button>
                      </div>
                    </div>

                    {/* Score display (Split screen as per user request) */}
                    {isComp && (
                      <div className="flex flex-col md:flex-row h-auto md:h-64 text-white">
                        {/* Team 1 Side */}
                        <div className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors ${t1Win ? 'bg-emerald-500' : (t2Win ? 'bg-rose-500' : 'bg-zinc-800')}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest mb-4">SCORE</p>
                          <div className="text-6xl md:text-8xl font-black italic tracking-tighter leading-none mb-4">
                            {m.t1Runs}<span className="opacity-40">/</span>{m.t1Wickets}
                          </div>
                          <div className="space-y-1 text-center">
                            <p className="text-sm font-black uppercase italic tracking-tight">EARNED: {t1Earned} PTS</p>
                            <p className="text-[10px] font-bold mono opacity-60">CUR NRR: {t1Stats?.nrr?.toFixed(3)}</p>
                          </div>
                        </div>

                        {/* Team 2 Side */}
                        <div className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors border-t-4 md:border-t-0 md:border-l-4 border-black ${t2Win ? 'bg-emerald-500' : (t1Win ? 'bg-rose-500' : 'bg-zinc-800')}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest mb-4">SCORE</p>
                          <div className="text-6xl md:text-8xl font-black italic tracking-tighter leading-none mb-4">
                            {m.t2Runs}<span className="opacity-40">/</span>{m.t2Wickets}
                          </div>
                          <div className="space-y-1 text-center">
                            <p className="text-sm font-black uppercase italic tracking-tight">EARNED: {t2Earned} PTS</p>
                            <p className="text-[10px] font-bold mono opacity-60">CUR NRR: {t2Stats?.nrr?.toFixed(3)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Form for entry (Only shows when editing/expanding) */}
                    {isExp && (
                      <div className="p-6 bg-white border-t-4 border-black grid grid-cols-1 md:grid-cols-2 gap-8 no-print text-black">
                         <div className="space-y-4">
                            <p className="font-black text-[10px] uppercase opacity-40 border-b-2 border-black mb-2">{t1?.name} SCORECARD</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[8px] font-black uppercase opacity-60">Runs</label>
                                    <input type="number" className="w-full brutalist-border p-3 font-black text-xl bg-white text-black" value={resultForm.t1Runs} onChange={e => handleScoreChange('t1Runs', e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black uppercase opacity-60">Wickets (10 Max)</label>
                                    <input type="number" className="w-full brutalist-border p-3 font-black text-xl bg-white text-black" value={resultForm.t1Wickets} onChange={e => handleScoreChange('t1Wickets', e.target.value)} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                               <div className="flex-1">
                                   <label className="text-[8px] font-black uppercase opacity-60">{isHundred ? 'Balls (100 Max)' : 'Overs'}</label>
                                   <input type="number" className="w-full brutalist-border p-3 font-black bg-white text-black" value={resultForm.t1OversWhole} onChange={e => handleScoreChange('t1OversWhole', e.target.value)} />
                               </div>
                               {!isHundred && (
                                   <div className="flex-1">
                                       <label className="text-[8px] font-black uppercase opacity-60">Balls</label>
                                       <select className="w-full brutalist-border p-3 font-black bg-white text-black" value={resultForm.t1Balls} onChange={e => handleScoreChange('t1Balls', e.target.value)}>
                                           {[0,1,2,3,4,5].map(b => <option key={b}>{b}</option>)}
                                       </select>
                                   </div>
                               )}
                            </div>
                         </div>
                         <div className="space-y-4">
                            <p className="font-black text-[10px] uppercase opacity-40 border-b-2 border-black mb-2">{t2?.name} SCORECARD</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[8px] font-black uppercase opacity-60">Runs</label>
                                    <input type="number" className="w-full brutalist-border p-3 font-black text-xl bg-white text-black" value={resultForm.t2Runs} onChange={e => handleScoreChange('t2Runs', e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black uppercase opacity-60">Wickets (10 Max)</label>
                                    <input type="number" className="w-full brutalist-border p-3 font-black text-xl bg-white text-black" value={resultForm.t2Wickets} onChange={e => handleScoreChange('t2Wickets', e.target.value)} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                               <div className="flex-1">
                                   <label className="text-[8px] font-black uppercase opacity-60">{isHundred ? 'Balls (100 Max)' : 'Overs'}</label>
                                   <input type="number" className="w-full brutalist-border p-3 font-black bg-white text-black" value={resultForm.t2OversWhole} onChange={e => handleScoreChange('t2OversWhole', e.target.value)} />
                               </div>
                               {!isHundred && (
                                   <div className="flex-1">
                                       <label className="text-[8px] font-black uppercase opacity-60">Balls</label>
                                       <select className="w-full brutalist-border p-3 font-black bg-white text-black" value={resultForm.t2Balls} onChange={e => handleScoreChange('t2Balls', e.target.value)}>
                                           {[0,1,2,3,4,5].map(b => <option key={b}>{b}</option>)}
                                       </select>
                                   </div>
                               )}
                            </div>
                         </div>
                         <div className="col-span-1 md:col-span-2 pt-4">
                            <BrutalistButton variant="success" className="w-full py-5 text-2xl" onClick={() => handleSaveResult(m.id)}>AUTHORIZE & SAVE RESULT</BrutalistButton>
                         </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* POINTS TAB */}
        {activeTab === 'POINTS' && (
          <div className="space-y-6">
             <div className="bg-black text-white p-4 brutalist-border shadow-[4px_4px_0px_white] flex justify-between items-center no-print">
                <h3 className="text-xl font-black italic uppercase leading-none">Official Standings</h3>
                <BrutalistButton variant="secondary" compact onClick={() => downloadElement(pointsTabRef.current, "PointTable")}>EXPORT PNG</BrutalistButton>
             </div>
             <div className="bg-white brutalist-border shadow-[10px_10px_0px_black] overflow-x-auto" ref={pointsTabRef}>
              <table className="w-full text-left text-sm">
                <thead className="bg-black text-white border-b-2 border-black font-black uppercase text-[10px]">
                  <tr>
                    <th className="p-4 w-16 text-center">POS</th>
                    <th className="p-4">TEAM</th>
                    <th className="p-4 text-center">P</th>
                    <th className="p-4 text-center">W</th>
                    <th className="p-4 text-center">L</th>
                    <th className="p-4 text-center bg-gray-900">PTS</th>
                    <th className="p-4 text-center">NRR</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black font-black uppercase italic">
                  {standings.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-yellow-50">
                      <td className="p-4 text-center text-lg opacity-20">#{idx + 1}</td>
                      <td className="p-4 font-black">{t.name}</td>
                      <td className="p-4 text-center mono">{t.matchesPlayed}</td>
                      <td className="p-4 text-center mono text-emerald-600">{t.matchesWon}</td>
                      <td className="p-4 text-center mono text-rose-600">{t.matchesLost}</td>
                      <td className="p-4 text-center mono text-lg bg-gray-50">{t.actualPoints}</td>
                      <td className={`p-4 text-center mono ${t.nrr >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>{t.nrr.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'SCHEDULE' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-black text-white p-4 brutalist-border shadow-[4px_4px_0px_cyan]">
              <h3 className="text-xl font-black italic uppercase leading-none">Fixture Registry</h3>
              {tournament.matches.length === 0 && <BrutalistButton variant="cyan" compact onClick={generateSchedule}>GENERATE FIXTURES</BrutalistButton>}
            </div>
            <div className="bg-white brutalist-border overflow-hidden shadow-[8px_8px_0px_black]">
              <table className="w-full text-left">
                <thead className="bg-gray-100 border-b-2 border-black font-black uppercase text-[10px]">
                  <tr><th className="p-3 w-16 text-center">RD</th><th className="p-3">MATCHUP</th><th className="p-3">VENUE</th><th className="p-3 text-center">STATUS</th></tr>
                </thead>
                <tbody className="divide-y-2 divide-black text-xs font-black uppercase italic">
                  {sortedMatches.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="p-3 text-center border-r-2 border-black mono">R{m.round}</td>
                      <td className="p-3">{tournament.teams.find(t => t.id === m.team1Id)?.name} vs {tournament.teams.find(t => t.id === m.team2Id)?.name}</td>
                      <td className="p-3 opacity-60">{tournament.stadiums.find(s => s.id === m.venueId)?.name || 'TBD'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 brutalist-border text-[8px] ${m.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-yellow-400'}`}>{m.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'SECURITY' && (
          <div className="p-10 brutalist-border bg-rose-50 text-center space-y-6 shadow-[10px_10px_0px_black]">
            <h3 className="text-3xl font-black text-rose-600 uppercase italic">ENGINE STATUS: {tournament.isLocked ? 'LOCKED' : 'OPERATIONAL'}</h3>
            <BrutalistButton variant={tournament.isLocked ? 'success' : 'danger'} className="px-10 py-6 text-xl shadow-[8px_8px_0px_black]" onClick={() => setShowSecurityModal({ type: 'LOCK' })}>{tournament.isLocked ? 'UNLOCK SYSTEM' : 'LOCK SYSTEM OVERRIDE'}</BrutalistButton>
          </div>
        )}

      </div>

      {showSecurityModal && (
        <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in">
          <BrutalistCard title="⚠️ AUTHORIZATION REQUIRED" className="max-w-md w-full border-rose-600 shadow-[12px_12px_0px_rose-600]">
            <div className="space-y-6 py-4">
              <input className="w-full brutalist-border p-4 font-black uppercase outline-none focus:bg-rose-50 border-rose-600 shadow-[4px_4px_0px_black] bg-white text-black" placeholder="TOURNAMENT NAME" value={securityInput} onChange={e => setSecurityInput(e.target.value)} />
              <div className="flex gap-4">
                <BrutalistButton variant="danger" className="flex-1 py-4" onClick={() => {
                  if (securityInput.toUpperCase() !== tournament.name.toUpperCase()) return alert("MISMATCH!");
                  if (showSecurityModal.type === 'RESET') {
                    handleUpdate({ matches: [], logs: [] }, 'Factory Reset Executed');
                    setActiveTab('CONTROL');
                  } else if (showSecurityModal.type === 'LOCK') {
                    handleUpdate({ isLocked: !tournament.isLocked }, `System ${!tournament.isLocked ? 'Locked' : 'Unlocked'}`);
                  }
                  setShowSecurityModal(null); setSecurityInput('');
                }}>CONFIRM</BrutalistButton>
                <BrutalistButton variant="secondary" className="flex-1 py-4" onClick={() => setShowSecurityModal(null)}>ABORT</BrutalistButton>
              </div>
            </div>
          </BrutalistCard>
        </div>
      )}

      {isDownloading && (
        <div className="fixed inset-0 z-[600] bg-black/95 flex flex-col items-center justify-center text-white backdrop-blur-xl">
          <div className="text-8xl mb-8 animate-bounce">📸</div>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">GENERATING SNAPSHOT...</h2>
        </div>
      )}
    </div>
  );
};

export default TournamentWorkspace;