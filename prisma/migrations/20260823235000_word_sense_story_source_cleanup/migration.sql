ALTER TABLE `word_sense_story`
    DROP FOREIGN KEY `word_sense_story_wordSenseId_fkey`;

ALTER TABLE `word_sense_story`
    ADD CONSTRAINT `word_sense_story_wordSenseId_fkey`
    FOREIGN KEY (`wordSenseId`) REFERENCES `word_sense`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER `english_word_json_hint_story_cleanup`
AFTER UPDATE ON `english_word`
FOR EACH ROW
DELETE FROM `word_sense_story`
WHERE `wordSenseId` IN (
    SELECT `id` FROM `word_sense` WHERE `englishId` = NEW.`id`
)
AND NOT (OLD.`json_hint` <=> NEW.`json_hint`);

