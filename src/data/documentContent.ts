import { primitives } from "./primitives";
import type { DocumentId, ProductPhase } from "../lib/types";

export type ProductCapability = {
  id: string;
  title: string;
  status: "observed" | "roadmap" | "internal_hypothesis";
  proof: string;
  acceptance: string;
};

export type ProductOffer = {
  id: string;
  label: string;
  buyer: string;
  problem: string;
  promise: string;
  pricingStatus: "internal_hypothesis" | "observed";
  phases: ProductPhase[];
  proofBeforeSale: string[];
  exclusions: string[];
  researchSourceIds: string[];
};

export type ProductDocumentContent = {
  kind: "product";
  capabilities: ProductCapability[];
  offers: ProductOffer[];
  commercialRules: string[];
};

export type ResearchSignal = {
  id: string;
  title: string;
  status: "research_signal" | "internal_hypothesis";
  observation: string;
  hypothesis: string;
  validationQuestion: string;
  sourceIds: string[];
};

export type SalesSequenceStep = {
  id: string;
  stage: string;
  objective: string;
  action: string;
  entryCriteria: string;
  exitCriteria: string;
};

export type OutreachTemplate = {
  id: string;
  label: string;
  channel: string;
  objective: string;
  body: string;
  variables: string[];
  guardrail: string;
};

export type SalesDocumentContent = {
  kind: "sales";
  targetCities: string[];
  qualificationRules: string[];
  disqualificationRules: string[];
  researchSignals: ResearchSignal[];
  sequence: SalesSequenceStep[];
  templates: OutreachTemplate[];
  guardrails: string[];
};

export type SystemDocumentContent = {
  kind: "system";
  operatingRules: string[];
  cadence: { title: string; owner: string; frequency: string; output: string }[];
};

export type OperatingDocumentContent = {
  kind: "operating";
  metrics: { label: string; formula: string; decisionUse: string }[];
  gates: { label: string; threshold: string; action: string }[];
};

export type UpsellDocumentContent = {
  kind: "upsell";
  triggers: { signal: string; nextOffer: string; requiredEvidence: string; stopRule: string }[];
  reviewQuestions: string[];
};

export type PartnerDocumentContent = {
  kind: "partner";
  stages: { stage: string; partnerGets: string; codeForgeOwns: string; proof: string }[];
  guardrails: string[];
};

export type DocumentContent =
  | ProductDocumentContent
  | SalesDocumentContent
  | SystemDocumentContent
  | OperatingDocumentContent
  | UpsellDocumentContent
  | PartnerDocumentContent;

const productOffer = (
  id: string,
  buyer: string,
  problem: string,
  promise: string,
  proofBeforeSale: string[],
  exclusions: string[],
  researchSourceIds: string[],
): ProductOffer => {
  const product = primitives.products[id];
  return {
    id,
    label: product.label,
    buyer,
    problem,
    promise,
    pricingStatus: product.pricing_status ?? "internal_hypothesis",
    phases: product.phases.map((phase) => ({ ...phase })),
    proofBeforeSale,
    exclusions,
    researchSourceIds,
  };
};

const whiteLabelCities = primitives.white_label_research.directory_observations.map((item) => item.city);
const whiteLabelDirectorySourceIds = primitives.white_label_research.directory_observations.map((item) => item.source_id);
const marmeladPriceSource = primitives.public_price_observations.find((item) => item.id === "price_marmelad_multisite_start");

export const documentContent: Record<DocumentId, DocumentContent> = {
  "ai-os": {
    kind: "system",
    operatingRules: [
      "Наблюдение, гипотеза, расчет и решение должны быть разделены явно.",
      "Каждое числовое утверждение получает primitivePath или ссылку на источник.",
      "Статусы partial, conflict и stale остаются видимыми и не превращаются в verified автоматически.",
      "Любой новый research pass добавляет версию наблюдения, а не молча заменяет старую цифру.",
    ],
    cadence: [
      { title: "Evidence review", owner: "Founder", frequency: "еженедельно", output: "Статусы новых источников и список конфликтов" },
      { title: "Pipeline review", owner: "Sales", frequency: "еженедельно", output: "Следующее действие по каждой P1-компании" },
      { title: "Decision review", owner: "Founder", frequency: "после каждого пилота", output: "Обновленный verdict и список доказательств" },
    ],
  },
  "operating-model": {
    kind: "operating",
    metrics: [
      { label: "Fully-loaded CAC", formula: "cash cost лида / funnel rate + sales hours × hourly rate", decisionUse: "Не масштабировать канал, если время основателя не учтено." },
      { label: "Project margin", formula: "project price − delivery hours × labor rate − variable costs", decisionUse: "Остановить фазу, если продажа не оплачивает delivery." },
      { label: "Recurring contribution", formula: "MRR × gross margin − support/infrastructure costs", decisionUse: "Проверять, действительно ли подписка покрывает сопровождение." },
      { label: "Delivery load", formula: "planned delivery hours / available delivery hours", decisionUse: "Не принимать pipeline поверх capacity без изменения цены или состава команды." },
    ],
    gates: [
      { label: "LTV / CAC", threshold: "Порог из decision_thresholds", action: "Считать сценарий условным до появления фактических конверсий." },
      { label: "Payback", threshold: "Порог из decision_thresholds", action: "Сверить cash cycle и условия оплаты до предложения." },
      { label: "Scenario evidence", threshold: "Минимальное покрытие сценария", action: "Заменить internal hypothesis фактическими данными пилотов." },
    ],
  },
  "product-knowledge-base": {
    kind: "product",
    capabilities: [
      { id: "crm", title: "CRM / Companies", status: "observed", proof: "Рабочий экран компаний, сегмент, город, стадия, приоритет, заметки и активности.", acceptance: "Новая компания сохраняется и появляется в pipeline без ручного редактирования кода." },
      { id: "evidence", title: "Verification layer", status: "observed", proof: "Evidence хранит URL, дату наблюдения, тип источника, confidence и статус.", acceptance: "Непроверенная карточка не считается trusted fact и имеет следующее действие." },
      { id: "scenarios", title: "Scenario engine", status: "observed", proof: "Три сценария рассчитываются из primitives.json и сохраняют историю запусков.", acceptance: "Любое число в UI имеет понятное расчетное правило или статус internal hypothesis." },
      { id: "decision", title: "Decision Center", status: "observed", proof: "LTV/CAC, payback, capacity и verified evidence собраны в единый verdict.", acceptance: "NO-GO/CONDITIONAL GO показывает блокеры и следующий проверяемый шаг." },
      { id: "research-import", title: "Safe research import", status: "observed", proof: "Импорт 2ГИС/VK принимает уже полученный официальный JSON и сохраняет запись partial.", acceptance: "Ключи не попадают во frontend, сырой импорт не меняет trusted primitives автоматически." },
      { id: "live-integrations", title: "Live API fetch / payments", status: "roadmap", proof: "В текущем local-demo режиме live-вызовы и платежи не включены.", acceptance: "Добавлять только после серверного адаптера, credentials и теста разрешенного scope." },
    ],
    offers: [
      productOffer(
        "self_storage",
        "Оператор self-storage с публичной воронкой, тарифами и ручной обработкой заявок.",
        "Публичные наблюдения GBOX, Складовки72 и Твой Склад показывают разные форматы и цены; единого доказанного benchmark по Уралу нет.",
        "Начать с аудита и прозрачного калькулятора, затем связать заявку, CRM и повторную оплату. Uplift не обещается без baseline.",
        ["Снять текущую воронку: источник лида → расчет → договор → оплата.", "Зафиксировать единицы цены, площадь и промо отдельно.", "Получить 5–10 реальных заявок для baseline."],
        ["Не обещать occupancy или рост выручки из публичной цены.", "Не считать промо-тариф средней ценой города.", "Не включать автоматизацию до согласования процесса владельцем."],
        ["ss_gbox_ekb_2026", "ss_skladovka72_tyumen_2026", "ss_tvoysklad_perm_2026", "ss_tvoysklad_chelyabinsk_2026"],
      ),
      productOffer(
        "ooh",
        "Оператор или агентство OOH, которому нужно управлять адресной программой и продажами поверхностей.",
        "Отраслевые оценки рынка OOH существуют, но локальные цены, inventory и occupancy не сопоставимы без единого формата.",
        "Собрать каталог конструкций и процесс продажи так, чтобы адрес, формат, сторона, срок, печать и монтаж не смешивались.",
        ["Получить актуальную адресную программу и правила доступности.", "Разделить собственный inventory и агентское размещение.", "Сравнить одну и ту же поверхность в единой единице."],
        ["Не использовать 109,1/114,6 млрд ₽ как TAM продукта.", "Не превращать одну цену Supersite96 или stale-прайс в среднюю цену города.", "Не считать 2ГИС-рейтинг долей рынка."],
        ["ooh_outdoor_akar_2025", "ooh_outdoor_monitoring_2025", "ooh_supersite96_ekb_2026"],
      ),
      productOffer(
        "white_label",
        "Digital/web-студия, которая уже продает разработку и хочет закрывать delivery без раскрытия подрядчика клиенту.",
        "В пяти городах видна конкурентная выдача, но capacity, white-label условия и реальная потребность не опубликованы — это нужно подтвердить интервью.",
        "Предсказуемый handoff: discovery → оценка → разработка → QA → сдача студии. Это предложение, а не доказанный market fact.",
        ["Проверить 2–3 свежих проекта студии и узкое место delivery.", "Согласовать границы клиента, бренда и коммуникаций.", "Провести оплаченный discovery до платформенной фазы."],
        ["Не говорить «у вас точно не хватает разработчиков».", "Не обещать SLA, uptime или нулевой CAC без подписанного scope.", "Не продавать partner platform до повторяемого пилота."],
        ["2gis_white_label_ekb_2026", "2gis_white_label_tyumen_2026", "2gis_white_label_perm_2026", "2gis_white_label_chelyabinsk_2026", "2gis_white_label_surgut_2026", "wl_victory_ekb_2026", "wl_marmelad_2026"],
      ),
    ],
    commercialRules: [
      "Все цены, MRR и часы фаз берутся из primitives.products и имеют статус internal_hypothesis до оплаченного пилота.",
      "В коммерческом предложении разделять price, delivery cost, support и внешние сервисы.",
      "Перед продажей показывать capability, acceptance criterion и исключения из scope.",
      "После пилота обновлять часы, COGS, сроки и цену фактическими данными, а не ожиданиями команды.",
    ],
  },
  "sales-playbook": {
    kind: "sales",
    targetCities: whiteLabelCities,
    qualificationRules: [
      "Компания действительно продает разработку сайтов, digital или интеграции — подтверждается официальной страницей.",
      "Есть конкретный владелец проблемы: founder, head of production, account/director или technical lead.",
      "Есть живой проект, overflow или повторяющаяся delivery-проблема, а не только интерес к партнерству.",
      "Партнер готов обсуждать оплачиваемый discovery и критерий приемки.",
    ],
    disqualificationRules: [
      "Карточка 2ГИС без официального сайта и без подтвержденной услуги.",
      "Запрос только на бесплатную оценку, реселлинг без клиента или «пассивный доход».",
      "Невозможно определить, кто принимает решение и кто принимает работу.",
      "Ожидание, что CodeForge будет отвечать конечному клиенту без отдельного договора и цены поддержки.",
    ],
    researchSignals: [
      {
        id: "directory-noise",
        title: "Shortlist требует ручной квалификации",
        status: "research_signal",
        observation: `В выдаче 2ГИС по запросу «Разработка сайтов» есть по 12 видимых карточек в каждом из ${whiteLabelCities.length} выбранных городов, но notes прямо предупреждают о смеси агентств, IT-компаний, интеграторов и типографий.`,
        hypothesis: "Самая вероятная первая боль CodeForge — не отсутствие компаний, а стоимость отбора и проверки подходящих партнеров.",
        validationQuestion: "Сколько найденных проектов вы отсеиваете до разговора с production-владельцем и почему?",
        sourceIds: whiteLabelDirectorySourceIds,
      },
      {
        id: "capacity-not-public",
        title: "White-label capacity не видна снаружи",
        status: "research_signal",
        observation: "Публичные сайты подтверждают разработку и digital-услуги, но не раскрывают свободную capacity, правила работы с подрядчиком и partner economics.",
        hypothesis: "У студии может быть интерес к внешнему delivery, но это нельзя выводить из наличия сайта или рейтинга.",
        validationQuestion: "Какие типы проектов вы сейчас откладываете или отказываетесь брать из-за delivery-ограничений?",
        sourceIds: ["wl_victory_ekb_2026", "wl_marmelad_2026", "wl_yusmp_2026"],
      },
      {
        id: "price-anchor",
        title: "Публичная цена — только anchor",
        status: "research_signal",
        observation: marmeladPriceSource ? `${marmeladPriceSource.item}: ${marmeladPriceSource.price.toLocaleString("ru-RU")} ₽. Это стартовая цена конкретной студии, а не средний рынок.` : "Найдена публичная цена конкретной студии; условия проекта нужно квалифицировать.",
        hypothesis: "Цену CodeForge нужно обсуждать через scope, риск и delivery capacity, а не через сравнение с одной страницей «от». ",
        validationQuestion: "Какой scope и валовая маржа остаются у студии после передачи части delivery подрядчику?",
        sourceIds: marmeladPriceSource ? [marmeladPriceSource.source_id] : ["wl_marmelad_2026"],
      },
    ],
    sequence: [
      { id: "research", stage: "01 · Research", objective: "Найти конкретный сигнал, а не массово рассылать по каталогу.", action: "Открыть официальный сайт, карточку 2ГИС и 1–2 публичных услуги; записать наблюдение и источник в CRM.", entryCriteria: "Есть URL и город.", exitCriteria: "Понятно, почему компания может быть партнером и какой факт нужно проверить." },
      { id: "first-touch", stage: "02 · First touch", objective: "Получить ответ на один вопрос о delivery, не продавать платформу сразу.", action: "Отправить персонализированное сообщение с одним проверяемым наблюдением и вопросом о текущем процессе.", entryCriteria: "Есть конкретный факт из публичного источника.", exitCriteria: "Ответ получен или отправлено не более двух follow-up." },
      { id: "discovery", stage: "03 · Discovery", objective: "Посчитать стоимость проблемы и определить пилот.", action: "Разобрать текущий workflow, роли, сроки, COGS, коммуникации с клиентом и критерий приемки.", entryCriteria: "Есть owner проблемы и живой use case.", exitCriteria: "Есть письменный scope, цена discovery и дата решения." },
      { id: "paid-pilot", stage: "04 · Paid pilot", objective: "Получить первое экономическое доказательство.", action: "Продать ограниченный discovery/architecture или embed-пилот с фиксированным acceptance criterion.", entryCriteria: "Подписан scope и есть оплата.", exitCriteria: "Пилот сдан, фактические часы/COGS/сроки записаны в CRM." },
      { id: "repeat", stage: "05 · Repeat", objective: "Проверить повторяемость, а не один удачный кейс.", action: "Предложить следующую фазу только после результата и обновить предложение из фактических данных.", entryCriteria: "Есть оплаченный результат и удовлетворенный partner owner.", exitCriteria: "Повторный заказ или явная причина отказа записаны как evidence." },
    ],
    templates: [
      {
        id: "first-touch",
        label: "Первое обращение",
        channel: "Email / Telegram / VK",
        objective: "Проверить наличие delivery-проблемы",
        body: "Здравствуйте!\n\nУвидел, что [Компания] в [Город] предлагает [Наблюдение]. Пишу не с массовым предложением: хочу проверить, как вы закрываете проекты, когда собственная команда занята или нужен отдельный технический контур.\n\nCodeForge собирает white-label delivery для студий: discovery, оценка, разработка и QA остаются за нами, а отношения с конечным клиентом — у студии.\n\nПодскажите, бывают ли у вас проекты, которые вы откладываете из-за delivery-ограничений? Если да, предложу короткий разговор по одному реальному кейсу.",
        variables: ["[Компания]", "[Город]", "[Наблюдение]"],
        guardrail: "Перед отправкой проверить факт по ссылке; не утверждать, что у компании уже есть проблема.",
      },
      {
        id: "discovery",
        label: "Приглашение на discovery",
        channel: "Email / call follow-up",
        objective: "Перевести интерес в конкретный кейс",
        body: "Спасибо за ответ! Предлагаю не обсуждать абстрактное партнерство, а взять один текущий проект. За 30 минут разберем: что обещано клиенту, где сейчас узкое место, какие роли нужны и какой результат будет считаться принятым.\n\nПосле разговора я верну письменный scope discovery с ценой, сроком и тем, что CodeForge не берет на себя. Если кейса нет — честно зафиксируем, что сейчас пилот не нужен.",
        variables: [],
        guardrail: "Не обещать экономию, скорость или SLA до фиксации scope.",
      },
      {
        id: "follow-up",
        label: "Короткий follow-up",
        channel: "Email / Telegram / VK",
        objective: "Закрыть петлю без давления",
        body: "Добрый день! Возвращаюсь к вопросу про delivery для [Компания]. Если сейчас overflow-задач нет, это нормальный ответ — я закрою контакт. Если есть один проект, где не хватает времени или узкой экспертизы, можно начать с проверки scope без обязательства переходить к платформе.",
        variables: ["[Компания]"],
        guardrail: "Не делать больше двух follow-up без нового факта или ответа.",
      },
    ],
    guardrails: [
      "2ГИС/VK — источники для поиска и персонализации, не доказательство потребности, бюджета или выручки.",
      "Публичная цена «от» не используется как средняя цена и не является аргументом «у вас должно быть дешевле». ",
      "Платный пилот, а не ответ на письмо, считается первым бизнес-доказательством.",
      "Каждый отказ классифицируется: нет боли, нет бюджета, нет owner, не подходит scope или timing.",
    ],
  },
  "upsell-matrix": {
    kind: "upsell",
    triggers: [
      { signal: "Повторяются ручные расчеты и заявки не доходят до оплаты", nextOffer: "self_storage / 3D-калькулятор объема", requiredEvidence: "Минимум 5 реальных заявок и текущий conversion baseline", stopRule: "Нет повторяющейся проблемы или отсутствует owner воронки" },
      { signal: "Каталог OOH ведется в таблицах и менеджер не знает доступность поверхности", nextOffer: "ooh / каталог инвентаря", requiredEvidence: "Актуальная адресная программа и владелец данных", stopRule: "Нет доступа к inventory или данные обновляются нерегулярно" },
      { signal: "Студия передает проекты вручную и теряет контроль над scope", nextOffer: "white_label / discovery и архитектура", requiredEvidence: "Один живой проект и согласованный handoff", stopRule: "Нет оплачиваемого use case или клиент должен общаться напрямую с CodeForge" },
    ],
    reviewQuestions: [
      "Какой baseline был до изменения?",
      "Какие часы и расходы появились после расширения?",
      "Кто владеет результатом со стороны клиента?",
      "Что является stop rule, если эффект не подтверждается?",
    ],
  },
  "white-label-playbook": {
    kind: "partner",
    stages: [
      { stage: "01 · Qualify", partnerGets: "Понимание формата партнерства и границ клиента.", codeForgeOwns: "Проверку fit, scope и доступной capacity.", proof: "Официальный сайт, owner проблемы и реальный use case." },
      { stage: "02 · Discovery", partnerGets: "Письменную оценку и понятный следующий шаг.", codeForgeOwns: "Архитектуру, список рисков и acceptance criterion.", proof: "Оплаченный discovery или явно зафиксированная причина отказа." },
      { stage: "03 · Delivery", partnerGets: "Результат под своим брендом и прозрачный handoff.", codeForgeOwns: "Разработку, QA, техническую документацию и 2-ю линию.", proof: "Сданный scope, фактические часы и журнал изменений." },
      { stage: "04 · Repeat", partnerGets: "Повторяемый процесс и возможность расширения.", codeForgeOwns: "Обновление цены, COGS, сроков и support capacity.", proof: "Повторный оплаченный заказ, а не обещание pipeline." },
    ],
    guardrails: [
      "Студия остается владельцем отношений с конечным клиентом только если это отражено в договоре и процессе коммуникаций.",
      "SLA, uptime, сроки и компенсации не переносятся из старых HTML в предложение без действующей инфраструктуры и договора.",
      "Партнерский канал не имеет нулевого CAC: учитываются research, onboarding, enablement и support.",
      "Масштабирование начинается после повторяемой оплаченной поставки, а не после количества подписанных партнеров.",
    ],
  },
};

export function getDocumentContent(documentId: DocumentId): DocumentContent {
  return documentContent[documentId];
}
