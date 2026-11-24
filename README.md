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

## Konto & Synchronisieren (optional)

Ohne Konto speichert Home Bar alles nur im Browser. Mit einem kostenlosen
[Supabase](https://supabase.com)-Projekt können sich Nutzer anmelden, und ihre
Bar ist auf allen Geräten gleich.

1. Supabase-Projekt erstellen.
2. Im **SQL Editor** den Inhalt von `supabase-setup.sql` ausführen.
3. Unter **Authentication → URL Configuration** die Site-URL auf die Adresse der Seite setzen.
4. **Project URL** und **anon public key** in `config.js` eintragen.

Der anon key ist öffentlich gedacht; die Daten sind durch Row Level Security geschützt
(jeder sieht nur seine eigenen Daten).
