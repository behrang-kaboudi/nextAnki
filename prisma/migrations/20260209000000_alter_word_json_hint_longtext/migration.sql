-- Prevent truncation of large json_hint payloads.
ALTER TABLE `Word`
  MODIFY `json_hint` LONGTEXT NULL;

