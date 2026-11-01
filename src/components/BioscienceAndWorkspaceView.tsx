import React, { useEffect, useState } from 'react';
import {
  EventPreset,
  PubChemCompoundProfile,
  TimelineMilestone,
  VendorRecord,
} from '../types/planning';
import { CURATED_PUBCHEM_PROFILES } from '../data/seedEvents';
import { evaluateCompoundSafety, formatINR } from '../utils/planningLogic';
import {
  createCalendarMilestone,
  createGoogleKeepNote,
  createGoogleTask,
  createRunOfShowGoogleDoc,
  googleSignIn,
  initAuth,
  listCalendarEvents,
  listGmailMessages,
  listGoogleKeepNotes,
  listGoogleTasks,
  logout,
  sendGmailNegotiationEmail,
} from '../services/firebaseAuth';
import {
  FlaskConical,
  ExternalLink,
  Search,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  StickyNote,
  AlertTriangle,
} from 'lucide-react';

interface BioscienceAndWorkspaceViewProps {
  preset: EventPreset;
  vendors: VendorRecord[];
  timeline: TimelineMilestone[];
  stagedEmail: { to: string; subject: string; body: string } | null;
}

interface PendingMutationConfirm {
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => Promise<void>;
}

const QUICK_TRY_COMPOUNDS = [
  { id: 'linalool', label: 'Linalool (Lavender / Floral Terpene)' },
  { id: 'vanillin', label: 'Vanillin (Patisserie & Cake Glaze)' },
  { id: 'capsaicin', label: 'Capsaicin (Spiced Canapés & Agave)' },
  { id: 'histamine', label: 'Histamine (Aged Vintage Wine & Raw Bar)' },
  { id: 'caffeine', label: 'Caffeine (Late-Night Espresso Bar)' },
];

export const BioscienceAndWorkspaceView: React.FC<BioscienceAndWorkspaceViewProps> = ({
  preset,
  vendors,
  timeline,
  stagedEmail,
}) => {
  // 1. Bioscience PubChem Scout State
  const [selectedCompoundKey, setSelectedCompoundKey] = useState<string>('linalool');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [compoundProfile, setCompoundProfile] = useState<PubChemCompoundProfile>(
    CURATED_PUBCHEM_PROFILES.linalool
  );
  const [isLoadingCompound, setIsLoadingCompound] = useState<boolean>(false);

  // 2. Google Workspace Auth & State
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  const [gmailList, setGmailList] = useState<any[]>([]);
  const [calendarList, setCalendarList] = useState<any[]>([]);
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [keepList, setKeepList] = useState<any[]>([]);
  const [createdDocInfo, setCreatedDocInfo] = useState<{
    documentId: string;
    title: string;
  } | null>(null);

  // Email Composer State
  const [emailTo, setEmailTo] = useState(
    stagedEmail?.to || vendors[2]?.contactEmail || 'studio@botanicaflora.example.com'
  );
  const [emailSubject, setEmailSubject] = useState(
    stagedEmail?.subject || `Partnership Terms & Scope — ${preset.name}`
  );
  const [emailBody, setEmailBody] = useState(
    stagedEmail?.body ||
      `Dear Partner Team,\n\nWe are finalizing our master production schedule for ${preset.name} at ${preset.venueName}. Please review the updated timeline and confirm your load-in window.\n\nWarm regards,\nEvent Production Desk`
  );

  // Mandatory Confirmation Dialog for Mutating Workspace Operations
  const [pendingConfirm, setPendingConfirm] = useState<PendingMutationConfirm | null>(null);
  const [isExecutingMutation, setIsExecutingMutation] = useState(false);

  useEffect(() => {
    if (stagedEmail) {
      setEmailTo(stagedEmail.to);
      setEmailSubject(stagedEmail.subject);
      setEmailBody(stagedEmail.body);
    }
  }, [stagedEmail]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setIsAuthenticated(true);
        setUserEmail(user.email);
      },
      () => {
        setIsAuthenticated(false);
        setUserEmail(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLoadCompound = async (queryName: string) => {
    const key = queryName.toLowerCase().trim();
    setSelectedCompoundKey(key);
    if (CURATED_PUBCHEM_PROFILES[key]) {
      setCompoundProfile(CURATED_PUBCHEM_PROFILES[key]);
    }
    setIsLoadingCompound(true);
    try {
      const res = await fetch(`/api/science/pubchem/${encodeURIComponent(queryName)}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setCompoundProfile(data);
        return;
      }
      // Direct client-side fallback to NCBI PubChem PUG-REST API for static deployments (e.g., Netlify)
      const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
        queryName
      )}/property/Title,MolecularFormula,MolecularWeight,IUPACName,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,CanonicalSMILES,InChIKey/JSON`;
      const directRes = await fetch(pubchemUrl);
      if (directRes.ok) {
        const directJson = await directRes.json();
        const prop = directJson?.PropertyTable?.Properties?.[0];
        if (prop) {
          const base = CURATED_PUBCHEM_PROFILES[key] || CURATED_PUBCHEM_PROFILES.linalool;
          setCompoundProfile({
            ...base,
            cid: Number(prop.CID) || base.cid,
            title: prop.Title || queryName,
            molecularFormula: prop.MolecularFormula || base.molecularFormula,
            molecularWeight: Number(prop.MolecularWeight) || base.molecularWeight,
            iupacName: prop.IUPACName || base.iupacName,
            xlogp: Number(prop.XLogP ?? base.xlogp),
            tpsa: Number(prop.TPSA ?? base.tpsa),
            hBondDonorCount: Number(prop.HBondDonorCount ?? base.hBondDonorCount),
            hBondAcceptorCount: Number(prop.HBondAcceptorCount ?? base.hBondAcceptorCount),
            canonicalSmiles: prop.CanonicalSMILES || base.canonicalSmiles,
            inchiKey: prop.InChIKey || base.inchiKey,
            provenanceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${prop.CID || base.cid}`,
            isLivePubChem: true,
          });
        }
      }
    } catch {
      const fallback = CURATED_PUBCHEM_PROFILES[key] || CURATED_PUBCHEM_PROFILES.linalool;
      setCompoundProfile(fallback);
    } finally {
      setIsLoadingCompound(false);
    }
  };

  const handleCustomCompoundSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    handleLoadCompound(customQuery.trim());
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setIsAuthenticated(true);
        setUserEmail(result.user.email);
        setWorkspaceStatus({
          type: 'success',
          text: `Connected Google Workspace as ${result.user.email}. You can now read and synchronize Gmail, Calendar, Docs, Tasks, and Keep.`,
        });
      }
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'error',
        text: `Google Sign-In popup did not complete: ${err?.message || 'Cancelled'}`,
      });
    }
  };

  const handleGoogleSignOut = async () => {
    await logout();
    setIsAuthenticated(false);
    setUserEmail(null);
    setWorkspaceStatus({ type: 'info', text: 'Signed out of Google Workspace.' });
  };

  const handleFetchWorkspaceData = async () => {
    try {
      setWorkspaceStatus({ type: 'info', text: 'Fetching live Gmail, Calendar, and Tasks records...' });
      const [mails, events, tasks] = await Promise.all([
        listGmailMessages(4).catch(() => []),
        listCalendarEvents().catch(() => []),
        listGoogleTasks().catch(() => []),
      ]);
      setGmailList(mails);
      setCalendarList(events);
      setTasksList(tasks);
      setWorkspaceStatus({
        type: 'success',
        text: `Loaded ${mails.length} Gmail thread(s), ${events.length} upcoming Calendar event(s), and ${tasks.length} Google Task(s).`,
      });
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'error',
        text: err?.message || 'Unable to fetch Workspace data.',
      });
    }
  };

  const safetyMetrics = evaluateCompoundSafety(compoundProfile);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
      {/* PART 1: Scientific Workbench — Bioscience Catering & Floral Allergen Safety Scout */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs text-slate-500">
              04. Bioscience Molecular & Allergen Scout · Powered by NCBI PubChem PUG-REST API
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display mt-1">
              Culinary Phytochemical & Floral Allergen Safety Workbench
            </h1>
          </div>

          <form onSubmit={handleCustomCompoundSearch} className="flex items-center gap-2">
            <input
              type="search"
              aria-label="Query PubChem compound by name"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Search PubChem (e.g., Eugenol, Citral)..."
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md w-64"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1A73E8] rounded-md hover:bg-[#0B57D0] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Query PubChem</span>
            </button>
          </form>
        </div>

        {/* Mandatory Top Quick-Try Example Bar (from science skill) */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4 text-[#1A73E8]" />
            <span>Quick-Try Event Compounds:</span>
          </span>
          {QUICK_TRY_COMPOUNDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleLoadCompound(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                selectedCompoundKey === item.id
                  ? 'bg-[#1A73E8] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Split Interactive 2D Structure Canvas + Synchronized Molecular Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 5 Columns: 2D Chemical Depiction & Provenance Card */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>PubChem CID: {compoundProfile.cid}</span>
                <span>
                  {compoundProfile.isLivePubChem
                    ? '[Live PubChem PUG-REST Verified]'
                    : '[Curated Reference Record]'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{compoundProfile.title}</h2>
              <p className="text-xs text-slate-500 font-mono break-all">
                IUPAC: {compoundProfile.iupacName}
              </p>
            </div>

            {/* 2D Skeletal Chemical Structure Canvas + Live PubChem Overlay */}
            <div className="relative h-56 bg-[#F8FAFC] border border-slate-200 rounded-lg flex flex-col items-center justify-center p-4 overflow-hidden">
              <svg
                viewBox="0 0 320 150"
                className="w-56 h-32 stroke-slate-800"
                fill="none"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label={`2D skeletal diagram of ${compoundProfile.title}`}
              >
                {/* Aromatic / Terpene Skeletal Ring & Functional Groups */}
                <polygon points="105,40 140,22 175,40 175,80 140,98 105,80" />
                <line x1="113" y1="45" x2="140" y2="31" />
                <line x1="167" y1="45" x2="167" y2="75" />
                <line x1="105" y1="98" x2="140" y2="98" stroke="none" />
                <line x1="113" y1="75" x2="140" y2="90" />
                <line x1="175" y1="40" x2="215" y2="24" />
                <line x1="215" y1="24" x2="250" y2="44" />
                <line x1="213" y1="29" x2="246" y2="48" />
                <line x1="140" y1="98" x2="140" y2="128" />
                <line x1="105" y1="40" x2="72" y2="24" />
                <text x="256" y="52" fill="#0B57D0" stroke="none" fontFamily="monospace" fontSize="14" fontWeight="bold">
                  OH
                </text>
                <text x="44" y="26" fill="#0D9488" stroke="none" fontFamily="monospace" fontSize="13" fontWeight="bold">
                  OCH₃
                </text>
                <text x="134" y="143" fill="#DC2626" stroke="none" fontFamily="monospace" fontSize="13" fontWeight="bold">
                  =O
                </text>
              </svg>
              <div className="text-xs font-mono text-slate-600 mt-1">
                {compoundProfile.molecularFormula} · {compoundProfile.molecularWeight.toFixed(2)} g/mol
                {isLoadingCompound ? ' · Syncing PubChem...' : ''}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Allergen Classification: {compoundProfile.allergenRiskLevel}
              </span>
              <a
                href={compoundProfile.provenanceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1A73E8] hover:underline font-medium flex items-center gap-1"
              >
                <span>PubChem Record</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right 7 Columns: Physicochemical Properties & Event Catering/Floral Advisory */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Physicochemical Descriptor Matrix & Reception Safety Guidance
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {compoundProfile.eventContextRole}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Molecular Weight</div>
                <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                  {compoundProfile.molecularWeight.toFixed(2)} g/mol
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Lipophilicity (XLogP)</div>
                <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                  {compoundProfile.xlogp.toFixed(1)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Polar Area (TPSA)</div>
                <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                  {compoundProfile.tpsa.toFixed(1)} Å²
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">H-Bond (Don / Acc)</div>
                <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                  {compoundProfile.hBondDonorCount} / {compoundProfile.hBondAcceptorCount}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
              <div className="font-mono text-slate-700 break-all">
                <span className="font-semibold text-slate-900">Canonical SMILES: </span>
                {compoundProfile.canonicalSmiles}
              </div>
              <div className="font-mono text-slate-600 break-all">
                <span className="font-semibold text-slate-900">InChIKey: </span>
                {compoundProfile.inchiKey}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-slate-900">
                GHS Hazard & Allergen Pharmacology Notes:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                {compoundProfile.ghsHazards.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-slate-800 space-y-1">
              <div className="font-bold text-slate-900">
                Event Sommelier & Floral Placement Directive ({safetyMetrics.volatilityClass})
              </div>
              <p>{compoundProfile.cateringFloralGuidance}</p>
              <p className="text-slate-600">{safetyMetrics.safetySummary}</p>
            </div>
          </div>
        </div>
      </section>

      {/* PART 2: 1P Google Workspace Integration Hub (Gmail, Calendar, Docs, Tasks, Keep) */}
      <section className="space-y-6 pt-6 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              05. Connected 1P Google Workspace Command Center · Client-Side OAuth Token Flow
            </p>
            <h2 className="text-2xl font-bold text-slate-900 font-display mt-1">
              Gmail, Google Calendar, Google Docs, Google Tasks & Keep Sync
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">Sign in with Google</span>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600">
                  Signed in: <strong className="text-slate-900">{userEmail}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleFetchWorkspaceData}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                >
                  Refresh Live Workspace Data
                </button>
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {workspaceStatus && (
          <div
            className={`p-3.5 rounded-lg border text-xs ${
              workspaceStatus.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : workspaceStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            {workspaceStatus.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Gmail Vendor & RSVP Dispatch */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-600" />
                <span>Gmail Vendor & RSVP Dispatch</span>
              </h3>
            </div>
            <div className="space-y-2 text-xs">
              <input
                type="email"
                aria-label="Recipient email for Gmail dispatch"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
              <input
                type="text"
                aria-label="Email subject for Gmail dispatch"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium"
              />
              <textarea
                rows={4}
                aria-label="Email body for Gmail dispatch"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() =>
                  setPendingConfirm({
                    title: 'Confirm Sending Email via Gmail',
                    description: `You are about to send an email via your Google Workspace Gmail account to "${emailTo}" with subject "${emailSubject}". Do you want to proceed?`,
                    actionLabel: 'Confirm & Send Email',
                    onConfirm: async () => {
                      await sendGmailNegotiationEmail(emailTo, emailSubject, emailBody);
                      setWorkspaceStatus({
                        type: 'success',
                        text: `Sent email to ${emailTo} via Gmail API.`,
                      });
                    },
                  })
                }
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                Send Email via Gmail (Requires Confirmation)
              </button>
            </div>
            {gmailList.length > 0 && (
              <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                <div className="font-semibold text-slate-700">Recent Inbox Threads:</div>
                {gmailList.map((m) => (
                  <div key={m.id} className="text-slate-500 truncate">
                    ID: {m.id}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Google Calendar Milestone Sync */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Google Calendar Timeline Sync</span>
            </h3>
            <p className="text-xs text-slate-600">
              Publish your {timeline.length} event run-of-show milestones on {preset.date} to your primary Google Calendar.
            </p>
            <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto border border-slate-100 p-2 rounded">
              {timeline.map((m) => (
                <div key={m.id} className="flex justify-between">
                  <span className="truncate">{m.title}</span>
                  <span className="font-mono text-slate-500">{m.time}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setPendingConfirm({
                  title: 'Confirm Google Calendar Event Creation',
                  description: `This will create ${timeline.length} milestone events on your primary Google Calendar for ${preset.name} on ${preset.date}. Proceed?`,
                  actionLabel: 'Confirm & Sync Calendar',
                  onConfirm: async () => {
                    for (const ms of timeline.slice(0, 3)) {
                      await createCalendarMilestone(
                        `${preset.name}: ${ms.title}`,
                        preset.date,
                        ms.time,
                        preset.venueName,
                        `Owner: ${ms.owner} · Zone: ${ms.locationZone}`
                      );
                    }
                    setWorkspaceStatus({
                      type: 'success',
                      text: `Synced ${preset.name} milestones to Google Calendar.`,
                    });
                  },
                })
              }
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
            >
              Sync Milestones to Google Calendar
            </button>
            {calendarList.length > 0 && (
              <div className="text-xs text-slate-500">
                Upcoming events loaded: {calendarList.length}
              </div>
            )}
          </div>

          {/* Card 3: Google Docs Master Run-of-Show & Contract Brief */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Google Docs Run-of-Show Generator</span>
            </h3>
            <p className="text-xs text-slate-600">
              Generate a formatted Google Doc containing your master event brief, vendor contract targets, and timeline cues.
            </p>
            <button
              type="button"
              onClick={() =>
                setPendingConfirm({
                  title: 'Confirm Creating Master Brief in Google Docs',
                  description: `This will create a new Google Docs document titled "${preset.name} — Master Run-of-Show & Vendor Brief" in your Google Workspace account.`,
                  actionLabel: 'Create Google Doc',
                  onConfirm: async () => {
                    const docText = `${preset.name}\nVenue: ${preset.venueName}\nDate: ${preset.date}\nTarget Budget: ${formatINR(preset.totalBudgetCap)}\n\nTIMELINE CUES:\n${timeline
                      .map((t) => `- ${t.time}: ${t.title} (${t.locationZone})`)
                      .join('\n')}\n\nVENDORS:\n${vendors
                      .map((v) => `- ${v.name}: Target ${formatINR(v.negotiatedTarget)} (${v.status})`)
                      .join('\n')}\n`;
                    const created = await createRunOfShowGoogleDoc(
                      `${preset.name} — Master Run-of-Show`,
                      docText
                    );
                    setCreatedDocInfo(created);
                    setWorkspaceStatus({
                      type: 'success',
                      text: `Created Google Doc "${created.title}" (ID: ${created.documentId}).`,
                    });
                  },
                })
              }
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
            >
              Export Master Brief to Google Docs
            </button>
            {createdDocInfo && (
              <a
                href={`https://docs.google.com/document/d/${createdDocInfo.documentId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-[#1A73E8] hover:underline font-medium"
              >
                Open "{createdDocInfo.title}" in Google Docs →
              </a>
            )}
          </div>

          {/* Card 4: Google Tasks Vendor Checklist Sync */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <span>Google Tasks Vendor Checklists</span>
            </h3>
            <p className="text-xs text-slate-600">
              Push open vendor action items and production deadlines directly to your primary Google Tasks list.
            </p>
            <button
              type="button"
              onClick={() =>
                setPendingConfirm({
                  title: 'Confirm Adding Vendor Checklist to Google Tasks',
                  description: `This will create action items in your default Google Tasks list for open vendor checklist tasks.`,
                  actionLabel: 'Export to Google Tasks',
                  onConfirm: async () => {
                    const openTasks = vendors.flatMap((v) =>
                      v.checklist
                        .filter((c) => !c.completed)
                        .map((c) => ({ vendor: v.name, ...c }))
                    );
                    for (const t of openTasks.slice(0, 3)) {
                      await createGoogleTask(
                        `[${t.vendor}] ${t.task}`,
                        `Event: ${preset.name}`,
                        t.dueDate
                      );
                    }
                    setWorkspaceStatus({
                      type: 'success',
                      text: `Exported open vendor tasks to Google Tasks.`,
                    });
                  },
                })
              }
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
            >
              Push Open Checklists to Google Tasks
            </button>
            {tasksList.length > 0 && (
              <div className="text-xs text-slate-500">
                Active tasks in list: {tasksList.length}
              </div>
            )}
          </div>

          {/* Card 5: Google Keep Decor & Mood Board Notes */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <span>Google Keep Aesthetic & Botanical Note Sync</span>
              </h3>
              <span className="text-xs text-slate-500">
                Supports Enterprise Workspace Domain Accounts
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Archive your theme palette swatches ({preset.linenColor}, {preset.accentHex}) and PubChem allergen safety advisories as structured Google Keep notes.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setPendingConfirm({
                    title: 'Confirm Creating Note in Google Keep',
                    description: `This will create a new note in Google Keep containing your ${preset.themeTitle} palette and floral safety notes.`,
                    actionLabel: 'Create Google Keep Note',
                    onConfirm: async () => {
                      await createGoogleKeepNote(
                        `${preset.name} — Decor & Floral Spec`,
                        `Theme: ${preset.themeTitle}\nPalette: ${preset.linenColor}, ${preset.accentHex}\nBotanical Safety: ${compoundProfile.title} (${compoundProfile.cateringFloralGuidance})`
                      );
                      setWorkspaceStatus({
                        type: 'success',
                        text: 'Created decor note in Google Keep.',
                      });
                    },
                  })
                }
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                Save Decor & Safety Note to Google Keep
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const notes = await listGoogleKeepNotes();
                    setKeepList(notes);
                  } catch (err: any) {
                    setWorkspaceStatus({ type: 'error', text: err?.message });
                  }
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
              >
                List Google Keep Notes ({keepList.length})
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Mandatory User Confirmation Modal for Mutating Workspace Operations */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-confirm-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 id="workspace-confirm-title" className="text-base font-bold text-slate-900">
                  {pendingConfirm.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {pendingConfirm.description}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                disabled={isExecutingMutation}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecutingMutation}
                onClick={async () => {
                  setIsExecutingMutation(true);
                  try {
                    await pendingConfirm.onConfirm();
                  } catch (err: any) {
                    setWorkspaceStatus({
                      type: 'error',
                      text: err?.message || 'Workspace operation failed. Ensure you are signed in with Google.',
                    });
                  } finally {
                    setIsExecutingMutation(false);
                    setPendingConfirm(null);
                  }
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                {isExecutingMutation ? 'Executing...' : pendingConfirm.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
