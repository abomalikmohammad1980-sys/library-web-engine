# Arabic translation quality benchmark: 36 target languages

Verified against provider documentation on 2026-09-24. **This is a benchmark plan and provisional routing matrix, not measured translation quality.** No provider credentials, reference corpus, blind human evaluations, or account-specific quota data are available in the repository. Do not treat listed priorities as proven winners.

## Evaluation protocol

For **each** of the 36 languages, collect at least 30 Arabic examples: 10 short interface labels, 10 bibliographic titles and author names, and 10 paragraphs from permitted library content. Include RTL/LTR punctuation, numbers, citations, Quran verse markers, honorifics and dialect/script distinctions. Use the same frozen prompts and input for each supported provider. Obtain two native-speaker blind ratings (adequacy 0–5, fluency 0–5), record critical errors separately (meaning reversal, fabricated quotation, altered names, missing sentence, changed verse marker), and resolve disagreements with a third reviewer. Record latency and cost only after the quality score. Reject any provider with critical errors for that language and task type. Reorder priorities separately for UI and paragraphs only after the language's reviewed results are committed. Never auto-publish unreviewed religious quotations.

## Capability and provisional priority matrix

✓ = source Arabic and target code listed, or explicitly part of the published core pair set; — = not verified for this exact pair. Workers AI means the **existing** M2M100/LLM fallback; model-level support and output quality still need testing. Alibaba publishes 214 pairs but confirms Arabic bidirectionality only for 16 core languages, so its broader code list is not taken as proof of all Arabic pairs. Qwen means **qwen-mt-plus**; Qwen's published list omits Uyghur, both Kurdish variants, Pashto, Somali and Hausa. AWS likewise omits Uyghur and both Kurdish variants. Azure also requires nb for Norwegian and zh-Hans for Simplified Chinese. Azure's Kurdish codes differ from Google: 'ckb' maps to Azure 'ku', and 'ku' maps to Azure 'kmr'.

| # | Language | App code | Azure | Google NMT | Alibaba MT | AWS | Qwen-MT | Workers AI | Provisional priority | Blind score |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | English | `en` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 2 | French | `fr` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 3 | Turkish | `tr` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 4 | Urdu | `ur` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 5 | Uyghur | `ug` | ✓ | ✓ | — | — | — | ✓ | azure → google → workers-ai | Pending |
| 6 | Sorani Kurdish | `ckb` | ku | ✓ | — | — | — | ✓ | azure → google → workers-ai | Pending |
| 7 | Kurmanji Kurdish | `ku` | kmr | ✓ | — | — | — | ✓ | azure → google → workers-ai | Pending |
| 8 | Persian | `fa` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 9 | Swahili | `sw` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 10 | Hindi | `hi` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 11 | Hungarian | `hu` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 12 | Indonesian | `id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 13 | Malay | `ms` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 14 | Bengali | `bn` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 15 | Pashto | `ps` | ✓ | ✓ | — | ✓ | — | ✓ | azure → google → aws → workers-ai | Pending |
| 16 | Somali | `so` | ✓ | ✓ | — | ✓ | — | ✓ | azure → google → aws → workers-ai | Pending |
| 17 | Hausa | `ha` | ✓ | ✓ | — | ✓ | — | ✓ | azure → google → aws → workers-ai | Pending |
| 18 | Russian | `ru` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 19 | Ukrainian | `uk` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 20 | German | `de` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 21 | Spanish | `es` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 22 | Portuguese | `pt` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 23 | Italian | `it` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 24 | Dutch | `nl` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 25 | Swedish | `sv` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 26 | Norwegian | `no` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 27 | Polish | `pl` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 28 | Romanian | `ro` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 29 | Bosnian | `bs` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 30 | Albanian | `sq` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 31 | Azerbaijani | `az` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 32 | Uzbek | `uz` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 33 | Kazakh | `kk` | ✓ | ✓ | — | ✓ | ✓ | ✓ | azure → google → qwen → aws → workers-ai | Pending |
| 34 | Chinese (Simplified) | `zh` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 35 | Japanese | `ja` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 36 | Korean | `ko` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | azure → google → qwen → aws → alibaba → workers-ai | Pending |

**Priority rationale:** Azure and Google NMT are the baseline for every pair. Qwen-MT Plus follows where its language is explicitly listed and can be promoted after blind evaluation, especially for books and technical prose. AWS follows on listed pairs; Alibaba follows only on confirmed Arabic core pairs. Existing Workers AI remains the final fallback, including paid inference on Workers Paid. This order is intentionally provisional: support documentation and vendor marketing do not establish relative Arabic translation quality.

## Free allocation and activation safeguards

- Azure Translator F0: 2,000,000 characters/month (verify the deployed SKU). Local D1 cap defaults to that amount.
- Google NMT: first 500,000 characters/month as a shared $10 credit across Basic and Advanced. Local D1 cap defaults to that amount.
- Alibaba MT: 1,000,000 characters/month for each edition per current pricing; the router uses only General and reserves at most 1,000,000. Enable account billing protection separately.
- AWS Translate: 2,000,000 characters/month for **12 months from signup**. The router requires an explicit UTC 'AWS_TRANSLATE_FREE_UNTIL' date, otherwise excludes AWS.
- Qwen-MT Plus: 1,000,000 input+output tokens **for new users in Singapore, 90 days**. The router requires 'QWEN_FREE_UNTIL', reserves a conservative 3× UTF-8 input byte estimate against that token cap, and account-side **Free Quota Only** must be enabled. A local estimate cannot guarantee the billable output token count.
- Workers AI: 10,000 neurons/day free across models; Workers Paid can bill overage. The existing fallback is preserved, without claiming an exact request-to-neuron conversion.

These allocations are **not additive guarantees**: providers differ in eligibility, region, billing unit, account age, and existing consumption. D1 tracks only requests passing this router. Set provider-side budgets, free-only mode where available, and lower local caps when other clients share an account. There is no KV, AI Gateway or Translation Memory in this PR; they require separate provisioned resources and quality/security decisions. Neither a secret nor a live Cloudflare resource is created here.

## Deployment configuration

Apply migration '0042_translation_provider_usage.sql' to the existing VISITORS_DB. Add secrets outside Git: 'AZURE_TRANSLATOR_KEY' (and 'AZURE_TRANSLATOR_REGION' for regional resources); 'GOOGLE_TRANSLATE_KEY'; 'ALIBABA_TRANSLATE_ACCESS_KEY_ID' and 'ALIBABA_TRANSLATE_ACCESS_KEY_SECRET'; 'AWS_TRANSLATE_ACCESS_KEY_ID', 'AWS_TRANSLATE_SECRET_ACCESS_KEY', 'AWS_TRANSLATE_REGION' (and optional session token); 'QWEN_API_KEY' and an HTTPS 'QWEN_ENDPOINT' ending in '/chat/completions' on an aliyuncs.com host. Optional UTC free-trial expiry dates above and caps 'TRANSLATION_<PROVIDER>_FREE_CHARS' may lower hard-coded maxima. Set 'TRANSLATION_ROUTER_ENABLED=1' only after migration, secrets, provider-side spend limits, and staging checks. Otherwise production continues on the original Workers AI flow. Router failures also fall back to that flow.

## Official sources

- Azure language list: https://learn.microsoft.com/azure/ai-services/translator/language-support ; pricing: https://azure.microsoft.com/en-us/pricing/details/translator/
- Google language list: https://docs.cloud.google.com/translate/docs/languages ; pricing: https://cloud.google.com/products/translate/pricing
- Alibaba core language pairs: https://www.alibabacloud.com/help/en/machine-translation/product-overview/general-version-of-machine-translation ; pricing: https://www.alibabacloud.com/help/en/machine-translation/product-overview/product-pricing ; signing: https://www.alibabacloud.com/help/en/machine-translation/developer-reference/signature-mechanism
- AWS languages: https://docs.aws.amazon.com/translate/latest/dg/what-is-languages.html ; pricing: https://aws.amazon.com/translate/pricing/
- Qwen-MT language list and API: https://www.alibabacloud.com/help/en/model-studio/machine-translation ; trial: https://www.alibabacloud.com/help/en/model-studio/new-free-quota
- Workers AI model and pricing: https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/ ; https://developers.cloudflare.com/workers-ai/platform/pricing/
