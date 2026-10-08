/* Keola Books — app.js */

(() => {
  "use strict";

  const state = {
    books: [],
    filtered: []
  };

  const $ = (id) => document.getElementById(id);

  function text(value) {
    return value == null ? "" : String(value);
  }

  function normalize(value) {
    return text(value)
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  /* Campos que serão pesquisados */
  const SEARCH_FIELDS = [
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

  function searchableText(book) {
    return SEARCH_FIELDS
      .map((field) => text(book[field]))
      .join(" ");
  }

  /* Sistema de relevância da busca */
  function scoreBook(book, query) {
    if (!query) return 1;

    const terms = normalize(query)
      .split(/\s+/)
      .filter(Boolean);

    const title = normalize(book["Título"]);
    const author = normalize(book["Autor"]);
    const all = normalize(searchableText(book));

    /* Todas as palavras digitadas precisam existir no livro */
    if (!terms.every((term) => all.includes(term))) {
      return 0;
    }

    let score = 1;

    for (const term of terms) {

      if (title === term) {
        score += 150;
      } else if (title.includes(term)) {
        score += 100;
      }

      if (author.includes(term)) {
        score += 60;
      }

      if (
        normalize(book["Tema principal"])
          .includes(term)
      ) {
        score += 40;
      }

      if (
        normalize(book["Necessidades relacionadas"])
          .includes(term)
      ) {
        score += 35;
      }

      if (
        normalize(book["Palavras-chave"])
          .includes(term)
      ) {
        score += 30;
      }

      if (
        normalize(book["Subtemas"])
          .includes(term)
      ) {
        score += 25;
      }
    }

    return score;
  }

  /* Valores únicos dos filtros */
  function uniqueValues(field) {
    return [
      ...new Set(
        state.books
          .map((book) => text(book[field]).trim())
          .filter(Boolean)
      )
    ].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }

  /* Preenche os filtros */
  function populateSelect(id, field) {
    const select = $(id);

    if (!select) return;

    while (select.options.length > 1) {
      select.remove(1);
    }

    for (const value of uniqueValues(field)) {

      const option = document.createElement("option");

      option.value = value;
      option.textContent = value;

      select.appendChild(option);
    }
  }

  function setupFilters() {

    populateSelect(
      "categoria",
      "Categoria original"
    );

    populateSelect(
      "tema",
      "Tema principal"
    );

    populateSelect(
      "autor",
      "Autor"
    );

    populateSelect(
      "editora",
      "Editora"
    );
  }

  /* Pega os filtros atuais */
  function getFilters() {

    return {

      query: normalize(
        $("search")?.value || ""
      ),

      categoria:
        $("categoria")?.value || "",

      tema:
        $("tema")?.value || "",

      autor:
        $("autor")?.value || "",

      editora:
        $("editora")?.value || ""
    };
  }

  /* Faz a busca */
  function filterBooks() {

    const filters = getFilters();

    const results = state.books

      .filter((book) => {

        if (
          filters.categoria &&
          text(book["Categoria original"]) !==
          filters.categoria
        ) {
          return false;
        }

        if (
          filters.tema &&
          text(book["Tema principal"]) !==
          filters.tema
        ) {
          return false;
        }

        if (
          filters.autor &&
          text(book["Autor"]) !==
          filters.autor
        ) {
          return false;
        }

        if (
          filters.editora &&
          text(book["Editora"]) !==
          filters.editora
        ) {
          return false;
        }

        return true;
      })

      .map((book) => ({

        book,

        score: scoreBook(
          book,
          filters.query
        )

      }))

      .filter(
        (item) => item.score > 0
      )

      .sort((a, b) => {

        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return text(
          a.book["Título"]
        ).localeCompare(
          text(b.book["Título"]),
          "pt-BR"
        );
      })

      .map(
        (item) => item.book
      );

    state.filtered = results;

    render();
  }

  /* Mostra os livros */
  function render() {

    const count = $("count");
    const results = $("results");

    if (!count || !results) return;

    const total =
      state.filtered.length;

    count.textContent =
      `${total} livro${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`;

    if (!total) {

      results.innerHTML = `

        <div class="empty">

          <strong>
            Nenhum livro encontrado.
          </strong>

          <br><br>

          Tente outra palavra
          ou limpe os filtros.

        </div>

      `;

      return;
    }

    results.innerHTML =
      state.filtered
        .map((book, index) => {

          const description =
            text(
              book["Sinopse de consulta"]
            ) ||

            text(
              book[
                "Como apresentar ao cliente (base)"
              ]
            ) ||

            "Consulte os detalhes deste livro.";

          const shortDescription =
            description.length > 280
              ? description.slice(0, 280) + "…"
              : description;

          return `

            <article
              class="card"
              data-book-index="${index}"
            >

              <div class="tag">

                ${escapeHtml(
                  book["Tema principal"] ||
                  book["Categoria original"] ||
                  "Livro"
                )}

              </div>

              <h3>

                ${escapeHtml(
                  book["Título"] ||
                  "Sem título"
                )}

              </h3>

              <div class="author">

                ${escapeHtml(
                  book["Autor"] ||
                  "Autor não informado"
                )}

                ${
                  book["Editora"]
                    ? " · " +
                      escapeHtml(
                        book["Editora"]
                      )
                    : ""
                }

              </div>

              <div class="desc">

                ${escapeHtml(
                  shortDescription
                )}

              </div>

              <div class="card-actions">

                <button
                  type="button"
                  class="btn"
                  data-action="details"
                  data-book-index="${index}"
                >

                  Ver detalhes

                </button>

              </div>

            </article>

          `;
        })
        .join("");
  }

  /* Abre detalhes do livro */
  function openBook(index) {

    const book =
      state.filtered[index];

    if (!book) return;

    const tags = [

      book["Tema principal"],
      book["Subtemas"],
      book["Tipo de livro"],
      book["Perfil de leitor"]

    ].filter(Boolean);

    const modalContent =
      $("modalContent");

    if (!modalContent) return;

    modalContent.innerHTML = `

      <div class="tag">

        ${escapeHtml(
          book["Tema principal"] ||
          "Keola Books"
        )}

      </div>

      <h2>

        ${escapeHtml(
          book["Título"] ||
          "Sem título"
        )}

      </h2>

      <div class="author">

        ${escapeHtml(
          book["Autor"] ||
          "Autor não informado"
        )}

        ${
          book["Editora"]
            ? " · " +
              escapeHtml(
                book["Editora"]
              )
            : ""
        }

      </div>

      <div class="meta">

        ${tags
          .map(
            (tag) =>
              `<span>${escapeHtml(tag)}</span>`
          )
          .join("")}

      </div>

      <h4>
        Sinopse de consulta
      </h4>

      <p>

        ${escapeHtml(
          book["Sinopse de consulta"] ||
          "Não disponível."
        )}

      </p>

      <h4>
        Como apresentar ao cliente
      </h4>

      <p>

        ${escapeHtml(
          book[
            "Como apresentar ao cliente (base)"
          ] ||
          "Não disponível."
        )}

      </p>

      <h4>
        Quando indicar
      </h4>

      <p>

        ${escapeHtml(
          book[
            "Situações de indicação"
          ] ||
          "Não disponível."
        )}

      </p>

      <h4>
        Palavras-chave
      </h4>

      <p>

        ${escapeHtml(
          book["Palavras-chave"] ||
          "Não disponíveis."
        )}

      </p>

      <h4>
        Livros relacionados no catálogo
      </h4>

      <p>

        ${escapeHtml(
          book[
            "Livros relacionados por catálogo"
          ] ||
          "Não informado."
        )}

      </p>

    `;

    const modal = $("modal");

    if (!modal) return;

    if (
      typeof modal.showModal ===
      "function"
    ) {

      modal.showModal();

    } else {

      modal.setAttribute(
        "open",
        ""
      );

    }
  }

  /* Fecha a janela */
  function closeModal() {

    const modal = $("modal");

    if (!modal) return;

    if (
      typeof modal.close ===
      "function"
    ) {

      modal.close();

    } else {

      modal.removeAttribute(
        "open"
      );

    }
  }

  /* Limpa todos os filtros */
  function clearFilters() {

    const search =
      $("search");

    if (search) {
      search.value = "";
    }

    [
      "categoria",
      "tema",
      "autor",
      "editora"
    ].forEach((id) => {

      const element = $(id);

      if (element) {
        element.value = "";
      }

    });

    filterBooks();

    if (search) {
      search.focus();
    }
  }

  /* Botões rápidos */
  function quickSearch(query) {

    const search =
      $("search");

    if (!search) return;

    search.value = query;

    filterBooks();

    search.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  /* Carrega o JSON */
  async function loadCatalog() {

    const count =
      $("count");

    const results =
      $("results");

    try {

      const response =
        await fetch(
          "./catalogo.json?v=" +
          Date.now(),
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {

        throw new Error(
          "HTTP " +
          response.status +
          " ao carregar catalogo.json"
        );
      }

      const data =
        await response.json();

      if (!Array.isArray(data)) {

        throw new Error(
          "catalogo.json não contém uma lista de livros."
        );
      }

      state.books = data;

      setupFilters();

      filterBooks();

      console.log(
        "Keola Books:",
        state.books.length,
        "livros carregados."
      );

    } catch (error) {

      console.error(
        "Keola Books:",
        error
      );

      if (count) {

        count.textContent =
          "Erro ao carregar o catálogo";

      }

      if (results) {

        results.innerHTML = `

          <div class="empty">

            <strong>
              Não foi possível carregar o catálogo.
            </strong>

            <br><br>

            Verifique se
            <strong>catalogo.json</strong>
            está na mesma pasta de
            <strong>index.html</strong>.

          </div>

        `;
      }
    }
  }

  /* Eventos */
  function setupEvents() {

    const search =
      $("search");

    const searchBtn =
      $("searchBtn");

    const clearBtn =
      $("clearBtn");

    const closeBtn =
      $("closeModal");

    const modal =
      $("modal");

    /* Campo de busca */
    if (search) {

      search.addEventListener(
        "input",
        filterBooks
      );

      search.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key ===
            "Enter"
          ) {

            event.preventDefault();

            filterBooks();
          }
        }
      );
    }

    /* Botão Buscar */
    if (searchBtn) {

      searchBtn.addEventListener(
        "click",
        (event) => {

          event.preventDefault();

          filterBooks();
        }
      );
    }

    /* Botão Limpar */
    if (clearBtn) {

      clearBtn.addEventListener(
        "click",
        (event) => {

          event.preventDefault();

          clearFilters();
        }
      );
    }

    /* Filtros */
    [
      "categoria",
      "tema",
      "autor",
      "editora"
    ].forEach((id) => {

      const select = $(id);

      if (select) {

        select.addEventListener(
          "change",
          filterBooks
        );
      }

    });

    /* Fechar modal */
    if (closeBtn) {

      closeBtn.addEventListener(
        "click",
        (event) => {

          event.preventDefault();

          closeModal();
        }
      );
    }

    /*
      Um único evento para todos
      os botões da página.
    */
    document.addEventListener(
      "click",
      (event) => {

        const detailsButton =
          event.target.closest(
            "[data-action='details']"
          );

        if (detailsButton) {

          event.preventDefault();

          event.stopPropagation();

          openBook(
            Number(
              detailsButton.dataset.bookIndex
            )
          );

          return;
        }

        const quickButton =
          event.target.closest(
            "[data-q]"
          );

        if (quickButton) {

          event.preventDefault();

          quickSearch(
            quickButton.dataset.q ||
            ""
          );
        }

      }
    );

    /* Fechar modal clicando fora */
    if (modal) {

      modal.addEventListener(
        "click",
        (event) => {

          if (
            event.target ===
            modal
          ) {

            closeModal();

          }

        }
      );
    }
  }

  /* Inicialização */
  function start() {

    setupEvents();

    loadCatalog();
  }

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start
    );

  } else {

    start();

  }

})();