const OWNER = "oggalexy";
const REPO = "zaidimai";
const FOLDER = "zaidimai";

const games = document.getElementById("games");
const status = document.getElementById("status");

async function loadGames() {
    try {
        const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FOLDER}`;

        const r = await fetch(url);

        if (!r.ok) {
            throw new Error(`GitHub API error: ${r.status}`);
        }

        const items = await r.json();

        const folders = items
            .filter(x => x.type === "dir")
            .sort((a, b) => a.name.localeCompare(b.name, "lt"));

        games.innerHTML = "";

        if (folders.length === 0) {
            status.textContent = "Žaidimų kol kas nėra.";
            return;
        }

        status.textContent = `${folders.length} žaidimai`;

        for (const folder of folders) {
            const a = document.createElement("a");

            a.className = "game";

            // Absoliutus kelias į žaidimą
            a.href = `/${REPO}/${FOLDER}/${encodeURIComponent(folder.name)}/`;

            const h = document.createElement("h2");

            h.textContent = folder.name
                .replace(/[-_]+/g, " ")
                .replace(/\b\w/g, c => c.toUpperCase());

            const p = document.createElement("p");
            p.textContent = "Paleisti žaidimą →";

            a.appendChild(h);
            a.appendChild(p);

            games.appendChild(a);
        }

    } catch (e) {
        console.error(e);

        status.textContent =
            "Nepavyko įkelti žaidimų. Patikrink GitHub repozitoriją.";
    }
}

loadGames();
