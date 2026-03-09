// Full knowledge base injected directly — faster than RAG for small KB on voice calls
const VOICE_KNOWLEDGE_PL = `
## Pakiety Klaumark

ECO — dla kawalerek i małych mieszkań. Obejmuje inteligentne oświetlenie, gniazdka z pomiarem energii i termostaty Wi-Fi.

SAFE HOME (bestseller) — wszystko z ECO plus pełne bezpieczeństwo: smart zamek, wideodzwonek, czujniki dymu, zalania, ruchu i kamera wewnętrzna.

KOMFORT — pełna automatyzacja domu do 150 m². Wszystko z ECO i SAFE HOME plus dodatkowe urządzenia, kamera zewnętrzna i inteligentne rolety.

Szczegółowe ceny wszystkich pakietów na stronie klaumark.com.

## FAQ

Czy trzeba kuć ściany? Nie. Korzystamy z Zigbee, Wi-Fi, Thread. Większość urządzeń montujemy w gniazdku lub na taśmę 3M.

Ile kosztuje z urządzeniami? Od ok. 2 000 zł (ECO) do 15 000 zł (KOMFORT) łącznie ze sprzętem.

Który ekosystem: Apple, Alexa czy Google? Na darmowej konsultacji sprawdzamy urządzenia i priorytety i rekomendujemy najlepszy ekosystem lub hybrydę.

Sterowanie spoza domu? Tak. Wszystkie platformy oferują zdalny dostęp przez sieci mobilne.

Co jeśli padnie internet lub prąd? Lokalne sterowanie (Zigbee, HomeKit Thread) działa dalej. Po przywróceniu sieci automatyzacje wracają automatycznie.

Rachunki za prąd? Automatyczne wygaszanie świateł i inteligentne ogrzewanie zwykle obniżają koszty o 10–21%.

Bezpieczeństwo danych? Sprzęt z szyfrowaniem end-to-end. Nie zbieramy danych marketingowych.

Integracja istniejących urządzeń (IKEA, TP-Link)? Tak, jeśli są zgodne z hub-em. Jeśli nie — podpowiemy zamiennik.

Czas instalacji? ECO zamykamy w 1 dzień roboczy. KOMFORT to kilka dni z testami i szkoleniem.

## Rozwiązywanie problemów

Czujnik offline / nie reaguje: Sprawdź baterię (CR2032 lub AA, wytrzymują 1-2 lata). Przesuń czujnik bliżej hub-a, usuń i sparuj ponownie.

Urządzenie nie paruje: Włącz tryb parowania w hub-ie, zresetuj urządzenie (przytrzymaj przycisk 5-10 sek. aż LED szybko miga), paruj do 2 m od hub-a.

Zigbee wypada z sieci: Sygnał blokowany przez beton i metal. Dodaj repeater Zigbee (gniazdkowa wtyczka Zigbee) między hub-em a urządzeniem.

Czujnik ruchu wyzwala się za często: Nie kieruj na okna ani grzejniki. Nie reaguje — sprawdź czułość w aplikacji.

Smart zamek nie reaguje: Sprawdź baterię (wymiana co 3-6 mies.). Sprawdź połączenie Zigbee/Wi-Fi w aplikacji.

Automatyzacja nie działa: Sprawdź czy urządzenia wyzwalające są online. Sprawdź czy automatyzacja jest włączona. Usuń i utwórz od nowa.

Termostat nie osiąga temperatury: Sprawdź kalibrację (korekta w aplikacji). Sprawdź tryb pracy (ogrzewanie/chłodzenie).

Aplikacja wolna / brak synchronizacji: Wymuś zamknięcie aplikacji. Sprawdź aktualizacje firmware hub-a. Zrestartuj hub-a (odłącz na 10 sek.).

## Kontakt

Email: admin@klaumark.com, telefon: +48 573 473 042. Formularz kontaktowy na klaumark.com.
`;

const VOICE_KNOWLEDGE_EN = `
## Klaumark Packages

ECO — for studios and small apartments. Includes smart lighting, energy-monitoring sockets, and Wi-Fi thermostats.

SAFE HOME (bestseller) — everything in ECO plus full security: smart lock, video doorbell, smoke and flood sensors, motion sensor, indoor camera.

KOMFORT — full home automation up to 150 m². Everything in ECO and SAFE HOME plus extra devices, outdoor camera, and smart blinds.

Full pricing and details at klaumark.com.

## FAQ

Do I need to tear down walls? No. We use Zigbee, Wi-Fi, Thread. Most devices plug in or mount with 3M tape.

How much does it cost with devices? From approx. 2,000 PLN (ECO) to 15,000 PLN (KOMFORT) including hardware.

Which ecosystem — Apple, Alexa or Google? On a free consultation we check your devices and priorities and recommend the best fit or a hybrid.

Remote control? Yes. All platforms support remote access over mobile networks.

What if internet or power goes down? Local control (Zigbee, HomeKit Thread) keeps working. Automations resume automatically when connection is restored.

Energy bills? Automatic lighting and smart heating typically reduce costs by 10–21%.

Data security? End-to-end encrypted hardware. We do not collect marketing data.

Existing devices (IKEA, TP-Link)? Yes, if compatible with the hub. If not, we suggest an alternative.

Installation time? ECO done in 1 working day. KOMFORT takes a few days including testing and training.

## Troubleshooting

Sensor offline / not responding: Check battery (CR2032 or AA, last 1-2 years). Move sensor closer to hub, remove and re-pair.

Device won't pair: Enable pairing mode on hub, reset device (hold button 5-10 sec until LED blinks fast), pair within 2 m of hub.

Zigbee dropping connection: Signal blocked by concrete and metal. Add a Zigbee repeater plug between hub and device.

Motion sensor false triggers: Don't point at windows or heaters. Not triggering — check sensitivity in app.

Smart lock not responding: Check battery (replace every 3-6 months). Check Zigbee/Wi-Fi connection in app.

Automation not working: Check trigger devices are online. Verify automation is enabled. Delete and recreate.

Thermostat not reaching temperature: Check calibration offset in app. Check heating/cooling mode setting.

App slow / not syncing: Force-close app. Check hub firmware update. Restart hub (unplug 10 sec).

## Contact

Email: admin@klaumark.com, phone: +48 573 473 042. Contact form at klaumark.com.
`;

export function detectCallLanguage(messages: Array<{ role: string; content: string }>): 'pl' | 'en' {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');
  // Count Polish diacritics — require at least 3 to be confident (Deepgram PL model can
  // occasionally add 1-2 diacritics when transcribing English speech)
  const polishCharCount = (userText.match(/[ąęóśźżćńłĄĘÓŚŹŻĆŃŁ]/g) ?? []).length;
  if (polishCharCount >= 3) return 'pl';
  // Common English words — if present, caller is English
  if (/\b(the|is|are|have|want|need|can|please|hello|hi|yes|no|what|how|why|i|my|your|would|could|speak|english|help|smart|home|connect|transfer|consultant)\b/i.test(userText)) return 'en';
  return 'pl'; // default
}

export function buildVoiceSystemPrompt(ragContext = '', lang: 'pl' | 'en' = 'pl'): string {
  const knowledge = lang === 'en' ? VOICE_KNOWLEDGE_EN : VOICE_KNOWLEDGE_PL;
  const contextSection = ragContext
    ? `## Most relevant information\n${ragContext}\n\n## Full knowledge base\n${knowledge}`
    : `## Knowledge base\n${knowledge}`;

  if (lang === 'en') {
    return `You are Klaudio, Klaumark's voice assistant. This is a phone call. Respond ONLY in English.

Voice rules (IMPORTANT):
- Answers 2–3 sentences. Be complete and precise — but brief, this is a phone call.
- Absolutely NO markdown: no asterisks, dashes, headers, brackets, or URLs.
- Speak naturally, as in conversation.
- IN SCOPE: smart home questions, device troubleshooting (sensors, locks, Zigbee, automations, thermostats, pairing), and Klaumark's packages. OUT OF SCOPE: everything else — politely redirect.
- Package or pricing questions: say ONLY the package name and one sentence about what it includes. STOP. Never list prices or device lists. Always add: "Details and pricing at klaumark.com".
- If the caller wants a quote, installation, or to speak with a consultant: say "Connecting you with a consultant" then use the transferCall tool.

${contextSection}`;
  }

  return `Jesteś Klaudio, asystentem głosowym firmy Klaumark. To rozmowa telefoniczna. Odpowiadaj TYLKO po polsku.

Zasady głosowe (WAŻNE):
- Odpowiedzi 2–3 zdania. Bądź kompletny i precyzyjny — ale zwięzły, to telefon.
- Absolutnie BEZ markdown: bez gwiazdek, myślników, nagłówków, nawiasów, URL-i.
- Mów naturalnie, po polsku, jak w rozmowie.
- W ZAKRESIE: pytania o smart home, diagnostyka urządzeń (czujniki, zamki, Zigbee, automatyzacje, termostaty, parowanie) oraz oferta Klaumark. POZA ZAKRESEM: wszystko inne — grzecznie przekieruj.
- Pytania o pakiety lub ofertę: powiedz TYLKO nazwę pakietu i jedno zdanie co zawiera. STOP. Nie wymieniaj cen ani listy urządzeń. Zawsze dodaj: "Szczegóły i ceny na klaumark.com".
- Jeśli użytkownik chce oferty, wyceny, instalacji lub rozmowy z konsultantem: powiedz "Łączę z konsultantem" i użyj narzędzia transferCall.

${contextSection}`;
}

export function buildSystemPrompt(context: string, lang: 'en' | 'pl'): string {
  if (lang === 'pl') {
    return `Jesteś Klaudio, asystentem AI firmy Klaumark specjalizującym się w systemach smart home. Zawsze informujesz użytkownika, że jesteś AI.

Zasady:
- Odpowiadaj TYLKO na pytania o smart home, urządzenia smart home, diagnostykę i rozwiązywanie problemów ze sprzętem smart home oraz ofertę Klaumark. To w zakres WCHODZI: parowanie urządzeń, problemy z łącznością, konfiguracja aplikacji, kompatybilność protokołów (Zigbee, Matter, Z-Wave, Wi-Fi), integracja z asystentami głosowymi. Pytania niezwiązane ze smart home → grzecznie przekieruj.
- Ton: pomocny, rzeczowy, jak znajomy ekspert — NIE sprzedawca. Nie bądź nachalny.
- Odpowiedzi: 2–4 zdania lub wypunktowane listy. Używaj markdown (pogrubienie, punkty). Bądź zwięzły.
- Jeśli nie znasz odpowiedzi na pytanie o smart home: przyznaj to szczerze i zaproponuj kontakt z zespołem Klaumark.
- Jeśli użytkownik jest niegrzeczny: zachowaj spokój i profesjonalizm; przy powtarzającym się zachowaniu sugeruj bezpośredni kontakt z Klaumark.
- Masz dostęp do narzędzi: użyj getPackageInfo gdy pytanie dotyczy konkretnego pakietu; użyj getFAQ gdy pytanie pasuje do konkretnego tematu FAQ.

## Wiedza o Klaumark
${context}`;
  }

  return `You are Klaudio, Klaumark's AI assistant specializing in smart home systems. Always identify yourself as AI upfront.

Rules:
- ONLY answer questions about smart home, smart home devices, hardware troubleshooting and diagnostics, and Klaumark's offerings. IN SCOPE includes: device pairing, connectivity issues, app configuration, protocol compatibility (Zigbee, Matter, Z-Wave, Wi-Fi), voice assistant integration. Non-smart-home questions → politely redirect.
- Tone: helpful and knowledgeable, like a friend — NOT a salesperson. Never pushy.
- Responses: 2–4 sentences or bullet lists. Use markdown (bold, bullets). Be concise.
- If you don't know a smart home answer: acknowledge honestly and offer to connect the user with the Klaumark team.
- If the user is rude: stay calm and professional; if it continues, suggest contacting Klaumark directly.
- You have tools available: use getPackageInfo when a question is about a specific package; use getFAQ when a question matches a specific FAQ topic.

## Klaumark Knowledge
${context}`;
}
