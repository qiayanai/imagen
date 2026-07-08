import type { Locale } from "@/lib/i18n";

export const siteConfig = {
  name: "Imagen",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@imagen.chat",
  apiBaseUrl: (process.env.NEXT_PUBLIC_DOCS_API_BASE_URL || "https://api.imagen.chat").replace(/\/+$/, ""),
  description:
    "AI image generation credits for product visuals, marketing assets, and developer workflows.",
};

export type PricingPlanId = "starter" | "plus" | "pro" | "studio";

export type PricingPlan = {
  id: PricingPlanId;
  price: string;
  checkoutUrl: string;
  featured?: boolean;
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    price: "$19",
    checkoutUrl: process.env.NEXT_PUBLIC_CREEM_STARTER_URL || "/client/",
  },
  {
    id: "plus",
    price: "$49",
    checkoutUrl: process.env.NEXT_PUBLIC_CREEM_PLUS_URL || "/client/",
    featured: true,
  },
  {
    id: "pro",
    price: "$99",
    checkoutUrl: process.env.NEXT_PUBLIC_CREEM_PRO_URL || "/client/",
  },
  {
    id: "studio",
    price: "$299",
    checkoutUrl: process.env.NEXT_PUBLIC_CREEM_STUDIO_URL || "/client/",
  },
];

export const siteCopy = {
  en: {
    nav: {
      library: "Library",
      pricing: "Pricing",
      docs: "API Docs",
      console: "Console",
      admin: "Admin",
    },
    footer: {
      body:
        "AI-generated images must be used responsibly. Imagen applies content rules, usage limits, and account review to protect creators, customers, and the public.",
      contact: "Contact",
      links: {
        library: "Library",
        pricing: "Pricing",
        docs: "API Docs",
        terms: "Terms",
        privacy: "Privacy",
        refund: "Refunds",
        contentPolicy: "Content Policy",
      },
    },
    pricingPlans: {
      starter: {
        name: "Starter",
        credits: "200 credits",
        description: "For first tests, light product visuals, and prompt exploration.",
        highlights: ["One-time credit pack", "Hosted image results", "Standard support"],
      },
      plus: {
        name: "Plus",
        credits: "650 credits",
        description: "For regular creators and ecommerce teams producing campaign assets.",
        highlights: ["Better effective rate", "Batch task queue", "API key access"],
      },
      pro: {
        name: "Pro",
        credits: "1,600 credits",
        description: "For teams generating product images, ad variants, and social visuals.",
        highlights: ["Team-ready quota", "Higher batch volume", "Priority issue review"],
      },
      studio: {
        name: "Studio",
        credits: "6,000 credits",
        description: "For studios and agencies that need a larger recurring production pool.",
        highlights: ["Largest credit bundle", "Workflow onboarding", "Custom quota review"],
      },
    },
    pricingCard: {
      popular: "Popular",
      buy: "Buy credits",
    },
    home: {
      badge: "AI image generation for creators and teams",
      title: "Generate production-ready visuals with credits and API access.",
      intro:
        "Imagen helps ecommerce, marketing, and developer teams create AI-generated product images, ad concepts, and social visuals through a web console or API workflow.",
      viewPricing: "View pricing",
      browseLibrary: "Browse library",
      openConsole: "Open console",
      trust: ["One-time credit packs", "Responsible content policy", "Hosted image outputs"],
      sampleLabel: "AI-generated sample",
      sampleMeta: "1024 x 1024 PNG",
      queuedApi: "Queued API",
      capabilitiesEyebrow: "Capabilities",
      capabilitiesTitle: "A safer way to turn image generation into a service",
      capabilitiesBody:
        "Use the web console to test prompts, or connect another service through API keys with quota, task history, and hosted results.",
      capabilities: [
        {
          title: "Image generation credits",
          description:
            "Purchase one-time credit packs and use them for product visuals, campaign variants, and social media imagery.",
        },
        {
          title: "API key management",
          description:
            "Create separate keys for apps, teams, or environments, then manage quota and concurrency for each key.",
        },
        {
          title: "Batch task queue",
          description:
            "Submit single or batch jobs, let the service process them in the background, and poll status until results are ready.",
        },
        {
          title: "Hosted image results",
          description:
            "Generated images are stored and returned as accessible URLs for CMS, automation workflows, or internal business tools.",
        },
      ],
      pricingEyebrow: "Pricing",
      pricingTitle: "Start with one-time credit packs",
      pricingBody:
        "No subscription is required for the first version. Credits are consumed by generation quality, image count, and workflow type.",
      comparePlans: "Compare plans",
      responsibleEyebrow: "Responsible use",
      responsibleTitle: "Clear rules for generated content",
      responsibleBody:
        "Imagen is designed for commercial visuals, ecommerce content, creative exploration, and developer workflows. We prohibit unsafe, deceptive, infringing, and illegal content.",
      readPolicy: "Read content policy",
      prohibited: [
        "Adult sexual content, non-consensual intimate imagery, or sexual content involving minors.",
        "Impersonation, misleading identity claims, deceptive political content, or fraud.",
        "Copyright, trademark, privacy, or publicity-rights infringement.",
        "Graphic violence, hate, harassment, illegal activity, or regulated professional deception.",
      ],
      apiEyebrow: "API access",
      apiTitle: "Built for service-to-service workflows",
      apiBody:
        "Your app only needs an API key. Submit a task, poll its status, then read completed image URLs from output_urls.",
      examplePrompt: "A clean studio product image",
    },
    pricingPage: {
      eyebrow: "Pricing",
      title: "Simple one-time credit packs",
      intro:
        "Buy credits when you need them. Credits are consumed based on generation settings, requested image count, and workflow type. No subscription is required for the MVP.",
      notes: [
        {
          title: "Responsible content",
          body:
            "Generated content must follow our Content Policy. We may review prompts, outputs, and accounts for safety and abuse prevention.",
        },
        {
          title: "Refunds",
          body:
            "Unused credit purchases may be eligible for refund within 7 days. Consumed credits and suspended abuse cases are not refundable.",
        },
        {
          title: "AI-generated notice",
          body:
            "Users are responsible for labeling, reviewing, and using generated images according to applicable laws and platform rules.",
        },
      ],
    },
    legal: {
      lastUpdated: "Last updated: July 6, 2026",
      terms: {
        title: "Terms of Service",
        intro:
          "These Terms govern access to Imagen, including the web console, API, credits, hosted image results, and related services.",
        sections: [
          {
            title: "1. Service",
            body: [
              "Imagen provides AI image generation workflows for creators, ecommerce sellers, marketing teams, and developers. The service may include a web console, API keys, quota controls, task queues, hosted output URLs, and account management tools.",
              "Generated results can vary. Imagen does not guarantee that any output will be accurate, unique, non-infringing, suitable for a specific marketplace, or accepted by any advertising, ecommerce, or social platform.",
            ],
          },
          {
            title: "2. Accounts and API keys",
            body: [
              "You are responsible for maintaining the confidentiality of your Google account, API keys, and account credentials. Any activity performed through your account or keys is your responsibility.",
              "We may suspend, rotate, throttle, or revoke access if we detect abuse, excessive failures, suspected compromise, payment issues, or use that violates these Terms or our Content Policy.",
            ],
          },
          {
            title: "3. Credits and payments",
            body: [
              "Credits are prepaid units used to request image generation workflows. Credit consumption may depend on generation quality, image count, model routing, reference images, editing workflow, retries, or other settings shown in the product.",
              "Payments may be processed by a Merchant of Record or third-party payment provider. The payment provider may appear as the seller on receipts, invoices, or bank statements and may handle tax, payment disputes, and chargebacks.",
            ],
          },
          {
            title: "4. User content and generated content",
            body: [
              "You represent that you have the necessary rights to submit prompts, images, references, product photos, logos, trademarks, and other materials to the service.",
              "You are responsible for reviewing generated content before publication or commercial use. You must not use Imagen to create content that violates laws, third-party rights, platform policies, or our Content Policy.",
            ],
          },
          {
            title: "5. Contact",
            body: [
              `Questions about these Terms can be sent to ${siteConfig.supportEmail}. We may update these Terms as the service evolves.`,
            ],
          },
        ],
      },
      privacy: {
        title: "Privacy Policy",
        intro:
          "This Privacy Policy explains what data Imagen may collect, how it is used, and how users can contact us about privacy requests.",
        sections: [
          {
            title: "1. Information we collect",
            body: [
              "We may collect account information such as email address, access credentials, API key metadata, customer identifiers, usage quota, payment status, and support messages.",
              "We may collect service content such as prompts, generation settings, reference images, generated image URLs, task status, error messages, and output metadata to provide and improve the service.",
            ],
          },
          {
            title: "2. Payment information",
            body: [
              "Payments are processed by third-party payment providers or a Merchant of Record. Imagen does not store full payment card numbers. Payment providers may collect payment details, billing information, tax details, and fraud-prevention signals under their own policies.",
            ],
          },
          {
            title: "3. How we use information",
            body: [
              "We use information to provide image generation services, manage credits and quota, process orders, prevent abuse, enforce policies, debug failures, provide support, improve reliability, and comply with legal or payment obligations.",
              `Users can request deletion or access by contacting ${siteConfig.supportEmail}. Some records may be retained where required for legal, tax, payment, security, or abuse-prevention reasons.`,
            ],
          },
        ],
      },
      refund: {
        title: "Refund Policy",
        intro: "This policy explains how refunds work for one-time credit purchases and failed payments.",
        sections: [
          {
            title: "1. One-time credit purchases",
            body: [
              "Imagen sells prepaid credits. Credits are added to the customer account after successful payment confirmation from the payment provider or Merchant of Record.",
              "Unused credit purchases may be eligible for refund within 7 days of purchase. A purchase is considered used once credits have been consumed for generation tasks, API calls, batch jobs, editing workflows, or other service usage.",
            ],
          },
          {
            title: "2. Non-refundable cases",
            body: [
              "Consumed credits are not refundable. Failed generation tasks do not consume credits, and partial outputs consume only the images that were successfully delivered.",
              "Purchases connected to abuse, policy violations, prohibited content, chargeback fraud, account compromise caused by user negligence, or attempts to bypass safety controls are not refundable.",
            ],
          },
          {
            title: "3. How to request a refund",
            body: [
              `Send refund requests to ${siteConfig.supportEmail}. Include your order email, receipt ID, product purchased, reason for the request, and any relevant screenshots.`,
            ],
          },
        ],
      },
      contentPolicy: {
        title: "Content Policy",
        intro:
          "Imagen is intended for lawful creative, ecommerce, marketing, and developer workflows. These rules apply to prompts, reference images, generated images, metadata, and API usage.",
        sections: [
          {
            title: "1. Allowed use",
            body: [
              "Imagen may be used to create product visuals, lifestyle images, ad concepts, social media assets, internal mockups, design variations, and developer workflow outputs.",
              "Users must review all outputs before publication and must comply with laws, marketplace rules, advertising standards, and third-party rights.",
            ],
          },
          {
            title: "2. Sexual and exploitative content",
            body: [
              "Do not create adult sexual content, pornography, non-consensual intimate imagery, sexualized public figures, sexual content involving minors, or content that exploits, endangers, or targets children.",
            ],
          },
          {
            title: "3. Deception, impersonation, and fraud",
            body: [
              "Do not create misleading identity documents, fake receipts, phishing materials, scam ads, counterfeit product listings, deceptive endorsements, fake news imagery, or content designed to mislead people about a real event or person.",
              "Do not impersonate private individuals, public figures, brands, platforms, government agencies, financial institutions, or medical professionals in a deceptive way.",
            ],
          },
          {
            title: "4. Enforcement",
            body: [
              "We may block prompts, remove outputs, throttle accounts, suspend access, revoke API keys, deny refunds, or report abuse where we believe this policy has been violated.",
              `To report misuse, contact ${siteConfig.supportEmail} with the relevant account, task, URL, or transaction details.`,
            ],
          },
        ],
      },
    },
  },
  zh: {
    nav: {
      library: "素材库",
      pricing: "定价",
      docs: "API 文档",
      console: "控制台",
      admin: "管理",
    },
    footer: {
      body:
        "AI 生成图片需要负责任地使用。Imagen 通过内容规则、额度限制和账户审核保护创作者、客户和公众。",
      contact: "联系",
      links: {
        library: "素材库",
        pricing: "定价",
        docs: "API 文档",
        terms: "服务条款",
        privacy: "隐私政策",
        refund: "退款政策",
        contentPolicy: "内容政策",
      },
    },
    pricingPlans: {
      starter: {
        name: "Starter",
        credits: "200 credits",
        description: "适合初次测试、轻量产品图和提示词探索。",
        highlights: ["一次性点数包", "生成结果托管", "标准支持"],
      },
      plus: {
        name: "Plus",
        credits: "650 credits",
        description: "适合稳定产出营销素材的创作者、电商和小团队。",
        highlights: ["更优单价", "批量任务队列", "API Key 接入"],
      },
      pro: {
        name: "Pro",
        credits: "1,600 credits",
        description: "适合持续生成商品图、广告变体和社媒视觉的团队。",
        highlights: ["团队额度", "更高批量产能", "优先问题处理"],
      },
      studio: {
        name: "Studio",
        credits: "6,000 credits",
        description: "适合需要更大生产池的工作室和代理商。",
        highlights: ["最大点数包", "工作流上手支持", "自定义额度评估"],
      },
    },
    pricingCard: {
      popular: "推荐",
      buy: "购买点数",
    },
    home: {
      badge: "面向创作者和团队的 AI 生图服务",
      title: "用点数和 API 生成可用于生产的视觉素材。",
      intro:
        "Imagen 帮助电商、营销和开发团队通过网页控制台或 API 工作流创建 AI 商品图、广告概念图和社媒视觉素材。",
      viewPricing: "查看定价",
      browseLibrary: "浏览素材库",
      openConsole: "打开控制台",
      trust: ["一次性点数包", "负责任的内容政策", "生成图片托管"],
      sampleLabel: "AI 生成样图",
      sampleMeta: "1024 x 1024 PNG",
      queuedApi: "队列 API",
      capabilitiesEyebrow: "能力",
      capabilitiesTitle: "把生图能力做成更稳定、更安全的服务",
      capabilitiesBody:
        "你可以在网页控制台测试提示词，也可以通过 API Key、额度、任务记录和托管结果接入自己的业务系统。",
      capabilities: [
        {
          title: "生图点数",
          description: "购买一次性点数包，用于商品图、活动变体和社媒图片等视觉素材生产。",
        },
        {
          title: "API Key 管理",
          description: "为应用、团队或环境创建独立 Key，并分别管理额度和并发。",
        },
        {
          title: "批量任务队列",
          description: "提交单个或批量任务，由后台排队生成，完成后轮询状态和结果。",
        },
        {
          title: "图片结果托管",
          description: "生成图片会被存储并返回可访问 URL，方便接入 CMS、自动化流程或内部系统。",
        },
      ],
      pricingEyebrow: "定价",
      pricingTitle: "从一次性点数包开始",
      pricingBody: "首版不需要订阅。点数消耗取决于生成质量、图片数量和工作流类型。",
      comparePlans: "对比套餐",
      responsibleEyebrow: "负责任使用",
      responsibleTitle: "清晰的生成内容规则",
      responsibleBody:
        "Imagen 面向商业视觉、电商内容、创意探索和开发工作流。我们禁止不安全、欺骗性、侵权和违法内容。",
      readPolicy: "查看内容政策",
      prohibited: [
        "成人色情内容、未经同意的私密图像或涉及未成年人的性内容。",
        "冒充、误导身份声明、欺骗性政治内容或欺诈。",
        "侵犯版权、商标、隐私权或肖像/公开权。",
        "血腥暴力、仇恨、骚扰、违法活动或受监管领域的欺骗性内容。",
      ],
      apiEyebrow: "API 接入",
      apiTitle: "适合服务到服务的工作流",
      apiBody: "你的应用只需要 API Key。提交任务、轮询状态，然后从 output_urls 获取完成后的图片地址。",
      examplePrompt: "一张干净的棚拍产品图",
    },
    pricingPage: {
      eyebrow: "定价",
      title: "简单的一次性点数包",
      intro:
        "需要时再购买点数。点数消耗取决于生成参数、请求图片数量和工作流类型。MVP 阶段不强制订阅。",
      notes: [
        {
          title: "负责任内容",
          body: "生成内容必须遵守我们的内容政策。我们可能为了安全和防滥用审查提示词、输出和账户。",
        },
        {
          title: "退款",
          body: "未使用的点数购买可在 7 天内申请退款。已消耗点数和因滥用被暂停的账户不支持退款。",
        },
        {
          title: "AI 生成标识",
          body: "用户需要根据适用法律和平台规则，对生成图片进行审查、标识和使用。",
        },
      ],
    },
    legal: {
      lastUpdated: "最后更新：2026 年 7 月 6 日",
      terms: {
        title: "服务条款",
        intro: "本条款适用于 Imagen 的网页控制台、API、点数、托管图片结果和相关服务。",
        sections: [
          {
            title: "1. 服务",
            body: [
              "Imagen 为创作者、电商卖家、营销团队和开发者提供 AI 图片生成工作流。服务可能包括网页控制台、API Key、额度控制、任务队列、托管结果 URL 和账户管理工具。",
              "生成结果可能存在差异。Imagen 不保证任何输出准确、唯一、不侵权、适合特定平台或会被广告、电商、社交平台接受。",
            ],
          },
          {
            title: "2. 账户和 API Key",
            body: [
              "你需要妥善保管 Google 账户、API Key 和账户凭证。通过你的账户或 Key 发起的活动由你负责。",
              "如果我们发现滥用、异常失败、疑似泄露、支付问题或违反条款/内容政策的行为，可能暂停、限速、轮换或撤销访问权限。",
            ],
          },
          {
            title: "3. 点数和支付",
            body: [
              "点数是用于请求图片生成工作流的预付单位。点数消耗可能取决于生成质量、图片数量、模型路由、参考图、编辑工作流、重试和其他产品内展示的设置。",
              "支付可能由 Merchant of Record 或第三方支付服务商处理。支付服务商可能作为收据、发票或银行账单上的销售方，并处理税务、支付争议和拒付。",
            ],
          },
          {
            title: "4. 用户内容和生成内容",
            body: [
              "你确认你有权提交提示词、图片、参考图、产品照片、Logo、商标和其他材料。",
              "发布或商业使用生成内容前，你需要自行审查。不得使用 Imagen 创建违反法律、第三方权利、平台政策或内容政策的内容。",
            ],
          },
          {
            title: "5. 联系",
            body: [`如对本条款有疑问，请联系 ${siteConfig.supportEmail}。我们可能随服务变化更新本条款。`],
          },
        ],
      },
      privacy: {
        title: "隐私政策",
        intro: "本隐私政策说明 Imagen 可能收集哪些数据、如何使用，以及用户如何联系我们处理隐私请求。",
        sections: [
          {
            title: "1. 我们收集的信息",
            body: [
              "我们可能收集账户信息，例如邮箱、访问凭证、API Key 元数据、客户标识、用量额度、支付状态和支持消息。",
              "我们可能收集服务内容，例如提示词、生成设置、参考图、生成图片 URL、任务状态、错误信息和输出元数据，用于提供和改进服务。",
            ],
          },
          {
            title: "2. 支付信息",
            body: [
              "支付由第三方支付服务商或 Merchant of Record 处理。Imagen 不存储完整银行卡号。支付服务商可能根据其自身政策收集支付详情、账单信息、税务信息和反欺诈信号。",
            ],
          },
          {
            title: "3. 信息使用",
            body: [
              "我们使用信息提供图片生成服务、管理点数和额度、处理订单、防止滥用、执行政策、排查失败、提供支持、提高可靠性并履行法律或支付义务。",
              `用户可以通过 ${siteConfig.supportEmail} 请求访问或删除数据。出于法律、税务、支付、安全或防滥用原因，部分记录可能需要保留。`,
            ],
          },
        ],
      },
      refund: {
        title: "退款政策",
        intro: "本政策说明一次性点数购买和失败支付的退款规则。",
        sections: [
          {
            title: "1. 一次性点数购买",
            body: [
              "Imagen 销售预付点数。支付服务商或 Merchant of Record 确认支付成功后，点数会加入客户账户。",
              "未使用的点数购买可在购买后 7 天内申请退款。一旦点数被用于生成任务、API 调用、批量任务、编辑工作流或其他服务使用，即视为已使用。",
            ],
          },
          {
            title: "2. 不支持退款的情况",
            body: [
              "已消耗点数不支持退款。生成失败的任务不消耗点数；部分成功的任务只按实际交付图片数消耗点数。",
              "与滥用、政策违规、禁止内容、拒付欺诈、用户疏忽导致的账户泄露或绕过安全控制相关的购买不支持退款。",
            ],
          },
          {
            title: "3. 如何申请退款",
            body: [`请发送退款请求至 ${siteConfig.supportEmail}，并提供订单邮箱、收据 ID、购买产品、退款原因和相关截图。`],
          },
        ],
      },
      contentPolicy: {
        title: "内容政策",
        intro: "Imagen 面向合法的创意、电商、营销和开发工作流。本规则适用于提示词、参考图、生成图片、元数据和 API 使用。",
        sections: [
          {
            title: "1. 允许用途",
            body: [
              "Imagen 可用于创建产品视觉、生活方式图、广告概念、社媒素材、内部 mockup、设计变体和开发工作流输出。",
              "用户在发布前必须审查所有输出，并遵守法律、平台规则、广告标准和第三方权利。",
            ],
          },
          {
            title: "2. 性和剥削性内容",
            body: ["不得创建成人色情、色情内容、未经同意的私密图像、性化公众人物、涉及未成年人的性内容，或剥削、危害、针对儿童的内容。"],
          },
          {
            title: "3. 欺骗、冒充和欺诈",
            body: [
              "不得创建误导性身份证件、假收据、钓鱼材料、诈骗广告、假冒商品列表、欺骗性背书、假新闻图片或设计用于误导他人对真实事件/人物认知的内容。",
              "不得以欺骗方式冒充私人、公众人物、品牌、平台、政府机构、金融机构或医疗专业人士。",
            ],
          },
          {
            title: "4. 执行",
            body: [
              "如果我们认为本政策被违反，可能拦截提示词、删除输出、限速账户、暂停访问、撤销 API Key、拒绝退款或报告滥用。",
              `如需举报滥用，请通过 ${siteConfig.supportEmail} 联系我们，并提供相关账户、任务、URL 或交易详情。`,
            ],
          },
        ],
      },
    },
  },
} satisfies Record<Locale, {
  nav: { library: string; pricing: string; docs: string; console: string; admin: string };
  footer: {
    body: string;
    contact: string;
    links: { library: string; pricing: string; docs: string; terms: string; privacy: string; refund: string; contentPolicy: string };
  };
  pricingPlans: Record<PricingPlanId, { name: string; credits: string; description: string; highlights: string[] }>;
  pricingCard: { popular: string; buy: string };
  home: {
    badge: string;
    title: string;
    intro: string;
    viewPricing: string;
    browseLibrary: string;
    openConsole: string;
    trust: string[];
    sampleLabel: string;
    sampleMeta: string;
    queuedApi: string;
    capabilitiesEyebrow: string;
    capabilitiesTitle: string;
    capabilitiesBody: string;
    capabilities: { title: string; description: string }[];
    pricingEyebrow: string;
    pricingTitle: string;
    pricingBody: string;
    comparePlans: string;
    responsibleEyebrow: string;
    responsibleTitle: string;
    responsibleBody: string;
    readPolicy: string;
    prohibited: string[];
    apiEyebrow: string;
    apiTitle: string;
    apiBody: string;
    examplePrompt: string;
  };
  pricingPage: {
    eyebrow: string;
    title: string;
    intro: string;
    notes: { title: string; body: string }[];
  };
  legal: Record<
    "terms" | "privacy" | "refund" | "contentPolicy",
    { title: string; intro: string; sections: { title: string; body: string[] }[] }
  > & { lastUpdated: string };
}>;

export type LegalPageKey = "terms" | "privacy" | "refund" | "contentPolicy";
