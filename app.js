// Simple CSV parser for this specific structure
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

let parts = [];
let filteredParts = [];
let selectedIndex = null; // index into `parts` of the currently selected item

const tableBody = document.querySelector("#parts-table tbody");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const form = document.querySelector("#part-form");
const resetFormBtn = document.querySelector("#reset-form");
const deleteBtn = document.querySelector("#delete-part");
const downloadCsvBtn = document.querySelector("#download-csv");
const downloadPdfBtn = document.querySelector("#download-pdf");
const totalsBar = document.querySelector("#totals-bar");

// Modal elements
const detailsModal = document.querySelector("#details-modal");
const modalBackdrop = document.querySelector("#modal-backdrop");
const detailsCloseBtn = document.querySelector("#details-close");
const detailsSaveBtn = document.querySelector("#details-save");
const detailsNotesInput = document.querySelector("#details-notes");
const detailsTitle = document.querySelector("#details-title");

let detailsIndex = null; // which part the modal is editing

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
      '<tr><td colspan="9">Unable to load CSV. Ensure <code>data/pc_parts.csv</code> exists.</td></tr>';
    updateTotals();
  }
}

function formatPrice(p) {
  if (!p.PricePaid) return "";
  const cur = p.Currency || "USD";
  const num = Number.parseFloat(p.PricePaid);
  if (Number.isNaN(num)) return `${cur} ${p.PricePaid}`;
  return `${cur} ${num.toFixed(2)}`;
}

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

function contactBlock(email, phone) {
  const bits = [];
  if (email) bits.push(`<div>Email: <a href="mailto:${email}">${email}</a></div>`);
  if (phone) bits.push(`<div>Phone: ${phone}</div>`);
  return bits.join("") || "";
}

function renderTable() {
  if (!filteredParts.length) {
    tableBody.innerHTML =
      '<tr><td colspan="9">No parts found. Add entries via the form or in the CSV.</td></tr>';
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
          <td>${cat}</td>
          <td>${partDisplay}</td>
          <td>${vendorLink || ""}</td>
          <td>${formatPrice(p)}</td>
          <td>${summarizeWarranty(p)}</td>
          <td>${summarizeExtendedWarranty(p)}</td>
          <td>${vendorContact}</td>
          <td>${warrantyContact}</td>
          <td>
            <button type="button" class="details-btn" data-details-index="${masterIndex}">
              Details
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  updateTotals();
}

// Totals bar
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

// Filter logic
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

// Map form values to object (fill empties with dummy_<field>)
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

function clearSelectionHighlight() {
  tableBody.querySelectorAll("tr").forEach((row) => {
    row.classList.remove("selected-row");
  });
}

// Modal helpers
function openDetailsModal(index) {
  detailsIndex = index;
  const part = parts[index];
  if (!part) return;

  const title = [part.PartName || "", part.Model || ""]
    .filter(Boolean)
    .join(" — ");
  detailsTitle.textContent = title || "Part Details";

  detailsNotesInput.value = part.Notes || "";

  modalBackdrop.classList.remove("hidden");
  detailsModal.classList.remove("hidden");
}

function closeDetailsModal() {
  detailsIndex = null;
  modalBackdrop.classList.add("hidden");
  detailsModal.classList.add("hidden");
}

// Download current right-hand table as CSV (filtered if any filter is applied)
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

// Download right-hand table as PDF
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

// EVENT LISTENERS

// Click on table row or Details button
tableBody.addEventListener("click", (e) => {
  const detailsBtn = e.target.closest(".details-btn");
  if (detailsBtn && detailsBtn.dataset.detailsIndex !== undefined) {
    const idx = Number.parseInt(detailsBtn.dataset.detailsIndex, 10);
    if (!Number.isNaN(idx) && parts[idx]) {
      openDetailsModal(idx);
    }
    e.stopPropagation();
    return;
  }

  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.index) return;

  const idx = Number.parseInt(tr.dataset.index, 10);
  if (Number.isNaN(idx) || !parts[idx]) return;

  selectedIndex = idx;
  clearSelectionHighlight();
  tr.classList.add("selected-row");
  populateFormFromPart(parts[idx]);
});

searchInput.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

// Save (Add / Update)
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

// New / Clear
resetFormBtn.addEventListener("click", () => {
  form.reset();
  selectedIndex = null;
  clearSelectionHighlight();
});

// Delete Selected
deleteBtn.addEventListener("click", () => {
  if (selectedIndex === null || !parts[selectedIndex]) return;
  const ok = window.confirm("Delete the selected part from the list?");
  if (!ok) return;

  parts.splice(selectedIndex, 1);
  selectedIndex = null;
  form.reset();
  applyFilters();
});

// Modal
detailsCloseBtn.addEventListener("click", closeDetailsModal);
modalBackdrop.addEventListener("click", closeDetailsModal);

detailsSaveBtn.addEventListener("click", () => {
  if (detailsIndex === null || !parts[detailsIndex]) return;
  const notes = detailsNotesInput.value.trim() || "dummy_Notes";
  parts[detailsIndex].Notes = notes;
  applyFilters(); // re-render table with updated Notes
  closeDetailsModal();
});

// Downloads
downloadCsvBtn.addEventListener("click", downloadCsvSnapshot);
downloadPdfBtn.addEventListener("click", downloadPdfTable);

// Load CSV on startup
loadData();