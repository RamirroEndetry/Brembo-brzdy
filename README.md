# Brzdový servis – interaktivní 3D trenažér

Webová aplikace, ve které si uživatel z pohledu mechanika rozebere a složí přední brzdu.
Auto stojí na zvedáku, kolo je dole a je vidět těhlice, tlumič s pružinou, rameno, poloosa a celá brzda.

- **Dvě sestavy:** standardní (plovoucí jednopístkový třmen, kotouč 312 mm) a sportovní
  (pevný čtyřpístkový monoblok Brembo, dvoudílný děrovaný kotouč 355 mm).
- **Dva režimy:** demontáž a montáž. Montáž zahrnuje čištění náboje, odmaštění kotouče,
  mazání správným mazivem na správná místa a dotahování momentovým klíčem.
- **Hra:** v každém kroku se vybere nářadí a klikne na označený díl. Špatná volba vysvětlí, proč to tak nejde.
  Počítají se body, chyby a čas.

## Spuštění

```bash
npm install
npm run dev
```

Produkční build (statické soubory ve složce `dist/`):

```bash
npm run build
```

## Logo

Aplikace používá logo z `public/brand/brembo-logo.png` (kopie souboru `Logo/Brembo_logo.png`).
Při výměně stačí soubor přepsat; funguje i `brembo-logo.svg`. Na třmenech a destičkách se logo samo obarví.

## Auta

Standardní sestava je na Audi A3 (8V), sportovní na rally Audi Sport quattro S1.
Karoserie se generují kódem z profilů a kreslených textur v `src/cars.js` (tvary, okna, maska, polepy);
obecný generátor je v `src/carbody.js`.

## Kde co je

| Soubor | Obsah |
| --- | --- |
| `src/procedures.js` | Texty a pořadí kroků, nářadí, mazací plán, hlášky ke špatnému nářadí |
| `src/brakes.js` | 3D modely kotoučů, třmenů, destiček, šroubů a mazacích míst |
| `src/suspension.js` | Těhlice, náboj, tlumič, pružina, rameno, poloosa, řízení |
| `src/world.js` | Dílna, zvedák, vozík, světla, kamera |
| `src/cars.js`, `src/carbody.js` | Karoserie obou aut |
| `src/tools3d.js` | 3D nářadí a jeho animace |
| `src/rig.js` | Rozmístění dílů na vozíku, přesuny dílů, brzdová hadice |
| `src/main.js` | Průběh hry a uživatelské rozhraní |

Utahovací momenty v textech jsou orientační. Před předáním klientovi je dobré je nechat odsouhlasit.
