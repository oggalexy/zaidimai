async function loadGames() {
  const res = await fetch("/api/games");
  const games = await res.json();
  const container = document.querySelector("#games");
  const empty = document.querySelector("#empty");

  if (!games.length) {
    empty.classList.remove("hidden");
    return;
  }

  container.innerHTML = games.map(g => `
    <article class="card">
      <img class="cover" src="${escapeAttr(g.image)}" alt="">
      <div class="card-body">
        <h2>${escapeHtml(g.title)}</h2>
        <a class="play" href="/play/${encodeURIComponent(g.id)}">Žaisti</a>
      </div>
    </article>
  `).join("");
}

async function checkAdmin() {
  const res = await fetch("/api/me");
  const data = await res.json();
  if (data.admin) document.querySelector("#adminLink")?.classList.remove("hidden");
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(v) { return escapeHtml(v); }

loadGames();
checkAdmin();