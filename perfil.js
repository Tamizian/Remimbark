// Perfil: cambiar nombre de usuario, bio y avatar.
// Usa `db`, `currentUser`, `$`, `showMessage` y `loadThreads`, definidos en index.html y foro.js.

// Silueta pixelada que se muestra mientras la persona no tenga avatar
const PLACEHOLDER_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'>" +
  "<rect width='8' height='8' fill='%23251f3d'/>" +
  "<rect x='3' y='1' width='2' height='2' fill='%23cdbfe6'/>" +
  "<rect x='2' y='4' width='4' height='3' fill='%23cdbfe6'/></svg>";

const AVATAR_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

let savedAvatarUrl = null;

async function openProfile() {
  showMessage("");
  $("list-view").hidden = true;
  $("thread-view").hidden = true;
  $("profile-view").hidden = false;

  const { data, error } = await db
    .from("profiles")
    .select("username, bio, avatar_url")
    .eq("id", currentUser.id)
    .single();
  if (error) {
    showMessage("No se pudo cargar tu perfil.", "error");
    return;
  }
  $("p-username").value = data.username;
  $("p-bio").value = data.bio || "";
  $("p-avatar").value = "";
  savedAvatarUrl = data.avatar_url;
  $("avatar-preview").src = savedAvatarUrl || PLACEHOLDER_AVATAR;
}

$("profile-open").addEventListener("click", openProfile);
$("profile-back").addEventListener("click", loadThreads);

// Vista previa del avatar elegido, antes de guardar
$("p-avatar").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) $("avatar-preview").src = URL.createObjectURL(file);
});

$("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button[type=submit]");
  const username = $("p-username").value.trim();
  const bio = $("p-bio").value.trim();
  const file = $("p-avatar").files[0];

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    showMessage("El nombre de usuario debe tener de 3 a 20 letras, números o guiones bajos.", "error");
    return;
  }
  if (file && (!AVATAR_TYPES[file.type] || file.size > MAX_AVATAR_BYTES)) {
    showMessage("El avatar debe ser PNG, JPG o WebP y pesar menos de 2 MB.", "error");
    return;
  }

  button.disabled = true;
  showMessage("Guardando…");

  let avatarUrl = savedAvatarUrl;
  if (file) {
    // Cada imagen va en la carpeta de su dueño, con un nombre nuevo para que no se quede la versión vieja en caché
    const path = currentUser.id + "/" + Date.now() + "." + AVATAR_TYPES[file.type];
    const upload = await db.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (upload.error) {
      showMessage("No se pudo subir la imagen.", "error");
      button.disabled = false;
      return;
    }
    avatarUrl = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await db
    .from("profiles")
    .update({ username, bio: bio || null, avatar_url: avatarUrl })
    .eq("id", currentUser.id);
  button.disabled = false;

  if (error) {
    // 23505 es el código de Postgres para "ya existe un valor igual" (nombre repetido)
    showMessage(error.code === "23505" ? "Ese nombre de usuario ya está en uso." : "No se pudo guardar el perfil.", "error");
    return;
  }
  savedAvatarUrl = avatarUrl;
  $("username").textContent = username;
  showMessage("Perfil guardado.", "ok");
});
