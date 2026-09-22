const OWNER = "oggalexy";
const REPO = "zaidimai";
const fs = require("fs");

const token = process.env.GITHUB_TOKEN;

async function fetchJson(url) {
    const headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "zaidimai-generator"
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const r = await fetch(url, { headers });
    if (!r.ok) {
        throw new Error(`${url} → ${r.status} ${await r.text()}`);
    }
    return r.json();
}

async function getLastUpdated(folder) {
    try {
        const commits = await fetchJson(
            `https://api.github.com/repos/${OWNER}/${REPO}/commits?path=${encodeURIComponent(folder + "/index.html")}&per_page=1`
        );
        if (commits?.[0]?.commit?.committer?.date) {
            return commits[0].commit.committer.date;
        }

        const folderCommits = await fetchJson(
            `https://api.github.com/repos/${OWNER}/${REPO}/commits?path=${encodeURIComponent(folder)}&per_page=1`
        );
        return folderCommits?.[0]?.commit?.committer?.date || null;
    } catch (e) {
        console.warn(`Nepavyko gauti datos: ${folder}`, e.message);
        return null;
    }
}

async function getMessage(folder) {
    try {
        const data = await fetchJson(
            `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(folder)}/message.txt`
        );
        if (!data.content) return null;
        const text = Buffer.from(data.content, "base64").toString("utf8").trim();
        return text || null;
    } catch {
        return null;
    }
}

async function hasThumbnail(folder) {
    try {
        await fetchJson(
            `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(folder)}/thumbnail.png`
        );
        return true;
    } catch {
        return false;
    }
}

async function main() {
    const items = await fetchJson(`https://api.github.com/repos/${OWNER}/${REPO}/contents/`);
    
    const folders = items
        .filter(i => i.type === "dir" && i.name !== ".github")
        .sort((a, b) => a.name.localeCompare(b.name, "lt"));

    console.log(`Rasta ${folders.length} žaidimų aplankų`);

    const games = [];

    for (const folder of folders) {
        console.log("→", folder.name);

        const [updated, message, thumb] = await Promise.all([
            getLastUpdated(folder.name),
            getMessage(folder.name),
            hasThumbnail(folder.name)
        ]);

        games.push({
            name: folder.name,
            title: folder.name
                .replace(/[-_]+/g, " ")
                .replace(/\b\w/g, c => c.toUpperCase()),
            thumbnail: thumb ? `./${folder.name}/thumbnail.png` : null,
            message,
            updated
        });
    }

    const json = JSON.stringify(games, null, 2) + "\n";
    fs.writeFileSync("games.json", json);
    console.log("✓ games.json atnaujintas");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
