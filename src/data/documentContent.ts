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

export type OperatingStage = {
  id: string;
  number: string;
  name: string;
  owner: string;
  purpose: string;
  entryCriteria: string[];
  checklist: string[];
  artifacts: string[];
  exitCriteria: string[];
  stopConditions: string[];
  escalation: string;
};

export type SystemDecisionRule = {
  signal: string;
  action: string;
  owner: string;
  handoff: string;
};

export type SystemDocumentContent = {
  kind: "system";
  mission: string;
  nonNegotiables: string[];
  operatingRules: string[];
  stages: OperatingStage[];
  decisionRules: SystemDecisionRule[];
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

const whiteLabelResearch = primitives.white_label_research;
const whiteLabelCities = whiteLabelResearch.directory_observations.map((item) => item.city);
const whiteLabelDirectorySourceIds = whiteLabelResearch.directory_observations.map((item) => item.source_id);
const whiteLabelMicroSourceIds = whiteLabelResearch.micro_sources.map((item) => item.id);
const whiteLabelMicroCandidates = whiteLabelResearch.micro_candidates;
const microCandidateCities = [...new Set(whiteLabelMicroCandidates.map((item) => item.city))];

export const documentContent: Record<DocumentId, DocumentContent> = {
  "ai-os": {
    kind: "system",
    mission: "Провести каждую компанию и каждый проект CodeForge от первого сигнала до результата по одному воспроизводимому процессу: один владелец, один следующий шаг, один проверяемый выход этапа.",
    nonNegotiables: [
      "Любая работа начинается с записи в CRM: компания, сегмент, стадия, владелец и следующее действие.",
      "Сотрудник не переводит запись на следующий этап без критериев выхода и зафиксированного артефакта.",
      "Факт, гипотеза, расчет и решение маркируются раздельно; непроверенное нельзя выдавать за обещание клиенту.",
      "У каждого handoff есть письменный контекст: что сделано, что принято, что блокирует и кто следующий владелец.",
      "Если нет следующего действия или даты пересмотра, запись считается остановленной и попадает на разбор руководителю контура.",
    ],
    operatingRules: [
      "Наблюдение, гипотеза, расчет и решение должны быть разделены явно.",
      "Каждое числовое утверждение получает primitivePath или ссылку на источник.",
      "Статусы partial, conflict и stale остаются видимыми и не превращаются в verified автоматически.",
      "Любой новый research pass добавляет версию наблюдения, а не молча заменяет старую цифру.",
      "Любой запрос клиента сначала превращается в scope и критерий приемки, затем в оценку и предложение.",
    ],
    stages: [
      {
        id: "intake",
        number: "01",
        name: "Прием и классификация",
        owner: "Sales / Research",
        purpose: "Понять, с чем мы имеем дело, и не тратить delivery на неподходящий контакт.",
        entryCriteria: ["Есть публичный сигнал, входящий запрос или рекомендация.", "Понятно, кто принес запись и когда."],
        checklist: ["Создать или найти компанию в CRM; убрать дубль.", "Выбрать сегмент, город, тип контакта и приоритет.", "Сохранить первичный URL/источник и дату наблюдения.", "Сформулировать одну рабочую гипотезу проблемы без утверждения, что она уже доказана."],
        artifacts: ["Карточка компании", "Первичное evidence", "Следующее действие с владельцем"],
        exitCriteria: ["Карточка идентифицируема.", "Назначен владелец и конкретный следующий шаг.", "Понятно, какой факт нужно проверить первым."],
        stopConditions: ["Дубль или несуществующая компания.", "Нет источника и невозможно объяснить, почему контакт релевантен.", "Сигнал относится к крупному/нерелевантному профилю и не проходит ICP."],
        escalation: "Sales lead закрывает дубль/нерелевантную запись; спорную квалификацию передает Founder с ссылкой на evidence.",
      },
      {
        id: "qualification",
        number: "02",
        name: "Проверка fit и проблемы",
        owner: "Sales",
        purpose: "Отделить потенциального клиента или партнера от просто найденной компании.",
        entryCriteria: ["Карточка заполнена и есть первичный источник.", "Определен предполагаемый владелец проблемы."],
        checklist: ["Проверить юридическое/брендовое имя, город и официальный канал.", "Проверить ICP: размер, тип работы, технический разрыв и актуальность.", "Зафиксировать минимум один факт и одну гипотезу отдельными полями.", "Поставить статус данных: verified, in_review, conflict или stale.", "Создать задачу на первый контакт или закрытие с причиной."],
        artifacts: ["Квалификационная заметка", "Ссылки на источники", "Решение qualify / disqualify"],
        exitCriteria: ["Компания либо квалифицирована с обоснованием, либо закрыта с кодом причины.", "Для qualify определены контактный канал и вопрос discovery."],
        stopConditions: ["Нет идентифицированного человека или актуальной услуги.", "Компания имеет собственную релевантную backend-команду для white-label.", "Источник только сниппет/категория без возможности ручной проверки."],
        escalation: "Если fit неясен, не отправлять коммерческое сообщение: поставить in_review и вынести на ближайший pipeline review.",
      },
      {
        id: "first-contact",
        number: "03",
        name: "Первый контакт",
        owner: "Sales",
        purpose: "Проверить наличие реальной боли одним персональным вопросом, а не презентовать весь CodeForge.",
        entryCriteria: ["Есть конкретный проверяемый факт.", "Есть канал связи и персонализированный контекст."],
        checklist: ["Сослаться только на факт, который сотрудник открыл и проверил.", "Сформулировать один вопрос о текущем процессе или delivery-ограничении.", "Выбрать подходящий шаблон и адаптировать его под компанию.", "Записать отправленный текст, канал и дату в activity.", "Планировать не более двух follow-up без нового факта."],
        artifacts: ["Отправленное сообщение", "Activity с датой", "Запланированный follow-up"],
        exitCriteria: ["Получен ответ и назначен discovery, либо закрыта причина отсутствия интереса.", "Ответа нет — выполнен согласованный follow-up и запись не зависла без владельца."],
        stopConditions: ["Нельзя подтвердить персональный факт.", "Сообщение превращается в массовую рассылку или обещает неподтвержденный результат.", "Нет согласия на коммуникацию или есть явный отказ."],
        escalation: "Негативный ответ не переубеждать: классифицировать причину. Жалобу, конфликт бренда или правовой вопрос сразу передать Founder.",
      },
      {
        id: "discovery",
        number: "04",
        name: "Discovery и scoping",
        owner: "Sales + Delivery",
        purpose: "Превратить интерес в описанную проблему, границы работ и измеримый результат.",
        entryCriteria: ["Есть ответственный со стороны клиента.", "Есть живой use case, проект или повторяющаяся операция."],
        checklist: ["Разобрать текущий workflow от входа до результата.", "Зафиксировать роли, системы, ограничения и ручные обходы.", "Отделить must-have от nice-to-have и явно записать out of scope.", "Определить baseline и критерий приемки до оценки.", "Оценить риски, внешние зависимости, поддержку и способ handoff.", "Согласовать письменный summary discovery с клиентом."],
        artifacts: ["Discovery notes", "Scope / out of scope", "Acceptance criterion", "Решение о feasibility"],
        exitCriteria: ["Delivery подтверждает техническую реализуемость.", "Клиент подтверждает scope и критерий приемки.", "Можно рассчитать цену, сроки, COGS и ответственных без скрытых допущений."],
        stopConditions: ["Клиент не дает доступ к необходимому контексту.", "Нет измеримого результата или owner приемки.", "Scope растет быстрее, чем его можно проверить."],
        escalation: "Технический риск фиксируется Delivery lead; изменение обещаний, цены или границ после discovery требует согласования Founder.",
      },
      {
        id: "proposal",
        number: "05",
        name: "Предложение и договор",
        owner: "Founder / Sales",
        purpose: "Продать ограниченный, понятный и экономически защищенный следующий шаг.",
        entryCriteria: ["Discovery notes и acceptance criterion согласованы.", "Есть оценка часов, внешних расходов и ответственный delivery."],
        checklist: ["Собрать предложение из актуального продуктового каталога.", "Разделить цену, delivery cost, внешние сервисы, поддержку и допущения.", "Показать, что входит, не входит и как принимается результат.", "Не переносить рыночные гипотезы, старые HTML-цифры или roadmap в обещание.", "Получить письменное согласование scope, цены, сроков и коммуникаций.", "Создать в CRM activity с датой решения и следующим действием."],
        artifacts: ["Proposal / SOW", "Калькуляция", "Риски и допущения", "Согласованный следующий шаг"],
        exitCriteria: ["Есть подписанный scope и подтвержденный способ оплаты.", "Передача в delivery содержит полный контекст и не зависит от устных договоренностей."],
        stopConditions: ["Маржа/срок/нагрузка не проходят operating gates.", "Клиент просит гарантии, которых нет в Product Knowledge Base.", "Нет доступа к ЛПР или невозможно согласовать критерий приемки."],
        escalation: "Любое исключение из стандартного scope, цены, SLA или ответственности утверждает Founder до отправки клиенту.",
      },
      {
        id: "delivery",
        number: "06",
        name: "Delivery и приемка",
        owner: "Delivery",
        purpose: "Сдать согласованный результат, не превращая пилот в бесконтрольную разработку.",
        entryCriteria: ["Есть оплаченный scope и назначен delivery owner.", "Критерий приемки, доступы и зависимости доступны команде."],
        checklist: ["Разбить scope на задачи и зафиксировать порядок работ.", "Перед началом проверить доступы, данные, интеграции и точки риска.", "Вести журнал изменений и отклонений от scope.", "Регулярно показывать промежуточный результат владельцу приемки.", "Проверить QA, документацию и rollback/ручной fallback для критичного процесса.", "Получить письменную приемку или список конкретных замечаний."],
        artifacts: ["Delivery board", "Change log", "QA evidence", "Release / handoff note", "Acceptance record"],
        exitCriteria: ["Acceptance criterion выполнен или отклонение письменно согласовано.", "Фактические часы, COGS, сроки и риски внесены в CRM.", "Клиент понимает, как пользоваться результатом и куда обращаться."],
        stopConditions: ["Работа выходит за scope без change request.", "Нет данных/доступов для безопасной проверки.", "Критический дефект или риск данных не имеет владельца и плана."],
        escalation: "Блокер, влияющий на срок или приемку, эскалировать Delivery lead в тот же рабочий цикл; изменение коммерческих условий — Founder.",
      },
      {
        id: "close-learn",
        number: "07",
        name: "Закрытие, поддержка и обучение",
        owner: "Account / Founder",
        purpose: "Понять, что доказал проект, и решить: повторять, расширять или остановиться.",
        entryCriteria: ["Результат передан и есть acceptance record.", "Фактические данные проекта собраны."],
        checklist: ["Провести короткий review: результат против baseline.", "Зафиксировать фактическую маржу, часы, сроки, внешние расходы и support load.", "Собрать обратную связь клиента и причину любой неудовлетворенности.", "Определить следующий use case только при наличии сигнала и owner.", "Обновить CRM stage, evidence и decision note.", "При отсутствии repeat-сигнала закрыть проект без искусственного upsell."],
        artifacts: ["Post-pilot review", "Фактическая экономика", "Customer feedback", "Repeat / stop decision"],
        exitCriteria: ["Есть документированный результат и следующий коммерческий статус.", "Уроки попали в Product Knowledge Base, Sales Playbook или primitives только с правильным статусом."],
        stopConditions: ["Результат не измерен.", "Поддержка съедает маржу или не имеет владельца.", "Повторное предложение строится только на желании команды, а не на сигнале клиента."],
        escalation: "Системный дефект, повторяющийся в проектах, превращается в отдельную improvement-задачу и обсуждается на Decision review.",
      },
    ],
    decisionRules: [
      { signal: "Источник не подтвержден или содержит конфликт", action: "Оставить in_review/partial, не использовать в расчете и назначить ручную проверку.", owner: "Research", handoff: "Передать в Verification с URL, датой и формулировкой, что именно нужно проверить." },
      { signal: "У компании нет fit или owner проблемы", action: "Закрыть с причиной, не создавать активность ради числа в pipeline.", owner: "Sales", handoff: "Зафиксировать disqualification reason; повторно открыть только при новом сигнале." },
      { signal: "Scope нельзя принять в измеримых терминах", action: "Остановить оценку и вернуть запрос на discovery.", owner: "Delivery", handoff: "Sales получает список недостающих вводных и новый критерий готовности." },
      { signal: "Delivery load, маржа или риск не проходят gate", action: "Не обещать срок; изменить scope/цену/ресурс или отказаться.", owner: "Founder", handoff: "Operating Model получает фактические часы и причину отклонения." },
      { signal: "В delivery появляется работа вне согласованного scope", action: "Поставить работу на паузу до change request.", owner: "Delivery", handoff: "Sales/Founder согласуют влияние на цену, срок и приемку письменно." },
      { signal: "Пилот завершен, но repeat-сигнала нет", action: "Не делать upsell автоматически; закрыть learnings и ждать нового подтвержденного use case.", owner: "Account", handoff: "Добавить post-pilot evidence и обновить соответствующий playbook." },
    ],
    cadence: [
      { title: "Daily handoff check", owner: "Каждый владелец записи", frequency: "в начале рабочего цикла", output: "Следующее действие, блокер и статус каждой активной записи" },
      { title: "Pipeline review", owner: "Sales lead", frequency: "еженедельно", output: "Решение по каждой P1-компании: advance, hold или close" },
      { title: "Delivery / margin review", owner: "Delivery + Founder", frequency: "по каждому проекту и после сдачи", output: "Scope changes, фактические часы, COGS и риски" },
      { title: "Evidence review", owner: "Research / Founder", frequency: "еженедельно", output: "Статусы новых источников, конфликты и список ручных проверок" },
      { title: "Decision review", owner: "Founder", frequency: "после каждого пилота и при изменении ключевых входов", output: "Обновленный verdict, подтвержденные learnings и stop/go решение" },
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
        "Соло-дизайнер, фрилансер или micro-студия до примерно 3 человек, которая продает дизайн/Tilda/no-code, но не может закрыть backend, интеграции или технический delivery самостоятельно.",
        `В broad-выдаче 2ГИС много крупных и нерелевантных карточек; отдельный micro-pass нашел ${whiteLabelMicroCandidates.length} публичных кандидатов, но ни один еще не доказал спрос или capacity.`,
        "Предсказуемый скрытый delivery: CodeForge закрывает backend, интеграции, QA и техническую передачу, а дизайнер сохраняет отношения со своим клиентом. Это оффер для теста, не доказанный market fact.",
        ["Проверить один свежий дизайн-проект и конкретный технический пробел.", "Согласовать границы бренда, клиента, коммуникаций и handoff.", "Провести оплаченный discovery до любой разработки."],
        ["Не говорить «у вас точно не хватает разработчиков».", "Не обещать SLA, uptime, сроки или нулевой CAC без scope и договора.", "Не включать в target-list крупные агентства, интеграторов и студии с собственной backend-командой."],
        whiteLabelMicroSourceIds,
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
      "Публичный источник указывает конкретного дизайнера, фрилансера или micro-студию, а не крупное full-cycle агентство.",
      "Есть явный сигнал дизайна, Figma, Tilda, Taplink или no-code; backend/integration delivery не заявлен как собственная сильная сторона.",
      "Город входит в целевую пятерку, а источник и дата наблюдения сохранены в micro shortlist.",
      "Есть конкретный владелец проблемы и живой проект, overflow или повторяющаяся техническая задача.",
      "Партнер готов обсуждать оплачиваемый discovery, конфиденциальность и критерий приемки.",
    ],
    disqualificationRules: [
      "Публично заявлена большая команда разработки, enterprise-интеграции, собственный backend/mobile delivery или продуктовая IT-модель.",
      "Есть только карточка 2ГИС, общий marketplace-раздел, школа или вакансия — без идентифицированного исполнителя.",
      "Нет актуального портфолио/услуги или город подтверждается только неподтвержденным сниппетом.",
      "Запрос только на бесплатную оценку, реселлинг без клиента или «пассивный доход».",
      "Ожидание, что CodeForge будет общаться с конечным клиентом без отдельного договора и цены поддержки.",
    ],
    researchSignals: [
      {
        id: "directory-noise",
        title: "Broad 2ГИС выдача не является target-list",
        status: "research_signal",
        observation: `В публичном срезе 2ГИС по запросу «Разработка сайтов» видно по 12 карточек в каждом из ${whiteLabelCities.length} городов, но сами notes фиксируют смесь крупных агентств, IT-компаний, интеграторов, типографий и школ.`,
        hypothesis: "Первая операционная боль — стоимость ручного отбора: без micro-фильтра outreach будет адресован компаниям, которым CodeForge не нужен.",
        validationQuestion: "Какие карточки вы отсеиваете до первого сообщения как слишком крупные или технически самодостаточные?",
        sourceIds: whiteLabelDirectorySourceIds,
      },
      {
        id: "micro-cohort",
        title: "Micro-сигналы есть, но спрос еще не доказан",
        status: "research_signal",
        observation: `После отдельного фильтра найдено ${whiteLabelMicroCandidates.length} публичных кандидатов в ${microCandidateCities.length} городах: дизайнерские профили, Tilda/no-code и marketplace/social сигналы.`,
        hypothesis: "Для CodeForge может существовать узкая ниша «дизайн умею — технический delivery не закрываю», но это проверяется только разговором и оплачиваемым пилотом.",
        validationQuestion: "Какую часть последнего проекта вы не смогли сделать сами: backend, интеграцию, публикацию, QA или поддержку?",
        sourceIds: whiteLabelMicroSourceIds,
      },
      {
        id: "handoff-risk",
        title: "Боль — не «нужен сайт», а риск потерять клиента при handoff",
        status: "research_signal",
        observation: "В открытых профилях явно описаны дизайн, Tilda и no-code, но не видны backend, интеграции, QA и правила передачи работы.",
        hypothesis: "Наиболее правдоподобный wedge — невидимый технический delivery под брендом дизайнера, без принуждения к найму команды.",
        validationQuestion: "Что происходит, когда клиент просит форму, оплату, личный кабинет или интеграцию, которой нет в Tilda?",
        sourceIds: whiteLabelMicroSourceIds.slice(0, 6),
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
      { stage: "01 · Screen", partnerGets: "Разговор только о подходящем micro-профиле: дизайн, Tilda/no-code и технический пробел.", codeForgeOwns: "Отсев крупных агентств, интеграторов и неподтвержденных карточек.", proof: "Именованный публичный сигнал, город, дата и ручная проверка." },
      { stage: "02 · Discovery", partnerGets: "Письменную оценку конкретного клиентского проекта без обязательства строить платформу.", codeForgeOwns: "Архитектуру, список рисков, конфиденциальность и acceptance criterion.", proof: "Оплаченный discovery или явно зафиксированная причина отказа." },
      { stage: "03 · Hidden delivery", partnerGets: "Технический результат под своим брендом и контролируемый handoff.", codeForgeOwns: "Backend, интеграции, QA, техническую документацию и согласованную support-линию.", proof: "Сданный scope, фактические часы, журнал изменений и обратная связь дизайнера." },
      { stage: "04 · Repeat", partnerGets: "Повторяемый процесс для следующих клиентов без найма полной команды.", codeForgeOwns: "Обновление цены, COGS, сроков, capacity и partner economics.", proof: "Повторный оплаченный заказ, а не количество переписок или подписанных партнеров." },
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
