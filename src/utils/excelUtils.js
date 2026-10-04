import * as XLSX from 'xlsx';

/** Exports a list of voters (already fetched, filters applied) to an .xlsx file. */
export function exportVotersToExcel(voters, filename = 'voter-register.xlsx') {
  const sheetData = voters.map((v) => ({
    'Voter ID': v.voter_card_id,
    'Name': v.name,
    'Relation Name': v.relation_name || '',
    'Age': v.age,
    'Gender': v.gender,
    'Phone': v.phone || '',
    'Address': v.address || '',
    'Religion': v.religion || '',
    'Caste': v.caste || '',
    'Sub-Caste': v.sub_caste || '',
    'Ward': v.ward_name || '',
    'Booth': v.booth_name || '',
    // A voter can be enrolled in more than one scheme, so every scheme
    // they're part of is listed here, comma-separated.
    'Schemes Enrolled': Array.isArray(v.schemes) && v.schemes.length > 0
      ? v.schemes.map((s) => s.name).join(', ')
      : (v.scheme_name || '')
  }));
  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Voters');
  XLSX.writeFile(workbook, filename);
}

/** Exports a multi-sheet workbook for the Reports page. */
export function exportReportToExcel({ boothStats, schemeStats, ageStats, religionStats, casteStats, schemeCaste }, filename = 'voter-analytics-report.xlsx') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet((boothStats || []).map((b) => ({ Booth: b.name, Voters: b.voters }))),
    'Booth-wise Voters'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet((schemeStats || []).map((s) => ({ Scheme: s.name, Enrolled: s.value }))),
    'Scheme Coverage'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet((ageStats || []).map((a) => ({ 'Age Group': a.name, Voters: a.value }))),
    'Age Distribution'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet((religionStats || []).map((r) => ({ Religion: r.name, Voters: r.value }))),
    'Religion Split'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet((casteStats || []).map((c) => ({ Caste: c.name, Voters: c.value }))),
    'Caste Breakdown'
  );
  if (schemeCaste?.length) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(schemeCasteMatrix(schemeCaste)), 'Scheme x Caste');
  }
  XLSX.writeFile(workbook, filename);
}

/** Pivot [{scheme, caste, voters}] into one row per scheme with a column per caste + Total. */
export function schemeCasteMatrix(rows) {
  const castes = [...new Set(rows.map((r) => r.caste))];
  const bySchemeMap = new Map();
  rows.forEach((r) => {
    const row = bySchemeMap.get(r.scheme) || { Scheme: r.scheme, Category: r.category, Total: 0 };
    row[r.caste] = (row[r.caste] || 0) + r.voters;
    row.Total += r.voters;
    bySchemeMap.set(r.scheme, row);
  });
  return [...bySchemeMap.values()].map((row) => {
    castes.forEach((c) => { if (row[c] === undefined) row[c] = 0; });
    return row;
  });
}

const TEMPLATE_HEADERS = ['Voter ID', 'Name', 'Relation Name', 'Age', 'Gender', 'Phone', 'Address', 'Religion', 'Caste', 'Sub-Caste', 'Ward', 'Booth', 'Schemes Enrolled'];

/** Blank import template with the exact headers the importer expects. */
export function downloadVoterTemplate() {
  const sample = { 'Voter ID': 'ABC1234567', Name: 'Sample Name', 'Relation Name': 'S/O Sample', Age: 35, Gender: 'Male', Phone: '9876543210', Address: 'House 1, Street', Religion: 'Sikh', Caste: 'Jat Sikh', 'Sub-Caste': '', Ward: '', Booth: 'Booth 1', 'Schemes Enrolled': 'PM-KISAN, Ujjwala Yojana' };
  const ws = XLSX.utils.json_to_sheet([sample], { header: TEMPLATE_HEADERS });
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Voters');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Voter ID is the unique key: existing IDs are updated, new IDs are added.'],
    ['Several schemes: separate with a comma. Unknown booths and schemes are created.'],
    ['Leave Ward empty when a ward is selected in the top bar.']
  ]), 'Help');
  XLSX.writeFile(wb, 'voter-import-template.xlsx');
}

/** Scheme-wise export: voters (current filters) + caste / religion / booth summaries that match the charts. */
export function exportSchemeViewToExcel({ scheme, voters }, filename) {
  const count = (key) => {
    const m = new Map();
    voters.forEach((v) => { const k = v[key] || 'Not specified'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ [key === 'booth_name' ? 'Booth' : key === 'caste' ? 'Caste' : 'Religion']: name, Voters: n, Share: `${((n / (voters.length || 1)) * 100).toFixed(1)}%` }));
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(voters.map((v) => ({
    'Voter ID': v.voter_card_id, Name: v.name, 'Relation Name': v.relation_name || '', Age: v.age, Gender: v.gender,
    Phone: v.phone || '', Address: v.address || '', Religion: v.religion || '', Caste: v.caste || '', 'Sub-Caste': v.sub_caste || '',
    Booth: v.booth_name || '', 'Schemes Enrolled': (v.schemes || []).map((x) => x.name).join(', ')
  }))), 'Voters');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(count('caste')), 'By Caste');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(count('religion')), 'By Religion');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(count('booth_name')), 'By Booth');
  XLSX.writeFile(wb, filename || `${scheme.name.replace(/[^\w]+/g, '-')}.xlsx`);
}

/**
 * Parses an uploaded .xlsx file (matching the exported column headers, or the
 * Booth_Management_Voter_Register.xlsx template headers) into the row shape
 * expected by the backend's /voters/bulk-import endpoint.
 */
export function parseVoterExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const rows = json.map((row) => {
          const houseNo = row['House No.'] || row['house_no'] || '';
          const locality = row['Ward / Locality'] || row['ward_locality'] || '';
          const combinedAddress = [houseNo, locality].filter(Boolean).join(', ');

          return {
            voter_card_id: String(row['Voter ID'] || row['voter_card_id'] || '').trim(),
            name: String(row['Name'] || row['Full Name'] || row['name'] || '').trim(),
            relation_name: String(row['Relation Name'] || row['relation_name'] || '').trim(),
            age: Number(row['Age'] || row['age']) || null,
            gender: row['Gender'] || row['gender'] || 'Male',
            phone: String(row['Phone'] || row['phone'] || ''),
            address: String(row['Address'] || row['address'] || combinedAddress || ''),
            religion: String(row['Religion'] || row['religion'] || '').trim(),
            caste: String(row['Caste'] || row['caste'] || '').trim(),
            sub_caste: String(row['Sub-Caste'] || row['Sub Caste'] || row['sub_caste'] || '').trim(),
            ward_name: String(row['Ward'] || row['Ward / Locality'] || row['ward_name'] || '').trim(),
            booth_name: row['Booth'] || row['booth_name'] || '',
            scheme_name: row['Scheme'] || row['Schemes Enrolled'] || row['scheme_name'] || ''
          };
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
