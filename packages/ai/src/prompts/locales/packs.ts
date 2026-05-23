import type { LocalePack } from "./types.js";

/**
 * Initial language pack covering 12 BCP-47 locales (#206).
 *
 * Translations are baseline machine-assisted drafts intended for review by
 * native speakers. The seed script (`db:seed-locales-pack`) is idempotent
 * (`onConflictDoUpdate`) so manual edits land via a follow-up reseed.
 */

const READINESS_CHECK_DE = `Du pruefst die KI-Sichtbarkeit der Website {{display_name}}.
Ziel: bewerten, wie gut die Marke {{brand_name}} in {{country}}-spezifischen
KI-Antworten sichtbar ist. Beruecksichtige folgende lokale KI-Assistenten:
{{ai_assistants}}. Beruecksichtige folgende lokale Suchmaschinen: {{search_engines}}.
Antworte ausschließlich auf {{language}}.`;

const COMPETITOR_ANALYSIS_DE = `Vergleiche {{brand_name}} mit den Wettbewerbern {{competitors}}.
Sprachraum: {{display_name}}. Bewerte Sichtbarkeit, Zitations-Frequenz und
Sentiment in den lokalen KI-Tools ({{ai_assistants}}). Antworte auf {{language}}.`;

const READINESS_CHECK_EN = `Evaluate the AI visibility of the website {{display_name}}.
Goal: rate how well the brand {{brand_name}} surfaces in {{country}}-specific
AI answers. Consider these local AI assistants: {{ai_assistants}} and search
engines: {{search_engines}}. Reply only in {{language}}.`;

const COMPETITOR_ANALYSIS_EN = `Compare {{brand_name}} to competitors {{competitors}}.
Locale: {{display_name}}. Score visibility, citation frequency and sentiment
across local AI tools ({{ai_assistants}}). Reply in {{language}}.`;

const READINESS_CHECK_FR = `Evalue la visibilite IA du site {{display_name}}.
Objectif : noter la presence de la marque {{brand_name}} dans les reponses
IA specifiques au {{country}}. Tiens compte des assistants IA locaux :
{{ai_assistants}}, et des moteurs de recherche : {{search_engines}}. Reponds
uniquement en {{language}}.`;

const COMPETITOR_ANALYSIS_FR = `Compare {{brand_name}} aux concurrents
{{competitors}}. Locale : {{display_name}}. Note la visibilite, la frequence
de citation et le sentiment sur les outils IA locaux ({{ai_assistants}}).
Reponds en {{language}}.`;

const READINESS_CHECK_IT = `Valuta la visibilita AI del sito {{display_name}}.
Obiettivo: valutare la presenza del brand {{brand_name}} nelle risposte AI
specifiche per {{country}}. Considera questi assistenti AI locali:
{{ai_assistants}} e motori di ricerca: {{search_engines}}. Rispondi solo in
{{language}}.`;

const COMPETITOR_ANALYSIS_IT = `Confronta {{brand_name}} con i competitor
{{competitors}}. Locale: {{display_name}}. Valuta visibilita, frequenza di
citazione e sentiment sugli strumenti AI locali ({{ai_assistants}}).
Rispondi in {{language}}.`;

const READINESS_CHECK_ES = `Evalua la visibilidad AI del sitio {{display_name}}.
Objetivo: medir como aparece la marca {{brand_name}} en respuestas AI
especificas de {{country}}. Considera asistentes AI locales: {{ai_assistants}}
y motores de busqueda: {{search_engines}}. Responde solo en {{language}}.`;

const COMPETITOR_ANALYSIS_ES = `Compara {{brand_name}} con los competidores
{{competitors}}. Locale: {{display_name}}. Califica visibilidad, frecuencia
de citas y sentiment en herramientas AI locales ({{ai_assistants}}).
Responde en {{language}}.`;

const READINESS_CHECK_PT = `Avalia a visibilidade AI do site {{display_name}}.
Objetivo: pontuar como a marca {{brand_name}} aparece em respostas AI
especificas de {{country}}. Considera assistentes AI locais: {{ai_assistants}}
e motores de busca: {{search_engines}}. Responde apenas em {{language}}.`;

const COMPETITOR_ANALYSIS_PT = `Compara {{brand_name}} com os concorrentes
{{competitors}}. Locale: {{display_name}}. Pontua visibilidade, frequencia de
citacao e sentimento nas ferramentas AI locais ({{ai_assistants}}).
Responde em {{language}}.`;

const READINESS_CHECK_NL = `Beoordeel de AI-zichtbaarheid van de website
{{display_name}}. Doel: meten hoe goed het merk {{brand_name}} naar voren
komt in {{country}}-specifieke AI-antwoorden. Houd rekening met lokale
AI-assistenten: {{ai_assistants}} en zoekmachines: {{search_engines}}.
Antwoord uitsluitend in het {{language}}.`;

const COMPETITOR_ANALYSIS_NL = `Vergelijk {{brand_name}} met de concurrenten
{{competitors}}. Locale: {{display_name}}. Beoordeel zichtbaarheid,
citatiefrequentie en sentiment in lokale AI-tools ({{ai_assistants}}).
Antwoord in het {{language}}.`;

const READINESS_CHECK_PL = `Oceniaj widocznosc AI strony {{display_name}}.
Cel: ocena, jak marka {{brand_name}} pojawia sie w odpowiedziach AI
specyficznych dla {{country}}. Uwzglednij lokalne asystenty AI:
{{ai_assistants}} oraz wyszukiwarki: {{search_engines}}. Odpowiadaj
wylacznie po {{language}}.`;

const COMPETITOR_ANALYSIS_PL = `Porownaj {{brand_name}} z konkurentami
{{competitors}}. Locale: {{display_name}}. Oceniaj widocznosc, czestotliwosc
cytowan i sentyment w lokalnych narzedziach AI ({{ai_assistants}}).
Odpowiadaj po {{language}}.`;

const READINESS_CHECK_CS = `Vyhodnot viditelnost AI pro web {{display_name}}.
Cil: ohodnotit, jak se znacka {{brand_name}} objevuje v odpovedich AI
specifickych pro {{country}}. Vezmi v uvahu lokalni AI asistenty:
{{ai_assistants}} a vyhledavace: {{search_engines}}. Odpovidej pouze v
{{language}}.`;

const COMPETITOR_ANALYSIS_CS = `Porovnej {{brand_name}} s konkurenty
{{competitors}}. Locale: {{display_name}}. Ohodnot viditelnost, frekvenci
citaci a sentiment v lokalnich AI nastrojich ({{ai_assistants}}).
Odpovidej v {{language}}.`;

const READINESS_CHECK_JA = `Webサイト {{display_name}} のAI可視性を評価してください。
目的: ブランド {{brand_name}} が {{country}} 固有のAI応答にどの程度
表示されるかを評価する。次のローカルAIアシスタントを考慮: {{ai_assistants}}、
検索エンジン: {{search_engines}}。回答は {{language}} のみで行うこと。`;

const COMPETITOR_ANALYSIS_JA = `{{brand_name}} を競合 {{competitors}} と
比較してください。ロケール: {{display_name}}。ローカルAIツール
({{ai_assistants}}) における可視性、引用頻度、センチメントを評価。
{{language}} で回答すること。`;

export const LANGUAGE_PACK: LocalePack[] = [
	{
		countryCode: "DE",
		languageCode: "de",
		displayName: "Deutsch (Deutschland)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "You.com", "Aleph Alpha", "DeepL Write"],
			search_engines: ["Google.de", "Bing.de", "Ecosia"],
			market_notes: "DACH-Markt; DSGVO-sensitiv; hoher B2B-Anteil",
		},
		templates: {
			readiness_check: READINESS_CHECK_DE,
			competitor_analysis: COMPETITOR_ANALYSIS_DE,
		},
	},
	{
		countryCode: "AT",
		languageCode: "de",
		displayName: "Deutsch (Oesterreich)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "Microsoft Copilot"],
			search_engines: ["Google.at", "Bing"],
		},
		templates: {
			readiness_check: READINESS_CHECK_DE,
			competitor_analysis: COMPETITOR_ANALYSIS_DE,
		},
	},
	{
		countryCode: "CH",
		languageCode: "de",
		displayName: "Deutsch (Schweiz)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "Microsoft Copilot"],
			search_engines: ["Google.ch", "Swisscows"],
			market_notes: "Mehrsprachiger Markt (DE/FR/IT)",
		},
		templates: {
			readiness_check: READINESS_CHECK_DE,
			competitor_analysis: COMPETITOR_ANALYSIS_DE,
		},
	},
	{
		countryCode: "US",
		languageCode: "en",
		displayName: "English (United States)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Claude", "Perplexity", "Gemini", "Copilot"],
			search_engines: ["Google.com", "Bing", "DuckDuckGo"],
		},
		templates: {
			readiness_check: READINESS_CHECK_EN,
			competitor_analysis: COMPETITOR_ANALYSIS_EN,
		},
	},
	{
		countryCode: "GB",
		languageCode: "en",
		displayName: "English (United Kingdom)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Claude", "Perplexity", "Gemini"],
			search_engines: ["Google.co.uk", "Bing", "DuckDuckGo"],
		},
		templates: {
			readiness_check: READINESS_CHECK_EN,
			competitor_analysis: COMPETITOR_ANALYSIS_EN,
		},
	},
	{
		countryCode: "FR",
		languageCode: "fr",
		displayName: "Francais (France)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Mistral / Le Chat", "Perplexity"],
			search_engines: ["Google.fr", "Qwant", "Bing"],
			market_notes: "Marche FR; preference pour acteurs locaux (Mistral)",
		},
		templates: {
			readiness_check: READINESS_CHECK_FR,
			competitor_analysis: COMPETITOR_ANALYSIS_FR,
		},
	},
	{
		countryCode: "IT",
		languageCode: "it",
		displayName: "Italiano (Italia)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "Microsoft Copilot"],
			search_engines: ["Google.it", "Bing"],
		},
		templates: {
			readiness_check: READINESS_CHECK_IT,
			competitor_analysis: COMPETITOR_ANALYSIS_IT,
		},
	},
	{
		countryCode: "ES",
		languageCode: "es",
		displayName: "Espanol (Espana)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "Microsoft Copilot"],
			search_engines: ["Google.es", "Bing"],
		},
		templates: {
			readiness_check: READINESS_CHECK_ES,
			competitor_analysis: COMPETITOR_ANALYSIS_ES,
		},
	},
	{
		countryCode: "PT",
		languageCode: "pt",
		displayName: "Portugues (Portugal)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "Sintra (PT)"],
			search_engines: ["Google.pt", "Bing"],
		},
		templates: {
			readiness_check: READINESS_CHECK_PT,
			competitor_analysis: COMPETITOR_ANALYSIS_PT,
		},
	},
	{
		countryCode: "NL",
		languageCode: "nl",
		displayName: "Nederlands (Nederland)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "Microsoft Copilot"],
			search_engines: ["Google.nl", "Bing", "Startpage"],
		},
		templates: {
			readiness_check: READINESS_CHECK_NL,
			competitor_analysis: COMPETITOR_ANALYSIS_NL,
		},
	},
	{
		countryCode: "PL",
		languageCode: "pl",
		displayName: "Polski (Polska)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "Bielik AI"],
			search_engines: ["Google.pl", "Bing"],
		},
		templates: {
			readiness_check: READINESS_CHECK_PL,
			competitor_analysis: COMPETITOR_ANALYSIS_PL,
		},
	},
	{
		countryCode: "CZ",
		languageCode: "cs",
		displayName: "Cestina (Ceska republika)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Perplexity", "Microsoft Copilot"],
			search_engines: ["Google.cz", "Seznam.cz"],
		},
		templates: {
			readiness_check: READINESS_CHECK_CS,
			competitor_analysis: COMPETITOR_ANALYSIS_CS,
		},
	},
	{
		countryCode: "JP",
		languageCode: "ja",
		displayName: "日本語 (日本)",
		regionContext: {
			ai_assistants: ["ChatGPT", "Claude", "Perplexity", "Gemini"],
			search_engines: ["Google.co.jp", "Yahoo! Japan", "Bing"],
			market_notes: "Japan market; localised content critical",
		},
		templates: {
			readiness_check: READINESS_CHECK_JA,
			competitor_analysis: COMPETITOR_ANALYSIS_JA,
		},
	},
];
