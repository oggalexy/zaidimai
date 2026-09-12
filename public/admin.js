const list = document.querySelector("#adminList");
const modalBg = document.querySelector("#modalBg");
const form = document.querySelector("#gameForm");
const title = document.querySelector("#title");
const cover = document.querySelector("#cover");
const files = document.querySelector("#files");
const gameId = document.querySelector("#gameId");
const modalTitle = document.querySelector("#modalTitle");
const save = document.querySelector("#save");
const status = document.querySelector("#status");

async function load() {
  const me = await fetch("/api/me");
  if (!me.ok || !(await me.json()).admin) {
    location.href = "/admin/login";
    return;
  }

  const res = await fetch("/api/games");
  const games = await res.json();

  if (!games.length) {
    list.innerHTML = '<div class="empty">Žaidimų dar nėra.</div>';
    return;
  }

  list.innerHTML = games.map(g => `
    <div class="admin-row">
      <img src="${esc(g.image)}" alt="">
      <div class="grow">
        <strong>${esc(g.title)}</strong>
        <div class="muted">${new Date(g.updated_at).toLocaleString("lt-LT")}</div>
      </div>
      <div class="menu">
        <button class="dots" data-menu="${esc(g.id)}">⋯</button>
        <div class="dropdown hidden" id="menu-${esc(g.id)}">
          <button data-edit="${esc(g.id)}">Atnaujinti</button>
          <button data-delete="${esc(g.id)}">Ištrinti</button>
        </div>
      </div>
    </div>
  `).join("");
}

document.addEventListener("click", async e => {
  const menu = e.target.closest("[data-menu]");
  if (menu) {
    document.querySelectorAll(".dropdown").forEach(x => x.classList.add("hidden"));
    document.querySelector("#menu-" + menu.dataset.menu)?.classList.toggle("hidden");
    return;
  }

  const edit = e.target.closest("[data-edit]");
  if (edit) {
    const res = await fetch("/api/games/" + encodeURIComponent(edit.dataset.edit));
    const g = await res.json();
    gameId.value = g.id;
    title.value = g.title;
    cover.required = false;
    files.required = true;
    modalTitle.textContent = "Atnaujinti žaidimą";
    save.textContent = "Išsaugoti";
    status.textContent = "";
    modalBg.classList.remove("hidden");
    return;
  }

  const del = e.target.closest("[data-delete]");
  if (del) {
    if (!confirm("Ar tikrai ištrinti šį žaidimą?")) return;
    const res = await fetch("/api/admin/games/" + encodeURIComponent(del.dataset.delete), {method:"DELETE"});
    if (!res.ok) alert((await res.json()).error || "Nepavyko ištrinti.");
    await load();
  }
});

document.querySelector("#newGame").onclick = () => {
  form.reset();
  gameId.value = "";
  cover.required = true;
  files.required = true;
  modalTitle.textContent = "Naujas žaidimas";
  save.textContent = "Įkelti";
  status.textContent = "";
  modalBg.classList.remove("hidden");
};

function close() { modalBg.classList.add("hidden"); }
document.querySelector("#closeModal").onclick = close;
document.querySelector("#cancel").onclick = close;
modalBg.addEventListener("click", e => { if (e.target === modalBg) close(); });

form.addEventListener("submit", async e => {
  e.preventDefault();
  save.disabled = true;
  status.textContent = "Keliama...";

  const data = new FormData();
  data.append("title", title.value);
  if (cover.files[0]) data.append("cover", cover.files[0]);
  for (const file of files.files) data.append("files", file);

  const id = gameId.value;
  const url = id ? "/api/admin/games/" + encodeURIComponent(id) : "/api/admin/games";
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {method, body:data});
  const json = await res.json();

  if (!res.ok) {
    status.textContent = json.error || "Nepavyko.";
    save.disabled = false;
    return;
  }

  close();
  save.disabled = false;
  await load();
});

document.querySelector("#logout").onclick = async () => {
  await fetch("/api/admin/logout", {method:"POST"});
  location.href = "/";
};

function esc(v) {
  return String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

load();