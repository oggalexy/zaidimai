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

/**
 * Reads status.txt next to the game.
 * Expected content (one line is enough):
 *   status: enabled
 *   status: disabled
 *   status: updating
 * Missing / unreadable file → treated as enabled.
 */
async function fetchGameStatus(gameName) {
    const urls = [
        `./${encodeURIComponent(gameName)}/status.txt?v=${Date.now()}`,
        `/${REPO}/${encodeURIComponent(gameName)}/status.txt?v=${Date.now()}`
    ];

    for (const url of urls) {
        try {
            const r = await fetch(url, { cache: "no-store" });
            if (!r.ok) continue;
            const text = await r.text();
            const match = String(text).match(/^\s*status\s*:\s*(\w+)/im);
            if (!match) continue;
            const value = match[1].toLowerCase();
            if (value === "enabled" || value === "disabled" || value === "updating") {
                return value;
            }
        } catch (e) {
            // try next url
        }
    }
    return "enabled";
}

function statusMessage(status) {
    if (status === "disabled") return "Žaidimas išjungtas kūrėjo";
    if (status === "updating") return "Žaidimas atnaujinamas ir bus įjungtas neužilgo";
    return null;
}

function statusPlayLabel(status) {
    if (status === "disabled") return "Išjungta";
    if (status === "updating") return "Atnaujinama…";
    return "Paleisti žaidimą →";
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

        // Load every game's status.txt in parallel
        const statuses = await Promise.all(
            folders.map((game) => fetchGameStatus(game.name))
        );

        folders.forEach((game, i) => {
            const gameStatus = statuses[i] || "enabled";
            const blocked = gameStatus === "disabled" || gameStatus === "updating";
            const lockMsg = statusMessage(gameStatus);

            const a = document.createElement("a");
            a.className = "game" + (blocked ? " game-blocked" : "");
            a.dataset.status = gameStatus;

            if (blocked) {
                a.href = "#";
                a.setAttribute("aria-disabled", "true");
                a.addEventListener("click", (ev) => {
                    ev.preventDefault();
                });
            } else {
                a.href = `/${REPO}/${encodeURIComponent(game.name)}/`;
            }

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

            if (lockMsg) {
                const lock = document.createElement("p");
                lock.className = "game-status-msg game-status-" + gameStatus;
                lock.textContent = lockMsg;
                content.appendChild(lock);
            }

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
            p.className = "game-play" + (blocked ? " game-play-blocked" : "");
            p.textContent = statusPlayLabel(gameStatus);
            content.appendChild(p);

            a.appendChild(content);
            gamesEl.appendChild(a);
        });
    } catch (e) {
        console.error(e);
        statusEl.textContent = "Nepavyko įkelti žaidimų.";
    }
}

loadGames();
