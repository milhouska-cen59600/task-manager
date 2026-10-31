# Úkolník

První verze webové aplikace pro evidenci pracovních úkolů. Česká, responzivní aplikace postavená na JavaScriptu a Vite, připravená pro statické hostování na GitHub Pages.

## Co aplikace umí

- Vytvořit, upravit, dokončit, znovu otevřít a smazat úkol.
- Evidovat název, popis, stav, prioritu a nepovinný termín.
- Zobrazit souhrn a pohledy na všechny, dnešní, opožděné a dokončené úkoly.
- Hledat v názvu a popisu, filtrovat stav a prioritu, řadit podle vytvoření, termínu a priority.
- Ukládat změny do `localStorage`, synchronizovat přehled mezi kartami stejného prohlížeče a exportovat/importovat JSON zálohy.

## Lokální spuštění

Použijte Node.js 22.12 nebo novější.

```sh
npm ci
npm run dev
```

Adresu lokálního serveru vypíše Vite. Produkční sestavení a jeho náhled:

```sh
npm test
npm run build
npm run preview
```

## Publikování na GitHub Pages

1. Spusťte `npm ci`, `npm test` a `npm run build`. Hotová aplikace vznikne ve složce `docs`, jejím vstupním souborem je `docs/index.html`.
2. Commitněte zdrojové soubory, `package-lock.json` i celý adresář `docs` a začleňte pull request do větve `main`.
3. V repozitáři otevřete **Settings → Pages → Build and deployment → Source** a vyberte **Deploy from a branch**.
4. Vyberte větev **main**, složku **/docs** a klikněte na **Save**.

GitHub Pages publikuje přímo commitnuté soubory ze složky `docs`; nepoužívá vlastní deploy workflow této aplikace. Při každé změně zdrojů znovu spusťte `npm run build` a do stejného commitu zahrňte změny v `docs`. Workflow **Check application** spouští testy a kontroluje, že commitnuté sestavení odpovídá zdrojům. Soubor `docs/.nojekyll` vypíná zpracování Jekyllem.

Web bude dostupný na https://milhouska-cen59600.github.io/task-manager/ po úspěšném nasazení Pages. Relativní cesty v konfiguraci Vite umožňují hostování pod cestou `/task-manager/`. Kořenový `index.html` slouží vývoji a sestavení, nikoli přímému publikování. Aplikace nepoužívá klientské URL routování, takže obnovení stránky nevyžaduje přesměrování.

## Návrh aplikace

Rozhraní kombinuje tmavě zelený navigační panel, světlou pracovní plochu, souhrnné karty a přehled úkolů. Barevné štítky rozlišují stav a prioritu; barvu vždy doplňuje text. Na telefonu se navigace přesune nad obsah a úkoly se zobrazí v jednom sloupci. Formuláře používají nativní dialogy a ovládání klávesnicí.

`src/tasks.js` obsahuje datový model, validaci, filtrování a práci se zálohami. `src/main.js` propojuje model s rozhraním; `src/style.css` definuje vzhled. Testy datového modelu jsou v `test/tasks.test.js`.

Stavy: **K vyřízení → Rozpracované → Dokončené**. Dnešní pohled zahrnuje nedokončené úkoly s dnešním termínem. Úkol je po termínu od následujícího dne podle místního času; dokončené úkoly se za opožděné nepovažují. Statistiky vždy ukazují všechny úkoly, nezávisle na filtrech.

## Data a omezení první verze

GitHub Pages hostuje pouze statické soubory. Tato verze nemá server, účty, týmové sdílení ani synchronizaci mezi zařízeními. Úkoly se neodesílají na GitHub; jsou uložené jen v daném prohlížeči a pro danou doménu. Nejde o šifrované úložiště pro citlivá pracovní data. Anonymní režim, smazání dat prohlížeče nebo změna domény mohou úkoly odstranit či znepřístupnit.

Pravidelně používejte **Exportovat**. **Importovat** po potvrzení nahradí současné úkoly zálohou; nepřidává je k existujícím. Přijímá pouze platný formát verze 1, maximálně 5 MB. Při chybě ukládání se změna neprovede. Poškozené uložené údaje aplikace automaticky nepřepisuje; nejprve si je zazálohujte přes vývojářské nástroje prohlížeče. Potom lze v úložišti webu odstranit klíč `ukolnik.tasks.v1`, obnovit stránku a importovat platnou zálohu. Při zablokovaném úložišti nejprve povolte ukládání dat webu.

Další možná etapa: projekty a štítky, opakované úkoly a týmová spolupráce s autentizací a samostatným backendem. Publikování této verze žádný backend nevyžaduje.