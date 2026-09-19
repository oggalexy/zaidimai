const OWNER = "oggalexy";
const REPO = "zaidimai";
const FOLDER = "";

const games = document.getElementById("games");
const status = document.getElementById("status");

function formatDate(isoString) {
    if (!isoString) return null;

    const date = new Date(isoString);

    return date.toLocaleDateString("lt-LT", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

async function fetchLastUpdated(folderName) {
    try {
        // Paskutinis commit'as, kuris palietė index.html (kai atnaujini – ištrini ir įkeli naują)
        const url =
            `https://api.github.com/repos/${OWNER}/${REPO}/commits` +
            `?path=${encodeURIComponent(folderName + "/index.html")}` +
            `&per_page=1`;

        const r = await fetch(url);

        if (!r.ok) return null;

        const commits = await r.json();

        if (!Array.isArray(commits) || commits.length === 0) {
            // Jei index.html nėra – bandome visą aplanką
            const folderUrl =
                `https://api.github.com/repos/${OWNER}/${REPO}/commits` +
                `?path=${encodeURIComponent(folderName)}` +
                `&per_page=1`;

            const fr = await fetch(folderUrl);
            if (!fr.ok) return null;

            const folderCommits = await fr.json();
            if (!Array.isArray(folderCommits) || folderCommits.length === 0) return null;

            return folderCommits[0].commit?.committer?.date || null;
        }

        return commits[0].commit?.committer?.date || null;
    } catch (e) {
        console.log(`Nepavyko gauti datos: ${folderName}`, e);
        return null;
    }
}

async function fetchMessage(folderName) {
    try {
        const url =
            `https://api.github.com/repos/${OWNER}/${REPO}/contents/` +
            `${encodeURIComponent(folderName)}/message.txt`;

        const r = await fetch(url);

        if (!r.ok) return null;

        const data = await r.json();

        // Turinio nėra arba failas tuščias
        if (!data.content) return null;

        // GitHub API grąžina base64
        const text = atob(data.content.replace(/\n/g, "")).trim();

        return text.length > 0 ? text : null;
    } catch (e) {
        console.log(`Nerasta message.txt: ${folderName}`);
        return null;
    }
}

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

            // Thumbnail
            let thumbnail = null;

            try {
                const thumbnailUrl =
                    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(folder.name)}/thumbnail.png`;

                const thumbnailResponse = await fetch(thumbnailUrl);

                if (thumbnailResponse.ok) {
                    const thumbnailData = await thumbnailResponse.json();
                    thumbnail = thumbnailData.download_url;
                }
            } catch (error) {
                console.log(`Nerasta thumbnail.png: ${folder.name}`);
            }

            // Paskutinio atnaujinimo data + žinutė (lygiagrečiai)
            const [lastUpdatedIso, message] = await Promise.all([
                fetchLastUpdated(folder.name),
                fetchMessage(folder.name)
            ]);

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

            content.appendChild(h);

            // Žinutė iš message.txt (jei yra ir netuščia)
            if (message) {
                const msg = document.createElement("p");
                msg.className = "game-message";
                msg.textContent = message;
                content.appendChild(msg);
            }

            // Data
            if (lastUpdatedIso) {
                const dateEl = document.createElement("p");
                dateEl.className = "game-date";
                dateEl.textContent = `Atnaujinta: ${formatDate(lastUpdatedIso)}`;
                content.appendChild(dateEl);
            }

            const p = document.createElement("p");
            p.className = "game-play";
            p.textContent = "Paleisti žaidimą →";

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
