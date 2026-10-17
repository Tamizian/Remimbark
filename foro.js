// Lógica del foro: lista de temas, crear tema, comentar, borrar y reportar.
// Usa la variable `db` (conexión a Supabase) que se crea en index.html.

let currentUser = null;
const $ = (id) => document.getElementById(id);

// Crea un elemento y le pone texto con textContent (así nadie puede colar código en la página).
function make(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function metaText(row) {
  const name = row.profiles ? row.profiles.username : "alguien";
  const date = new Date(row.created_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
  return "por " + name + " · " + date;
}

function startForum(user) {
  if (currentUser && currentUser.id === user.id) return;
  currentUser = user;
  loadThreads();
}

async function loadThreads() {
  $("thread-view").hidden = true;
  $("profile-view").hidden = true;
  $("list-view").hidden = false;
  const list = $("thread-list");

  const { data, error } = await db
    .from("threads")
    .select("id, title, created_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(50);

  list.replaceChildren();
  if (error) {
    showMessage("No se pudieron cargar los temas.", "error");
    return;
  }
  if (!data.length) {
    list.append(make("li", "Aún no hay temas. Publica el primero.", "empty"));
    return;
  }
  data.forEach((t) => {
    const btn = make("button", "", "thread-btn");
    btn.type = "button";
    btn.append(make("strong", t.title), make("span", metaText(t), "meta"));
    btn.addEventListener("click", () => openThread(t.id));
    const item = document.createElement("li");
    item.append(btn);
    list.append(item);
  });
}

$("thread-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = $("t-title").value.trim();
  const content = $("t-content").value.trim();
  const { error } = await db.from("threads").insert({ author_id: currentUser.id, title, content });
  if (error) {
    showMessage("No se pudo publicar el tema.", "error");
    return;
  }
  event.target.reset();
  showMessage("Tema publicado.", "ok");
  loadThreads();
});

async function openThread(id) {
  showMessage("");
  const [threadRes, commentsRes] = await Promise.all([
    db.from("threads").select("id, author_id, title, content, created_at, profiles(username)").eq("id", id).single(),
    db.from("comments").select("id, author_id, content, created_at, profiles(username)").eq("thread_id", id).order("created_at", { ascending: true }),
  ]);
  if (threadRes.error) {
    showMessage("No se pudo abrir el tema.", "error");
    return;
  }
  const t = threadRes.data;

  const back = make("button", "Volver a los temas", "small");
  back.type = "button";
  back.addEventListener("click", loadThreads);

  const actions = make("div", "", "row");
  actions.append(reportButton("thread", t.id));
  if (t.author_id === currentUser.id) actions.append(deleteButton("threads", t.id, loadThreads));

  const list = make("ul", "", "list");
  const comments = commentsRes.data || [];
  if (!comments.length) list.append(make("li", "Todavía nadie ha comentado.", "empty"));
  comments.forEach((c) => {
    const item = make("li", "", "comment");
    const row = make("div", "", "row");
    row.append(reportButton("comment", c.id));
    if (c.author_id === currentUser.id) row.append(deleteButton("comments", c.id, () => openThread(id)));
    item.append(make("span", metaText(c), "meta"), make("p", c.content, "post"), row);
    list.append(item);
  });

  const form = document.createElement("form");
  const label = make("label", "Tu comentario");
  label.htmlFor = "c-content";
  const box = document.createElement("textarea");
  box.id = "c-content";
  box.rows = 3;
  box.maxLength = 2000;
  box.required = true;
  const send = make("button", "Comentar", "primary");
  send.type = "submit";
  form.append(label, box, send);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = box.value.trim();
    if (!content) return;
    const { error } = await db.from("comments").insert({ thread_id: id, author_id: currentUser.id, content });
    if (error) {
      showMessage("No se pudo comentar.", "error");
      return;
    }
    openThread(id);
  });

  const view = $("thread-view");
  view.replaceChildren(
    back,
    make("h2", t.title),
    make("p", metaText(t), "meta"),
    make("p", t.content, "post"),
    actions,
    make("h2", "Comentarios"),
    list,
    form
  );
  $("list-view").hidden = true;
  view.hidden = false;
}

function reportButton(type, id) {
  const button = make("button", "Reportar", "small danger");
  button.type = "button";
  button.addEventListener("click", async () => {
    const reason = prompt("¿Por qué quieres reportar esto?");
    if (!reason || reason.trim().length < 3) return;
    const { error } = await db.from("reports").insert({
      reporter_id: currentUser.id,
      content_type: type,
      content_id: String(id),
      reason: reason.trim(),
    });
    showMessage(error ? "No se pudo enviar el reporte." : "Reporte enviado. Gracias.", error ? "error" : "ok");
  });
  return button;
}

function deleteButton(table, id, after) {
  const button = make("button", "Borrar", "small danger");
  button.type = "button";
  button.addEventListener("click", async () => {
    if (!confirm("¿Seguro que quieres borrarlo?")) return;
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) showMessage("No se pudo borrar.", "error");
    else after();
  });
  return button;
}
