const STORAGE_KEY = "riegos_quote_v4";
const IVA_RATE = 0.16;

const initialQuote = {
  quoteDate: new Date().toISOString().slice(0, 10),
  clientName: "",
  clientAddress: "",
  quoteNumber: "",
  sectionName: "Instalaciones",
  includeIva: false,
  includeIsr: false,
  isrRate: 1.25,
  workDescription: "",
  items: [{ qty: "", concept: "", price: "", amount: "" }]
};

let quote = loadQuote();

const fields = {
  quoteDate: document.querySelector("#quoteDate"),
  clientName: document.querySelector("#clientName"),
  clientAddress: document.querySelector("#clientAddress"),
  quoteNumber: document.querySelector("#quoteNumber"),
  sectionName: document.querySelector("#sectionName"),
  includeIva: document.querySelector("#includeIva"),
  includeIsr: document.querySelector("#includeIsr"),
  isrRate: document.querySelector("#isrRate"),
  workDescription: document.querySelector("#workDescription")
};

const itemsBody = document.querySelector("#itemsBody");
const downloadPdfBtn = document.querySelector("#downloadPdfBtn");

function loadQuote() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored ? { ...initialQuote, ...stored } : structuredClone(initialQuote);
  } catch {
    return structuredClone(initialQuote);
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  });
}

function parseNumber(value) {
  const clean = String(value ?? "").replace(/[$,\s]/g, "");
  const number = Number(clean);
  return Number.isFinite(number) ? number : 0;
}

function dateInSpanish(value) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  const formatted = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
  return `Aguascalientes, México a ${formatted}`;
}

function getTotals() {
  const subtotal = quote.items.reduce((sum, item) => sum + parseNumber(item.amount), 0);
  const iva = quote.includeIva ? subtotal * IVA_RATE : 0;
  const isr = quote.includeIsr ? subtotal * (parseNumber(quote.isrRate) / 100) : 0;
  return { subtotal, iva, isr, total: subtotal + iva - isr };
}

function bindFields() {
  Object.entries(fields).forEach(([key, input]) => {
    if (input.type === "checkbox") input.checked = Boolean(quote[key]);
    else input.value = quote[key] ?? "";

    input.addEventListener("input", () => {
      quote[key] = input.type === "checkbox" ? input.checked : input.value;
      autoSaveQuote();
      render();
    });
  });
}

function renderItemsEditor() {
  itemsBody.innerHTML = "";

  quote.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "items-row";
    row.innerHTML = `
      <label><span>Cantidad</span><input aria-label="Cantidad" value="${escapeHtml(item.qty)}"></label>
      <label><span>Concepto</span><input aria-label="Concepto" value="${escapeHtml(item.concept)}"></label>
      <label><span>Precio</span><input aria-label="Precio" inputmode="decimal" value="${item.price ?? ""}"></label>
      <label><span>Importe</span><input aria-label="Importe" inputmode="decimal" value="${item.amount ?? ""}"></label>
      <button type="button" class="remove-row" title="Eliminar concepto">×</button>
    `;

    const [qtyInput, conceptInput, priceInput, amountInput] = row.querySelectorAll("input");
    qtyInput.addEventListener("input", () => updateItem(index, "qty", qtyInput.value));
    conceptInput.addEventListener("input", () => updateItem(index, "concept", conceptInput.value));
    priceInput.addEventListener("input", () => updateItem(index, "price", priceInput.value));
    amountInput.addEventListener("input", () => updateItem(index, "amount", amountInput.value));

    row.querySelector("button").addEventListener("click", () => {
      quote.items.splice(index, 1);
      if (!quote.items.length) quote.items.push({ qty: "", concept: "", price: "", amount: "" });
      autoSaveQuote();
      render();
    });

    itemsBody.appendChild(row);
  });
}

function updateItem(index, key, value) {
  quote.items[index][key] = value;
  autoSaveQuote();
  renderPreview();
}

function renderPreviewItems() {
  const body = document.querySelector("#previewItems");
  body.innerHTML = "";

  const visibleItems = quote.items.filter((item) => item.qty || item.concept || item.price || item.amount);
  const paddedItems = [...visibleItems];
  while (paddedItems.length < 10) paddedItems.push({ qty: "", concept: "", price: "", amount: "" });

  paddedItems.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(item.qty ?? "")}</td>
      <td>${escapeHtml(item.concept ?? "")}</td>
      <td>${item.price === "" || item.price == null ? "" : money(parseNumber(item.price))}</td>
      <td>${item.amount === "" || item.amount == null ? "" : money(parseNumber(item.amount))}</td>
    `;
    body.appendChild(row);
  });
}

function renderPreviewTotals() {
  const totals = getTotals();
  const rows = [["Subtotal", money(totals.subtotal), ""]];

  if (quote.includeIva) rows.push(["IVA", money(totals.iva), ""]);
  if (quote.includeIsr) rows.push(["ISR", `-${money(totals.isr)}`, ""]);
  rows.push(["Total", money(totals.total), "total-row"]);

  document.querySelector("#previewTotals").innerHTML = rows
    .map(([label, value, className]) => `<tr class="${className}"><td>${label}</td><td>${value}</td></tr>`)
    .join("");

  document.querySelector("#subtotalText").textContent = money(totals.subtotal);
  document.querySelector("#ivaText").textContent = money(totals.iva);
  document.querySelector("#isrText").textContent = money(totals.isr);
  document.querySelector("#totalText").textContent = money(totals.total);
}

function renderPreview() {
  document.querySelector("#previewDate").textContent = dateInSpanish(quote.quoteDate);
  document.querySelector("#previewClient").textContent = quote.clientName || "Cliente";
  document.querySelector("#previewAddress").textContent = quote.clientAddress || "Domicilio";
  document.querySelector("#previewNumber").textContent = quote.quoteNumber || "";
  document.querySelector("#previewSection").textContent = quote.sectionName || "Instalaciones";
  document.querySelector("#previewNotes").textContent = quote.workDescription || "";
  renderPreviewItems();
  renderPreviewTotals();
}

function render() {
  renderItemsEditor();
  renderPreview();
}

function autoSaveQuote() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quote));
}

function resetQuote() {
  quote = structuredClone(initialQuote);
  quote.quoteDate = new Date().toISOString().slice(0, 10);
  localStorage.removeItem(STORAGE_KEY);
  bindQuoteToInputs();
  render();
}

function buildFileName() {
  const number = quote.quoteNumber ? `-${quote.quoteNumber}` : "";
  const client = (quote.clientName || "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `cotizacion${number}-${client}.pdf`;
}

function downloadPdf() {
  autoSaveQuote();
  renderPreview();

  const element = document.querySelector("#printArea");
  if (!window.html2pdf) {
    window.print();
    return;
  }

  html2pdf()
    .set({
      margin: 0,
      filename: buildFileName(),
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
    })
    .from(element)
    .save();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindQuoteToInputs() {
  Object.entries(fields).forEach(([key, input]) => {
    if (input.type === "checkbox") input.checked = Boolean(quote[key]);
    else input.value = quote[key] ?? "";
  });
}

document.querySelector("#addItemBtn").addEventListener("click", () => {
  quote.items.push({ qty: "", concept: "", price: "", amount: "" });
  autoSaveQuote();
  render();
});

document.querySelector("#newQuoteBtn").addEventListener("click", resetQuote);

downloadPdfBtn.addEventListener("click", downloadPdf);

document.querySelector("#printBtn").addEventListener("click", () => {
  autoSaveQuote();
  renderPreview();
  window.print();
});

bindFields();
render();
