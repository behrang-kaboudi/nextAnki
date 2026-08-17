import { MeaningReviewStatus, type Prisma } from "@prisma/client";

export const NEEDS_ACTION_MEANING_REVIEW_STATUSES = [
  MeaningReviewStatus.NEEDS_ACTION_INVALID_PRIMARY,
  MeaningReviewStatus.NEEDS_ACTION_NORMALIZATION_CONFLICT,
  MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY,
] as const;

export const meaningReviewNeedsActionWhere = {
  meaningReviewStatus: { in: [...NEEDS_ACTION_MEANING_REVIEW_STATUSES] },
} satisfies Prisma.WordSenseWhereInput;

export const meaningReviewConfirmedWhere = {
  meaningReviewStatus: MeaningReviewStatus.CONFIRMED,
} satisfies Prisma.WordSenseWhereInput;

export const meaningReviewNotNeedsActionWhere = {
  meaningReviewStatus: { notIn: [...NEEDS_ACTION_MEANING_REVIEW_STATUSES] },
} satisfies Prisma.WordSenseWhereInput;

export function isMeaningReviewNeedsAction(status: MeaningReviewStatus) {
  return NEEDS_ACTION_MEANING_REVIEW_STATUSES.includes(
    status as (typeof NEEDS_ACTION_MEANING_REVIEW_STATUSES)[number],
  );
}

export function meaningReviewStatusAfterSemanticChange(meaningId: number | null | undefined) {
  return meaningId == null
    ? MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY
    : MeaningReviewStatus.PENDING;
}

export function meaningReviewStatusLabel(status: MeaningReviewStatus) {
  switch (status) {
    case MeaningReviewStatus.CONFIRMED: return "Confirmed";
    case MeaningReviewStatus.PENDING: return "Pending AI review";
    case MeaningReviewStatus.NEEDS_ACTION_INVALID_PRIMARY: return "Needs action: invalid primary meaning";
    case MeaningReviewStatus.NEEDS_ACTION_NORMALIZATION_CONFLICT: return "Needs action: normalized Persian meaning conflict";
    case MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY: return "Needs action: missing primary meaning";
  }
}
