/**
 * Matrix PC Build Tracker - Core Logic
 * Handles CSV parsing, Table rendering, Form management, and Exports.
 */

let pcParts = [];
let selectedRowIndex = null;

// DOM Elements
const partForm = document.getElementById('part-form');
const partsTable = document.getElementById('parts-table');
const tableBody = partsTable.querySelector('tbody');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const totalsBar = document.getElementById('totals-bar');

// Modal Elements
const notesModal = document.getElementById('notes-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const notesClose = document.getElementById('notes-close');
const notesSave = document.getElementById('notes-save');
const notesTextarea = document.getElementById('notes-textarea');
const notesTitle = document.getElementById('notes-title');
let currentNotesIndex = null;

/**
 * INITIALIZATION
 * Fetch CSV with cache-buster to ensure GitHub updates show immediately.
 */
document.addEventListener('DOMContentLoaded', () => {
  const cacheBuster = new Date().getTime();
  fetch(`pc_parts.csv?v=${cacheBuster}`)
    .then(response => response.text())
    .then(csvText => {
      pcParts = parseCSV(csvText);
      renderTable();
    })
    .catch(err => console.error("Error loading CSV:", err));
});

/**
 * CSV PARSER
 * Converts raw CSV text into an array of objects.
 */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || "";
    });
    return obj;
  });
}

/**
 * Helper to handle commas inside quotes in CSV
 */
function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * TABLE RENDERING
 * Filters data and builds the HTML table rows.
 */
function renderTable() {
  const searchTerm = searchInput.value.toLowerCase();
  const filterCat = categoryFilter.value;

  const filtered = pcParts.filter(p => {
    const matchesSearch = Object.values(p).some(val => String(val).toLowerCase().includes(searchTerm));
    const matchesCat = !filterCat || p.Category === filterCat;
    return matchesSearch && matchesCat;
  });

  tableBody.innerHTML = "";
  filtered.forEach((part, index) => {
    const tr = document.createElement('tr');
    if (selectedRowIndex === index) tr.classList.add('selected-row');
    
    // Map CSV headers to Table Columns
    // Columns: Category, Part, Price, Vendor, Order #, Warranty Owner, Start Date, End Date
    tr.innerHTML = `
      <td class="category-cell" data-index="${index}">${part.Category || '---'}</td>
      <td>${part.PartName || '---'}</td>
      <td>${part.PricePaid ? part.Currency + ' ' + part.PricePaid : '---'}</td>
      <td>${part.VendorName || '---'}</td>
      <td>${part.OrderID || '---'}</td>
      <td>${part.WarrantyProvider || '---'}</td>
      <td>${part.WarrantyStartDate || '---'}</td>
      <td>${part.WarrantyEndDate || '---'}</td>
    `;

    // Click Category -> Open Notes
    tr.querySelector('.category-cell').addEventListener('click', (e) => {
      e.stopPropagation();
      openNotes(index);
    });

    // Click Row -> Populate Form
    tr.addEventListener('click', () => selectRow(index));
    
    tableBody.appendChild(tr);
  });

  // Add 4 empty rows for visual consistency
  for (let i = 0; i < 4; i++) {
    const emptyTr = document.createElement('tr');
    emptyTr.innerHTML = `<td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>`;
    tableBody.appendChild(emptyTr);
  }

  updateTotals(filtered);
}

/**
 * TOTALS CALCULATION
 */
function updateTotals(data) {
  const total = data.reduce((sum, p) => sum + (parseFloat(p.PricePaid) || 0), 0);
  totalsBar.innerHTML = `
    <span>Items: ${data.length}</span>
    <span>Total Investment: $${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
  `;
}

/**
 * FORM MANAGEMENT
 */
function selectRow(index) {
  selectedRowIndex = index;
  const part = pcParts[index];
  
  // Auto-fill form fields based on ID matching CSV Header
  Object.keys(part).forEach(key => {
    const input = document.getElementById(key);
    if (input) input.value = part[key];
  });
  
  renderTable();
}

partForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(partForm);
  const newPart = {};
  
  // Use headers from first part to ensure consistency
  const headers = Object.keys(pcParts[0] || {});
  headers.forEach(h => {
    newPart[h] = formData.get(h) || `dummy_${h}`;
  });

  if (selectedRowIndex !== null) {
    pcParts[selectedRowIndex] = newPart;
  } else {
    pcParts.push(newPart);
  }
  
  renderTable();
  partForm.reset();
  selectedRowIndex = null;
});

document.getElementById('reset-form').addEventListener('click', () => {
  partForm.reset();
  selectedRowIndex = null;
  renderTable();
});

document.getElementById('delete-part').addEventListener('click', () => {
  if (selectedRowIndex !== null) {
    pcParts.splice(selectedRowIndex, 1);
    selectedRowIndex = null;
    partForm.reset();
    renderTable();
  }
});

/**
 * SEARCH & FILTER
 */
searchInput.addEventListener('input', renderTable);
categoryFilter.addEventListener('change', renderTable);

/**
 * NOTES MODAL LOGIC
 */
function openNotes(index) {
  currentNotesIndex = index;
  const part = pcParts[index];
  notesTitle.innerText = `${part.Category}: ${part.PartName}`;
  notesTextarea.value = part.Notes || "";
  notesModal.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
}

function closeNotes() {
  notesModal.classList.add('hidden');
  modalBackdrop.classList.add('hidden');
}

notesClose.addEventListener('click', closeNotes);
modalBackdrop.addEventListener('click', closeNotes);

notesSave.addEventListener('click', () => {
  if (currentNotesIndex !== null) {
    pcParts[currentNotesIndex].Notes = notesTextarea.value || "dummy_Notes";
    renderTable();
    closeNotes();
  }
});

/**
 * EXPORT LOGIC
 */
document.getElementById('download-csv').addEventListener('click', () => {
  const headers = Object.keys(pcParts[0]);
  const rows = pcParts.map(p => headers.map(h => `"${p[h]}"`).join(','));
  const csvContent = [headers.join(','), ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pc_build_snapshot_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
});

document.getElementById('download-pdf').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt');
  
  const tableData = pcParts.map(p => [
    p.Category, p.PartName, p.PricePaid, p.VendorName, p.OrderID, p.WarrantyProvider, p.WarrantyStartDate, p.WarrantyEndDate
  ]);

  doc.autoTable({
    head: [['Category', 'Part', 'Price', 'Vendor', 'Order #', 'Warranty', 'Start', 'End']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 }
  });
  
  doc.save('pc_build_report.pdf');
});

/**
 * COPY FIELD LOGIC
 */
document.querySelectorAll('.copy-field-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const fieldId = btn.getAttribute('data-field');
    const input = document.getElementById(fieldId);
    if (input) {
      navigator.clipboard.writeText(input.value).then(() => showToast());
    }
  });
});

document.getElementById('copy-all-form').addEventListener('click', () => {
  const data = pcParts[selectedRowIndex] || {};
  const text = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
  navigator.clipboard.writeText(text).then(() => showToast());
});

function showToast() {
  const toast = document.getElementById('copy-toast');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}