export interface Package {
  id: string;
  names: { en: string; pl: string };
  servicePrice: number;
  devicesPrice: number;
  advantages: { en: string[]; pl: string[] };
}

export interface FAQ {
  topic: string; // keyword used for matching, e.g. 'installation', 'warranty', 'voice'
  q: { en: string; pl: string };
  a: { en: string; pl: string };
}

export const PACKAGES: Package[] = [
  {
    id: 'eco',
    names: {
      en: 'ECO - Studio, 1 or 2 bedroom apartment',
      pl: 'ECO - Kawalerka, 1 lub 2 pokojowe mieszkanie',
    },
    servicePrice: 850,
    devicesPrice: 1800,
    advantages: {
      en: [
        'Smart bulbs or wall switches (7)',
        'Smart sockets with energy monitoring (4)',
        'Wi-Fi Smart Thermostat (2)',
        'Air Conditioner integration',
        'Design + remote configuration',
        'Online training',
      ],
      pl: [
        'Inteligentne żarówki lub przełączniki ścienne (7)',
        'Smart gniazdka z pomiarem energii (4)',
        'Termostat Wi-Fi (2)',
        'Integracja klimatyzacji',
        'Projekt + zdalna konfiguracja',
        'Szkolenie on-line',
      ],
    },
  },
  {
    id: 'safe-home',
    names: {
      en: 'SAFE HOME - Security and monitoring',
      pl: 'SAFE HOME - Bezpieczeństwo i monitoring',
    },
    servicePrice: 1750,
    devicesPrice: 3750,
    advantages: {
      en: [
        'All devices and services included in the ECO package',
        'Smart lock + video doorbell (1)',
        'Smoke and water leak sensor (1)',
        'Door and window sensor (1)',
        'Motion sensor (1)',
        'Temperature and humidity sensor (1)',
        'Indoor camera (1)',
      ],
      pl: [
        'Wszystkie urządzenia i usługi z pakietu ECO',
        'Smart zamek + wideodzwonek (1)',
        'Czujniki dymu i zalania (1)',
        'Czujnik drzwi i okien (1)',
        'Czujnik ruchu (1)',
        'Czujnik temperatury oraz wilgotności (1)',
        'Kamera wewnętrzna (1)',
      ],
    },
  },
  {
    id: 'komfort',
    names: {
      en: 'KOMFORT - Full home automation 70-150 m²',
      pl: 'KOMFORT - Pełna automatyzacja domu 70-150 m²',
    },
    servicePrice: 3499,
    devicesPrice: 8570,
    advantages: {
      en: [
        'All devices and services from ECO and SAFE HOME packages',
        'Additional smart bulbs (10)',
        'Additional smart sockets (10)',
        'Additional door and window sensors (4)',
        'Additional motion sensors (3)',
        'Additional temperature and humidity sensors (2)',
        'Outdoor camera (1)',
        'Intelligent blinds or curtain motors (1)',
        'Any compatible smart device addition (5)',
      ],
      pl: [
        'Wszystkie urządzenia oraz usługi pakietu ECO oraz SAFE HOME',
        'Dodatkowe inteligentne żarówki (10)',
        'Dodatkowe smart gniazdka (10)',
        'Dodatkowe czujniki drzwi i okien (4)',
        'Dodatkowe czujniki ruchu (3)',
        'Dodatkowe czujniki temperatury i wilgotności (2)',
        'Kamera zewnętrzna (1)',
        'Inteligentny karnisz (1)',
        'Dowolne kompatybilne urządzenie inteligentne (5)',
      ],
    },
  },
];

export const FAQS: FAQ[] = [
  {
    topic: 'renovation',
    q: {
      en: 'Do I need to tear down walls or replace my electrical wiring?',
      pl: 'Czy muszę kuć ściany albo wymieniać instalację elektryczną?',
    },
    a: {
      en: 'No. We use wireless technologies (Zigbee, Wi-Fi 6/7, Thread). Most devices are plug-in or mounted with 3M tape. No renovation needed.',
      pl: 'Nie. Korzystamy z rozwiązań bezprzewodowych (Zigbee, Wi-Fi 6/7, Thread). Większość urządzeń montujemy w gniazdku lub na taśmę 3M. Remont nie jest potrzebny.',
    },
  },
  {
    topic: 'cost',
    q: {
      en: 'How much does it really cost, including devices?',
      pl: 'Ile to realnie kosztuje z urządzeniami?',
    },
    a: {
      en: 'Depending on the package: from approx. 2,000 PLN (ECO Start) to 15,000 PLN (COMFORT Plus), devices included. We quote the service upfront, and you buy the hardware at cost.',
      pl: 'Zależnie od pakietu: od ok. 2 000 zł (ECO Start) do 15 000 zł (COMFORT Plus) łącznie ze sprzętem. Usługę wyceniamy z góry, sprzęt kupujesz po kosztach.',
    },
  },
  {
    topic: 'ecosystem',
    q: {
      en: 'Which ecosystem to choose: Apple, Alexa or Google?',
      pl: 'Który ekosystem wybrać: Apple, Alexa czy Google?',
    },
    a: {
      en: 'During a free consultation, we check what devices you already use and your priorities (e.g., savings, price, security). Then we recommend the best system — or a hybrid.',
      pl: 'Podczas darmowej konsultacji sprawdzamy, z jakich urządzeń już korzystasz i jakie są Twoje priorytety. Potem rekomendujemy najlepszy ekosystem lub hybrydę.',
    },
  },
  {
    topic: 'remote',
    q: {
      en: 'Can I control the system away from home Wi-Fi?',
      pl: 'Czy mogę sterować domem spoza sieci Wi-Fi?',
    },
    a: {
      en: 'Yes. All three platforms support remote access over mobile networks. Home Assistant can also use secure Nabu Casa cloud.',
      pl: 'Tak. Wszystkie trzy platformy oferują zdalny dostęp przez sieci mobilne, a Home Assistant może działać przez bezpieczną chmurę Nabu Casa.',
    },
  },
  {
    topic: 'internet',
    q: {
      en: 'What happens if internet or power goes down?',
      pl: 'Co jeśli padnie internet albo prąd?',
    },
    a: {
      en: 'Local control (buttons, HomeKit Thread, Zigbee) continues to function. Once the connection is restored, automations resume automatically. We can also install backup power (UPS) on request.',
      pl: 'Lokalne sterowanie (przyciski, HomeKit-Thread, Zigbee) działa dalej, a po przywróceniu sieci scenariusze wracają automatycznie. Na życzenie instalujemy zasilanie awaryjne UPS.',
    },
  },
  {
    topic: 'energy',
    q: {
      en: 'Will a smart home increase my electricity bills?',
      pl: 'Czy smart-dom podniesie rachunki za prąd?',
    },
    a: {
      en: 'Quite the opposite — smart lighting and heating typically reduce energy use by 10–21%. Most devices in standby draw less than 1W. We also support PoE where Ethernet is pre-installed.',
      pl: 'Przeciwnie — automatyczne wygaszanie świateł i inteligentne ogrzewanie zwykle obniżają koszty o 10–21%. Urządzenia w trybie czuwania pobierają poniżej 1 W.',
    },
  },
  {
    topic: 'privacy',
    q: {
      en: 'How are my data and camera recordings protected?',
      pl: 'Jak chronione są moje dane i nagrania z kamer?',
    },
    a: {
      en: 'We choose equipment with end-to-end encryption. We do not collect marketing data. Logs are stored either locally or in the manufacturer\'s cloud — it\'s up to you.',
      pl: 'Wybieramy sprzęt z szyfrowaniem end-to-end. Nie zbieramy Twoich danych marketingowych, a logi przechowujesz lokalnie lub w chmurze producenta.',
    },
  },
  {
    topic: 'existing-devices',
    q: {
      en: 'I already have IKEA bulbs / TP-Link plugs. Can they be integrated?',
      pl: 'Mam już kilka żarówek IKEA / gniazdka TP-Link. Da się je włączyć do systemu?',
    },
    a: {
      en: 'Yes. We can integrate existing devices if they\'re compatible with your hub. If not, we\'ll suggest an affordable alternative.',
      pl: 'Tak. Integrujemy istniejące urządzenia, o ile są zgodne ze standardami obsługi Twojego hub-a. Jeśli nie — podpowiemy tańszy zamiennik.',
    },
  },
  {
    topic: 'installation',
    q: {
      en: 'How long does installation and setup take?',
      pl: 'Jak długo trwa montaż i konfiguracja?',
    },
    a: {
      en: 'ECO Start is usually completed in a couple of working days. More complex installations (COMFORT Plus) take only a few days longer including testing and training.',
      pl: 'Pakiet ECO Start zamykamy zwykle w ciągu jednego dnia roboczego. Złożone instalacje (COMFORT Plus) to kilka dni wraz z testami i szkoleniem.',
    },
  },
];
