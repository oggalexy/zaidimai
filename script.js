const REPO = "zaidimai";

const gamesEl = document.getElementById("games");
const statusEl = document.getElementById("status");

function formatDate(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleDateString("lt-LT", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function formatTitle(name) {
    return name
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

async function loadGames() {
    try {
        const r = await fetch("./games.json?v=" + Date.now());

        if (!r.ok) {
            throw new Error(`Nepavyko gauti games.json (${r.status})`);
        }

        const folders = await r.json();

        gamesEl.innerHTML = "";

        if (!Array.isArray(folders) || folders.length === 0) {
            statusEl.textContent = "Žaidimų kol kas nėra.";
            return;
        }

        statusEl.textContent = `${folders.length} žaidimai`;

        for (const game of folders) {
            const a = document.createElement("a");
            a.className = "game";
            a.href = `/${REPO}/${encodeURIComponent(game.name)}/`;

            if (game.thumbnail) {
                const img = document.createElement("img");
                img.src = game.thumbnail;
                img.alt = `${game.name} thumbnail`;
                a.appendChild(img);
            }

            const content = document.createElement("div");
            content.className = "game-content";

            const h = document.createElement("h2");
            h.textContent = game.title || formatTitle(game.name);
            content.appendChild(h);

            if (game.message) {
                const msg = document.createElement("p");
                msg.className = "game-message";
                msg.textContent = game.message;
                content.appendChild(msg);
            }

            if (game.updated) {
                const dateEl = document.createElement("p");
                dateEl.className = "game-date";
                dateEl.textContent = `Atnaujinta: ${formatDate(game.updated)}`;
                content.appendChild(dateEl);
            }

            const p = document.createElement("p");
            p.className = "game-play";
            p.textContent = "Paleisti žaidimą →";
            content.appendChild(p);

            a.appendChild(content);
            gamesEl
