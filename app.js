/* ========================================
   CSV PARSER: converts CSV text to array of objects
   ======================================== */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || "").trim();
    });
    return obj;
  });
}

/* ========================================
   GLOBAL STATE
   ======================================== */
let parts = []; // master array of all parts
let filteredParts = []; // filtered/searched subset
let selectedIndex = null; // index into `parts` of currently selected row
let notesIndex = null; // index into `parts` for notes modal

/* ========================================
   DOM REFERENCES
   ======================================== */
const tableBody = document.querySelector("#parts-table tbody");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const form = document.querySelector("#part-form");
const resetFormBtn = document.querySelector("#reset-form");
const deleteBtn = document.querySelector("#delete-part");
const downloadCsvBtn = document.querySelector("#download-csv");
const downloadPdfBtn = document.querySelector("#download-pdf");
const totalsBar = document.querySelector("#totals-bar");

// Notes modal elements
const notesModal = document.querySelector("#notes-modal");
const modalBackdrop = document.querySelector("#modal-backdrop");
const notesCloseBtn = document.querySelector("#notes-close");
const notesSaveBtn = document.querySelector("#notes-save");
const notesTextarea = document.querySelector("#notes-textarea");
const notesTitle = document.querySelector("#notes-title");

/* ========================================
   LOAD DATA: fetch and parse CSV on startup
   ======================================== */
async function loadData() {
  try {
    const res = await fetch("data/pc_parts.csv");
    if (!res.ok) throw new Error("Failed to load CSV");
    const text = await res.text();
    parts = parseCSV(text);
    filteredParts = [...parts];
    renderTable();
  } catch (err) {
    console.error(err);
    tableBody.innerHTML =
      '<tr><td colspan="8">Unable to load CSV. Ensure <code>data/pc_parts.csv</code> exists.</td></tr>';
    updateTotals();
  }
}

/* ========================================
   FORMATTING HELPERS
   ======================================== */

// Format price with currency
function formatPrice(p) {
  if (!p.PricePaid) return "";
  const cur = p.Currency || "USD";
  const num = Number.parseFloat(p.PricePaid);
  if (Number.isNaN(num)) return `${cur} ${p.PricePaid}`;
  return `${cur} ${num.toFixed(2)}`;
}

// Summarize warranty info
function summarizeWarranty(p) {
  if (!p.WarrantyProvider && !p.WarrantyLengthMonths) {
    return '<span class="badge badge-none">None recorded</span>';
  }
  const months = p.WarrantyLengthMonths ? `${p.WarrantyLengthMonths}m` : "";
  const type = p.WarrantyType || "";
  const end = p.WarrantyEndDate || "";
  const label = [p.WarrantyProvider, type, months].filter(Boolean).join(" • ");
  const extra = end ? `Ends: ${end}` : "";
  return [label, extra].filter(Boolean).join("<br/>");
}

// Summarize extended warranty info
function summarizeExtendedWarranty(p) {
  if (!p.ExtendedWarrantyProvider && !p.ExtendedWarrantyLengthMonths) {
    return '<span class="badge badge-none">None</span>';
  }
  const months = p.ExtendedWarrantyLengthMonths
    ? `${p.ExtendedWarrantyLengthMonths}m`
    : "";
  const label = [p.ExtendedWarrantyProvider, months]
    .filter(Boolean)
    .join(" • ");
  const details = p.ExtendedWarrantyDetails || "";
  return `<span class="badge badge-extended">${label}</span>${
    details ? `<br/>${details}` : ""
  }`;
}

// Build contact info block (email + phone)
function contactBlock(email, phone) {
  const bits = [];
  if (email) bits.push(`<div>Email: <a href="mailto:${email}">${email}</a></div>`);
  if (phone) bits.push(`<div>Phone: ${phone}</div>`);
  return bits.join("") || "";
}

/* ========================================
   RENDER TABLE: build HTML rows from filteredParts
   ======================================== */
function renderTable() {
  if (!filteredParts.length) {
    tableBody.innerHTML =
      '<tr><td colspan="8">No parts found. Add entries via the form or in the CSV.</td></tr>';
    updateTotals();
    return;
  }

  tableBody.innerHTML = filteredParts
    .map((p) => {
      const masterIndex = parts.indexOf(p);
      const isSelected = masterIndex === selectedIndex;

      const vendor = p.VendorName || "";
      const vendorLink = p.VendorWebsite
        ? `<a href="${p.VendorWebsite}" target="_blank">${vendor || "Vendor site"}</a>`
        : vendor;
      const cat = p.Category || "";
      const partName = p.PartName || "";
      const model = p.Model || "";
      const partDisplay = [partName, model].filter(Boolean).join(" — ");

      const vendorContact = contactBlock(
        p.VendorSupportEmail,
        p.VendorSupportPhone
      );
      const warrantyContact = contactBlock(
        p.WarrantySupportEmail,
        p.WarrantySupportPhone
      );

      return `
        <tr data-index="${masterIndex}" class="${isSelected ? "selected-row" : ""}">
          <td class="category-cell" data-notes-index="${masterIndex}">${cat}</td>
          <td>${partDisplay}</td>
          <td>${vendorLink || ""}</td>
          <td>${formatPrice(p)}</td>
          <td>${summarizeWarranty(p)}</td>
          <td>${summarizeExtendedWarranty(p)}</td>
          <td>${vendorContact}</td>
          <td>${warrantyContact}</td>
        </tr>
      `;
    })
    .join("");

  updateTotals();
}

/* ========================================
   UPDATE TOTALS BAR: sum of all visible prices
   ======================================== */
function updateTotals() {
  if (!totalsBar) return;
  const source = filteredParts.length ? filteredParts : parts;
  const total = source.reduce((sum, p) => {
    const v = parseFloat(p.PricePaid);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  if (!source.length) {
    totalsBar.textContent = "No parts to total.";
    return;
  }

  totalsBar.textContent = `Total price of listed parts: USD ${total.toFixed(2)}`;
}

/* ========================================
   FILTER LOGIC: search + category filter
   ======================================== */
function applyFilters() {
  const q = (searchInput.value || "").toLowerCase();
  const cat = categoryFilter.value;

  filteredParts = parts.filter((p) => {
    const matchCat = !cat || p.Category === cat;
    if (!matchCat) return false;

    if (!q) return true;
    const str = [
      p.PartName,
      p.Model,
      p.VendorName,
      p.WarrantyProvider,
      p.ExtendedWarrantyProvider,
      p.Notes,
    ]
      .join(" ")
      .toLowerCase();
    return str.includes(q);
  });

  renderTable();
}

/* ========================================
   FORM HELPERS
   ======================================== */

// Convert form data to object; fill empty fields with dummy_ values
function formToObject(formEl) {
  const data = new FormData(formEl);
  const obj = {};
  for (const [key, val] of data.entries()) {
    obj[key] = val.trim() || `dummy_${key}`;
  }
  return obj;
}

// Populate form from a selected part
function populateFormFromPart(part) {
  const fields = [
    "Category",
    "PartName",
    "Model",
    "VendorName",
    "VendorWebsite",
    "VendorLoginURL",
    "VendorUsername",
    "VendorPasswordHint",
    "VendorSupportEmail",
    "VendorSupportPhone",
    "PurchaseDate",
    "PricePaid",
    "Currency",
    "OrderID",
    "SerialNumber",
    "WarrantyProvider",
    "WarrantyType",
    "WarrantyRegistrationURL",
    "WarrantyLengthMonths",
    "WarrantyStartDate",
    "WarrantyEndDate",
    "WarrantySupportEmail",
    "WarrantySupportPhone",
    "ExtendedWarrantyProvider",
    "ExtendedWarrantyLengthMonths",
    "ExtendedWarrantyDetails",
    "ExtendedWarrantySupportEmail",
    "ExtendedWarrantySupportPhone",
    "Notes",
  ];

  fields.forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.value = part[name] || "";
  });
}

// Clear row selection highlight
function clearSelectionHighlight() {
  tableBody.querySelectorAll("tr").forEach((row) => {
    row.classList.remove("selected-row");
  });
}

/* ========================================
   NOTES MODAL HELPERS
   ======================================== */

// Open notes modal for a specific part
function openNotesModal(index) {
  notesIndex = index;
  const part = parts[index];
  if (!part) return;

  const title = [part.PartName || "", part.Model || ""]
    .filter(Boolean)
    .join(" — ");
  notesTitle.textContent = title || "Part Notes";

  notesTextarea.value = part.Notes || "";

  modalBackdrop.classList.remove("hidden");
  notesModal.classList.remove("hidden");
}

// Close notes modal
function closeNotesModal() {
  notesIndex = null;
  modalBackdrop.classList.add("hidden");
  notesModal.classList.add("hidden");
}

/* ========================================
   DOWNLOAD HELPERS
   ======================================== */

// Download current table as CSV
function downloadCsvSnapshot() {
  const source = filteredParts.length ? filteredParts : parts;
  if (!source.length) return;

  const headers = Object.keys(source[0]);
  const rows = [
    headers.join(","),
    ...source.map((p) =>
      headers.map((h) => (p[h] || "").replace(/,/g, " ")).join(",")
    ),
  ];
  const blob = new Blob([rows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pc_parts_table.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Download current table as PDF
function downloadPdfTable() {
  const source = filteredParts.length ? filteredParts : parts;
  if (!source.length || !window.jspdf || !window.jspdf.jsPDF) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "pt", "a4");

  const columns = [
    { header: "Category", key: "Category" },
    { header: "Part", key: "PartName" },
    { header: "Model", key: "Model" },
    { header: "Vendor", key: "VendorName" },
    { header: "Price", key: "PricePaid" },
    { header: "Warranty", key: "WarrantyProvider" },
    { header: "Ext. Warranty", key: "ExtendedWarrantyProvider" },
    { header: "Notes", key: "Notes" },
  ];

  const rows = source.map((p) => ({
    Category: p.Category || "",
    PartName: p.PartName || "",
    Model: p.Model || "",
    VendorName: p.VendorName || "",
    PricePaid: formatPrice(p),
    WarrantyProvider: p.WarrantyProvider || "",
    ExtendedWarrantyProvider: p.ExtendedWarrantyProvider || "",
    Notes: p.Notes || "",
  }));

  doc.text("PC Build Matrix – Parts Summary", 40, 40);

  const head = [columns.map((c) => c.header)];
  const body = rows.map((r) => columns.map((c) => r[c.key]));

  doc.autoTable({
    startY: 60,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 200, 150] },
  });

  doc.save("pc_parts_table.pdf");
}

/* ========================================
   EVENT LISTENERS
   ======================================== */

// Click on table row: select row and populate form
// Click on Category cell: open notes modal
tableBody.addEventListener("click", (e) => {
  // Check if Category cell was clicked
  const categoryCell = e.target.closest(".category-cell");
  if (categoryCell && categoryCell.dataset.notesIndex !== undefined) {
    const idx = Number.parseInt(categoryCell.dataset.notesIndex, 10);
    if (!Number.isNaN(idx) && parts[idx]) {
      openNotesModal(idx);
    }
    e.stopPropagation();
    return;
  }

  // Otherwise, select the row
  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.index) return;

  const idx = Number.parseInt(tr.dataset.index, 10);
  if (Number.isNaN(idx) || !parts[idx]) return;

  selectedIndex = idx;
  clearSelectionHighlight();
  tr.classList.add("selected-row");
  populateFormFromPart(parts[idx]);
});

// Search input: filter table
searchInput.addEventListener("input", applyFilters);

// Category filter: filter table
categoryFilter.addEventListener("change", applyFilters);

// Form submit: save (add or update) part
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const obj = formToObject(form);

  if (selectedIndex !== null && parts[selectedIndex]) {
    // Update currently selected part
    parts[selectedIndex] = { ...parts[selectedIndex], ...obj };
  } else {
    // No row selected: try match by Category + PartName + Model, else add new
    const idx = parts.findIndex(
      (p) =>
        p.Category === obj.Category &&
        p.PartName === obj.PartName &&
        p.Model === obj.Model
    );
    if (idx >= 0) {
      parts[idx] = { ...parts[idx], ...obj };
      selectedIndex = idx;
    } else {
      // Ensure new part has all fields from existing parts
      if (parts.length) {
        const headers = Object.keys(parts[0]);
        headers.forEach((h) => {
          if (!(h in obj)) obj[h] = "";
        });
      }
      parts.push(obj);
      selectedIndex = parts.length - 1;
    }
  }

  applyFilters();
});

// Reset form button: clear form and selection
resetFormBtn.addEventListener("click", () => {
  form.reset();
  selectedIndex = null;
  clearSelectionHighlight();
});

// Delete button: remove selected part
deleteBtn.addEventListener("click", () => {
  if (selectedIndex === null || !parts[selectedIndex]) return;
  const ok = window.confirm("Delete the selected part from the list?");
  if (!ok) return;

  parts.splice(selectedIndex, 1);
  selectedIndex = null;
  form.reset();
  applyFilters();
});

// Notes modal close button
notesCloseBtn.addEventListener("click", closeNotesModal);

// Notes modal backdrop click: close modal
modalBackdrop.addEventListener("click", closeNotesModal);

// Notes modal save button: save notes back to part
notesSaveBtn.addEventListener("click", () => {
  if (notesIndex === null || !parts[notesIndex]) return;
  const notes = notesTextarea.value.trim() || "dummy_Notes";
  parts[notesIndex].Notes = notes;
  applyFilters(); // re-render table with updated Notes
  closeNotesModal();
});

// Download CSV button
downloadCsvBtn.addEventListener("click", downloadCsvSnapshot);

// Download PDF button
downloadPdfBtn.addEventListener("click", downloadPdfTable);

/* ========================================
   INITIALIZATION: load CSV on page load
   ======================================== */
loadData();