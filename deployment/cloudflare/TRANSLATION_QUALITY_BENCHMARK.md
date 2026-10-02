# Arabic translation quality benchmark: 36 target languages

Verified against provider documentation on 2026-09-24. **This is a benchmark plan and provisional routing matrix, not a completed 36-language blind evaluation. No provider credentials, full reference corpus, or account-specific Gemini limits are stored in the repository. The project owner selected Gemini 3.5 Flash-Lite as the first attempted provider for all 36 configured target codes; provider errors and quota exhaustion fall through to the next provider. Do not interpret that route decision as independently verified fluency or accuracy for each language.

## Evaluation protocol

For **each** of the 36 languages, collect at least 30 Arabic examples: 10 short interface labels, 10 bibliographic titles and author names, and 10 paragraphs from permitted library content. Include RTL/LTR punctuation, numbers, citations, Quran verse markers, honorifics and dialect/script distinctions. Use the same frozen prompts and input for each supported provider. Obtain two native-speaker blind ratings (adequacy 0–5, fluency 0–5), record critical errors separately (meaning reversal, fabricated quotation, altered names, missing sentence, changed verse marker), and resolve disagreements with a third reviewer. Record latency and cost only after the quality score. Reject any provider with critical errors for that language and task type. Reorder priorities separately for UI and paragraphs only after the language's reviewed results are committed. Never auto-publish unreviewed religious quotations.

## Capability and provisional priority matrix

✓ = source Arabic and target code listed, or explicitly part of the published core pair set; — = not verified for this exact pair. Gemini is attempted for all 36 app codes by project-owner decision; Google describes Flash-Lite as optimized for translation and high-volume use but does not publish an explicit mapping for these 36 app codes on its model page. Workers AI means the **existing** M2M100/LLM fallback; model-level support and output quality still need testing. Alibaba publishes 214 pairs but confirms Arabic bidirectionality only for 16 core languages, so its broader code list is not taken as proof of all Arabic pairs. Qwen means **qwen-mt-plus**; Qwen's published list omits Uyghur, both Kurdish variants, Pashto, Somali and Hausa. AWS likewise omits Uyghur and both Kurdish variants. Azure also requires nb for Norwegian and zh-Hans for Simplified Chinese. Azure's Kurdish codes differ from Google: 'ckb' maps to Azure 'ku', and 'ku' maps to Azure 'kmr'.

| # | Language | App code | Azure | Google NMT | Alibaba MT | AWS | Qwen-MT | Workers AI | Provisional priority | Blind score |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | English | `en` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 2 | French | `fr` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 3 | Turkish | `tr` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 4 | Urdu | `ur` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 5 | Uyghur | `ug` | ✓ | ✓ | — | — | — | ✓ | gemini → azure → google → workers-ai | Pending |
| 6 | Sorani Kurdish | `ckb` | ku | ✓ | — | — | — | ✓ | gemini → azure → google → workers-ai | Pending |
| 7 | Kurmanji Kurdish | `ku` | kmr | ✓ | — | — | — | ✓ | gemini → azure → google → workers-ai | Pending |
| 8 | Persian | `fa` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 9 | Swahili | `sw` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 10 | Hindi | `hi` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 11 | Hungarian | `hu` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 12 | Indonesian | `id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 13 | Malay | `ms` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 14 | Bengali | `bn` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 15 | Pashto | `ps` | ✓ | ✓ | — | ✓ | — | ✓ | gemini → azure → google → aws → workers-ai | Pending |
| 16 | Somali | `so` | ✓ | ✓ | — | ✓ | — | ✓ | gemini → azure → google → aws → workers-ai | Pending |
| 17 | Hausa | `ha` | ✓ | ✓ | — | ✓ | — | ✓ | gemini → azure → google → aws → workers-ai | Pending |
| 18 | Russian | `ru` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 19 | Ukrainian | `uk` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 20 | German | `de` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 21 | Spanish | `es` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 22 | Portuguese | `pt` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 23 | Italian | `it` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 24 | Dutch | `nl` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 25 | Swedish | `sv` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 26 | Norwegian | `no` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 27 | Polish | `pl` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 28 | Romanian | `ro` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 29 | Bosnian | `bs` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 30 | Albanian | `sq` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 31 | Azerbaijani | `az` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 32 | Uzbek | `uz` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 33 | Kazakh | `kk` | ✓ | ✓ | — | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → workers-ai | Pending |
| 34 | Chinese (Simplified) | `zh` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 35 | Japanese | `ja` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |
| 36 | Korean | `ko` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | gemini → azure → google → qwen → aws → alibaba → workers-ai | Pending |

**Priority rationale:** Gemini 3.5 Flash-Lite is attempted first for all 36 app codes by project-owner decision, then Azure and Google NMT are the baseline. Qwen-MT Plus follows where its language is explicitly listed and can be promoted after blind evaluation, especially for books and technical prose. AWS follows on listed pairs; Alibaba follows only on confirmed Arabic core pairs. Existing Workers AI remains the final fallback, including paid inference on Workers Paid. This order is intentionally provisional: support documentation and vendor marketing do not establish relative Arabic translation quality.

## Free allocation and activation safeguards

- Azure Translator F0: 2,000,000 characters/month (verify the deployed SKU). Local D1 cap defaults to that amount.
- Google NMT: first 500,000 characters/month as a shared $10 credit across Basic and Advanced. Local D1 cap defaults to that amount.
- Alibaba MT: 1,000,000 characters/month for each edition per current pricing; the router uses only General and reserves at most 1,000,000. Enable account billing protection separately.
- AWS Translate: 2,000,000 characters/month for **12 months from signup**. The router requires an explicit UTC 'AWS_TRANSLATE_FREE_UNTIL' date, otherwise excludes AWS.
- Qwen-MT Plus: 1,000,000 input+output tokens **for new users in Singapore, 90 days**. The router requires 'QWEN_FREE_UNTIL', reserves a conservative 3× UTF-8 input byte estimate against one trial-period token bucket (no monthly reset), and account-side **Free Quota Only** must be enabled. A local estimate cannot guarantee the billable output token count.
- Workers AI: 10,000 neurons/day free across models; Workers Paid can bill overage. The existing fallback is preserved, without claiming an exact request-to-neuron conversion.

These allocations are **not additive guarantees**: providers differ in eligibility, region, billing unit, account age, and existing consumption. D1 tracks only requests passing this router. Set provider-side budgets, free-only mode where available, and lower local caps when other clients share an account. There is no KV, AI Gateway or Translation Memory in this PR; they require separate provisioned resources and quality/security decisions. Neither a secret nor a live Cloudflare resource is created here.

## Deployment configuration

The owner's AI Studio screenshot for Gemini 3.5 Flash-Lite showed base limits of 15 RPM, 250,000 input TPM and 500 RPD, with `Compare: Tier 3` selected. The router does not count the green Tier 3 comparison increments as part of the current limits. It uses 80% internal ceilings: 12 requests/minute, 200,000 input tokens/minute and 400 requests/day. The request counter conservatively includes both `countTokens` and generation calls, so the daily limit may allow fewer than 400 translations. Minute limits use adjacent UTC-minute buckets to avoid boundary bursts; the daily bucket resets on Google's Pacific-time date. Google says active limits are project-specific, can change, and are not guaranteed, so recheck AI Studio before raising these constants.

These RPM/TPM/RPD controls are rate-limit protections, not a published monthly free allowance or a guaranteed spend cap. Gemini remains skipped unless 'TRANSLATION_GEMINI_ENABLED=1', 'GEMINI_API_KEY' and a positive operator-defined monthly token stop 'TRANSLATION_GEMINI_FREE_TOKENS' are set. This monthly stop is an additional local ceiling, not a Google-published free quota. Apply migration '0042_translation_provider_usage.sql' to the existing VISITORS_DB. Add other provider secrets outside Git: 'AZURE_TRANSLATOR_KEY' (and 'AZURE_TRANSLATOR_REGION' for regional resources); 'GOOGLE_TRANSLATE_KEY'; 'ALIBABA_TRANSLATE_ACCESS_KEY_ID' and 'ALIBABA_TRANSLATE_ACCESS_KEY_SECRET'; 'AWS_TRANSLATE_ACCESS_KEY_ID', 'AWS_TRANSLATE_SECRET_ACCESS_KEY', 'AWS_TRANSLATE_REGION' (and optional session token); 'QWEN_API_KEY' and an HTTPS 'QWEN_ENDPOINT' ending in '/chat/completions' on an aliyuncs.com host. Optional UTC free-trial expiry dates above and caps 'TRANSLATION_<PROVIDER>_FREE_CHARS' may lower hard-coded monthly character maxima; Qwen instead uses 'TRANSLATION_QWEN_FREE_TOKENS' for its one-time trial. Set 'TRANSLATION_ROUTER_ENABLED=1' only after migration, secrets, provider-side billing/spend settings, and staging checks. Otherwise production continues on the original Workers AI flow. Router failures also fall back to that flow.

## Official sources

- Gemini 3.5 Flash-Lite model and translation optimization: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite ; rate limits: https://ai.google.dev/gemini-api/docs/rate-limits ; token counting and usage: https://ai.google.dev/gemini-api/docs/tokens ; pricing: https://ai.google.dev/gemini-api/docs/pricing

- Azure language list: https://learn.microsoft.com/azure/ai-services/translator/language-support ; pricing: https://azure.microsoft.com/en-us/pricing/details/translator/
- Google language list: https://docs.cloud.google.com/translate/docs/languages ; pricing: https://cloud.google.com/products/translate/pricing
- Alibaba core language pairs: https://www.alibabacloud.com/help/en/machine-translation/product-overview/general-version-of-machine-translation ; pricing: https://www.alibabacloud.com/help/en/machine-translation/product-overview/product-pricing ; signing: https://www.alibabacloud.com/help/en/machine-translation/developer-reference/signature-mechanism
- AWS languages: https://docs.aws.amazon.com/translate/latest/dg/what-is-languages.html ; pricing: https://aws.amazon.com/translate/pricing/
- Qwen-MT language list and API: https://www.alibabacloud.com/help/en/model-studio/machine-translation ; trial: https://www.alibabacloud.com/help/en/model-studio/new-free-quota
- Workers AI model and pricing: https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/ ; https://developers.cloudflare.com/workers-ai/platform/pricing/

