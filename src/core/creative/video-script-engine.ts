import type {
  CreativeBriefInput,
  VideoScriptAsset
} from "@/core/creative/creative-types";

export function buildVideoScriptAsset(input: CreativeBriefInput): VideoScriptAsset {
  const hook = buildHook(input);
  const storyboard = [
    {
      scene: 1,
      durationSeconds: 3,
      visual: `Close crop on the core pain of ${input.audience}, with premium motion typography.`,
      narration: hook,
      onScreenText: input.promise,
      transition: "Fast cut with subtle punch-in."
    },
    {
      scene: 2,
      durationSeconds: 7,
      visual: `Show the mechanism: how ${input.companyName} turns context into action.`,
      narration: `Most campaigns fail because the team sees reports late and acts without a clear priority.`,
      onScreenText: "Context -> diagnosis -> action",
      transition: "Data stream wipe."
    },
    {
      scene: 3,
      durationSeconds: 8,
      visual: `Proof montage: ${input.proof.slice(0, 2).join(" and ") || "credible signals and operating cadence"}.`,
      narration: `The answer is not more content. It is a tighter operating loop with evidence, policy and execution.`,
      onScreenText: "Fewer guesses. Faster learning.",
      transition: "Split-screen to hero frame."
    },
    {
      scene: 4,
      durationSeconds: 5,
      visual: `Hero CTA frame with ${input.companyName} visual system and strong contrast.`,
      narration: input.callToAction,
      onScreenText: input.callToAction,
      transition: "Clean end card."
    }
  ];

  return {
    id: `video-script-${slugify(input.companyName)}-${slugify(input.platform)}`,
    platform: input.platform,
    format: input.format,
    hook,
    shortScript: storyboard.map((scene) => scene.narration).join(" "),
    longScript: buildLongScript(input, hook),
    storyboard,
    voiceover: storyboard.map((scene) => scene.narration).join("\n"),
    onScreenText: storyboard.map((scene) => scene.onScreenText),
    callToAction: input.callToAction,
    videoPrompt: buildVideoPrompt(input),
    thumbnailPrompt: buildThumbnailPrompt(input),
    platformVersions: buildPlatformVersions(input),
    qaChecklist: [
      "Hook lands before second 3.",
      "Every claim has proof or is framed as a hypothesis.",
      "CTA is present in voiceover and final card.",
      "First frame works without sound.",
      "Scene density is safe for mobile."
    ],
    complianceRisks:
      input.guardrails.length > 0
        ? input.guardrails.map((guardrail) => `Review video claim: ${guardrail}`)
        : ["Avoid guaranteed outcomes and unverifiable social proof."]
  };
}

function buildHook(input: CreativeBriefInput) {
  return `If ${input.audience} needs ${input.promise.toLowerCase()}, the next campaign cannot be another guess.`;
}

function buildLongScript(input: CreativeBriefInput, hook: string) {
  return [
    hook,
    `The fastest path is to connect the audience, the offer, the channel and the metric into one operating loop.`,
    `${input.companyName} should lead with ${input.promise}, support it with ${input.proof.join(", ") || "clear evidence"}, and drive the viewer to ${input.callToAction}.`,
    `The creative must stay inside these guardrails: ${input.guardrails.join("; ") || "no unsupported promise"}.`,
    `End with a direct CTA and measure the first signal before scaling spend.`
  ].join(" ");
}

function buildVideoPrompt(input: CreativeBriefInput) {
  return [
    `Generate a premium ${input.format} video ad for ${input.platform}.`,
    `Audience: ${input.audience}. Emotion: ${input.emotion ?? "clarity and momentum"}.`,
    `Visual system: ${input.visualStyle ?? "luxury SaaS command center, cinematic UI overlays, realistic people and product moments"}.`,
    `Use fast but readable transitions, strong first-frame hook, no fake metrics, no unsupported claim.`
  ].join(" ");
}

function buildThumbnailPrompt(input: CreativeBriefInput) {
  return `Premium thumbnail for ${input.platform}: one clear subject, bold readable promise "${input.promise}", high contrast, no clutter, CTA mood "${input.callToAction}".`;
}

function buildPlatformVersions(input: CreativeBriefInput) {
  return [
    {
      platform: "TikTok/Reels",
      adaptation: "Cut to 20-25 seconds, stronger first-person hook, larger on-screen captions."
    },
    {
      platform: "Meta Ads",
      adaptation: "Keep 25-35 seconds, add proof frame and final direct-response CTA."
    },
    {
      platform: "YouTube Shorts",
      adaptation: "Open with search-intent pain, make the proof frame slower and clearer."
    },
    {
      platform: input.platform,
      adaptation: `Primary version for ${input.platform} using ${input.format}.`
    }
  ];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "video";
}
