import { scoreCreativeBrief } from "@/core/creative/creative-qa-engine";
import { buildImagePromptAssets } from "@/core/creative/image-prompt-engine";
import type {
  CreativeBriefInput,
  MultimodalCreativePackage
} from "@/core/creative/creative-types";
import { buildVideoScriptAsset } from "@/core/creative/video-script-engine";

export function buildMultimodalCreativePackage(input: {
  companySlug: string;
  briefs: CreativeBriefInput[];
  generatedAt?: string;
}): MultimodalCreativePackage {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const imagePrompts = input.briefs.flatMap(buildImagePromptAssets);
  const videoScripts = input.briefs.map(buildVideoScriptAsset);
  const qaResults = input.briefs.map(scoreCreativeBrief);
  const blocked = qaResults.filter((result) => result.verdict === "blocked");
  const revisions = qaResults.filter((result) => result.verdict === "needs_revision");

  return {
    id: `creative-package-${input.companySlug}-${Date.parse(generatedAt) || Date.now()}`,
    companySlug: input.companySlug,
    generatedAt,
    imagePrompts,
    videoScripts,
    qaResults,
    summary: `${imagePrompts.length} image prompts, ${videoScripts.length} video scripts and ${qaResults.length} QA reviews prepared for approval-gated production.`,
    risks: [
      ...blocked.map((result) => `${result.id}: blocked by creative QA.`),
      ...revisions.map((result) => `${result.id}: needs revision before launch.`)
    ].slice(0, 8)
  };
}
