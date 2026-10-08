const state = {
  books: [],
  filtered: []
};


/* =====================================================
   ELEMENTOS
===================================================== */

const $ = id => document.getElementById(id);


/* =====================================================
   TEXTO
===================================================== */

function text(value) {
  return value == null ? "" : String(value);
}


/* =====================================================
   NORMALIZAÇÃO
   Remove acentos para melhorar a busca.
===================================================== */

function norm(value) {

  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

}


/* =====================================================
   SEGURANÇA HTML
===================================================== */

function esc(value) {

  return text(value).replace(
    /[&<>"']/g,
    match => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[match])
  );

}


/* =====================================================
   CAMPOS UTILIZADOS NA BUSCA
===================================================== */

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


/* =====================================================
   RANKING DE RELEVÂNCIA
===================================================== */

function score(book, query) {

  if (!query) {
    return 0;
  }

  const terms =
    norm(query)
      .split(/\s+/)
      .filter(Boolean);

  let total = 0;


  for (const term of terms) {

    const title =
      norm(book["Título"]);

    const author =
      norm(book["Autor"]);


    /* Título exato */

    if (title === term) {

      total += 120;

    }

    /* Título contém */

    else if (title.includes(term)) {

      total += 70;

    }


    /* Autor */

    if (author.includes(term)) {

      total += 45;

    }


    /* Outros campos */

    for (const field of FIELDS.slice(3)) {

      const value =
        norm(book[field]);


      if (value.includes(term)) {

        if (
          field === "Tema principal"
        ) {

          total += 28;

        }

        else if (
          field === "Necessidades relacionadas"
        ) {

          total += 22;

        }

        else if (
          field === "Palavras-chave"
        ) {

          total += 18;

        }

        else {

          total += 8;

        }

      }

    }

  }


  return total;

}


/* =====================================================
   VALORES ÚNICOS DOS FILTROS
===================================================== */

function unique(field) {

  return [
    ...new Set(
      state.books
        .map(book => text(book[field]))
        .filter(Boolean)
    )
  ]
  .sort(
    (a,b) =>
      a.localeCompare(
        b,
        "pt-BR"
      )
  );

}


/* =====================================================
   PREENCHER SELECT
===================================================== */

function fillSelect(id, field) {

  const select =
    $(id);


  unique(field)
    .forEach(value => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        value;

      option.textContent =
        value;


      select.appendChild(
        option
      );

    });

}


/* =====================================================
   CONFIGURAR FILTROS
===================================================== */

function setupFilters() {

  fillSelect(
    "categoria",
    "Categoria original"
  );

  fillSelect(
    "tema",
    "Tema principal"
  );

  fillSelect(
    "autor",
    "Autor"
  );

  fillSelect(
    "editora",
    "Editora"
  );

}


/* =====================================================
   FILTRAR LIVROS
===================================================== */

function filterBooks() {

  const query =
    norm(
      $("search").value.trim()
    );


  const categoria =
    $("categoria").value;


  const tema =
    $("tema").value;


  const autor =
    $("autor").value;


  const editora =
    $("editora").value;


  state.filtered =

    state.books

      .filter(book => {

        if (
          categoria &&
          text(
            book["Categoria original"]
          ) !== categoria
        ) {

          return false;

        }


        if (
          tema &&
          text(
            book["Tema principal"]
          ) !== tema
        ) {

          return false;

        }


        if (
          autor &&
          text(
            book["Autor"]
          ) !== autor
        ) {

          return false;

        }


        if (
          editora &&
          text(
            book["Editora"]
          ) !== editora
        ) {

          return false;

        }


        return true;

      })


      .map(book => ({

        book,

        score:
          score(
            book,
            query
          )

      }))


      .filter(item => {

        return (
          !query ||
          item.score > 0
        );

      })


      .sort((a,b) => {

        if (
          b.score !== a.score
        ) {

          return (
            b.score -
            a.score
          );

        }


        return text(
          a.book["Título"]
        ).localeCompare(
          text(
            b.book["Título"]
          ),
          "pt-BR"
        );

      })


      .map(
        item =>
          item.book
      );


  render();

}


/* =====================================================
   RENDERIZAR RESULTADOS
===================================================== */

function render() {

  const books =
    state.filtered;


  $("count").textContent =

    `${books.length} ` +

    `livro${

      books.length === 1
        ? ""
        : "s"

    } encontrado${

      books.length === 1
        ? ""
        : "s"

    }`;


  if (
    books.length === 0
  ) {

    $("results").innerHTML = `

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


  $("results").innerHTML =

    books.map(
      (book,index) => {

        const description =

          text(
            book[
              "Sinopse de consulta"
            ]
          ) ||

          text(
            book[
              "Como apresentar ao cliente (base)"
            ]
          ) ||

          "Consulte os detalhes deste livro.";


        return `

          <article class="card">

            <div class="tag">

              ${esc(
                book[
                  "Tema principal"
                ] ||

                book[
                  "Categoria original"
                ] ||

                "Livro"
              )}

            </div>


            <h3>

              ${esc(
                book["Título"] ||
                "Sem título"
              )}

            </h3>


            <div class="author">

              ${esc(
                book["Autor"] ||
                "Autor não informado"
              )}

            </div>


            <div class="desc">

              ${esc(
                description
              ).slice(0,280)}

              ${
                description.length > 280
                  ? "…"
                  : ""
              }

            </div>


            <div class="card-actions">

              <button
                class="btn"
                data-book-index="${index}"
              >

                Ver detalhes

              </button>

            </div>

          </article>

        `;

      }
    ).join("");


  document
    .querySelectorAll(
      "[data-book-index]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openBook(
            Number(
              button.dataset.bookIndex
            )
          );

        }
      );

    });

}


/* =====================================================
   ABRIR LIVRO
===================================================== */

function openBook(index) {

  const book =
    state.filtered[index];


  if (!book) {
    return;
  }


  const tags = [

    book["Tema principal"],

    book["Subtemas"],

    book["Tipo de livro"],

    book["Perfil de leitor"]

  ].filter(Boolean);


  $("modalContent").innerHTML = `

    <div class="tag">

      ${esc(
        book[
          "Tema principal"
        ] ||
        "Keola Books"
      )}

    </div>


    <h2>

      ${esc(
        book["Título"]
      )}

    </h2>


    <div class="author">

      ${esc(
        book["Autor"]
      )}

      ${
        book["Editora"]
          ? " · " +
            esc(
              book["Editora"]
            )
          : ""
      }

    </div>


    <div class="meta">

      ${tags.map(tag => `

        <span>

          ${esc(tag)}

        </span>

      `).join("")}

    </div>


    <h4>
      Sinopse de consulta
    </h4>

    <p>

      ${esc(
        book[
          "Sinopse de consulta"
        ] ||
        "Não disponível."
      )}

    </p>


    <h4>
      Como apresentar ao cliente
    </h4>

    <p>

      ${esc(
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

      ${esc(
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

      ${esc(
        book[
          "Palavras-chave"
        ] ||
        "Não disponíveis."
      )}

    </p>


    <h4>
      Livros relacionados
    </h4>

    <p>

      ${esc(
        book[
          "Livros relacionados por catálogo"
        ] ||
        "Não informado."
      )}

    </p>

  `;


  $("modal")
    .showModal();

}


/* =====================================================
   LIMPAR FILTROS
===================================================== */

function clearFilters() {

  $("search").value = "";


  [
    "categoria",
    "tema",
    "autor",
    "editora"

  ].forEach(id => {

    $(id).value = "";

  });


  filterBooks();

}


/* =====================================================
   BUSCA RÁPIDA
===================================================== */

function quickSearch(query) {

  $("search").value =
    query;

  filterBooks();

}


/* =====================================================
   CARREGAR CATÁLOGO
===================================================== */

async function loadCatalog() {

  try {

    const response =
      await fetch(
        "./catalogo.json",
        {
          cache: "no-store"
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "Não foi possível carregar catalogo.json"
      );

    }


    state.books =
      await response.json();


    setupFilters();

    filterBooks();

  }

  catch(error) {

    console.error(
      error
    );


    $("count").textContent =
      "Erro ao carregar o catálogo";


    $("results").innerHTML = `

      <div class="empty">

        Não foi possível
        carregar o catálogo.

        <br><br>

        Confirme se

        <strong>
          catalogo.json
        </strong>

        está na mesma pasta
        do index.html.

      </div>

    `;

  }

}


/* =====================================================
   EVENTOS
===================================================== */

$("search")
  .addEventListener(
    "input",
    filterBooks
  );


[
  "categoria",
  "tema",
  "autor",
  "editora"

].forEach(id => {

  $(id)
    .addEventListener(
      "change",
      filterBooks
    );

});


$("searchBtn")
  .addEventListener(
    "click",
    filterBooks
  );


$("clearBtn")
  .addEventListener(
    "click",
    clearFilters
  );


$("closeModal")
  .addEventListener(
    "click",
    () =>
      $("modal").close()
  );


document
  .querySelectorAll(
    "[data-q]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        quickSearch(
          button.dataset.q
        );

      }
    );

  });


$("modal")
  .addEventListener(
    "click",
    event => {

      if (
        event.target ===
        $("modal")
      ) {

        $("modal").close();

      }

    }
  );


/* =====================================================
   INICIAR
===================================================== */

loadCatalog();