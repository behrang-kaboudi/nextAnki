RENAME TABLE `word` TO `word_sense`;

ALTER TABLE `word_sense`
  RENAME INDEX `Word_anki_link_id_key` TO `WordSense_anki_link_id_key`,
  RENAME INDEX `Word_englishId_idx` TO `WordSense_englishId_idx`,
  RENAME INDEX `Word_meaningId_idx` TO `WordSense_meaningId_idx`,
  RENAME INDEX `Word_conceptMergeReviewed_idx` TO `WordSense_conceptMergeReviewed_idx`,
  RENAME INDEX `Word_inflectionMergeReviewed_idx` TO `WordSense_inflectionMergeReviewed_idx`;
