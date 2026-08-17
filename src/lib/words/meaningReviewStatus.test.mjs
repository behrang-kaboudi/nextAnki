import assert from "node:assert/strict";
import test from "node:test";

import { MeaningReviewStatus } from "@prisma/client";

import {
  isMeaningReviewNeedsAction,
  meaningReviewConfirmedWhere,
  meaningReviewNotNeedsActionWhere,
} from "./meaningReviewStatus.ts";

test("only human-action statuses are classified as needs action", () => {
  assert.equal(isMeaningReviewNeedsAction(MeaningReviewStatus.PENDING), false);
  assert.equal(isMeaningReviewNeedsAction(MeaningReviewStatus.CONFIRMED), false);
  assert.equal(isMeaningReviewNeedsAction(MeaningReviewStatus.NEEDS_ACTION_INVALID_PRIMARY), true);
  assert.equal(isMeaningReviewNeedsAction(MeaningReviewStatus.NEEDS_ACTION_NORMALIZATION_CONFLICT), true);
  assert.equal(isMeaningReviewNeedsAction(MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY), true);
});

test("workflow filters keep confirmed and non-attention scopes distinct", () => {
  assert.deepEqual(meaningReviewConfirmedWhere, {
    meaningReviewStatus: MeaningReviewStatus.CONFIRMED,
  });
  assert.deepEqual(meaningReviewNotNeedsActionWhere, {
    meaningReviewStatus: {
      notIn: [
        MeaningReviewStatus.NEEDS_ACTION_INVALID_PRIMARY,
        MeaningReviewStatus.NEEDS_ACTION_NORMALIZATION_CONFLICT,
        MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY,
      ],
    },
  });
});
