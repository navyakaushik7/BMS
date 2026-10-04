import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, resolveWardScope } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Keep payloads bounded however much data exists: beyond this many rows the
// long tail is rolled into a single "Others" row on the server.
const MAX_ROWS = 300;
const rollup = (rows, limit = MAX_ROWS) => {
  if (rows.length <= limit) return rows;
  const rest = rows.slice(limit).reduce((s, r) => s + r.value, 0);
  return [...rows.slice(0, limit), { name: 'Others', value: rest }];
};

/**
 * GET /api/analytics/overview?ward_id=&booth_id=
 * All aggregation happens in SQL, so cost stays flat as voters grow.
 * (Pre-poll demographics only — there is no voted/pending concept.)
 */
router.get('/overview', async (req, res) => {
  const wardId = resolveWardScope(req);
  const boothId = req.query.booth_id ? parseInt(req.query.booth_id, 10) : null;

  const vParams = [];
  const vClauses = [];
  if (wardId) { vParams.push(wardId); vClauses.push(`v.ward_id = $${vParams.length}`); }
  if (boothId) { vParams.push(boothId); vClauses.push(`v.booth_id = $${vParams.length}`); }
  const vWhere = vClauses.length ? `WHERE ${vClauses.join(' AND ')}` : '';

  const wParams = wardId ? [wardId] : [];
  const wardOnly = (alias) => (wardId ? `WHERE ${alias}.ward_id = $1` : '');
  const named = (col) => `COALESCE(NULLIF(v.${col}, ''), 'Not specified')`;
  const dist = (col) =>
    query(`SELECT ${named(col)} AS name, COUNT(*)::int AS value FROM voters v ${vWhere} GROUP BY 1 ORDER BY value DESC`, vParams);

  const [totals, booths, boothStats, schemeCount, enrolled, schemeStats, gender, age, religion, caste, contactStatus] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total_voters,
              COUNT(DISTINCT v.family_id)::int AS households,
              COUNT(DISTINCT NULLIF(v.religion, ''))::int AS religions,
              COUNT(DISTINCT NULLIF(v.caste, ''))::int AS castes
       FROM voters v ${vWhere}`, vParams),
    query(`SELECT COUNT(*)::int AS n FROM booths b ${wardOnly('b')}`, wParams),
    query(
      `SELECT b.name, COUNT(v.id)::int AS voters
       FROM booths b LEFT JOIN voters v ON v.booth_id = b.id
       ${wardOnly('b')} GROUP BY b.id, b.name ORDER BY voters DESC, b.name`, wParams),
    query(`SELECT COUNT(*)::int AS n FROM schemes s ${wardOnly('s')}`, wParams),
    query(
      `SELECT COUNT(DISTINCT vs.voter_id)::int AS n
       FROM voter_schemes vs JOIN voters v ON v.id = vs.voter_id ${vWhere}`, vParams),
    query(
      `SELECT s.name, COUNT(DISTINCT vs.voter_id)::int AS value
       FROM schemes s
       JOIN voter_schemes vs ON vs.scheme_id = s.id
       JOIN voters v ON v.id = vs.voter_id
       ${vWhere} GROUP BY s.id, s.name ORDER BY value DESC`, vParams),
    dist('gender'),
    query(
      `SELECT COUNT(*) FILTER (WHERE age BETWEEN 18 AND 25)::int AS a,
              COUNT(*) FILTER (WHERE age BETWEEN 26 AND 35)::int AS b,
              COUNT(*) FILTER (WHERE age BETWEEN 36 AND 45)::int AS c,
              COUNT(*) FILTER (WHERE age BETWEEN 46 AND 60)::int AS d,
              COUNT(*) FILTER (WHERE age > 60)::int AS e
       FROM voters v ${vWhere}`, vParams),
    dist('religion'),
    dist('caste'),
    query(`SELECT v.contact_status AS name, COUNT(*)::int AS value FROM voters v ${vWhere} GROUP BY 1 ORDER BY value DESC`, vParams)
  ]);

  const total = totals.rows[0].total_voters;
  const nBooths = booths.rows[0].n;
  const a = age.rows[0];

  res.json({
    stats: {
      totalVoters: total,
      totalBooths: nBooths,
      avgPerBooth: nBooths ? Math.round(boothStats.rows.reduce((s, b) => s + b.voters, 0) / nBooths) : 0,
      totalSchemes: schemeCount.rows[0].n,
      enrolledVoters: enrolled.rows[0].n,
      coveragePct: total ? Math.round((enrolled.rows[0].n / total) * 1000) / 10 : 0,
      households: totals.rows[0].households,
      totalReligions: totals.rows[0].religions,
      totalCastes: totals.rows[0].castes,
      // Any status other than 'Not Contacted' counts as reached
      contactedVoters: contactStatus.rows.filter((r) => r.name !== 'Not Contacted').reduce((s, r) => s + r.value, 0)
    },
    boothStats: boothStats.rows,
    schemeDistribution: rollup(schemeStats.rows),
    ageDistribution: [
      { name: '18-25', value: a.a }, { name: '26-35', value: a.b }, { name: '36-45', value: a.c },
      { name: '46-60', value: a.d }, { name: '60+', value: a.e }
    ],
    genderDistribution: gender.rows,
    religionDistribution: rollup(religion.rows),
    casteDistribution: rollup(caste.rows),
    contactStatusDistribution: contactStatus.rows
  });
});

/** GET /api/analytics/scheme-caste — scheme x caste counts (for the Excel cross-tab) */
router.get('/scheme-caste', async (req, res) => {
  const wardId = resolveWardScope(req);
  const params = wardId ? [wardId] : [];
  const { rows } = await query(
    `SELECT s.name AS scheme, s.category,
            COALESCE(NULLIF(v.caste, ''), 'Not specified') AS caste,
            COUNT(DISTINCT v.id)::int AS voters
     FROM voter_schemes vs
     JOIN schemes s ON s.id = vs.scheme_id
     JOIN voters v ON v.id = vs.voter_id
     ${wardId ? 'WHERE v.ward_id = $1' : ''}
     GROUP BY s.name, s.category, 3 ORDER BY s.name, voters DESC`, params);
  res.json(rows);
});

export default router;
