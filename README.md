# Planverket – innebandyövningar

En mobilanpassad, installerbar webbapp (PWA) för att rita, animera och dela
innebandyövningar. Ingen appbutik, inloggning eller backend behövs.
Gränssnittet är på svenska.

## Kör lokalt

Node.js 22.12+ eller en nyare version som stöds av Vite krävs.

```powershell
Set-Location C:\www_temp\MAIS-Practice
npm ci
npm run dev
```

Öppna adressen som Vite skriver ut. Utvecklingsservern lyssnar på
`127.0.0.1`. Offlinefunktion och installation ska provas med
**produktionsbygget**, inte utvecklingsservern:

```powershell
npm run build
npm run preview
```

## Publicera och installera

### GitHub Pages (förvalt)

Repot `Dejntan/ibtest` publiceras automatiskt via
`.github/workflows/deploy.yml` vid varje push till `main`. Arbetsflödet
kör enhetstester, bygger och publicerar `dist`.

1. Första gången: på GitHub, gå till **Settings → Pages → Build and
   deployment** och välj **Source: GitHub Actions**.
2. Pusha till `main` (eller kör arbetsflödet manuellt under **Actions**).
3. Appen finns på **https://dejntan.github.io/ibtest/**.

### Annan webbserver

Publicera innehållet i `dist` på en statisk webbserver med **HTTPS**.
Relativa resurssökvägar gör att appen även kan ligga i en undermapp.
Öppna undermappens adress med avslutande snedstreck. Ingen serverkod,
databas, API-nyckel eller miljövariabel krävs.

Undvik långvarig HTTP-cache för `index.html`, `sw.js` och
`manifest.webmanifest`. Hashade resurser under `assets` kan långtidslagras.
Den slutliga webbplatsadressen bör vara stabil: lokal lagring tillhör
webbplatsens origin, och appinstallation/cache har sin egen scope.

- **iPhone/iPad:** öppna HTTPS-adressen i Safari → Dela → Lägg till på
  hemskärmen.
- **Android:** öppna i Chrome → Installera app eller Lägg till på
  startskärmen. Appens installationsknapp visas med installationsdialog
  när webbläsaren erbjuder den, annars med instruktioner.
- Öppna först appen med internet och invänta meddelandet **Redo för
  offline**. Därefter kan appen öppnas utan nät.
- Appuppdateringar visas som en notis. Gå till biblioteket med arbetet
  sparat för att aktivera en uppdatering.

Localhost räknas som säker kontext för lokal utveckling. En vanlig
HTTP-adress till datorns LAN-IP räcker däremot inte för installation och
service worker på telefonen. Använd en HTTPS-värd för telefonprov.
Hosting/domän och faktisk publicering ingår inte i projektets lokala bygge.

## Rita och animera

1. Skapa en övning, ange namn och beskrivning och välj hel- eller halvplan.
   **Ny från mall** startar från en färdig övning (t.ex. 2 mot 1,
   passningsfyrkant, skott efter passning och uppspel från back).
2. Välj spelare, målvakt, boll, kon, mål, zon, pil eller text. Tryck på
   planen för att placera objektet. Verktyget återgår därefter till
   Välj/flytta. **Konmallar** (rad, triangel, fyrkant, slalom) placerar
   flera koner på en gång.
3. Dra för att flytta. Markera en pil för att dra dess ändpunkter och det
   runda mitthandtaget för att böja den. Zoner (rektangel eller ellips)
   ändras i storlek med hörnhandtag. Egenskapsfältet har även
   objektlista, numeriska koordinater, färger och linjetyp
   (löpning, dribbling, passning, skott).
   Spelare har nummer 1–99 och grönt eller orange lag.
4. Välj **Kopiera till nästa steg** och flytta spelare och boll till nästa
   position. Kopian behåller objektens ID:n så att rörelsen kan animeras.
   Rörelsen visas som ett spår. Dra spårets runda handtag för att böja
   rörelsen; animationen följer kurvan. Spårets typ väljs automatiskt
   (boll nära spelare = dribbling, boll mot mål = skott, annars passning,
   spelare = löpning) men kan ändras under **Rörelse till nästa steg**.
5. Ange stegbeskrivning och tid till nästa steg (0,5–60 sekunder).
   Sista steget är slutpositionen och har ingen efterföljande övergång.
   **Visa rörelsespår** styr om spåren syns i uppspelning, bild och
   utskrift.
6. Välj **Spela upp** för animation, paus, omstart, hastighet, tidslinje
   och föregående/nästa steg. **Helskärm** i uppspelningen (eller **Visa**
   på övningskortet i biblioteket) öppnar presentationsläge i
   helskärm (liggande telefon rekommenderas): mellanslag spelar/pausar,
   piltangenter byter steg och Esc stänger.

Endast spelare, målvakter och boll interpoleras. Koner, mål, zoner, pilar
och text är statiska förklaringar i det aktuella steget.
**Pilar styr inte rörelsen.**
Objekt som tillkommer eller försvinner byts vid steggränsen.
Med systemets inställning för reducerad rörelse visas stegen utan
förflyttningsanimation.

Planbyte skalar objektens X-koordinater proportionellt, inklusive pilarnas
ändpunkter. Objekt klipps därför inte bort när planen ändras.
Ångra/gör om omfattar de senaste 80 redigeringarna under den öppna
redigeringssessionen. En draggest räknas som en ändring.

Tangentbord: välj objekt i listan, fokusera planen med Tab och använd
piltangenterna (5 planenheter, eller 20 med Skift). Delete/Backspace tar
bort markerat objekt. Positioner och piländpunkter kan också anges i
egenskapsfälten.

## Träningspass

Under fliken **Träningspass** sätts flera övningar ihop till en träning med
namn, datum och anteckningar. Varje övning får minuter (1–180) och en egen
anteckning och kan flyttas upp/ner. Passet visar total tid.

- **Visa pass** öppnar presentationsläget för hela passet med nedräkning
  per övning. Page Up/Page Down byter övning.
- **Skriv ut passet** ger ett tidsschema följt av alla övningars steg.
- **Dela pass** och **Exportera passet** skapar en fil som innehåller
  passet och de övningar det använder.
- Tas en övning bort ur biblioteket varnar appen om pass som använder den.
  Passet behålls och övningen hoppas över vid visning.

## Bild och utskrift

- Bildknappen i redigeraren skapar en PNG av aktuellt steg eller alla steg
  i en bild med titel och stegbeskrivningar, för att dela i t.ex. en
  lagchatt.
- Utskriftsknappen öppnar en utskriftsvy med alla steg. Välj
  **Spara som PDF** som skrivare för att få en PDF.

## Lagring, delning och säkerhetskopiering

- Övningar sparas automatiskt i **IndexedDB på den aktuella enheten och
  webbplatsadressen**. Sparstatus visas i redigeraren.
- Ingen molnsynkronisering eller serverlagring sker. En annan telefon
  eller webbläsare har sitt eget bibliotek.
- Webbläsardata kan rensas av användaren eller systemet. Lokal lagring
  är **inte en garanterad säkerhetskopia**. Exportera regelbundet hela
  biblioteket med Säkerhetskopiera.
- Exportera fil sparar en övning som JSON. Dela använder systemets
  fildelningsdialog där den stöds, annars filhämtning. Att skicka filen
  till någon via en annan app kan kräva nät.
- Mottagaren väljer Importera i sin app och öppnar JSON-filen.
  Import kan skapa nya kopior eller behålla ursprungliga ID:n.
  Befintliga ID:n ersätts bara efter ett uttryckligt val.
- Importen valideras i sin helhet före en atomisk databasskrivning.
  Felaktigt innehåll och okända versioner avvisas utan delimport.
- Om lagring blockeras eller blir full visas fel. Arbete som finns kvar
  i den öppna appen kan fortfarande exporteras; stäng inte sidan innan
  du har säkerhetskopierat det.
- Inget konto, delningslänkar, videoexport eller samredigering ingår.

Filformatet är ett objekt med `format: "planverket"`, `version: 2`,
`exercises` och `sessions`. Varje övning har metadata, planvariant och
steg med stabila objekt-ID:n. Träningspass refererar till övningar via
ID. Samma format används för en övning, ett pass och biblioteksbackup.
Filer med `version: 1` (endast övningar) kan fortfarande importeras.
Säkerhetsgränser: högst 100 steg per övning, 200 objekt per steg,
500 övningar och 200 pass i en fil och 10 MB per importfil.
Samma storleksgräns kontrolleras även vid export så att appen inte skapar
filer som den själv inte kan importera. Exportera övningar separat om en
hel biblioteksbackup blir för stor.

## Tester

```powershell
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Enhetstester täcker datamodell, koordinater, historik, tidslinje,
filvalidering, rundresa och lokal lagring. Playwright startar och stänger
själv en previewserver på port 4177 och provar datorvy, Android-liknande
mobilvy och iPhone-liknande WebKit-vy. Offlineprov görs mot
produktionsbyggets riktiga service worker.

Webbläsaremulering ersätter inte prov på riktiga telefoner. Installation,
systemets fildelningsdialog och beteendet för lagring i installerat läge
bör även verifieras på en riktig iPhone och Android från en HTTPS-adress.

## Struktur

- `src/domain`: datamodell, validering, historik, mallar och exempelövning.
- `src/editor`: pekinteraktion, ritverktyg och stegredigering.
- `src/playback`: tidslinje, uppspelning och presentationsläge.
- `src/sessions`: redigering av träningspass.
- `src/print`: utskriftsvy för övningar och pass.
- `src/storage`: lokal IndexedDB-lagring.
- `src/transfer`: portabla filer, PNG-export och systemdelning.
- `src/components`: gemensam planrendering, installation och uppdateringar.

Appen använder inga externa typsnitt, CDN-resurser eller obligatoriska
nätverks-API:er. Ikoner och appresurser följer med bygget.
