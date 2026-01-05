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

const tableBody = document.querySelector("#parts-table tbody");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const form = document.querySelector("#part-form");
const resetFormBtn = document.querySelector("#reset-form");
const downloadCsvBtn = document.querySelector("#download-csv");

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
  }
}

function formatPrice(p) {
  if (!p.PricePaid) return "";
  const cur = p.Currency || "USD";
  return `${cur} ${parseFloat(p.PricePaid).toFixed(2)}`;
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
      '<tr><td colspan="8">No parts found. Add entries via the form or in the CSV.</td></tr>';
    return;
  }

  tableBody.innerHTML = filteredParts
    .map((p, i) => {
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
        <tr data-index="${i}">
          <td>${cat}</td>
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

// In-page add/update (does not persist back to CSV automatically)
function formToObject(formEl) {
  const data = new FormData(formEl);
  const obj = {};
  for (const [key, val] of data.entries()) {
    obj[key] = val.trim();
  }
  return obj;
}

function downloadCsvSnapshot() {
  if (!parts.length) return;
  const headers = Object.keys(parts[0]);
  const rows = [
    headers.join(","),
    ...parts.map((p) => headers.map((h) => (p[h] || "").replace(/,/g, " ")).join(",")),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pc_parts_snapshot.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Event listeners
searchInput.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const obj = formToObject(form);

  // If a part with same Category + PartName + Model exists, update it; else add new
  const idx = parts.findIndex(
    (p) =>
      p.Category === obj.Category &&
      p.PartName === obj.PartName &&
      p.Model === obj.Model
  );
  if (idx >= 0) {
    parts[idx] = { ...parts[idx], ...obj };
  } else {
    // Ensure all known headers exist so CSV export works cleanly
    if (parts.length) {
      const headers = Object.keys(parts[0]);
      headers.forEach((h) => {
        if (!(h in obj)) obj[h] = "";
      });
    }
    parts.push(obj);
  }
  applyFilters();
});

resetFormBtn.addEventListener("click", () => {
  form.reset();
});

downloadCsvBtn.addEventListener("click", downloadCsvSnapshot);

// Load CSV on startup
loadData();