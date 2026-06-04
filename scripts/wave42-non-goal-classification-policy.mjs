export const wave42NonGoalClassificationPolicy = {
  classificationKinds: [
    {
      id: "positiveProductCapabilityClaim",
      handling: "blocking",
      description: "claims that a Wave42 non-goal is implemented, supported, passed, enabled, or available"
    },
    {
      id: "dependencyOrAssetDeclaration",
      handling: "blocking",
      description: "manifest, lockfile, vendored binary, or asset declarations for forbidden dependency classes"
    },
    {
      id: "sourceImplementationPath",
      handling: "blocking",
      description: "product source paths that implement parser, archive, filesystem, renderer, Cubism, LLM, or auto-fix behavior"
    },
    {
      id: "releaseDemoGateImplementation",
      handling: "blocking",
      description: "new release acceptance or demo gate execution surfaces"
    },
    {
      id: "negativeAssertion",
      handling: "allowed",
      description: "tests or checks that assert forbidden claims remain absent"
    },
    {
      id: "nonGoalDocumentation",
      handling: "allowed",
      description: "documentation that explicitly records unsupported or future-scope boundaries"
    },
    {
      id: "fixtureFalseFlag",
      handling: "allowed",
      description: "fixture metadata that stores false booleans for unsupported claim classes"
    },
    {
      id: "safetyUiText",
      handling: "allowed",
      description: "user-visible safety text that says automatic, parser, renderer, archive, Cubism, or external behavior is disabled"
    },
    {
      id: "historicalReviewEvidence",
      handling: "allowed",
      description: "past reports and reviews that classify previous findings or non-goals without adding implementation"
    }
  ],
  explicitNonGoals: [
    {
      id: "productPreflightPersistedExportedArtifact",
      terms: [
        "persisted product preflight artifact",
        "exported product preflight artifact",
        "product preflight package artifact"
      ],
      blockingContexts: ["positiveProductCapabilityClaim", "sourceImplementationPath"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "historicalReviewEvidence"]
    },
    {
      id: "releaseDemoGate",
      terms: ["release acceptance gate", "demo gate", "demo acceptance gate"],
      blockingContexts: ["positiveProductCapabilityClaim", "releaseDemoGateImplementation"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "historicalReviewEvidence"]
    },
    {
      id: "repoSideRepairGeneration",
      terms: [
        "repo-side repair generation",
        "repair candidate generation",
        "candidate ranking",
        "natural-language repair"
      ],
      blockingContexts: ["positiveProductCapabilityClaim", "sourceImplementationPath"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "historicalReviewEvidence"]
    },
    {
      id: "llmProviderPromptIntegration",
      terms: ["LLM provider", "prompt template", "prompt integration"],
      blockingContexts: ["positiveProductCapabilityClaim", "dependencyOrAssetDeclaration", "sourceImplementationPath"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "historicalReviewEvidence"]
    },
    {
      id: "autoFixAutomaticCommit",
      terms: ["auto-fix", "automatic commit", "automatic apply"],
      blockingContexts: ["positiveProductCapabilityClaim", "sourceImplementationPath"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "safetyUiText", "historicalReviewEvidence"]
    },
    {
      id: "externalTransport",
      terms: ["external transport", "HTTP transport", "WebSocket transport", "MCP transport"],
      blockingContexts: ["positiveProductCapabilityClaim", "sourceImplementationPath"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "historicalReviewEvidence"]
    },
    {
      id: "parserImageArchiveFilesystem",
      terms: [
        "parser/image decode",
        "image decode supported",
        "archive/filesystem supported",
        "standard ZIP supported",
        "File System Access API available"
      ],
      blockingContexts: ["positiveProductCapabilityClaim", "dependencyOrAssetDeclaration", "sourceImplementationPath"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "safetyUiText", "historicalReviewEvidence"]
    },
    {
      id: "rendererPixelOracle",
      terms: ["full renderer", "renderer/pixel oracle", "pixel oracle passed", "texture sampling correctness"],
      blockingContexts: ["positiveProductCapabilityClaim", "dependencyOrAssetDeclaration", "sourceImplementationPath"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "historicalReviewEvidence"]
    },
    {
      id: "cubismCompatibility",
      terms: [
        "Cubism SDK/Core",
        "Cubism compatibility",
        "Cubism support available",
        ".moc3",
        ".model3.json"
      ],
      blockingContexts: ["positiveProductCapabilityClaim", "dependencyOrAssetDeclaration", "sourceImplementationPath"],
      allowedContexts: ["negativeAssertion", "nonGoalDocumentation", "fixtureFalseFlag", "historicalReviewEvidence"]
    }
  ]
};
