const OWNER = "oggalexy";
const REPO = "zaidimai";
const FOLDER = "";

const games = document.getElementById("games");
const status = document.getElementById("status");

async function loadGames() {
    try {
        const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/`;

        const r = await fetch(url);

        if (!r.ok) {
            throw new Error(`GitHub API error: ${r.status}`);
        }

        const items = await r.json();

        const folders = items
            .filter(item =>
                item.type === "dir" &&
                item.name !== ".github"
            )
            .sort((a, b) => a.name.localeCompare(b.name, "lt"));

        games.innerHTML = "";

        if (folders.length === 0) {
            status.textContent = "Žaidimų kol kas nėra.";
            return;
        }

        status.textContent = `${folders.length} žaidimai`;

        for (const folder of folders) {

            // Tikriname, ar žaidimo aplanke yra thumbnail.png
            let thumbnail = null;

            try {
                const thumbnailUrl =
                    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(folder.name)}/thumbnail.png`;

                const thumbnailResponse = await fetch(thumbnailUrl);

                if (thumbnailResponse.ok) {
                    const thumbnailData = await thumbnailResponse.json();

                    // GitHub API pateikia download_url
                    thumbnail = thumbnailData.download_url;
                }
            } catch (error) {
                console.log(`Nerasta thumbnail.png: ${folder.name}`);
            }

            const a = document.createElement("a");

            a.className = "game";
            a.href = `/${REPO}/${encodeURIComponent(folder.name)}/`;

            // Thumbnail
            if (thumbnail) {
                const img = document.createElement("img");

                img.src = thumbnail;
                img.alt = `${folder.name} thumbnail`;

                a.appendChild(img);
            }

            const content = document.createElement("div");
            content.className = "game-content";

            const h = document.createElement("h2");

            h.textContent = folder.name
                .replace(/[-_]+/g, " ")
                .replace(/\b\w/g, c => c.toUpperCase());

            const p = document.createElement("p");
            p.textContent = "Paleisti žaidimą →";

            content.appendChild(h);
            content.appendChild(p);

            a.appendChild(content);
            games.appendChild(a);
        }

    } catch (e) {
        console.error(e);

        status.textContent =
            "Nepavyko įkelti žaidimų. Patikrink GitHub repozitoriją.";
    }
}

loadGames();
