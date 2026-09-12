# HTML Game Site

Privati administravimo zona leidžia tik administratoriui:
- įkelti naują HTML žaidimą;
- įkelti žaidimo paveikslėlį;
- pakeisti žaidimo failus;
- ištrinti žaidimą.

Kiekvienas žaidimas saugomas atskirame kataloge:
`data/games/<game-id>/`

Viduje laikomi jo HTML/CSS/JS ir kiti failai.

## Paleidimas

1. Įsidiek Node.js 20+.
2. Nukopijuok `.env.example` į `.env`.
3. Pakeisk `ADMIN_USERNAME`, `ADMIN_PASSWORD` ir `SESSION_SECRET`.
4. Paleisk:

```bash
npm install
npm start
```

Atidaryk `http://localhost:3000`.

Admin:
`http://localhost:3000/admin/login`

## Žaidimo įkėlimas

Įkėlimo lange galima pasirinkti kelis failus. `index.html` yra privalomas.
Failai išsaugomi konkretaus žaidimo aplanke, todėl galima naudoti:
- `index.html`
- `style.css`
- `game.js`
- paveikslėlius
- audio
- kitus žaidimui reikalingus failus

Keliai tarp failų turi būti reliatyvūs, pvz.:
`src="images/player.png"`

## Saugumas

Vieši lankytojai neturi admin mygtuko ir negali pasiekti administravimo API be prisijungimo.
Admin prisijungimas saugomas serverio sesijoje.

Prieš viešai paleidžiant rekomenduojama naudoti HTTPS ir stiprų `SESSION_SECRET` bei administratoriaus slaptažodį.
