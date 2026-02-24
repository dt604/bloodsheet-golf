import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CourseHole {
    number: number;
    par: number;
    yardage: number;
    strokeIndex: number;
}

interface MatchScorecardData {
    createdAt: string;
    courseName: string;
    format: string;
    holes: CourseHole[];
    players: {
        id: string;
        fullName: string;
        handicap: number;
        scores: Record<number, { gross: number; net: number; dots: string[] }>;
    }[];
}

export default function PastMatchScorecardPage() {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [data, setData] = useState<MatchScorecardData | null>(null);

    useEffect(() => {
        async function fetchScorecard() {
            if (!matchId) return;
            setLoading(true);
            try {
                // Fetch match and course details
                const { data: matchData, error: matchErr } = await supabase
                    .from('matches')
                    .select('created_at, format, courses!inner(name, holes)')
                    .eq('id', matchId)
                    .single();

                if (matchErr) {
                    setErrorMsg(`Match fetch err: ${matchErr.message}`);
                    return;
                }
                if (!matchData) {
                    setErrorMsg('No matchData returned');
                    return;
                }
                const m = matchData as Record<string, unknown>;
                const course = m.courses as Record<string, unknown>;

                // Fetch players (No profiles relation because guest IDs break the FK)
                const { data: mps, error: mpsErr } = await supabase
                    .from('match_players')
                    .select('user_id, initial_handicap, guest_name')
                    .eq('match_id', matchId);

                if (mpsErr) console.error("MPS err", mpsErr);

                // Find non-guest user IDs
                const authUserIds = (mps || [])
                    .filter((mp: Record<string, unknown>) => !mp.guest_name && typeof mp.user_id === 'string')
                    .map((mp: Record<string, unknown>) => String(mp.user_id).toLowerCase());

                let fetchedProfiles: Record<string, unknown>[] = [];
                if (authUserIds.length > 0) {
                    const { data: profs } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', authUserIds);
                    if (profs) fetchedProfiles = profs;
                }

                // Fetch scores
                const { data: scores, error: scoresErr } = await supabase
                    .from('hole_scores')
                    .select('*')
                    .eq('match_id', matchId);

                if (scoresErr) console.error("Scores err", scoresErr);

                const playersMap = new Map<string, MatchScorecardData['players'][0]>();
                if (mps) {
                    mps.forEach((mp: Record<string, unknown>) => {
                        const isGuest = !!mp.guest_name;
                        const pId = String(mp.user_id || '').toLowerCase();
                        if (!pId) return; // safety

                        let assignedName = isGuest ? (mp.guest_name as string) : 'Unknown';
                        if (!isGuest) {
                            const found = fetchedProfiles.find((p) => String(p.id).toLowerCase() === pId);
                            if (found && found.full_name) assignedName = found.full_name as string;
                        }

                        playersMap.set(pId, {
                            id: pId,
                            fullName: assignedName,
                            handicap: (mp.initial_handicap as number) || 0,
                            scores: {}
                        });
                    });
                }

                if (scores) {
                    scores.forEach((s: Record<string, unknown>) => {
                        const pid = String(s.player_id || '').toLowerCase();
                        const hnum = s.hole_number as number;
                        if (playersMap.has(pid)) {
                            const pData = playersMap.get(pid)!;
                            pData.scores[hnum] = {
                                gross: (s.gross as number) || 0,
                                net: (s.net as number) || 0,
                                dots: (s.trash_dots as string[]) || []
                            };
                        }
                    });
                }

                setData({
                    createdAt: m.created_at as string,
                    courseName: (course?.name as string) || 'Unknown Course',
                    format: m.format as string,
                    holes: (course?.holes as CourseHole[]) || [],
                    players: Array.from(playersMap.values())
                });
            } catch (err: unknown) {
                const e = err as Error;
                console.error(e);
                setErrorMsg(`Exception: ${e.message}`);
            } finally {
                setLoading(false);
            }
        }
        fetchScorecard();
    }, [matchId]);

    if (loading) {
        return <div className="p-8 text-center text-secondaryText min-h-screen flex items-center justify-center">Loading scorecard...</div>;
    }

    if (errorMsg) {
        return (
            <div className="p-8 text-center text-bloodRed min-h-screen flex flex-col items-center justify-center gap-4">
                <p>Error loading match:</p>
                <code className="text-xs">{errorMsg}</code>
                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 border border-borderColor text-white rounded-xl">Go Back</button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-center text-secondaryText min-h-screen flex flex-col items-center justify-center gap-4">
                <p>Match not found.</p>
                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 border border-borderColor rounded-xl">Go Back</button>
            </div>
        );
    }

    const { holes, players } = data;
    const sortedHoles = [...holes].sort((a, b) => a.number - b.number);
    while (sortedHoles.length < 18) {
        sortedHoles.push({ number: sortedHoles.length + 1, par: 4, yardage: 0, strokeIndex: 0 });
    }

    const frontNine = sortedHoles.slice(0, 9);
    const backNine = sortedHoles.slice(9, 18);
    const outPar = frontNine.reduce((s, h) => s + h.par, 0);
    const inPar = backNine.reduce((s, h) => s + h.par, 0);
    const totPar = outPar + inPar;

    // Build header array: 1..9, OUT, 10..18, IN, HCP, GROSS
    const headers = [
        ...frontNine.map(h => ({ type: 'hole', val: h.number })),
        { type: 'divider', val: 'OUT' },
        ...backNine.map(h => ({ type: 'hole', val: h.number })),
        { type: 'divider', val: 'IN' },
        { type: 'header', val: 'HCP' },
        { type: 'header', val: 'GROSS' }
    ];

    const outIndices = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const inIndices = new Set([10, 11, 12, 13, 14, 15, 16, 17, 18]);

    function getPlayerScore(player: MatchScorecardData['players'][0], type: 'gross' | 'net', holeNum: number) {
        return player.scores[holeNum]?.[type] || 0;
    }

    function getPlayerBlockSum(player: MatchScorecardData['players'][0], type: 'gross' | 'net', holeset: Set<number>) {
        let sum = 0;
        holeset.forEach(h => sum += getPlayerScore(player, type, h));
        return sum;
    }

    // A helper to render a row with dynamic cells corresponding to the headers
    function renderRowTracker({
        rowKey,
        title,
        titleColor = 'text-white',
        cellRenderer,
        dividerClass = 'bg-background/80 font-bold',
        totClass = 'bg-bloodRed text-white font-black',
        frontNineSum,
        backNineSum,
        extHCP,
        extGROSS
    }: {
        rowKey?: string | number;
        title: string;
        titleColor?: string;
        cellRenderer: (holeNum: number) => React.ReactNode;
        dividerClass?: string;
        totClass?: string;
        frontNineSum: React.ReactNode;
        backNineSum: React.ReactNode;
        extHCP?: React.ReactNode;
        extGROSS?: React.ReactNode;
    }) {
        return (
            <div key={rowKey} className="flex flex-row border-b border-borderColor last:border-b-0">
                <div className={`sticky left-0 z-20 bg-background border-r border-borderColor min-w-[70px] max-w-[70px] h-11 flex items-center justify-start px-2 font-bold uppercase tracking-tighter text-[10px] ${titleColor} truncate shadow-[2px_0_5px_rgba(0,0,0,0.5)]`}>
                    {title}
                </div>
                {headers.map((h, i) => {
                    const baseClass = "h-11 border-r border-borderColor flex items-center justify-center flex-shrink-0";
                    if (h.type === 'divider') {
                        if (h.val === 'OUT') return <div key={i} className={`${baseClass} min-w-[44px] ${dividerClass}`}>{frontNineSum}</div>;
                        if (h.val === 'IN') return <div key={i} className={`${baseClass} min-w-[44px] ${dividerClass}`}>{backNineSum}</div>;
                    } else if (h.type === 'header') {
                        if (h.val === 'HCP') return <div key={i} className={`${baseClass} min-w-[44px] bg-black/40 text-secondaryText font-bold text-[11px]`}>{extHCP}</div>;
                        if (h.val === 'GROSS') return <div key={i} className={`${baseClass} min-w-[44px] ${totClass} text-sm`}>{extGROSS}</div>;
                    }
                    return (
                        <div key={i} className={`${baseClass} min-w-[40px] text-xs font-semibold`}>
                            {cellRenderer(h.val as number)}
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background pb-12 font-sans overflow-hidden">
            <header className="flex flex-col border-b border-borderColor bg-surface/90 backdrop-blur z-30 flex-shrink-0">
                <div className="flex items-center p-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 ml-2">
                        <h2 className="text-xl font-black text-white tracking-tighter truncate">{data.courseName}</h2>
                        <span className="text-xs font-bold text-bloodRed uppercase tracking-widest">{data.format}</span>
                    </div>
                </div>
                <div className="px-4 pb-3 flex items-center justify-between text-[11px] font-bold text-secondaryText uppercase tracking-wider">
                    <span>{new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
            </header>

            <div className="flex-1 w-full overflow-hidden flex flex-col pt-4">
                <div className="px-4 mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-secondaryText">
                    <div className="flex items-center gap-2">
                        <Flag className="w-4 h-4 text-bloodRed" />
                        <span>Scorecard Overview</span>
                    </div>
                </div>

                {/* Scorecard Scrollable Container */}
                <div className="w-full overflow-x-auto no-scrollbar pb-6 relative">
                    <div className="inline-flex flex-col border-y border-borderColor min-w-max mx-4 mb-2 shadow-2xl">

                        {/* Header Row */}
                        <div className="flex flex-row bg-background">
                            <div className="sticky left-0 z-20 bg-background border-r border-borderColor min-w-[70px] max-w-[70px] h-9 flex items-center justify-start px-2 font-bold uppercase tracking-tighter text-[10px] text-secondaryText shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                                HOLE
                            </div>
                            {headers.map((h, i) => {
                                const baseClass = "h-9 border-r border-borderColor flex items-center justify-center font-bold text-[10px] flex-shrink-0";
                                if (h.type === 'hole') {
                                    return <div key={i} className={`${baseClass} min-w-[40px] text-secondaryText`}>{h.val}</div>;
                                }
                                if (h.type === 'divider') {
                                    return <div key={i} className={`${baseClass} min-w-[44px] bg-bloodRed/10 text-bloodRed tracking-widest`}>{h.val}</div>;
                                }
                                if (h.val === 'GROSS') {
                                    return <div key={i} className={`${baseClass} min-w-[44px] bg-bloodRed text-white tracking-widest uppercase`}>{h.val}</div>;
                                }
                                return <div key={i} className={`${baseClass} min-w-[44px] bg-black/60 text-secondaryText`}>{h.val}</div>;
                            })}
                        </div>

                        {/* Par Row */}
                        {renderRowTracker({
                            title: 'PAR',
                            titleColor: 'text-secondaryText',
                            frontNineSum: outPar,
                            backNineSum: inPar,
                            extHCP: '-',
                            extGROSS: totPar,
                            cellRenderer: (hNum) => sortedHoles.find(h => h.number === hNum)?.par || 4
                        })}

                        {/* Player Score Rows */}
                        {players.map((p) => {
                            const outGross = getPlayerBlockSum(p, 'gross', outIndices);
                            const inGross = getPlayerBlockSum(p, 'gross', inIndices);
                            const totGross = outGross + inGross;

                            return renderRowTracker({
                                rowKey: p.id,
                                title: p.fullName.split(' ')[0], // First name or alias
                                titleColor: 'text-white',
                                frontNineSum: outGross || '-',
                                backNineSum: inGross || '-',
                                extHCP: p.handicap,
                                extGROSS: totGross || '-',
                                cellRenderer: (hNum) => {
                                    const raw = getPlayerScore(p, 'gross', hNum);
                                    if (!raw) return <span className="text-borderColor">-</span>;
                                    const par = sortedHoles.find(h => h.number === hNum)?.par || 4;

                                    // CSS style matching Stitch mock
                                    if (raw < par) {
                                        // Birdie+ (Circle text)
                                        return <div className="border border-bloodRed w-7 h-7 flex items-center justify-center rounded-full text-bloodRed font-bold">{raw}</div>;
                                    } else if (raw > par) {
                                        // Bogey+ (Square text)
                                        return <div className="border border-secondaryText w-7 h-7 flex items-center justify-center text-secondaryText font-medium bg-surface/50">{raw}</div>;
                                    }
                                    // Par
                                    return <span className="font-bold text-white">{raw}</span>;
                                }
                            });
                        })}
                    </div>
                </div>

                <div className="px-4 mt-2">
                    <div className="bg-surface rounded-xl border border-borderColor p-4 flex gap-4 text-[10px] text-secondaryText uppercase font-bold tracking-widest">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border border-bloodRed flex items-center justify-center text-bloodRed leading-none pt-0.5">3</div>
                            <span>Under Par</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border border-secondaryText bg-surface/50 flex items-center justify-center text-secondaryText leading-none pt-0.5">5</div>
                            <span>Over Par</span>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
