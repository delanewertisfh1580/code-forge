import type { DirectoryListing, DirectoryObservation, ResearchSource, SocialObservation } from "./types";

export type ResearchImportContext = {
  city: string;
  query: string;
  sourceUrl: string;
  observedAt?: string;
  sourceId?: string;
};

export type ResearchImportDraft = {
  connectorId: "2gis_places_api" | "vk_groups_search_api";
  source: ResearchSource;
  directoryObservation?: DirectoryObservation;
  socialObservations?: SocialObservation[];
};

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const object = (value: unknown): JsonObject | undefined => isObject(value) ? value : undefined;
const array = (value: unknown): unknown[] | undefined => Array.isArray(value) ? value : undefined;
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
const firstNumber = (...values: unknown[]): number | undefined => values.find((value): value is number => typeof value === "number" && Number.isFinite(value));

function firstArray(...values: unknown[]): unknown[] | undefined {
  return values.map(array).find((value): value is unknown[] => Boolean(value));
}

function dateOnly(value?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

function plusDays(value: string, days: number): string {
  const result = new Date(`${value}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48) || "query";
}

function sourceFor(context: ResearchImportContext, connectorId: ResearchImportDraft["connectorId"], observedAt: string, sourceId: string): ResearchSource {
  const provider = connectorId === "2gis_places_api" ? "2ГИС" : "ВКонтакте";
  const kind = connectorId === "2gis_places_api" ? "официальный Places API" : "официальный API поиска сообществ";
  return {
    id: sourceId,
    title: `${provider} API · ${context.query} · ${context.city}`,
    publisher: provider,
    url: context.sourceUrl,
    published_at: observedAt,
    accessed_at: observedAt,
    geography: context.city,
    methodology: `Ответ ${kind}; нормализованы только публичные поля ответа, без пользовательских данных и без подсчета выдачи как census.`,
    notes: "Импорт требует повторной проверки карточек и юридического статуса; API-ответ не является независимым аудитом компании.",
    verification_status: "partial",
    source_type: connectorId === "2gis_places_api" ? "official" : "social",
    next_review_at: plusDays(observedAt, 30),
  };
}

function extractTwoGisItems(payload: unknown): unknown[] {
  const root = object(payload);
  const result = object(root?.result);
  const items = firstArray(result?.items, root?.items, result?.data, result?.results);
  if (!items) throw new Error("2ГИС API response не содержит result.items или items");
  return items;
}

function listingFromTwoGisItem(value: unknown, index: number): DirectoryListing {
  const item = object(value) ?? {};
  const reviews = object(item.reviews);
  const address = object(item.address);
  const name = text(item.name) ?? text(item.name_ex) ?? `Без названия #${index + 1}`;
  const rating = firstNumber(reviews?.rating, item.rating, item.rating_value);
  const ratingCount = firstNumber(reviews?.count, reviews?.rating_count, item.rating_count);
  const addressName = text(item.address_name) ?? text(address?.name) ?? text(address?.address_name);
  return {
    name,
    ...(rating === undefined ? {} : { rating: Math.min(5, Math.max(0, rating)) }),
    ...(ratingCount === undefined ? {} : { rating_count: Math.max(0, ratingCount) }),
    ...(addressName ? { address: addressName } : {}),
  };
}

export function normalizeTwoGisResponse(payload: unknown, context: ResearchImportContext): ResearchImportDraft {
  const observedAt = dateOnly(context.observedAt);
  const sourceId = context.sourceId ?? `api_2gis_${slug(context.city)}_${slug(context.query)}_${observedAt}`;
  const listings = extractTwoGisItems(payload).map(listingFromTwoGisItem);
  const distinctNames = new Set(listings.map((listing) => listing.name.toLocaleLowerCase("ru-RU")));
  const source = sourceFor(context, "2gis_places_api", observedAt, sourceId);
  return {
    connectorId: "2gis_places_api",
    source,
    directoryObservation: {
      id: `${sourceId}_observation`,
      platform: "2gis",
      city: context.city,
      segment: "white_label",
      query: context.query,
      source_id: sourceId,
      source_url: context.sourceUrl,
      observed_at: observedAt,
      first_page_visible_listings: listings.length,
      distinct_named_entities: distinctNames.size,
      listings,
      status: "partial",
      notes: "Нормализовано из официального API. Филиалы, рекламные карточки и тип услуги требуют ручной квалификации; результат не является числом компаний рынка.",
    },
  };
}

function extractVkItems(payload: unknown): unknown[] {
  const root = object(payload);
  const response = object(root?.response);
  const items = firstArray(response?.items, root?.items, response?.groups);
  if (!items) throw new Error("VK API response не содержит response.items или items");
  return items;
}

function vkUrl(screenName: string): string {
  return `https://vk.ru/${screenName.replace(/^@/, "")}`;
}

export function normalizeVkGroupsResponse(payload: unknown, context: ResearchImportContext): ResearchImportDraft {
  const observedAt = dateOnly(context.observedAt);
  const sourceId = context.sourceId ?? `api_vk_${slug(context.city)}_${slug(context.query)}_${observedAt}`;
  const source = sourceFor(context, "vk_groups_search_api", observedAt, sourceId);
  const socialObservations = extractVkItems(payload).map((value, index): SocialObservation => {
    const item = object(value) ?? {};
    const city = object(item.city);
    const screenName = text(item.screen_name) ?? text(item.domain) ?? `community-${text(item.id) ?? index + 1}`;
    const activity = text(item.activity) ?? text(item.description) ?? text(item.status) ?? "Публичная карточка сообщества найдена через API.";
    return {
      id: `${sourceId}_observation_${index + 1}`,
      platform: "vk",
      company_name: text(item.name) ?? `VK community #${index + 1}`,
      city: text(city?.title) ?? context.city,
      segment: "white_label",
      handle: screenName.startsWith("@") ? screenName : `@${screenName}`,
      source_id: sourceId,
      source_url: vkUrl(screenName),
      observed_at: observedAt,
      status: "partial",
      evidence: activity,
      notes: "Публичный сигнал присутствия; описание, подписчики, охват и принадлежность к white-label требуют ручной проверки.",
    };
  });
  return { connectorId: "vk_groups_search_api", source, socialObservations };
}

export function validateResearchImportDraft(draft: ResearchImportDraft): string[] {
  const errors: string[] = [];
  if (!/^https?:\/\/\S+$/i.test(draft.source.url)) errors.push("source.url должен быть http(s) URL");
  if (!draft.source.id) errors.push("source.id обязателен");
  if (draft.directoryObservation) {
    const observation = draft.directoryObservation;
    if (observation.source_id !== draft.source.id) errors.push("directoryObservation.source_id должен совпадать с source.id");
    if (observation.segment !== "white_label") errors.push("API directory import допускает только white_label");
    if (observation.listings.length !== observation.first_page_visible_listings) errors.push("Число listings должно совпадать с first_page_visible_listings");
  }
  for (const observation of draft.socialObservations ?? []) {
    if (observation.source_id !== draft.source.id) errors.push("socialObservation.source_id должен совпадать с source.id");
    if (observation.segment !== "white_label") errors.push("API social import допускает только white_label");
    if (!/^https?:\/\/\S+$/i.test(observation.source_url)) errors.push("socialObservation.source_url должен быть http(s) URL");
  }
  return errors;
}

export function assertValidResearchImportDraft(draft: ResearchImportDraft): void {
  const errors = validateResearchImportDraft(draft);
  if (errors.length) throw new Error(`Invalid research import: ${errors.join("; ")}`);
}
