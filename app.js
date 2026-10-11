
"use strict";

const state = {
  books: [],
  filtered: []
};

const $ = id => document.getElementById(id);

/* =====================================================
   RASTREAMENTO LOCAL — NÃO APARECE NA INTERFACE
   Os eventos ficam apenas no navegador atual.
   ===================================================== */

const TRACKING_KEY = "keola_book_tracking_v2";
const MAX_EVENTS = 5000;

function readTracking() {
  try {
    const stored = JSON.parse(localStorage.getItem(TRACKING_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.warn("Não foi possível ler o histórico local.", error);
    return [];
  }
}

function trackEvent(type, details = {}) {
  try {
    const events = readTracking();

    events.push({
      type,
      details,
      timestamp: new Date().toISOString()
    });

    localStorage.setItem(
      TRACKING_KEY,
      JSON.stringify(events.slice(-MAX_EVENTS))
    );
  } catch (error) {
    // A falha no rastreamento não deve impedir a busca de livros.
    console.warn("Não foi possível registrar este evento.", error);
  }
}

/*
 * Exportação local para manutenção.
 * Para usar: abra o site, abra o console do navegador e execute:
 * keolaExportLocalStats()
 *
 * Isso exporta apenas o histórico deste navegador.
 */
window.keolaExportLocalStats = function () {
  const events = readTracking();

  const blob = new Blob(
    [JSON.stringify(events, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "keola-historico-local.json";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};

/* =====================================================
   UTILITÁRIOS E BUSCA
   ===================================================== */

function text(value) {
  return value == null ? "" : String(value);
}

function norm(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function esc(value) {
  return text(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

const FIELDS = [
  "Título",
  "Autor",
  "Editora",
  "Categoria original",
  "Grupo",
  "Tema original",
  "Tema principal",
  "Subtemas",
  "Palavras-chave",
  "Necessidades relacionadas",
  "Perfil de leitor",
  "Tipo de livro",
  "Sinopse de consulta",
  "Como apresentar ao cliente (base)",
  "Situações de indicação"
];

function score(book, query) {
  if (!query) return 0;

  const terms = norm(query).split(/\s+/).filter(Boolean);
  let total = 0;

  for (const term of terms) {
    const title = norm(book["Título"]);
    const author = norm(book["Autor"]);

    if (title === term) {
      total += 120;
    } else if (title.includes(term)) {
      total += 70;
    }

    if (author.includes(term)) {
      total += 45;
    }

    for (const field of FIELDS.slice(3)) {
      const value = norm(book[field]);

      if (value.includes(term)) {
        total += field === "Tema principal" ? 28
          : field === "Necessidades relacionadas" ? 22
          : field === "Palavras-chave" ? 18
          : 8;
      }
    }
  }

  return total;
}

/* =====================================================
   FILTROS
   ===================================================== */

function unique(field) {
  return [
    ...new Set(
      state.books
        .map(book => text(book[field]))
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
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

function currentFilters() {
  return {
    categoria: $("categoria").value,
    tema: $("tema").value,
    autor: $("autor").value,
    editora: $("editora").value
  };
}

function filterBooks() {
  const query = norm($("search").value.trim());
  const filters = currentFilters();

  state.filtered = state.books
    .filter(book =>
      (!filters.categoria ||
        text(book["Categoria original"]) === filters.categoria) &&
      (!filters.tema ||
        text(book["Tema principal"]) === filters.tema) &&
      (!filters.autor ||
        text(book["Autor"]) === filters.autor) &&
      (!filters.editora ||
        text(book["Editora"]) === filters.editora)
    )
    .map(book => ({
      book,
      score: score(book, query)
    }))
    .filter(item => !query || item.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      text(a.book["Título"]).localeCompare(
        text(b.book["Título"]),
        "pt-BR"
      )
    )
    .map(item => item.book);

  render();
}

/* =====================================================
   EXIBIÇÃO DOS LIVROS
   ===================================================== */

function render() {
  const books = state.filtered;

  $("count").textContent =
    `${books.length} livro${books.length === 1 ? "" : "s"} encontrado${books.length === 1 ? "" : "s"}`;

  if (!books.length) {
    $("results").innerHTML = `
      <div class="empty">
        <strong>Nenhum livro encontrado.</strong><br><br>
        Tente outra palavra ou limpe os filtros.
      </div>
    `;
    return;
  }

  $("results").innerHTML = books.map((book, index) => {
    const description =
      text(book["Sinopse de consulta"]) ||
      text(book["Como apresentar ao cliente (base)"]) ||
      "Consulte os detalhes deste livro.";

    return `
      <article class="card">
        <div class="tag">
          ${esc(book["Tema principal"] || book["Categoria original"] || "Livro")}
        </div>

        <h3>${esc(book["Título"] || "Sem título")}</h3>

        <div class="author">
          ${esc(book["Autor"] || "Autor não informado")}
        </div>

        <div class="desc">
          ${esc(description).slice(0, 280)}${description.length > 280 ? "…" : ""}
        </div>

        <div class="card-actions">
          <button class="btn" data-book-index="${index}">
            Ver detalhes
          </button>
        </div>
      </article>
    `;
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

  // Registra o interesse pelo título sem exibir qualquer dado na página.
  trackEvent("book_opened", {
    title: text(book["Título"]),
    author: text(book["Autor"]),
    publisher: text(book["Editora"]),
    theme: text(book["Tema principal"])
  });

  const tags = [
    book["Tema principal"],
    book["Subtemas"],
    book["Tipo de livro"],
    book["Perfil de leitor"]
  ].filter(Boolean);

  $("modalContent").innerHTML = `
    <div class="tag">
      ${esc(book["Tema principal"] || "Keola Books")}
    </div>

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

/* =====================================================
   AÇÕES DE PESQUISA
   ===================================================== */

function registerSearch(origin) {
  const query = $("search").value.trim();
  const filters = currentFilters();

  // Não registra consultas completamente vazias.
  if (!query && !Object.values(filters).some(Boolean)) {
    return;
  }

  trackEvent("search", {
    query,
    filters,
    origin,
    resultCount: state.filtered.length
  });
}

function quickSearch(query) {
  $("search").value = query;
  filterBooks();

  registerSearch("atalho");
}

function clearFilters() {
  $("search").value = "";

  ["categoria", "tema", "autor", "editora"].forEach(id => {
    $(id).value = "";
  });

  filterBooks();
}

function handleSearch() {
  filterBooks();
  registerSearch("botao_buscar");
}

/* =====================================================
   CARREGAMENTO DO CATÁLOGO
   ===================================================== */

async function loadCatalog() {
  try {
    const response = await fetch("./catalogo.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Não foi possível carregar catalogo.json");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("O catálogo precisa conter uma lista de livros.");
    }

    state.books = data;

    setupFilters();
    filterBooks();
  } catch (error) {
    console.error(error);

    $("count").textContent = "Erro ao carregar o catálogo";

    $("results").innerHTML = `
      <div class="empty">
        Não foi possível carregar o catálogo.<br><br>
        Confirme se <strong>catalogo.json</strong> está na mesma pasta
        do index.html e contém um JSON válido.
      </div>
    `;
  }
}

/* =====================================================
   EVENTOS DA INTERFACE
   ===================================================== */

$("searchBtn").addEventListener("click", handleSearch);

$("search").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    handleSearch();
  }
});

document.querySelectorAll("[data-q]").forEach(button => {
  button.addEventListener("click", () => {
    quickSearch(button.dataset.q);
  });
});

["categoria", "tema", "autor", "editora"].forEach(id => {
  $(id).addEventListener("change", () => {
    filterBooks();
    registerSearch("filtro");
  });
});

$("clearBtn").addEventListener("click", clearFilters);

$("closeModal").addEventListener("click", () => {
  $("modal").close();
});

$("modal").addEventListener("click", event => {
  if (event.target === $("modal")) {
    $("modal").close();
  }
});

// Inicia o site.
loadCatalog();
