# studio-tools-engines

![CI](https://github.com/ChopCookies/studio-tools-engines/actions/workflows/ci.yml/badge.svg)

**The client-side engines that power the free tools on [studio-tools.online](https://studio-tools.online).**

Everything in this repository runs **100% in the visitor's browser**. Every calculator, converter and generator shipped here processes its input locally: files, text and numbers never leave the device, and nothing is uploaded to a server. This repository is the public, reviewable proof of that claim.

> Your files and data never leave your device. There is no server-side processing, no upload hidden behind a pretty button, and no analytics beacon on your content.

---

## Why this repo exists

Studio Tools has a hard rule: every tool is **local by design**. We publish the source for three reasons:

1. **Trust.** Anyone can read the code and confirm there is no hidden upload or server round-trip.
2. **Portability.** If you like a small engine, take it. They are small, dependency-light and easy to drop into your own projects.
3. **Accountability.** The files in `public/assets/js/` mirror the exact paths served in production, so you can diff them against the live site at any time.

## Verify it yourself

1. Read the code. Each tool's logic lives in a single plain JavaScript IIFE with no server calls.
2. Run the test suite (below). Every engine ships with a Node test that exercises its pure logic.
3. Open the live tool, type something private, and watch your network tab. Engines in this repo make no requests for your content.

## Repository layout

The structure mirrors the production site so you can diff against what is actually served:

```
public/assets/js/        <- tool engines (exactly the files served live)
  <slug>.js              <- one file per tool
scripts/test-<slug>.js   <- Node test for each engine
run-all-tests.js         <- runs every suite; used by `npm test`
```

## Getting started

Requires [Node.js](https://nodejs.org) (v18+).

```bash
npm install     # installs pdf-lib (the only dependency, used by the PDF tools)
npm test        # runs all 53 engine test suites
```

The engines are IIFEs: they expose pure, testable functions via `module.exports` when loaded in Node, and attach their UI automatically when loaded in the browser.

## Tools included

| Engine (live link) | German | English |
|---|---|---|
| [`a4-bilder-zu-pdf`](https://studio-tools.online/a4-bilder-zu-pdf) | A4 Bilder zu PDF | A4 Images to PDF |
| [`altersvorsorge-gap`](https://studio-tools.online/altersvorsorge-gap) | Altersvorsorge-Lücke Rechner | Retirement Gap Calculator |
| [`audio-recorder`](https://studio-tools.online/audio-recorder) | Audio-Recorder – Sprachaufnahme mit Gain, Gate & Kompressor | Audio Recorder – voice recording with gain, gate & compressor |
| [`balkonkraftwerk-rechner`](https://studio-tools.online/balkonkraftwerk-rechner) | Balkonkraftwerk Rechner | Balcony Solar (Plug-in PV) Calculator |
| [`batteriespeicher-rechner`](https://studio-tools.online/batteriespeicher-rechner) | Batteriespeicher Rechner | Home Battery Storage Calculator |
| [`brueckentage-planer`](https://studio-tools.online/brueckentage-planer) | Brueckentage-Planer | Bridge Days Planner |
| [`cron-generator`](https://studio-tools.online/cron-generator) | Cron-Generator | Cron Generator |
| [`dead-pixel-test`](https://studio-tools.online/dead-pixel-test) | Toter-Pixel-Test | Dead Pixel Test |
| [`encoding-reparatur`](https://studio-tools.online/encoding-reparatur) | Encoding-Reparatur | Encoding Repair (Mojibake fixer) |
| [`ersparnis-ziel-rechner`](https://studio-tools.online/ersparnis-ziel-rechner) | Sparziel Rechner | Savings Goal Calculator |
| [`erstausstattung-rechner`](https://studio-tools.online/erstausstattung-rechner) | Erstausstattung Rechner | First Apartment Setup Calculator |
| [`fahrkosten-rechner`](https://studio-tools.online/fahrkosten-rechner) | Fahrkosten-Rechner | Mileage Calculator |
| [`gamepad-tester`](https://studio-tools.online/gamepad-tester) | Gamepad-Test | Gamepad Tester |
| [`gehalt-rechner`](https://studio-tools.online/gehalt-rechner) | Gehaltsrechner (Brutto-Netto) | Salary Calculator (Gross to Net) |
| [`hauskauf-nebenkosten`](https://studio-tools.online/hauskauf-nebenkosten) | Hauskauf-Nebenkosten-Rechner | Home Buying Ancillary Costs Calculator |
| [`haustier-kosten-rechner`](https://studio-tools.online/haustier-kosten-rechner) | Haustierkosten-Rechner | Pet Cost Calculator |
| [`image-resizer`](https://studio-tools.online/image-resizer) | Bild Resizer \| Größe ändern, zuschneiden & drehen | Image Resizer \| Resize, crop & rotate |
| [`ipv6-rechner`](https://studio-tools.online/ipv6-rechner) | IPv6-Rechner | IPv6 Calculator |
| [`kredit-rechner`](https://studio-tools.online/kredit-rechner) | Kredit Rechner | Loan Calculator |
| [`kuendigungsfrist-rechner`](https://studio-tools.online/kuendigungsfrist-rechner) | Kündigungsfrist-Rechner | Notice Period Calculator (Employment) |
| [`meta-tags-generator`](https://studio-tools.online/meta-tags-generator) | Meta-Tags-Generator | Meta Tags Generator |
| [`miet-finanzcheck`](https://studio-tools.online/miet-finanzcheck) | Miet-Finanzcheck | Rent Affordability Check |
| [`mikrofon-test`](https://studio-tools.online/mikrofon-test) | Mikrofon-Test | Microphone Tester |
| [`mortgage-calculator`](https://studio-tools.online/mortgage-calculator) | Baufinanzierungsrechner | Mortgage Calculator |
| [`netzwerk-port-nachschlagewerk`](https://studio-tools.online/netzwerk-port-nachschlagewerk) | Netzwerk-Port-Nachschlagewerk | Network Port Reference |
| [`netzwerk-verbindung-info`](https://studio-tools.online/netzwerk-verbindung-info) | Netzwerk-Verbindungs-Info | Network Connection Info |
| [`notgroschen-rechner`](https://studio-tools.online/notgroschen-rechner) | Notgroschen Rechner | Emergency Fund Calculator |
| [`pendel-rechner`](https://studio-tools.online/pendel-rechner) | Pendel-Rechner | Commute Calculator |
| [`pendlerpauschale-rechner`](https://studio-tools.online/pendlerpauschale-rechner) | Pendlerpauschale-Rechner | Commuter Allowance Calculator |
| [`picture-element-generator`](https://studio-tools.online/picture-element-generator) | Picture-Element-Generator | Picture Element Generator |
| [`qr-code-reader`](https://studio-tools.online/qr-code-reader) | QR-Code-Reader: QR-Code aus Bild lesen | QR Code Reader: read a QR code from an image |
| [`refresh-rate-test`](https://studio-tools.online/refresh-rate-test) | Bildwiederholrate messen | Refresh Rate Test |
| [`reisebudget-rechner`](https://studio-tools.online/reisebudget-rechner) | Reisebudget-Rechner | Travel Budget Calculator |
| [`renten-rechner`](https://studio-tools.online/renten-rechner) | Rentenrechner (gesetzliche Rente) | Pension Calculator (German statutory pension) |
| [`robots-txt-generator`](https://studio-tools.online/robots-txt-generator) | Robots.txt-Generator | Robots.txt Generator |
| [`selector-generator`](https://studio-tools.online/selector-generator) | CSS-Selector-Generator | CSS Selector Generator |
| [`skonto-rechner`](https://studio-tools.online/skonto-rechner) | Skonto-Rechner | Cash Discount Calculator |
| [`social-media-snippets`](https://studio-tools.online/social-media-snippets) | Social Media Snippets | Social Media Snippets |
| [`solar-wartungskosten`](https://studio-tools.online/solar-wartungskosten) | Solar Wartungskosten-Rechner | Solar Maintenance & Repair Cost Estimator |
| [`stromkosten-rechner`](https://studio-tools.online/stromkosten-rechner) | Stromkosten-Rechner | Electricity Cost Calculator |
| [`subnet-rechner`](https://studio-tools.online/subnet-rechner) | IPv4-Subnetz-Rechner | IPv4 Subnet Calculator |
| [`text-diff`](https://studio-tools.online/text-diff) | Text-Diff: Zwei Texte vergleichen | Text Diff: Compare two texts |
| [`typing-trainer`](https://studio-tools.online/typing-trainer) | Tipp-Trainer | Typing Trainer |
| [`umzugskosten-rechner`](https://studio-tools.online/umzugskosten-rechner) | Umzugskosten Rechner | Moving Cost Calculator |
| [`urlaubsanspruch-rechner`](https://studio-tools.online/urlaubsanspruch-rechner) | Urlaubsanspruch-Rechner | Holiday Entitlement Calculator |
| [`vat-calculator`](https://studio-tools.online/vat-calculator) | Mehrwertsteuer-Rechner | VAT Calculator |
| [`vcard-generator`](https://studio-tools.online/vcard-generator) | Elektronische Visitenkarte Generator | vCard Generator |
| [`verzugszinsen`](https://studio-tools.online/verzugszinsen) | Verzugszinsen Rechner | Late Payment Interest Calculator |
| [`visitenkarte-designer`](https://studio-tools.online/visitenkarte-designer) | Visitenkarte-Designer | Business Card Designer |
| [`waschkosten-rechner`](https://studio-tools.online/waschkosten-rechner) | Waschkosten Rechner | Washing Cost Calculator |
| [`webcam-test`](https://studio-tools.online/webcam-test) | Kamera-Test | Webcam Tester |
| [`word-formatierung-entfernen`](https://studio-tools.online/word-formatierung-entfernen) | Word Formatierung entfernen | Remove Word Formatting |
| [`zinseszins-rechner`](https://studio-tools.online/zinseszins-rechner) | Zinseszins-Rechner | Compound Interest Calculator |

Every tool listed above is published as a single browser engine under `public/assets/js/<slug>.js` with a matching Node test under `scripts/`. Some engines rely on shared site libraries (e.g. `lib/image-utils.js`, `lib/ffmpeg-utils.js`) or CDN resources (pdf-lib, JSZip, QRCode) that are loaded by the site and are not duplicated here.

## Privacy model

- No server-side computation for any engine in this repo.
- No analytics or tracking inside the engines. The only scripts that touch the network are shared site infrastructure (self-hosted Matomo page view counting and Cloudflare), never your content.
- The optional AI features on some tools (image upscaling, audio denoising, transcription, personal-data redaction) also run fully on-device via WebAssembly models; those wrappers and models are documented separately on the site.

## License

[MIT](LICENSE) © 2026 Studio Chop Digital. Free to use, modify and distribute.
