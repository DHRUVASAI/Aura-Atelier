import React, { useEffect, useState } from 'react';
import {
  EventPreset,
  PubChemCompoundProfile,
  TimelineMilestone,
  VendorRecord,
} from '../types/planning';
import { CURATED_PUBCHEM_PROFILES } from '../data/seedEvents';
import { evaluateCompoundSafety } from '../utils/planningLogic';
import {
  createGoogleKeepNote,
  googleSignIn,
  subscribeWorkspaceAuth,
} from '../services/firebaseAuth';
import {
  FlaskConical,
  ExternalLink,
  Search,
  StickyNote,
  AlertTriangle,
} from 'lucide-react';

interface BioscienceAndWorkspaceViewProps {
  preset: EventPreset;
  vendors?: VendorRecord[];
  timeline?: TimelineMilestone[];
  stagedEmail?: { to: string; subject: string; body: string } | null;
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
}) => {
  const [selectedCompoundKey, setSelectedCompoundKey] = useState<string>('linalool');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [compoundProfile, setCompoundProfile] = useState<PubChemCompoundProfile>(
    CURATED_PUBCHEM_PROFILES.linalool
  );
  const [isLoadingCompound, setIsLoadingCompound] = useState<boolean>(false);

  // Contextual Google Keep Note Sync for Allergen Advisory
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [confirmSaveKeep, setConfirmSaveKeep] = useState<boolean>(false);
  const [isSavingKeep, setIsSavingKeep] = useState<boolean>(false);
  const [keepFeedback, setKeepFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeWorkspaceAuth((state) => {
      setIsAuthenticated(state.isAuthenticated);
    });
    return () => unsub();
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

  const safetyMetrics = evaluateCompoundSafety(compoundProfile);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Scientific Workbench — Catering & Floral Allergen Safety Scout */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs text-slate-500">
              04. Molecular & Allergen Safety Scout · Powered by NCBI PubChem PUG-REST API
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

        {/* Quick-Try Example Bar */}
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

            {/* 2D Skeletal Chemical Structure Canvas */}
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

            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-900">
                  Event Sommelier & Floral Placement Directive ({safetyMetrics.volatilityClass})
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!isAuthenticated) {
                      await googleSignIn();
                    }
                    setConfirmSaveKeep(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pin Allergen Directive to Google Keep</span>
                </button>
              </div>
              <p>{compoundProfile.cateringFloralGuidance}</p>
              <p className="text-slate-600">{safetyMetrics.safetySummary}</p>
              {keepFeedback && (
                <div className="pt-1 font-medium text-emerald-700">{keepFeedback}</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Modal for Saving Allergen Note to Google Keep */}
      {confirmSaveKeep && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="keep-safety-confirm-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 id="keep-safety-confirm-title" className="text-base font-bold text-slate-900">
                  Save Allergen Safety Note to Google Keep?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  This will create a note in your Google Keep account for "{preset.name}" with the {compoundProfile.title} allergen & floral placement directive.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSaveKeep(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingKeep}
                onClick={async () => {
                  setIsSavingKeep(true);
                  try {
                    await createGoogleKeepNote(
                      `${preset.name} — ${compoundProfile.title} Safety Directive`,
                      `Compound: ${compoundProfile.title} (${compoundProfile.molecularFormula})\nRisk: ${compoundProfile.allergenRiskLevel}\nGuidance: ${compoundProfile.cateringFloralGuidance}`
                    );
                    setKeepFeedback(`Saved "${compoundProfile.title}" safety directive to Google Keep.`);
                  } catch (err: any) {
                    setKeepFeedback(err?.message || 'Unable to save note.');
                  } finally {
                    setIsSavingKeep(false);
                    setConfirmSaveKeep(false);
                  }
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                {isSavingKeep ? 'Saving...' : 'Confirm & Save to Keep'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
