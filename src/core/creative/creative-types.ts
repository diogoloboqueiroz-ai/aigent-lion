export type CreativePlatform =
  | "instagram"
  | "tiktok"
  | "meta"
  | "google-ads"
  | "youtube"
  | "linkedin"
  | "site"
  | "email";

export type ImagePromptProvider =
  | "dall-e"
  | "midjourney"
  | "stable-diffusion"
  | "flux"
  | "firefly"
  | "ideogram"
  | "canva"
  | "adobe";

export type CreativeBriefInput = {
  companyName: string;
  objective: string;
  platform: CreativePlatform | string;
  format: string;
  audience: string;
  promise: string;
  proof: string[];
  callToAction: string;
  guardrails: string[];
  visualStyle?: string;
  emotion?: string;
  colorSystem?: string;
};

export type ImagePromptAsset = {
  id: string;
  provider: ImagePromptProvider;
  platform: string;
  format: string;
  objective: string;
  prompt: string;
  negativePrompt: string;
  suggestedText: string;
  variations: string[];
  qaChecklist: string[];
  complianceRisks: string[];
};

export type VideoScene = {
  scene: number;
  durationSeconds: number;
  visual: string;
  narration: string;
  onScreenText: string;
  transition: string;
};

export type VideoScriptAsset = {
  id: string;
  platform: string;
  format: string;
  hook: string;
  shortScript: string;
  longScript: string;
  storyboard: VideoScene[];
  voiceover: string;
  onScreenText: string[];
  callToAction: string;
  videoPrompt: string;
  thumbnailPrompt: string;
  platformVersions: Array<{
    platform: string;
    adaptation: string;
  }>;
  qaChecklist: string[];
  complianceRisks: string[];
};

export type CreativeQaScore = {
  clarity: number;
  hookStrength: number;
  audienceFit: number;
  differentiation: number;
  visualHierarchy: number;
  ctaStrength: number;
  claimRisk: number;
  conversionPotential: number;
};

export type CreativeQaResult = {
  id: string;
  score: number;
  scores: CreativeQaScore;
  verdict: "ready" | "needs_revision" | "blocked";
  recommendations: string[];
  risks: string[];
};

export type MultimodalCreativePackage = {
  id: string;
  companySlug: string;
  generatedAt: string;
  imagePrompts: ImagePromptAsset[];
  videoScripts: VideoScriptAsset[];
  qaResults: CreativeQaResult[];
  summary: string;
  risks: string[];
};
