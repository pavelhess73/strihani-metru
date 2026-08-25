# ✂️ Stříhání metru

Interaktivní webová aplikace pro rituální a vizuálně bohatý odpočet do významných životních či pracovních milníků (Den D, dovolená, konec zkouškového, maturita, svatba, narozeniny nebo vojenský metr do civilu).

---

## 🌟 Funkce

- **📏 Interaktivní páska metru**:
  - Páska s centimetrovým a milimetrovým dělením (1 cm = 1 den).
  - Kovové kování se nýty na začátku metru.
  - Přejetím nad centimetrem se zobrazí nůžky pro okamžité odstřižení.
  - Fyzikální animace padajícího kusu odstřižené látky a jiskřiček.

- **🔊 Zvukový engine (Web Audio API)**:
  - Realistický zvuk střihu nůžek bez potřeby externích zvukových souborů.
  - Cvakání pásky a cinknutí milníku.
  - Oslavná fanfára při kompletním odstřižení metru.

- **🎨 4 grafická témata**:
  - `Krejčovský žlutý` – Klasický žlutý plátěný metr.
  - `Vojenský Army` – Taktický olivově zelený styl.
  - `Cyberpunk Neon` – Tmavý neonový sci-fi styl.
  - `Bílý plátěný` – Elegantní bílá páska s červenými značkami.

- **📍 Špendlíky & Milníky**:
  - Možnost přidávat na konkrétní dny špendlíky s vlastními ikonami a popisky.

- **📝 Deník vzpomínek**:
  - K jednotlivým ustřiženým dnům lze psát krátké vzpomínky nebo postřehy.

- **💾 Automatické ukládání**:
  - Stav metru, nastavení a záznamy se ukládají v `localStorage`.

---

## 🚀 Jak aplikaci spustit

### Možnost 1: Přímo v prohlížeči (bez instalace)
Jednoduše otevřete soubor `index.html` v libovolném moderním webovém prohlížeči (Chrome, Edge, Firefox, Safari).

### Možnost 2: Pomocí Vite (vývojářský server)
1. Otevřete terminál ve složce projektu:
   ```bash
   npm install
   npm run dev
   ```
2. Otevřete adresu v prohlížeči (obvykle `http://localhost:5173`).

---

## 📁 Struktura projektu

```text
strihani-metru/
├── index.html       # Hlavní HTML struktura a modální dialogy
├── style.css        # Kompletní CSS design systém, animace a témata
├── audio.js         # Zvukový syntezátor přes Web Audio API
├── app.js           # Aplikační logika, výpočty odpočtu, částice a správa stavu
├── package.json     # Konfigurace projektu pro npm a Vite
├── start.bat        # Rychlé spuštění jedním kliknutím ve Windows
└── README.md        # Tato dokumentace
```
