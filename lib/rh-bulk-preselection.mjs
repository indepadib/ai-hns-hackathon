/**
 * Bulk preselection domain logic. This module deliberately has no storage,
 * browser, email or Netlify side effects. Bind to the real RH backend only
 * after its authentication, status vocabulary and update contract are verified.
 */
export function parseSubmissionNumbers(input) {
  const tokens = String(input ?? '').trim().split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length || tokens.length > 500) throw new Error('Saisir entre 1 et 500 identifiants.');
  const ids = new Set(), duplicates = new Set();
  for (const token of tokens) {
    if (!/^[1-9][0-9]*$/.test(token) || !Number.isSafeInteger(Number(token))) {
      throw new Error('Identifiant invalide : ' + token);
    }
    const id = Number(token);
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }
  return { ids: [...ids], duplicates: [...duplicates] };
}

/** Status values MUST come from the existing RH application, not guessed labels. */
export function planPreselection({ input, candidates, selectedStatus, eligibleStatuses }) {
  if (typeof selectedStatus !== 'string' || !selectedStatus ||
      !Array.isArray(eligibleStatuses) || !eligibleStatuses.length ||
      eligibleStatuses.includes(selectedStatus)) throw new Error('Configuration RH invalide.');
  const { ids, duplicates } = parseSubmissionNumbers(input);
  const byNumber = new Map();
  for (const candidate of candidates) {
    const n = Number(candidate.submissionNumber);
    if (!byNumber.has(n)) byNumber.set(n, []);
    byNumber.get(n).push(candidate);
  }
  const eligible = new Set(eligibleStatuses);
  const rows = ids.map(number => {
    const matches = byNumber.get(number) ?? [];
    if (!matches.length) return { number, action: 'missing' };
    if (matches.length !== 1) return { number, action: 'ambiguous' };
    const { id, status, version } = matches[0];
    const base = { number, id, status, version };
    if (status === selectedStatus) return { ...base, action: 'already-selected' };
    if (!eligible.has(status)) return { ...base, action: 'preserve' };
    if (id == null || id === '' || version == null || version === '') return { ...base, action: 'unverifiable' };
    return { ...base, action: 'select' };
  });
  const counts = {};
  for (const row of rows) counts[row.action] = (counts[row.action] ?? 0) + 1;
  return { rows, counts, duplicates, requested: ids.length };
}

/**
 * Called on the server AFTER authenticating/authorizing the current RH actor.
 * loadCandidates must read live records. compareAndSelect must implement a
 * server-enforced conditional update on the existing record, preserve notes
 * and history, record the actor, and NEVER dispatch invitations.
 * If the production adapter cannot ensure those properties, do not bind it.
 */
export async function applyPreselection({ input, selectedStatus, eligibleStatuses,
  confirmedNumbers, loadCandidates, compareAndSelect, authorize, actor }) {
  if (typeof authorize !== 'function' || !(await authorize(actor))) throw new Error('Accès RH refusé.');
  if (!Array.isArray(confirmedNumbers)) throw new Error('Prévisualisation et confirmation requises.');
  const plan = planPreselection({ input, candidates: await loadCandidates(),
    selectedStatus, eligibleStatuses });
  const allowed = new Set(confirmedNumbers);
  const results = [];
  for (const row of plan.rows) {
    if (row.action !== 'select') { results.push(row); continue; }
    if (!allowed.has(row.number)) { results.push({ ...row, action: 'not-confirmed' }); continue; }
    try {
      const outcome = await compareAndSelect({ id: row.id, expectedStatus: row.status,
        expectedVersion: row.version, nextStatus: selectedStatus, actor, notify: false });
      results.push({ ...row, action: outcome?.updated === true ? 'updated' : 'conflict' });
    } catch {
      results.push({ ...row, action: 'error' });
    }
  }
  const counts = {};
  for (const row of results) counts[row.action] = (counts[row.action] ?? 0) + 1;
  return { requested: plan.requested, duplicates: plan.duplicates, rows: results, counts };
}
