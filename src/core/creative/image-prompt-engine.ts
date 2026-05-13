import type {
  CreativeBriefInput,
  ImagePromptAsset,
  ImagePromptProvider
} from "@/core/creative/creative-types";

const PROVIDERS: ImagePromptProvider[] = [
  "dall-e",
  "midjourney",
  "stable-diffusion",
  "flux",
  "firefly",
  "ideogram",
  "canva",
  "adobe"
];

export function buildImagePromptAssets(input: CreativeBriefInput): ImagePromptAsset[] {
  return PROVIDERS.map((provider) => ({
    id: `image-prompt-${slugify(input.companyName)}-${slugify(input.platform)}-${provider}`,
    provider,
    platform: input.platform,
    format: input.format,
    objective: input.objective,
    prompt: buildProviderPrompt(provider, input),
    negativePrompt: buildNegativePrompt(input),
    suggestedText: `${input.promise} ${input.callToAction}`.trim(),
    variations: buildPromptVariations(input),
    qaChecklist: buildQaChecklist(input),
    complianceRisks: buildComplianceRisks(input)
  }));
}

function buildProviderPrompt(provider: ImagePromptProvider, input: CreativeBriefInput) {
  const style = input.visualStyle ?? "premium growth marketing, editorial SaaS quality, high trust";
  const emotion = input.emotion ?? "confidence, urgency and clarity";
  const colors = input.colorSystem ?? "deep emerald, graphite, warm gold accents, high contrast";
  const proof = input.proof.length > 0 ? input.proof.join("; ") : "credible operational proof, no fake claims";
  const providerHint = getProviderHint(provider);

  return [
    providerHint,
    `Create a high-converting marketing creative for ${input.companyName}.`,
    `Platform: ${input.platform}. Format: ${input.format}.`,
    `Audience: ${input.audience}. Objective: ${input.objective}.`,
    `Core promise: ${input.promise}. Proof cues: ${proof}.`,
    `Composition: strong mobile-first hierarchy, one hero subject, clear problem-to-outcome contrast, premium negative space.`,
    `Visual style: ${style}. Lighting: cinematic soft key light, clean product glow, polished shadows.`,
    `Colors: ${colors}. Desired emotion: ${emotion}.`,
    `Suggested text overlay: "${input.promise}" and CTA "${input.callToAction}".`,
    `Compliance guardrails: ${input.guardrails.join("; ") || "avoid unsupported claims"}.`
  ].join(" ");
}

function getProviderHint(provider: ImagePromptProvider) {
  switch (provider) {
    case "midjourney":
      return "Midjourney v6 style prompt, photographic detail, --ar 4:5 --style raw.";
    case "stable-diffusion":
      return "Stable Diffusion prompt with clear subject, camera, lens, lighting and negative prompt separation.";
    case "flux":
      return "Flux prompt, natural language, premium commercial realism, text-safe layout.";
    case "firefly":
      return "Adobe Firefly commercial-safe prompt, brand-safe, polished advertising composition.";
    case "ideogram":
      return "Ideogram prompt optimized for readable short text overlays.";
    case "canva":
      return "Canva design prompt for editable marketing layout with separable text and image zones.";
    case "adobe":
      return "Adobe design prompt for campaign-ready creative with layered composition.";
    default:
      return "DALL-E prompt with exact composition and readable code-native text guidance.";
  }
}

function buildNegativePrompt(input: CreativeBriefInput) {
  return [
    "generic stock photo",
    "low quality",
    "cluttered layout",
    "unreadable text",
    "fake logos",
    "misleading before-and-after",
    "medical or financial guarantees",
    ...input.guardrails.map((guardrail) => `avoid ${guardrail}`)
  ].join(", ");
}

function buildPromptVariations(input: CreativeBriefInput) {
  return [
    `Authority angle: ${input.promise} with proof-led hero composition.`,
    `Problem-solution angle for ${input.audience} with clearer pain signal.`,
    `Social proof angle using testimonial-like visual cues without inventing quotes.`
  ];
}

function buildQaChecklist(input: CreativeBriefInput) {
  return [
    "Promise is readable in under 2 seconds.",
    "CTA is visible and does not compete with the core claim.",
    "Visual hierarchy works in mobile feed crop.",
    "No unsupported guarantee, sensitive claim or fake proof.",
    `Guardrails checked: ${input.guardrails.length || 1}.`
  ];
}

function buildComplianceRisks(input: CreativeBriefInput) {
  return input.guardrails.length > 0
    ? input.guardrails.map((guardrail) => `Review required: ${guardrail}`)
    : ["Claims need evidence before paid distribution."];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "creative";
}
