/* ========================================
   CSV PARSER
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
let parts = [];
let filteredParts = [];
let selectedIndex = null;
let notesIndex = null;

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

const notesModal = document.querySelector("#notes-modal");
const modalBackdrop = document.querySelector("#modal-backdrop");
const notesCloseBtn = document.querySelector("#notes-close");
const notesSaveBtn = document.querySelector("#notes-save");
const notesTextarea = document.querySelector("#notes-textarea");
const notesTitle = document.querySelector("#notes-title");

/* ========================================
   LOAD DATA
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
function formatPrice(p) {
  if (!p.PricePaid) return "";
  const cur = p.Currency || "USD";
  const num = parseFloat(p.PricePaid);
  return isNaN(num) ? `${cur} ${p.PricePaid}` : `${cur} ${num.toFixed(2)}`;
}

/* ========================================
   RENDER TABLE
   Columns: Category | Part | Price | Vendor | Order # | Warranty Owner | Start Date | End Date
   ======================================== */
function renderTable() {
  if (!filteredParts.length) {
    tableBody.innerHTML =
      '<tr><td colspan="8">No parts found.</td></tr>';
    updateTotals();
    return;
  }

  tableBody.innerHTML = filteredParts.map((p) => {
    const masterIndex = parts.indexOf(p);
    const isSelected = masterIndex === selectedIndex;

    const partDisplay = [p.PartName, p.Model].filter(Boolean).join(" — ");
    const vendor = p.VendorWebsite
      ? `<a href="${p.VendorWebsite}" target="_blank">${p.VendorName || "Vendor"}</a>`
      : (p.VendorName || "");

    return `
      <tr data-index="${masterIndex}" class="${isSelected ? "selected-row" : ""}">
        <td class="category-cell" data-notes-index="${masterIndex}">${p.Category || ""}</td>
        <td>${partDisplay}</td>
        <td>${formatPrice(p)}</td>
        <td>${vendor}</td>
        <td>${p.OrderID || ""}</td>
        <td>${p.WarrantyProvider || ""}</td>
        <td>${p.WarrantyStartDate || ""}</td>
        <td>${p.WarrantyEndDate || ""}</td>
      </tr>
    `;
  }).join("");

  updateTotals();
}

/* ========================================
   TOTALS BAR
   ======================================== */
function updateTotals() {
  if (!totalsBar) return;
  const source = filteredParts.length ? filteredParts : parts;
  const total = source.reduce((sum, p) => {
    const v = parseFloat(p.PricePaid);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
  totalsBar.textContent = source.length
    ? `Total price of listed parts: USD ${total.toFixed(2)}`
    : "No parts to total.";
}

/* ========================================
   FILTER LOGIC
   ======================================== */
function applyFilters() {
  const q = (searchInput.value || "").toLowerCase();
  const cat = categoryFilter.value;

  filteredParts = parts.filter((p) => {
    if (cat && p.Category !== cat) return false;
    if (!q) return true;
    return [p.PartName, p.Model, p.VendorName, p.WarrantyProvider, p.Notes]
      .join(" ").toLowerCase().includes(q);
  });

  renderTable();
}

/* ========================================
   FORM HELPERS
   ======================================== */
function formToObject(formEl) {
  const data = new FormData(formEl);
  const obj = {};
  for (const [key, val] of data.entries()) {
    obj[key] = val.trim() || `dummy_${key}`;
  }
  return obj;
}

function populateFormFromPart(part) {
  const fields = [
    "Category","PartName","Model","VendorName","VendorWebsite",
    "VendorUsername","VendorPasswordHint",
    "PurchaseDate","PricePaid","Currency","OrderID","SerialNumber",
    "WarrantyProvider","WarrantyType","WarrantyRegistrationURL",
    "WarrantyLengthMonths","WarrantyStartDate","WarrantyEndDate",
    "WarrantySupportEmail","WarrantySupportPhone",
    "ExtendedWarrantyProvider","ExtendedWarrantyLengthMonths",
    "ExtendedWarrantyDetails","ExtendedWarrantySupportEmail",
    "ExtendedWarrantySupportPhone","Notes"
  ];
  fields.forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.value = part[name] || "";
  });
}

function clearSelectionHighlight() {
  tableBody.querySelectorAll("tr").forEach((r) => r.classList.remove("selected-row"));
}

/* ========================================
   NOTES MODAL
   ======================================== */
function openNotesModal(index) {
  notesIndex = index;
  const part = parts[index];
  if (!part) return;
  notesTitle.textContent = [part.PartName, part.Model].filter(Boolean).join(" — ") || "Part Notes";
  notesTextarea.value = part.Notes || "";
  modalBackdrop.classList.remove("hidden");
  notesModal.classList.remove("hidden");
}

function closeNotesModal() {
  notesIndex = null;
  modalBackdrop.classList.add("hidden");
  notesModal.classList.add("hidden");
}

/* ========================================
   DOWNLOAD HELPERS
   ======================================== */
function downloadCsvSnapshot() {
  const source = filteredParts.length ? filteredParts : parts;
  if (!source.length) return;
  const headers = ["Category","PartName","Price","VendorName","OrderID","WarrantyProvider","WarrantyStartDate","WarrantyEndDate"];
  const rows = [
    headers.join(","),
    ...source.map((p) => [
      p.Category, p.PartName, formatPrice(p), p.VendorName,
      p.OrderID, p.WarrantyProvider, p.WarrantyStartDate, p.WarrantyEndDate
    ].map((v) => (v || "").replace(/,/g, " ")).join(","))
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pc_parts_table.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadPdfTable() {
  const source = filteredParts.length ? filteredParts : parts;
  if (!source.length || !window.jspdf?.jsPDF) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "pt", "a4");
  doc.text("PC Build Matrix – Parts Summary", 40, 40);
  doc.autoTable({
    startY: 60,
    head: [["Category","Part","Price","Vendor","Order #","Warranty Owner","Start Date","End Date"]],
    body: source.map((p) => [
      p.Category, [p.PartName, p.Model].filter(Boolean).join(" — "),
      formatPrice(p), p.VendorName, p.OrderID,
      p.WarrantyProvider, p.WarrantyStartDate, p.WarrantyEndDate
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 200, 150] },
  });
  doc.save("pc_parts_table.pdf");
}

/* ========================================
   EVENT LISTENERS
   ======================================== */

// Row click: select row or open notes modal on Category cell
tableBody.addEventListener("click", (e) => {
  const categoryCell = e.target.closest(".category-cell");
  if (categoryCell && categoryCell.dataset.notesIndex !== undefined) {
    const idx = parseInt(categoryCell.dataset.notesIndex, 10);
    if (!isNaN(idx) && parts[idx]) openNotesModal(idx);
    e.stopPropagation();
    return;
  }
  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.index) return;
  const idx = parseInt(tr.dataset.index, 10);
  if (isNaN(idx) || !parts[idx]) return;
  selectedIndex = idx;
  clearSelectionHighlight();
  tr.classList.add("selected-row");
  populateFormFromPart(parts[idx]);
});

searchInput.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

// Save / update part
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const obj = formToObject(form);
  if (selectedIndex !== null && parts[selectedIndex]) {
    parts[selectedIndex] = { ...parts[selectedIndex], ...obj };
  } else {
    const idx = parts.findIndex(
      (p) => p.Category === obj.Category && p.PartName === obj.PartName && p.Model === obj.Model
    );
    if (idx >= 0) {
      parts[idx] = { ...parts[idx], ...obj };
      selectedIndex = idx;
    } else {
      if (parts.length) {
        Object.keys(parts[0]).forEach((h) => { if (!(h in obj)) obj[h] = ""; });
      }
      parts.push(obj);
      selectedIndex = parts.length - 1;
    }
  }
  applyFilters();
});

resetFormBtn.addEventListener("click", () => {
  form.reset();
  selectedIndex = null;
  clearSelectionHighlight();
});

deleteBtn.addEventListener("click", () => {
  if (selectedIndex === null || !parts[selectedIndex]) return;
  if (!window.confirm("Delete the selected part?")) return;
  parts.splice(selectedIndex, 1);
  selectedIndex = null;
  form.reset();
  applyFilters();
});

notesCloseBtn.addEventListener("click", closeNotesModal);
modalBackdrop.addEventListener("click", closeNotesModal);

notesSaveBtn.addEventListener("click", () => {
  if (notesIndex === null || !parts[notesIndex]) return;
  parts[notesIndex].Notes = notesTextarea.value.trim() || "dummy_Notes";
  applyFilters();
  closeNotesModal();
});

downloadCsvBtn.addEventListener("click", downloadCsvSnapshot);
downloadPdfBtn.addEventListener("click", downloadPdfTable);

/* ========================================
   INIT
   ======================================== */
loadData();