// ĮRAŠYK SAVO GITHUB DUOMENIS
const OWNER = "oggalexy";
const REPO = "zaidimai";
const FOLDER = "zaidimai";

const games = document.getElementById("games");
const status = document.getElementById("status");

async function loadGames(){
  if(OWNER.startsWith("TAVO_") || REPO.startsWith("TAVO_")){
    status.textContent="Atidaryk script.js ir įrašyk savo GitHub vardą bei repozitorijos pavadinimą.";
    return;
  }
  try{
    const r=await fetch(`https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${FOLDER}`);
    if(!r.ok) throw new Error(r.status);
    const items=await r.json();
    const folders=items.filter(x=>x.type==="dir").sort((a,b)=>a.name.localeCompare(b.name,"lt"));
    games.innerHTML="";
    status.textContent=folders.length?`${folders.length} žaidimai`:"Žaidimų kol kas nėra.";
    for(const folder of folders){
      const a=document.createElement("a");a.className="game";a.href=`${FOLDER}/${encodeURIComponent(folder.name)}/`;
      const h=document.createElement("h2");h.textContent=folder.name.replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      const p=document.createElement("p");p.textContent="Paleisti žaidimą →";a.append(h,p);games.appendChild(a);
    }
  }catch(e){status.textContent="Nepavyko įkelti žaidimų. Patikrink GitHub duomenis ir aplanką zaidimai/.";console.error(e)}
}
loadGames();
