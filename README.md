# Home Bar 🍸

Gib ein, was du zuhause hast, und sieh alle Drinks, die du daraus mixen kannst.

- Rezepte & Bilder: [TheCocktailDB](https://www.thecocktaildb.com) (kostenlose API)
- Barcode-Daten: [Open Food Facts](https://world.openfoodfacts.org) (kostenlos)
- Barcode-Scanner: [html5-qrcode](https://github.com/mebjas/html5-qrcode) (Apache 2.0, liegt in `vendor/`)
- Alles Persönliche (Bar, Favoriten, eigene Rezepte, Einkaufsliste, Notizen) wird im Browser gespeichert (localStorage).

Reine statische Webseite ohne Build-Schritt. Läuft auf GitHub Pages, Netlify oder Vercel.

## Lokal ansehen

```
python3 -m http.server 8000
```
Dann http://localhost:8000 öffnen.
