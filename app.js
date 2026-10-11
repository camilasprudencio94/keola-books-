
const state = { books: [], filtered: [] };

// CONFIGURAÇÃO: substitua pelos dados públicos do seu projeto Supabase.
// Use apenas a Project URL e a publishable key (sb_publishable_...).
// Nunca coloque a secret/service_role key neste arquivo.
const SUPABASE_URL = "COLE_AQUI_A_PROJECT_URL";
const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_A_PUBLISHABLE_KEY";
const ANALYTICS_ENABLED =
  /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
const FALLBACK_SEARCHES = [
  { term: "casamento", label: "Casamento" },
  { term: "pais", label: "Pais e filhos" },
  { term: "cura emocional", label: "Cura emocional" },
  { term: "lideranca", label: "Liderança" },
  { term: "mulheres", label: "Mulheres" }
];

const $ = id => document.getElementById(id);

function text(v){ return v == null ? "" : String(v); }
function norm(v){
  return text(v).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function esc(v){
  return text(v).replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

const FIELDS = [
  "Título","Autor","Editora","Categoria original","Grupo",
  "Tema original","Tema principal","Subtemas","Palavras-chave",
  "Necessidades relacionadas","Perfil de leitor","Tipo de livro",
  "Sinopse de consulta","Como apresentar ao cliente (base)",
  "Situações de indicação"
];

function canonicalTerm(value){
  return norm(value).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0,60);
}

async function supabaseRpc(name, payload){
  if(!ANALYTICS_ENABLED) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
    },
    body: JSON.stringify(payload || {})
  });
  if(!response.ok) throw new Error(`Supabase RPC ${name}: HTTP ${response.status}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

async function recordSearch(query){
  const term = canonicalTerm(query);
  if(!ANALYTICS_ENABLED || term.length < 2) return;
  try{
    await supabaseRpc("keola_record_search", { search_term: term });
    await loadPopularSearches();
  }catch(error){
    // A falha de analytics não deve impedir a busca no catálogo.
    console.warn("Não foi possível registrar a busca compartilhada.", error);
  }
}

function renderQuickSearches(items){
  const container = $("quickSearches");
  if(!container) return;
  const label = document.createElement("span");
  label.className = "quick-label";
  label.textContent = "Mais pesquisados nos últimos 30 dias";
  container.replaceChildren(label);

  items.forEach(item=>{
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.dataset.q = item.term;
    button.textContent = item.label || (item.term.charAt(0).toLocaleUpperCase("pt-BR") + item.term.slice(1));
    button.title = `${item.search_count || 0} buscas nos últimos 30 dias`;
    button.addEventListener("click",()=>quickSearch(item.term, true));
    container.appendChild(button);
  });
}

async function loadPopularSearches(){
  if(!ANALYTICS_ENABLED){
    renderQuickSearches(FALLBACK_SEARCHES);
    return;
  }
  try{
    const rows = await supabaseRpc("keola_popular_searches", {});
    if(Array.isArray(rows) && rows.length){
      renderQuickSearches(rows.map(row=>({
        term: row.term,
        label: row.term.charAt(0).toLocaleUpperCase("pt-BR") + row.term.slice(1),
        search_count: row.search_count
      })));
    }else{
      // Até haver volume suficiente de buscas, mantém atalhos iniciais úteis.
      renderQuickSearches(FALLBACK_SEARCHES);
    }
  }catch(error){
    console.warn("Não foi possível carregar as buscas populares.", error);
    renderQuickSearches(FALLBACK_SEARCHES);
  }
}

function submitSearch(){
  filterBooks();
  recordSearch($("search").value);
}

function score(book, query){
  if(!query) return 0;
  const terms = norm(query).split(/\s+/).filter(Boolean);
  let total = 0;

  for(const term of terms){
    const title = norm(book["Título"]);
    const author = norm(book["Autor"]);

    if(title === term) total += 120;
    else if(title.includes(term)) total += 70;

    if(author.includes(term)) total += 45;

    for(const field of FIELDS.slice(3)){
      const value = norm(book[field]);
      if(value.includes(term)){
        total += field === "Tema principal" ? 28 :
                 field === "Necessidades relacionadas" ? 22 :
                 field === "Palavras-chave" ? 18 : 8;
      }
    }
  }
  return total;
}

function unique(field){
  return [...new Set(state.books.map(b=>text(b[field])).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"pt-BR"));
}

function fillSelect(id, field){
  const select = $(id);
  unique(field).forEach(value=>{
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function setupFilters(){
  fillSelect("categoria","Categoria original");
  fillSelect("tema","Tema principal");
  fillSelect("autor","Autor");
  fillSelect("editora","Editora");
}

function filterBooks(){
  const q = norm($("search").value.trim());
  const cat = $("categoria").value;
  const tema = $("tema").value;
  const autor = $("autor").value;
  const editora = $("editora").value;

  state.filtered = state.books
    .filter(book =>
      (!cat || text(book["Categoria original"]) === cat) &&
      (!tema || text(book["Tema principal"]) === tema) &&
      (!autor || text(book["Autor"]) === autor) &&
      (!editora || text(book["Editora"]) === editora)
    )
    .map(book=>({book, score:score(book,q)}))
    .filter(item=>!q || item.score > 0)
    .sort((a,b)=>
      b.score-a.score ||
      text(a.book["Título"]).localeCompare(text(b.book["Título"]),"pt-BR")
    )
    .map(item=>item.book);

  render();
}

function render(){
  const books = state.filtered;
  $("count").textContent =
    `${books.length} livro${books.length===1?"":"s"} encontrado${books.length===1?"":"s"}`;

  if(!books.length){
    $("results").innerHTML =
      `<div class="empty"><strong>Nenhum livro encontrado.</strong><br><br>
       Tente outra palavra ou limpe os filtros.</div>`;
    return;
  }

  $("results").innerHTML = books.map((book,index)=>{
    const description =
      text(book["Sinopse de consulta"]) ||
      text(book["Como apresentar ao cliente (base)"]) ||
      "Consulte os detalhes deste livro.";

    return `
      <article class="card">
        <div class="tag">${esc(book["Tema principal"] || book["Categoria original"] || "Livro")}</div>
        <h3>${esc(book["Título"] || "Sem título")}</h3>
        <div class="author">${esc(book["Autor"] || "Autor não informado")}</div>
        <div class="desc">${esc(description).slice(0,280)}${description.length>280?"…":""}</div>
        <div class="card-actions">
          <button class="btn" data-book-index="${index}">Ver detalhes</button>
        </div>
      </article>`;
  }).join("");

  document.querySelectorAll("[data-book-index]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      openBook(Number(btn.dataset.bookIndex));
    });
  });
}

function openBook(index){
  const book = state.filtered[index];
  if(!book) return;

  const tags = [
    book["Tema principal"],
    book["Subtemas"],
    book["Tipo de livro"],
    book["Perfil de leitor"]
  ].filter(Boolean);

  $("modalContent").innerHTML = `
    <div class="tag">${esc(book["Tema principal"] || "Keola Books")}</div>
    <h2>${esc(book["Título"])}</h2>
    <div class="author">
      ${esc(book["Autor"])}
      ${book["Editora"] ? " · "+esc(book["Editora"]) : ""}
    </div>

    <div class="meta">
      ${tags.map(t=>`<span>${esc(t)}</span>`).join("")}
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

function clearFilters(){
  $("search").value = "";
  ["categoria","tema","autor","editora"].forEach(id=>$(id).value="");
  filterBooks();
}

function quickSearch(q, countSearch=false){
  $("search").value = q;
  filterBooks();
  if(countSearch) recordSearch(q);
}

async function loadCatalog(){
  try{
    const response = await fetch("./catalogo.json", {cache:"no-store"});
    if(!response.ok) throw new Error("Não foi possível carregar catalogo.json");
    state.books = await response.json();
    setupFilters();
    filterBooks();
    loadPopularSearches();
  }catch(error){
    console.error(error);
    $("count").textContent = "Erro ao carregar o catálogo";
    $("results").innerHTML =
      `<div class="empty">
        Não foi possível carregar o catálogo.<br><br>
        Confirme se <strong>catalogo.json</strong> está na mesma pasta do index.html.
      </div>`;
  }
}

$("search").addEventListener("input",filterBooks);
["categoria","tema","autor","editora"].forEach(id=>{
  $(id).addEventListener("change",filterBooks);
});
$("searchBtn").addEventListener("click",submitSearch);
$("search").addEventListener("keydown",event=>{
  if(event.key === "Enter"){
    event.preventDefault();
    submitSearch();
  }
});
$("clearBtn").addEventListener("click",clearFilters);
$("closeModal").addEventListener("click",()=>$("modal").close());

// Os atalhos são renderizados dinamicamente por loadPopularSearches().

$("modal").addEventListener("click",e=>{
  if(e.target === $("modal")) $("modal").close();
});

loadCatalog();
