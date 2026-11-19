(() => {
  const columns = [
    'format', 'type', 'date', 'test', 'result', 'unit',
    'reference_range', 'source', 'date_basis', 'id', 'record_json'
  ];
  const labFields = [
    'date', 'test', 'result', 'unit', 'reference_range', 'source', 'date_basis'
  ];
  const labsKey = 'sohstx-lab-history-v1-personal';

  function labKey(lab) {
    return JSON.stringify([
      lab.date, lab.test.trim().toLowerCase(), lab.result,
      lab.unit, lab.reference_range
    ]);
  }

  function readRows(rows, header) {
    return rows.slice(1).map((values, index) => {
      if (values.length !== header.length) {
        throw Error('Column count differs at row ' + (index + 2));
      }
      return Object.fromEntries(header.map((name, i) => [name, values[i]]));
    });
  }

  function decodeMaster(items) {
    const records = [];
    const labs = [];

    for (const item of items) {
      if (item.format !== 'sohstx-combined-v1') {
        throw Error('Unknown SohStx master file version.');
      }
      if (item.type === 'lab') {
        labs.push(item);
      } else if (item.type === 'record') {
        const record = JSON.parse(item.record_json);
        if (!record || record.id !== item.id || record.date !== item.date ||
            record.source !== item.source) {
          throw Error('Health record does not match its CSV row.');
        }
        records.push(record);
      } else {
        throw Error('Unknown master file row type.');
      }
    }

    if (!records.length && !labs.length) throw Error('Master file is empty.');
    return { records, labs };
  }

  function clinicalRecords(readings, events) {
    const records = [];

    for (const item of readings) {
      const value = Number(item.glucose_mg_dl);
      if (!Number.isFinite(value) || value <= 0) {
        throw Error('Invalid glucose result.');
      }
      const date = new Date(item.date).toISOString();
      records.push({
        id: 'review:' + date + ':' + value,
        date,
        source: 'libreview',
        raw: {
          date, bgl: value, eventType: 'GLUCOSE', msgType: 'LIBREVIEW',
          libreKind: 'historic', description: 'Imported clinical reading'
        }
      });
    }

    for (const event of events) {
      const date = new Date(event.date).toISOString();
      const text = String(event.description || '');
      const details = String(event.details || '');
      const type = String(event.type || 'event');
      records.push({
        id: 'review:' + JSON.stringify([date, type, text, details]),
        date,
        source: event.source || 'manual',
        raw: { date, bgl: '', eventType: type, text, details }
      });
    }

    return { records, labs: [] };
  }

  function classify(text) {
    text = text.replace(/^\uFEFF/, '').trim();
    if (text.startsWith('{')) {
      const data = JSON.parse(text);
      if (data.format === 'sohstx-health' && data.version === 1) {
        return { records: data.records, labs: [] };
      }
      if (data.format === 'sohstx-labs-v1') {
        return { records: [], labs: data.results };
      }
      if (data.format === 'sohstx-clinical' &&
          Array.isArray(data.readings) && Array.isArray(data.events)) {
        return clinicalRecords(data.readings, data.events);
      }
      throw Error('Unrecognized JSON export.');
    }

    const rows = parseCSV(text);
    const header = (rows[0] || []).map(name => name.trim());
    if (columns.every(name => header.includes(name))) {
      return decodeMaster(readRows(rows, header));
    }

    const libreFields = [
      'Device Timestamp', 'Record Type',
      'Historic Glucose mg/dL', 'Scan Glucose mg/dL'
    ];
    if (rows.some(row => {
      const names = row.map(value => value.trim());
      return libreFields.every(name => names.includes(name));
    })) return 'libre';

    const items = readRows(rows, header);
    if (['date', 'test', 'result'].every(name => header.includes(name))) {
      return { records: [], labs: items };
    }
    if (header.join('|') ===
        'timestamp_iso|record_type|glucose_mg_dl|description|details|source') {
      return clinicalRecords(
        items.filter(r => r.record_type === 'glucose')
          .map(r => ({ ...r, date: r.timestamp_iso })),
        items.filter(r => r.record_type !== 'glucose')
          .map(r => ({ ...r, date: r.timestamp_iso, type: r.record_type }))
      );
    }
    if (header.join('|') === 'date|type|value|details|source') {
      return clinicalRecords(
        items.filter(r => r.type === 'Glucose')
          .map(r => ({ ...r, glucose_mg_dl: r.value })),
        items.filter(r => r.type !== 'Glucose')
          .map(r => ({ ...r, description: r.details, details: '' }))
      );
    }
    throw Error('Choose a LibreView, lab, or SohStx export.');
  }

  function signature(record) {
    const raw = record.raw;
    const value = raw.bgl !== '' && raw.bgl != null
      ? Number(raw.bgl)
      : [raw.eventType, raw.text || raw.description || '', raw.details || ''];
    return JSON.stringify([Date.parse(record.date), value]);
  }

  async function merge(payload) {
    if (!Array.isArray(payload.records) || !Array.isArray(payload.labs)) {
      throw Error('Invalid export structure.');
    }

    const labs = JSON.parse(localStorage.getItem(labsKey) || '[]');
    const previousLabCount = labs.length;
    const labKeys = new Set(labs.map(labKey));

    for (const item of payload.labs) {
      const lab = Object.fromEntries(
        labFields.map(key => [key, String(item[key] ?? '').trim()])
      );
      if (!lab.test || !lab.result || !/^\d{4}-\d{2}-\d{2}$/.test(lab.date) ||
          !Number.isFinite(Date.parse(lab.date)) ||
          new Date(lab.date).toISOString().slice(0, 10) !== lab.date) {
        throw Error('Invalid lab row.');
      }
      const key = labKey(lab);
      if (!labKeys.has(key)) {
        labs.push(lab);
        labKeys.add(key);
      }
    }

    const existing = await getAll();
    const ids = new Set(existing.map(record => record.id));
    const signatures = new Set(existing.map(signature));
    const fresh = [];

    for (const record of payload.records) {
      if (!record || typeof record.id !== 'string' || !record.id ||
          !Number.isFinite(Date.parse(record.date)) ||
          !record.raw || typeof record.raw !== 'object' ||
          typeof record.source !== 'string') {
        throw Error('Invalid health record.');
      }
      const key = signature(record);
      const repeatedReview = record.id.startsWith('review:') && signatures.has(key);
      if (!ids.has(record.id) && !repeatedReview) fresh.push(record);
      ids.add(record.id);
      signatures.add(key);
    }

    if (fresh.length) {
      await transaction('readwrite', store => {
        for (const record of fresh) store.add(record);
      });
    }
    const addedLabs = labs.length - previousLabCount;
    if (addedLabs) localStorage.setItem(labsKey, JSON.stringify(labs));
    await refresh();
    document.querySelector('#view-labs .lab-wrap select')
      ?.dispatchEvent(new Event('change'));
    return `${fresh.length} health records and ${addedLabs} labs added.`;
  }

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.csv,.json,text/csv,application/json';
  picker.hidden = true;
  document.body.append(picker);

  let importing = false;
  window.addEventListener('click', event => {
    if (!event.target.closest?.('#importBtn')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!importing) picker.click();
  }, true);

  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (!file || importing) return;
    importing = true;
    const button = document.getElementById('importBtn');
    button.disabled = true;
    try {
      const payload = classify(await file.text());
      if (payload === 'libre') await importCSV(file);
      else notice(await merge(payload));
    } catch (error) {
      notice('Import error: ' + error.message);
    } finally {
      picker.value = '';
      button.disabled = false;
      importing = false;
    }
  });
})();
