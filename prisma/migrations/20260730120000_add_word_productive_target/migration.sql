ALTER TABLE `word`
    ADD COLUMN `productive_target` INTEGER NULL,
    ADD CONSTRAINT `Word_productive_target_range`
        CHECK (`productive_target` IS NULL OR (`productive_target` >= 0 AND `productive_target` <= 101));
