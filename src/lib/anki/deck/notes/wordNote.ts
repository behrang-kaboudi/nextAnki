export const WordAnkiConstants = {
  noteFields: [
    "anki_link_id",
    "base_form",
    "base_form_audio",
    "phonetic_us",
    "pos",
    "meaning_fa",
    "meaning_fa_audio",
    "other_meanings_fa",
    "other_meanings_fa_audio",
    "other_meanings_en",
    "other_meanings_en_audio",
    "concept_explained_fa",
    "concept_explained_fa_audio",
    "sentence_en",
    "sentence_en_audio",
    "sentence_en_meaning_fa",
    "sentence_en_meaning_fa_audio",
    "best_translate",
    "mixed_sentence",
    "first_letter_fa_hint",
    "first_letter_en_hint",
    "selfGuide",
    "hint_to_select_letters",
    "hint_sentence",
    "phonetic_us_normalized",
    "learning_depth",
    "imageability",
    "json_hint",
    "updatedAt",
  ],
  noteTemplates: {
    EnToFa: {
      Front: `
<div style='display:none'>[sound:rec1773369104.mp3]</div>
{{base_form}} {{base_form_audio}}{{phonetic_us}}
<div style='display:none'>[sound:rec1768097855.mp3]</div>
<br>
{{sentence_en}} {{sentence_en_audio}}
<div style='display:none'>[sound:6s_Stop.mp3]</div>`,
      Back: `
<div style='display:none'>[sound:rec1773369104.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{phonetic_us}}</div>
<hr id='answer'>
<div style='display:none'>[sound:rec1765049893.mp3]</div>

<div style=";text-align:right">
{{meaning_fa}} {{meaning_fa_audio}}
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa}} {{other_meanings_fa_audio}}</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_en}} {{other_meanings_en_audio}}</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}} {{concept_explained_fa_audio}}</div>
</div>
<div style='display:none'>[sound:rec1765049893.mp3]</div>{{sentence_en_meaning_fa}} {{sentence_en_meaning_fa_audio}}<div style='font-family: "Arial"; font-size: 20px;direction:rtl'></div>
<div style='font-family: "Arial"; font-size: 20px;'>{{best_translate}}</div>
<hr>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
  </div>
</div>

<hr>
<div style=";text-align:right">
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_fa_hint}}</div>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>`,
    },
    FaToEn: {
      Front: `
<div style='display:none'>[sound:rec1773369104.mp3]</div>

<div style=";text-align:right">


<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa}} {{meaning_fa_audio}}</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa}} {{other_meanings_fa_audio}}</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_en}} {{other_meanings_en_audio}}</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}} {{concept_explained_fa_audio}}</div>
</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{mixed_sentence}}</div>
<div style='display:none'>[sound:6s_Stop.mp3]</div>
<div style=";text-align:right">
<div style='font-family: "Arial"; font-size: 20px;'>{{hint_to_select_letters}}</div>
<div style='display:none'>[sound:6s_Stop.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>

`,
      Back: `
<div style='display:none'>[sound:rec1773369104.mp3]</div>
{{base_form}} {{base_form_audio}}{{phonetic_us}}

<hr>
<div style=";text-align:right">
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_fa_hint}}</div>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>`,
    },
    Emla: {
      Front: `<div style=";text-align:right">
<div style='display:none'>[sound:rec1765049893.mp3]</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa}} {{meaning_fa_audio}}</div>

<div style='display:none'>[sound:rec1765487198.mp3]</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}} {{concept_explained_fa_audio}}</div>
</div>
<hr>
{{base_form}} {{base_form_audio}}{{phonetic_us}}

<div style=";text-align:right">
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_fa_hint}}</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>`,
      Back: `{{base_form}} {{base_form_audio}}{{phonetic_us}}
<br>
{{sentence_en}} {{sentence_en_audio}}
<hr>
<div style=";text-align:right">
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_fa_hint}}</div>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>`,
    },
    Rahnama: {
      Front: `<div style='display:none'>[sound:rec1765049893.mp3]</div>{{base_form}} {{base_form_audio}}{{phonetic_us}}

<div style='display:none'>
[sound:rec1771027001.mp3]

[sound:6s_Stop.mp3]</div>

`,
      Back: `{{FrontSide}}


{{#selfGuide}}<div style='font-family: "Arial"; font-size: 20px;'>{{selfGuide}}</div>{{/selfGuide}}{{^selfGuide}}<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>{{/selfGuide}}

`,
    },
    Rahnama2: {
      Front: `{{#selfGuide}}<div style='font-family: "Arial"; font-size: 20px;'>{{selfGuide}}</div>{{/selfGuide}}{{^selfGuide}}<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>{{/selfGuide}}

`,
      Back: `{{FrontSide}}
<div style=";text-align:right">
	{{meaning_fa}} {{meaning_fa_audio}}
</div>`,
    },
  },
  cardTypes: {
    EnToFa: "EnToFa",
    FaToEn: "FaToEn",
    Emla: "Emla",
    Rahnama: "Rahnama",
    Rahnama2: "Rahnama2",
  },
  decks: {
    tempRoot: "TempFor1WordsForNewStudy",
    root: "WordsForNewStudy",
    EnToFa: "WordsForNewStudy::EnToFa",
    FaToEn: "WordsForNewStudy::FaToEn",
    Emla: "WordsForNewStudy::Emla",
    Rahnama: "WordsForNewStudy::Rahnama",
    Rahnama2: "WordsForNewStudy::Rahnama2",
  },
} as const;
