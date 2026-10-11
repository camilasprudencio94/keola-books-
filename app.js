
const state = { books: [], filtered: [] };

const $ = id => document.getElementById(id);

const VOLUNTEER_KEY = "keola_volunteer_v1";
const HISTORY_KEY = "keola_search_history_v1";
const MAX_HISTORY = 500;

function text(v) {
  return v == null ? "" : String(v);
}

function norm(v) {
  return text(v).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function esc(v) {
  return text(v).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

const FIELDS = [
  "Título", "Autor", "Editora", "Categoria original", "Grupo",
  "Tema original", "Tema principal", "Subtemas", "Palavras-chave",
  "Necessidades relacionadas", "Perfil de leitor", "Tipo de livro",
  "Sinopse de consulta", "Como apresentar ao cliente (base)",
  "Situações de indicação"
];

/* ---------------------------
   Identificação do voluntário
   --------------------------- */

function getVolunteer() {
  try {
    return localStorage.getItem(VOLUNTEER_KEY) || "";
  } catch (error) {
    return "";
  }
}

function setVolunteer(name) {
  const cleanName = text(name).trim().slice(0, 80);

  if (!cleanName) {
    alert("Informe um nome para identificar o uso do catálogo.");
    return false;
  }

  try {
    localStorage.setItem(VOLUNTEER_KEY, cleanName);
  } catch (error) {
    alert("Não foi possível guardar a identificação neste navegador.");
    return false;
  }

  updateVolunteerDisplay();
  return true;
}

function askVolunteer(force = false) {
  const current = getVolunteer();

  if (current && !force) {
    updateVolunteerDisplay();
    return;
  }

  const answer = prompt(
    "Digite seu nome para identificar suas pesquisas neste navegador:",
    current
  );

  if (answer === null) {
    if (!current) setVolunteer("Não identificado");
    updateVolunteerDisplay();
    return;
  }

  if (answer.trim()) {
    setVolunteer(answer);
  } else {
    alert("O nome não pode ficar vazio.");
    askVolunteer(true);
  }
}

function updateVolunteerDisplay() {
  $("volunteerName").textContent = getVolunteer() || "Não identificado";
}

/* ---------------------------
   Histórico local de pesquisas
   --------------------------- */

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(-MAX_HISTORY))
    );
    return true;
  } catch (error) {
    alert("Não foi possível guardar o histórico neste navegador.");
    return false;
  }
}

function registerSearch(origin) {
  const query = $("search").value.trim();
  const filters = {
    categoria: $("categoria").value,
    tema: $("tema").value,
    autor: $("autor").value,
    editora: $("editora").value
  };

  // Não registra uma ação totalmente vazia.
  if (!query && !Object.values(filters).some(Boolean)) return;

  const history = readHistory();

  history.push({
    volunteer: getVolunteer() || "Não identificado",
    query,
    filters,
    origin,
    results: state.filtered.length,
    timestamp: new Date().toISOString()
  });

  saveHistory(history);
  renderStats();
}

function renderStats() {
  const history = readHistory();

  $("statsSummary").textContent =
    `${history.length} pesquisa(s) registrada(s) neste navegador.`;

  const counts = {};

  history.forEach(item => {
    const term = text(item.query).trim();
    if (!term) return;
    const key = norm(term);
    if (!key) return;

    if (!counts[key]) {
      counts[key] = { term, count: 0 };
    }

    counts[key].count++;
  });

  const top = Object.values(counts)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, "pt-BR"))
    .slice(0, 10);

  if (!top.length) {
    $("topSearches").innerHTML =
      "<p>Nenhuma pesquisa por palavra foi registrada ainda.</p>";
    return;
  }

  $("topSearches").innerHTML = `
    <h4>Termos mais pesquisados</h4>
    <ol>
      ${top.map(item =>
        `<li>${esc(item.term)} — ${item.count} vez(es)</li>`
      ).join("")}
    </ol>
  `;
}

function exportHistory() {
  const history = readHistory();

  if (!history.length) {
    alert("Ainda não há pesquisas registradas para exportar.");
    return;
  }

  const rows = [
    ["Data e hora", "Voluntário informado", "Pesquisa", "Categoria",
      "Tema", "Autor", "Editora", "Origem", "Resultados"]
  ];

  history.forEach(item => {
    rows.push([
      item.timestamp || "",
      item.volunteer || "",
      item.query || "",
      item.filters?.categoria || "",
      item.filters?.tema || "",
      item.filters?.autor || "",
      item.filters?.editora || "",
      item.origin || "",
      item.results ?? ""
    ]);
  });

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value =>
      `"${text(value).replace(/"/g, '""')}"`
    ).join(";")
  ).join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "keola-historico-local.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearHistory() {
  const confirmed = confirm(
    "Deseja apagar o histórico de pesquisas deste navegador? Essa ação não pode ser desfeita."
  );

  if (!confirmed) return;

  try {
    localStorage.removeItem(HISTORY_KEY);
    renderStats();
    alert("Histórico local apagado.");
  } catch (error) {
    alert("Não foi possível apagar o histórico.");
  }
}

/* ---------------------------
   Busca e filtros do catálogo
   --------------------------- */

function score(book, query) {
  if (!query) return 0;

  const terms = norm(query).split(/\s+/).filter(Boolean);
  let total = 0;

  for (const term of terms) {
    const title = norm(book["Título"]);
    const author = norm(book["Autor"]);

    if (title === term) total += 120;
    else if (title.includes(term)) total += 70;

    if (author.includes(term)) total += 45;

    for (const field of FIELDS.slice(3)) {
      const value = norm(book[field]);

      if (value.includes(term)) {
        total += field === "Tema principal" ? 28 :
          field === "Necessidades relacionadas" ? 22 :
          field === "Palavras-chave" ? 18 : 8;
      }
    }
  }

  return total;
}

function unique(field) {
  return [...new Set(
    state.books.map(book => text(book[field])).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function fillSelect(id, field) {
  const select = $(id);

  unique(field).forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function setupFilters() {
  fillSelect("categoria", "Categoria original");
  fillSelect("tema", "Tema principal");
  fillSelect("autor", "Autor");
  fillSelect("editora", "Editora");
}

function filterBooks() {
  const query = norm($("search").value.trim());
  const category = $("categoria").value;
  const theme = $("tema").value;
  const author = $("autor").value;
  const publisher = $("editora").value;

  state.filtered = state.books
    .filter(book =>
      (!category || text(book["Categoria original"]) === category) &&
      (!theme || text(book["Tema principal"]) === theme) &&
      (!author || text(book["Autor"]) === author) &&
      (!publisher || text(book["Editora"]) === publisher)
    )
    .map(book => ({ book, score: score(book, query) }))
    .filter(item => !query || item.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      text(a.book["Título"]).localeCompare(
        text(b.book["Título"]), "pt-BR"
      )
    )
    .map(item => item.book);

  render();
}

function render() {
  const books = state.filtered;

  $("count").textContent =
    `${books.length} livro${books.length === 1 ? "" : "s"} encontrado${books.length === 1 ? "" : "s"}`;

  if (!books.length) {
    $("results").innerHTML =
      `<div class="empty"><strong>Nenhum livro encontrado.</strong><br><br>
       Tente outra palavra ou limpe os filtros.</div>`;
    return;
  }

  $("results").innerHTML = books.map((book, index) => {
    const description =
      text(book["Sinopse de consulta"]) ||
      text(book["Como apresentar ao cliente (base)"]) ||
      "Consulte os detalhes deste livro.";

    return `
      <article class="card">
        <div class="tag">${esc(book["Tema principal"] || book["Categoria original"] || "Livro")}</div>
        <h3>${esc(book["Título"] || "Sem título")}</h3>
        <div class="author">${esc(book["Autor"] || "Autor não informado")}</div>
        <div class="desc">${esc(description).slice(0, 280)}${description.length > 280 ? "…" : ""}</div>
        <div class="card-actions">
          <button class="btn" data-book-index="${index}">Ver detalhes</button>
        </div>
      </article>`;
  }).join("");

  document.querySelectorAll("[data-book-index]").forEach(button => {
    button.addEventListener("click", () => {
      openBook(Number(button.dataset.bookIndex));
    });
  });
}

function openBook(index) {
  const book = state.filtered[index];
  if (!book) return;

  const tags = [
    book["Tema principal"],
    book["Subtemas"],
    book["Tipo de livro"],
    book["Perfil de leitor"]
  ].filter(Boolean);

  $("modalContent").innerHTML = `
    <div class="tag">${esc(book["Tema principal"] || "Keola Books")}</div>
    <h2>${esc(book["Título"] || "Sem título")}</h2>
    <div class="author">
      ${esc(book["Autor"] || "Autor não informado")}
      ${book["Editora"] ? " · " + esc(book["Editora"]) : ""}
    </div>

    <div class="meta">
      ${tags.map(tag => `<span>${esc(tag)}</span>`).join("")}
    </div>

    <h4>Sinopse de consulta</h4>
    <p>${esc(book["Sinopse de consulta"] || "Não disponível.")}</p>

    <h4>Como apresentar ao cliente</h4>
    <p>${esc(book["Como apresentar ao cliente (base)"] || "Não disponível.")}</p>

    <h4>Quando indicar</h4>
    <p>${esc(book["Situações de indicação"] || "Não disponível.")}</p>

    <h4>Palavras-chave</h4>
    <p>${esc(book["Palavras-chave"] || "Não disponíveis.")}</p>

    <h4>Livros relacionados no catálogo</h4>
    <p>${esc(book["Livros relacionados por catálogo"] || "Não informado.")}</p>
  `;

  $("modal").showModal();
}

function clearFilters() {
  $("search").value = "";
  ["categoria", "tema", "autor", "editora"].forEach(id => {
    $(id).value = "";
  });
  filterBooks();
}

function quickSearch(query) {
  $("search").value = query;
  filterBooks();
  registerSearch("atalho");
}

/* ---------------------------
   Carregamento e eventos
   --------------------------- */

async function loadCatalog() {
  try {
    const response = await fetch("./catalogo.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Não foi possível carregar catalogo.json");
    }

    state.books = await response.json();

    if (!Array.isArray(state.books)) {
      throw new Error("O formato do catálogo não é uma lista de livros.");
    }

    setupFilters();
    filterBooks();
  } catch (error) {
    console.error(error);
    $("count").textContent = "Erro ao carregar o catálogo";
    $("results").innerHTML =
      `<div class="empty">
        Não foi possível carregar o catálogo.<br><br>
        Confirme se <strong>catalogo.json</strong> está na mesma pasta do index.html
        e se contém um JSON válido.
      </div>`;
  }
}

$("search").addEventListener("input", filterBooks);

$("search").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    filterBooks();
    registerSearch("teclado");
  }
});

$("searchBtn").addEventListener("click", () => {
  filterBooks();
  registerSearch("botao buscar");
});

["categoria", "tema", "autor", "editora"].forEach(id => {
  $(id).addEventListener("change", () => {
    filterBooks();
    registerSearch("filtro");
  });
});

$("clearBtn").addEventListener("click", clearFilters);
$("closeModal").addEventListener("click", () => $("modal").close());

document.querySelectorAll("[data-q]").forEach(button => {
  button.addEventListener("click", () => quickSearch(button.dataset.q));
});

$("modal").addEventListener("click", event => {
  if (event.target === $("modal")) $("modal").close();
});

$("changeVolunteer").addEventListener("click", () => askVolunteer(true));
$("exportStats").addEventListener("click", exportHistory);
$("clearStats").addEventListener("click", clearHistory);

askVolunteer();
renderStats();
loadCatalog();
