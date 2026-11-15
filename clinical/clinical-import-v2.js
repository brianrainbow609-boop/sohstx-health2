// Clinical importer for SohStx combined CSV, monthly lab CSV,
// clinical review CSV, and existing Clinical JSON files.
(() => {
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && c === ",") {
        row.push(field);
        field = "";
      } else if (!quoted && (c === "\n" || c === "\r")) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some(Boolean)) rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
    if (quoted) throw Error("Incomplete quoted field in CSV.");
    row.push(field);
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function install() {
    const input = document.getElementById("file");
    const button = document.getElementById("import");
    const status = document.getElementById("status");
    if (!input || !button || !status) return;

    const jsonHandler = typeof importClinicalJSON === "function"
      ? importClinicalJSON
      : input.onchange;

    input.accept = ".csv,.json,text/csv,application/json";
    button.textContent = "Import file (CSV or JSON)";

    input.onchange = async function (event) {
      const file = input.files[0];
      if (!file) return;
      button.disabled = true;

      try {
        const text = (await file.text()).replace(/^\uFEFF/, "").trim();
        const labStore = "sohstx-lab-history-v1-clinical";
        const savedLabs = JSON.parse(localStorage.getItem(labStore) || "[]");
        const copy = JSON.parse(JSON.stringify(
          data || { format: "sohstx-clinical", version: 1 }
        ));
        copy.readings ??= [];
        copy.events ??= [];

        const labKey = r => JSON.stringify([
          r.date, r.test.trim().toLowerCase(), r.result,
          r.unit || "", r.reference_range || ""
        ]);
        const glucoseKey = r => JSON.stringify([
          Date.parse(r.date), Number(r.glucose_mg_dl)
        ]);
        const eventKey = r => JSON.stringify([
          Date.parse(r.date), r.type, r.description || "", r.details || ""
        ]);
        const labs = new Set(savedLabs.map(labKey));
        const readings = new Set(copy.readings.map(glucoseKey));
        const events = new Set(copy.events.map(eventKey));
        let labCount = 0, glucoseCount = 0, eventCount = 0;

        function addLab(row) {
          const lab = {};
          for (const k of [
            "date", "test", "result", "unit",
            "reference_range", "source", "date_basis"
          ]) lab[k] = String(row[k] ?? "").trim();

          if (!lab.test || !lab.result ||
              !/^\d{4}-\d{2}-\d{2}$/.test(lab.date) ||
              new Date(lab.date).toISOString().slice(0, 10) !== lab.date)
            throw Error("A lab row has a missing result or invalid date.");

          const key = labKey(lab);
          if (labs.has(key)) return;
          labs.add(key);
          savedLabs.push(lab);
          labCount++;
        }

        function addRecord(date, value, type, description, details, source) {
          if (!Number.isFinite(Date.parse(date)))
            throw Error("A health record has an invalid date.");
          if (value !== "" && value != null) {
            const n = Number(value);
            if (!Number.isFinite(n) || n <= 0)
              throw Error("Invalid glucose value.");
            const r = { date, glucose_mg_dl: n, source };
            const key = glucoseKey(r);
            if (readings.has(key)) return;
            readings.add(key);
            copy.readings.push(r);
            glucoseCount++;
          } else {
            const r = { date, type, description, details, source };
            const key = eventKey(r);
            if (events.has(key)) return;
            events.add(key);
            copy.events.push(r);
            eventCount++;
          }
        }

        if (text.startsWith("{")) {
          const obj = JSON.parse(text);
          if (obj.format === "sohstx-labs-v1" && Array.isArray(obj.results)) {
            obj.results.forEach(addLab);
          } else {
            if (typeof jsonHandler !== "function")
              throw Error("The Clinical JSON handler is unavailable.");
            await jsonHandler.call(input, event);
            return;
          }
        } else {
          const rows = parseCSV(text);
          const header = (rows.shift() || []).map(s => s.trim());
          const has = (...names) => names.every(n => header.includes(n));
          const combined = has("format", "type", "record_json", "result");
          const monthly = has("date", "test", "result");
          const review = has("timestamp_iso", "record_type", "glucose_mg_dl");

          if (!combined && !monthly && !review)
            throw Error("Choose a SohStx combined CSV, monthly lab CSV, or clinical review CSV.");
          if (!rows.length) throw Error("This CSV has no data rows.");

          for (const cells of rows) {
            if (cells.length !== header.length)
              throw Error("A CSV row has the wrong number of columns.");
            const r = Object.fromEntries(header.map((k, i) => [k, cells[i]]));
            if (combined) {
              if (r.format !== "sohstx-combined-v1")
                throw Error("Unknown combined CSV version.");
              if (r.type === "lab") {
                addLab(r);
              } else if (r.type === "record") {
                const rec = JSON.parse(r.record_json);
                const raw = rec.raw;
                addRecord(rec.date, raw.bgl, raw.eventType || "event",
                  raw.text || raw.description || "", raw.details || "", rec.source);
              } else throw Error("Unknown combined CSV row type.");
            } else if (monthly) {
              addLab(r);
            } else {
              addRecord(r.timestamp_iso, r.glucose_mg_dl, r.record_type,
                r.description || "", r.details || "", r.source);
            }
          }
        }

        if (glucoseCount || eventCount) {
          localStorage.setItem("sohstx-clinical-import-v1", JSON.stringify(copy));
          data = copy;
          render();
        }
        if (labCount) {
          localStorage.setItem(labStore, JSON.stringify(savedLabs));
          document.querySelector("#view-labs .lab-wrap select")
            ?.dispatchEvent(new Event("change"));
        }
        if (typeof updateClearButton === "function") updateClearButton();
        status.textContent =
          `Added ${glucoseCount} glucose readings, ${eventCount} events and ${labCount} labs. Existing matches skipped.`;
      } catch (error) {
        status.textContent = "Import did not finish: " + error.message;
      } finally {
        input.value = "";
        button.disabled = false;
      }
    };
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
