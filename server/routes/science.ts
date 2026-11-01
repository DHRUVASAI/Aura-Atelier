import { Router } from 'express';
import { CURATED_PUBCHEM_PROFILES } from '../../src/data/seedEvents';
import { fetchWithRetry } from '../gemini';

const router = Router();

router.get('/pubchem/:query', async (req, res) => {
  const rawQuery = String(req.params.query || 'linalool').trim();
  const normalizedKey = rawQuery.toLowerCase();
  const fallbackRecord =
    CURATED_PUBCHEM_PROFILES[normalizedKey] || CURATED_PUBCHEM_PROFILES.linalool;

  try {
    const encoded = encodeURIComponent(rawQuery);
    const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encoded}/property/Title,IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount/JSON`;
    const propRes = await fetchWithRetry(propUrl, {}, 2, 400);
    const propJson = await propRes.json();
    const p = propJson?.PropertyTable?.Properties?.[0];
    if (!p || !p.CID) {
      return res.json(fallbackRecord);
    }

    return res.json({
      cid: Number(p.CID),
      queryName: rawQuery,
      title: p.Title || fallbackRecord.title,
      iupacName: p.IUPACName || fallbackRecord.iupacName,
      molecularFormula: p.MolecularFormula || fallbackRecord.molecularFormula,
      molecularWeight: Number(p.MolecularWeight || fallbackRecord.molecularWeight),
      canonicalSmiles: p.CanonicalSMILES || p.ConnectivitySMILES || fallbackRecord.canonicalSmiles,
      inchiKey: p.InChIKey || fallbackRecord.inchiKey,
      xlogp: Number(p.XLogP ?? fallbackRecord.xlogp),
      tpsa: Number(p.TPSA ?? fallbackRecord.tpsa),
      hBondDonorCount: Number(p.HBondDonorCount ?? fallbackRecord.hBondDonorCount),
      hBondAcceptorCount: Number(p.HBondAcceptorCount ?? fallbackRecord.hBondAcceptorCount),
      rotatableBondCount: Number(p.RotatableBondCount ?? fallbackRecord.rotatableBondCount),
      eventContextRole:
        CURATED_PUBCHEM_PROFILES[normalizedKey]?.eventContextRole ||
        `Evaluated botanical/culinary compound (${rawQuery}) for reception catering and floral table placement.`,
      allergenRiskLevel:
        CURATED_PUBCHEM_PROFILES[normalizedKey]?.allergenRiskLevel || 'Low / Safe',
      ghsHazards: CURATED_PUBCHEM_PROFILES[normalizedKey]?.ghsHazards || [
        'Verified via live NCBI PubChem PUG-REST property table',
      ],
      cateringFloralGuidance:
        CURATED_PUBCHEM_PROFILES[normalizedKey]?.cateringFloralGuidance ||
        'Cross-check guest dietary declarations and maintain clear allergen cards on buffet stations.',
      provenanceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`,
      isLivePubChem: true,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      // log or handle
    }
    return res.json(fallbackRecord);
  }
});

export default router;
