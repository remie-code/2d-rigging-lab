import { PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS } from "@private-2d-rigging-lab/contracts";
import type {
  ProductPreflightActionIdDto,
  ProductPreflightBlockingReasonChangeDto,
  ProductPreflightCategoryDto,
  ProductPreflightCategoryResultDto,
  ProductPreflightDiffContainerDto,
  ProductPreflightDiagnosticRefChangeDto,
  ProductPreflightDiagnosticRefDto,
  ProductPreflightDiagnosticRefKeyDto,
  ProductPreflightEvidenceIdDto,
  ProductPreflightEvidenceRefChangeDto,
  ProductPreflightEvidenceRefDto,
  ProductPreflightNotEvaluatedClaimChangeDto,
  ProductPreflightRecommendedActionChangeDto,
  ProductPreflightRecommendedActionDto,
  ProductPreflightReportDto,
  ProductPreflightUnsupportedClaimChangeDto
} from "@private-2d-rigging-lab/contracts";

type ProductPreflightReportDiffSide = "before" | "after";

type IndexedItem<TKeyFields extends object, TItem> = {
  readonly sortKey: string;
  readonly keyFields: TKeyFields;
  readonly item: TItem;
};

export const indexCategories = (
  categories: readonly ProductPreflightCategoryResultDto[]
): ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto> =>
  new Map(categories.map((category) => [category.category, category]));

export const getCategory = (
  categories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  category: ProductPreflightCategoryDto,
  side: ProductPreflightReportDiffSide
): ProductPreflightCategoryResultDto => {
  const categoryResult = categories.get(category);
  if (categoryResult === undefined) {
    throw new Error(`Missing ${side} Product Preflight category ${category}.`);
  }

  return categoryResult;
};

export const diffBlockingReasons = (
  beforeCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  afterCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>
): ProductPreflightBlockingReasonChangeDto[] =>
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.flatMap((category) => {
    const beforeCategory = getCategory(beforeCategories, category, "before");
    const afterCategory = getCategory(afterCategories, category, "after");

    return diffIndexedItems(
      indexById(beforeCategory.blockingReasons, (reason) => ({ reasonId: reason.reasonId })),
      indexById(afterCategory.blockingReasons, (reason) => ({ reasonId: reason.reasonId })),
      ({ reasonId }, after): ProductPreflightBlockingReasonChangeDto => ({
        changeKind: "added",
        category,
        reasonId,
        after
      }),
      ({ reasonId }, before): ProductPreflightBlockingReasonChangeDto => ({
        changeKind: "removed",
        category,
        reasonId,
        before
      }),
      ({ reasonId }, before, after): ProductPreflightBlockingReasonChangeDto => ({
        changeKind: "changed",
        category,
        reasonId,
        before,
        after
      })
    );
  });

export const diffDiagnosticRefs = (
  beforeCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  afterCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>
): ProductPreflightDiagnosticRefChangeDto[] =>
  diffContainerCollections(
    beforeCategories,
    afterCategories,
    collectDiagnosticRefContainers,
    (container, beforeItems, afterItems) =>
      diffIndexedItems(
        beforeItems,
        afterItems,
        (diagnosticRefKey, after): ProductPreflightDiagnosticRefChangeDto => ({
          changeKind: "added",
          container,
          diagnosticRefKey,
          after
        }),
        (diagnosticRefKey, before): ProductPreflightDiagnosticRefChangeDto => ({
          changeKind: "removed",
          container,
          diagnosticRefKey,
          before
        }),
        (diagnosticRefKey, before, after): ProductPreflightDiagnosticRefChangeDto => ({
          changeKind: "changed",
          container,
          diagnosticRefKey,
          before,
          after
        })
      )
  );

export const diffEvidenceRefs = (
  beforeCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  afterCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>
): ProductPreflightEvidenceRefChangeDto[] =>
  diffContainerCollections(
    beforeCategories,
    afterCategories,
    collectEvidenceRefContainers,
    (container, beforeItems, afterItems) =>
      diffIndexedItems(
        beforeItems,
        afterItems,
        ({ evidenceId }, after): ProductPreflightEvidenceRefChangeDto => ({
          changeKind: "added",
          container,
          evidenceId,
          after
        }),
        ({ evidenceId }, before): ProductPreflightEvidenceRefChangeDto => ({
          changeKind: "removed",
          container,
          evidenceId,
          before
        }),
        ({ evidenceId }, before, after): ProductPreflightEvidenceRefChangeDto => ({
          changeKind: "changed",
          container,
          evidenceId,
          before,
          after
        })
      )
  );

export const diffRecommendedActions = (
  beforeReport: ProductPreflightReportDto,
  afterReport: ProductPreflightReportDto,
  beforeCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  afterCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>
): ProductPreflightRecommendedActionChangeDto[] => [
  ...diffIndexedItems(
    indexById(beforeReport.recommendedNextActions, (action) => ({ actionId: action.actionId })),
    indexById(afterReport.recommendedNextActions, (action) => ({ actionId: action.actionId })),
    ({ actionId }, after): ProductPreflightRecommendedActionChangeDto => ({
      changeKind: "added",
      container: { containerKind: "report" },
      actionId,
      after
    }),
    ({ actionId }, before): ProductPreflightRecommendedActionChangeDto => ({
      changeKind: "removed",
      container: { containerKind: "report" },
      actionId,
      before
    }),
    ({ actionId }, before, after): ProductPreflightRecommendedActionChangeDto => ({
      changeKind: "changed",
      container: { containerKind: "report" },
      actionId,
      before,
      after
    })
  ),
  ...diffContainerCollections(
    beforeCategories,
    afterCategories,
    collectRecommendedActionContainers,
    (container, beforeItems, afterItems) =>
      diffIndexedItems(
        beforeItems,
        afterItems,
        ({ actionId }, after): ProductPreflightRecommendedActionChangeDto => ({
          changeKind: "added",
          container,
          actionId,
          after
        }),
        ({ actionId }, before): ProductPreflightRecommendedActionChangeDto => ({
          changeKind: "removed",
          container,
          actionId,
          before
        }),
        ({ actionId }, before, after): ProductPreflightRecommendedActionChangeDto => ({
          changeKind: "changed",
          container,
          actionId,
          before,
          after
        })
      )
  )
];

export const diffUnsupportedClaims = (
  beforeCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  afterCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>
): ProductPreflightUnsupportedClaimChangeDto[] =>
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.flatMap((category) => {
    const beforeCategory = getCategory(beforeCategories, category, "before");
    const afterCategory = getCategory(afterCategories, category, "after");

    return diffIndexedItems(
      indexById(beforeCategory.unsupportedClaims, (claim) => ({ claimId: claim.claimId })),
      indexById(afterCategory.unsupportedClaims, (claim) => ({ claimId: claim.claimId })),
      ({ claimId }, after): ProductPreflightUnsupportedClaimChangeDto => ({
        changeKind: "added",
        category,
        claimId,
        after
      }),
      ({ claimId }, before): ProductPreflightUnsupportedClaimChangeDto => ({
        changeKind: "removed",
        category,
        claimId,
        before
      }),
      ({ claimId }, before, after): ProductPreflightUnsupportedClaimChangeDto => ({
        changeKind: "changed",
        category,
        claimId,
        before,
        after
      })
    );
  });

export const diffNotEvaluatedClaims = (
  beforeCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  afterCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>
): ProductPreflightNotEvaluatedClaimChangeDto[] =>
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.flatMap((category) => {
    const beforeCategory = getCategory(beforeCategories, category, "before");
    const afterCategory = getCategory(afterCategories, category, "after");

    return diffIndexedItems(
      indexById(beforeCategory.notEvaluatedClaims, (claim) => ({ claimId: claim.claimId })),
      indexById(afterCategory.notEvaluatedClaims, (claim) => ({ claimId: claim.claimId })),
      ({ claimId }, after): ProductPreflightNotEvaluatedClaimChangeDto => ({
        changeKind: "added",
        category,
        claimId,
        after
      }),
      ({ claimId }, before): ProductPreflightNotEvaluatedClaimChangeDto => ({
        changeKind: "removed",
        category,
        claimId,
        before
      }),
      ({ claimId }, before, after): ProductPreflightNotEvaluatedClaimChangeDto => ({
        changeKind: "changed",
        category,
        claimId,
        before,
        after
      })
    );
  });

const diffContainerCollections = <TKeyFields extends object, TItem, TChange>(
  beforeCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  afterCategories: ReadonlyMap<ProductPreflightCategoryDto, ProductPreflightCategoryResultDto>,
  collectContainers: (
    category: ProductPreflightCategoryResultDto
  ) => readonly IndexedContainer<TKeyFields, TItem>[],
  createChanges: (
    container: ProductPreflightDiffContainerDto,
    beforeItems: readonly IndexedItem<TKeyFields, TItem>[],
    afterItems: readonly IndexedItem<TKeyFields, TItem>[]
  ) => readonly TChange[]
): TChange[] =>
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.flatMap((category) => {
    const beforeContainers = indexContainers(collectContainers(
      getCategory(beforeCategories, category, "before")
    ));
    const afterContainers = indexContainers(collectContainers(
      getCategory(afterCategories, category, "after")
    ));

    return sortedUnion([...beforeContainers.keys()], [...afterContainers.keys()])
      .flatMap((containerKey) => {
        const beforeContainer = beforeContainers.get(containerKey);
        const afterContainer = afterContainers.get(containerKey);
        const container = beforeContainer?.container ?? afterContainer?.container;
        if (container === undefined) {
          return [];
        }

        return createChanges(
          container,
          beforeContainer?.items ?? [],
          afterContainer?.items ?? []
        );
      });
  });

type IndexedContainer<TKeyFields extends object, TItem> = {
  readonly container: ProductPreflightDiffContainerDto;
  readonly items: readonly IndexedItem<TKeyFields, TItem>[];
};

const collectDiagnosticRefContainers = (
  category: ProductPreflightCategoryResultDto
): readonly IndexedContainer<ProductPreflightDiagnosticRefKeyDto, ProductPreflightDiagnosticRefDto>[] =>
  collectCategoryContainers(category, (containerOwner) =>
    indexDiagnosticRefs(containerOwner.diagnosticRefs)
  );

const collectEvidenceRefContainers = (
  category: ProductPreflightCategoryResultDto
): readonly IndexedContainer<{ readonly evidenceId: ProductPreflightEvidenceIdDto }, ProductPreflightEvidenceRefDto>[] =>
  collectCategoryContainers(category, (containerOwner) =>
    indexById(containerOwner.evidenceRefs, (evidenceRef) => ({
      evidenceId: evidenceRef.evidenceId
    }))
  );

const collectRecommendedActionContainers = (
  category: ProductPreflightCategoryResultDto
): readonly IndexedContainer<{ readonly actionId: ProductPreflightActionIdDto }, ProductPreflightRecommendedActionDto>[] =>
  collectCategoryContainers(category, (containerOwner) =>
    indexById(containerOwner.recommendedNextActions, (action) => ({
      actionId: action.actionId
    }))
  );

type CategoryContainerOwner = {
  readonly evidenceRefs: readonly ProductPreflightEvidenceRefDto[];
  readonly diagnosticRefs: readonly ProductPreflightDiagnosticRefDto[];
  readonly recommendedNextActions: readonly ProductPreflightRecommendedActionDto[];
};

const collectCategoryContainers = <TKeyFields extends object, TItem>(
  category: ProductPreflightCategoryResultDto,
  collectItems: (
    containerOwner: CategoryContainerOwner
  ) => readonly IndexedItem<TKeyFields, TItem>[]
): readonly IndexedContainer<TKeyFields, TItem>[] => [
  {
    container: {
      containerKind: "category",
      category: category.category
    },
    items: collectItems(category)
  },
  ...category.blockingReasons.map((reason) => ({
    container: {
      containerKind: "blockingReason" as const,
      category: category.category,
      reasonId: reason.reasonId
    },
    items: collectItems(reason)
  })),
  ...category.unsupportedClaims.map((claim) => ({
    container: {
      containerKind: "unsupportedClaim" as const,
      category: category.category,
      claimId: claim.claimId
    },
    items: collectItems(claim)
  })),
  ...category.notEvaluatedClaims.map((claim) => ({
    container: {
      containerKind: "notEvaluatedClaim" as const,
      category: category.category,
      claimId: claim.claimId
    },
    items: collectItems(claim)
  }))
];

const indexContainers = <TKeyFields extends object, TItem>(
  containers: readonly IndexedContainer<TKeyFields, TItem>[]
): ReadonlyMap<string, IndexedContainer<TKeyFields, TItem>> =>
  new Map(containers.map((container) => [
    containerSortKey(container.container),
    container
  ]));

const containerSortKey = (container: ProductPreflightDiffContainerDto): string => {
  switch (container.containerKind) {
    case "report":
      return "0|report";
    case "category":
      return `1|${container.category}`;
    case "blockingReason":
      return `2|${container.category}|${container.reasonId}`;
    case "unsupportedClaim":
      return `3|${container.category}|${container.claimId}`;
    case "notEvaluatedClaim":
      return `4|${container.category}|${container.claimId}`;
  }
};

const diffIndexedItems = <TKeyFields extends object, TItem, TChange>(
  beforeItems: readonly IndexedItem<TKeyFields, TItem>[],
  afterItems: readonly IndexedItem<TKeyFields, TItem>[],
  createAddedChange: (keyFields: TKeyFields, after: TItem) => TChange,
  createRemovedChange: (keyFields: TKeyFields, before: TItem) => TChange,
  createChangedChange: (keyFields: TKeyFields, before: TItem, after: TItem) => TChange
): TChange[] => {
  const beforeByKey = new Map(beforeItems.map((item) => [item.sortKey, item]));
  const afterByKey = new Map(afterItems.map((item) => [item.sortKey, item]));

  return sortedUnion([...beforeByKey.keys()], [...afterByKey.keys()]).flatMap((sortKey) => {
    const before = beforeByKey.get(sortKey);
    const after = afterByKey.get(sortKey);

    if (before === undefined && after !== undefined) {
      return [createAddedChange(after.keyFields, after.item)];
    }
    if (before !== undefined && after === undefined) {
      return [createRemovedChange(before.keyFields, before.item)];
    }
    if (
      before !== undefined &&
      after !== undefined &&
      stableStringify(before.item) !== stableStringify(after.item)
    ) {
      return [createChangedChange(after.keyFields, before.item, after.item)];
    }

    return [];
  });
};

const indexById = <TItem, TKeyFields extends object>(
  items: readonly TItem[],
  createKeyFields: (item: TItem) => TKeyFields
): IndexedItem<TKeyFields, TItem>[] =>
  items
    .map((item) => {
      const keyFields = createKeyFields(item);
      return {
        sortKey: stableStringify(keyFields),
        keyFields,
        item
      };
    })
    .sort(compareIndexedItems);

const indexDiagnosticRefs = (
  diagnosticRefs: readonly ProductPreflightDiagnosticRefDto[]
): IndexedItem<ProductPreflightDiagnosticRefKeyDto, ProductPreflightDiagnosticRefDto>[] =>
  diagnosticRefs
    .map((diagnosticRef) => {
      const keyFields = createDiagnosticRefKey(diagnosticRef);
      return {
        sortKey: stableStringify(keyFields),
        keyFields,
        item: diagnosticRef
      };
    })
    .sort(compareIndexedItems);

const createDiagnosticRefKey = (
  diagnosticRef: ProductPreflightDiagnosticRefDto
): ProductPreflightDiagnosticRefKeyDto => ({
  checkId: diagnosticRef.checkId,
  ...(diagnosticRef.reportId === undefined ? {} : { reportId: diagnosticRef.reportId }),
  ...(diagnosticRef.diagnosticIndex === undefined
    ? {}
    : { diagnosticIndex: diagnosticRef.diagnosticIndex }),
  ...(diagnosticRef.target === undefined ? {} : { target: diagnosticRef.target })
});

const compareIndexedItems = <TKeyFields extends object, TItem>(
  left: IndexedItem<TKeyFields, TItem>,
  right: IndexedItem<TKeyFields, TItem>
): number => left.sortKey.localeCompare(right.sortKey);

const sortedUnion = (
  leftValues: readonly string[],
  rightValues: readonly string[]
): string[] => [...new Set([...leftValues, ...rightValues])].sort();

const stableStringify = (value: unknown): string => JSON.stringify(canonicalize(value));

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)])
    );
  }

  return value;
};
