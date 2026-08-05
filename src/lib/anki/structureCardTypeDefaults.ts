export const defaultStructureCardTypeTemplates = {
  "EnToFa": {
    Front: `<div style="display:none;">[sound:anki_question_gentle_chime.mp3]</div>
<div style="display:none;">
[sound:rec1784581227.mp3]
</div>
<div style="">
<table style="">
<tr >
<td  >
{{base_form}} 
<div style="white-space: nowrap"> /{{phonetic_us}}/</div>
</td>
<td  style="text-align:right">
{{base_form_audio}}
</td>

</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en}}</div>

</td>
<td  style="text-align:right">
<div style="display:none">

[sound:rec1778206722.mp3]

</div>{{sentence_en_audio}}

</td>

</tr>


</table>
</div>





`,
    Back: `<div style="display:none;">
[sound:rec1784581227.mp3]
</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{base_form}} <span> /{{phonetic_us}}/</span></div>
<hr id='answer'>

<div style="direction:rtl;text-align:right">
<table style="width:100%">
<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa_audio}}</div>
</td>
<td>
{{meaning_fa}}
</td>
</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa}}</div>
</td>
</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}}</div>
</td>
</tr>


<tr>
<td>

<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en_meaning_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en_meaning_fa}}</div>
</td>
</tr>

</table>
</div>




<div style="display:none">

[sound:rec1778206722.mp3]

</div>

<hr>



`,
  },
  "FaToEn": {
    Front: `<div style="display:none;">[sound:anki_question_gentle_chime.mp3]</div>
<div style="display:none;">
[sound:rec1784581227.mp3]
</div>
<div style="direction:rtl;text-align:right">
<table style="width:100%">
<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa_audio}}</div>
</td>
<td>
{{meaning_fa}}
</td>
</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa}}</div>
</td>
</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}}</div>
</td>
</tr>


<tr>
<td>

<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en_meaning_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en_meaning_fa}}</div>
</td>
</tr>

</table>
</div>




<div style="display:none">

[sound:rec1778206722.mp3]

</div>

<hr>

<div style=";text-align:right">
<div style='font-family: "Arial"; font-size: 20px;'>{{hint_to_select_letters}}</div>

</div>









`,
    Back: `<div style="display:none;">
[sound:rec1784581227.mp3]
</div>
<div style="direction:rtl; text-align:right">

{{meaning_fa}}. {{concept_explained_fa}}

</div>
<hr>
<div style="">
<table >

<tr >
<td  >
{{base_form}} 
<div style="white-space: nowrap"> /{{phonetic_us}}/</div>
</td>
<td  style="text-align:right">
{{base_form_audio}}
</td>

</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en}}</div>

</td>
<td  style="text-align:right">
<div style="display:none">

[sound:rec1778206722.mp3]

</div>{{sentence_en_audio}}

</td>

</tr>




</table>
</div>

<div style="display:none">

[sound:rec1778206722.mp3]

</div>

<hr>




`,
  },
  "Rahnama": {
    Front: `<div style="display:none;">[sound:anki_question_gentle_chime.mp3]</div>
<div style='display:none'>[sound:rec1765049893.mp3]</div>{{base_form}} {{base_form_audio}}{{phonetic_us}}

<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa}}</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa_audio}}</div>


<div style='display:none'>
[sound:rec1771027001.mp3]

[sound:6s_Stop.mp3]</div>





`,
    Back: `{{FrontSide}}


<div style='font-family: "Arial"; font-size: 20px;'>{{selfGuide}}</div>

`,
  },
  "Rahnama2": {
    Front: `<div style="display:none;">[sound:anki_question_gentle_chime.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{selfGuide}}</div>

`,
    Back: `{{FrontSide}}
<div style=";text-align:right">
	{{meaning_fa}} {{meaning_fa_audio}}
</div>`,
  },
  "EnToFaRev": {
    Front: `<div style="display:none;">[sound:anki_question_gentle_chime.mp3]</div>
<div style="display:none;">
[sound:rec1784581227.mp3]
</div>
<div style="">
<table style="">
<tr >
<td  >
{{base_form}} 
<div style="white-space: nowrap"> /{{phonetic_us}}/</div>
</td>
<td  style="text-align:right">
{{base_form_audio}}
</td>

</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en}}</div>

</td>
<td  style="text-align:right">
<div style="display:none">

[sound:rec1778206722.mp3]

</div>{{sentence_en_audio}}

</td>

</tr>


</table>
</div>

`,
    Back: `<div style="display:none;">
[sound:rec1784581227.mp3]
</div>



<div style='font-family: "Arial"; font-size: 20px;'>{{base_form}} <span> /{{phonetic_us}}/</span></div>
<hr id='answer'>

<div style="direction:rtl;text-align:right">
<table style="width:100%">
<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa_audio}}</div>
</td>
<td>
{{meaning_fa}}
</td>
</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa}}</div>
</td>
</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}}</div>
</td>
</tr>


<tr>
<td>

<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en_meaning_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en_meaning_fa}}</div>
</td>
</tr>

</table>
</div>




<div style="display:none">

[sound:rec1778206722.mp3]

</div>



`,
  },
  "FaToEnRev": {
    Front: `<div style="display:none;">[sound:anki_question_gentle_chime.mp3]</div>
<div style="display:none;">
[sound:rec1784581227.mp3]
</div>
<div style="direction:rtl;text-align:right">
<table style="width:100%">
<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa_audio}}</div>
</td>
<td>
{{meaning_fa}}
</td>
</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{other_meanings_fa}}</div>
</td>
</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}}</div>
</td>
</tr>


<tr>
<td>

<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en_meaning_fa_audio}}</div>
</td>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en_meaning_fa}}</div>
</td>
</tr>

</table>
</div>




<div style="display:none">

[sound:rec1778206722.mp3]

</div>

<hr>

<div style=";text-align:right">
<div style='font-family: "Arial"; font-size: 20px;'>{{hint_to_select_letters}}</div>

</div>


`,
    Back: `<div style="display:none;">
[sound:rec1784581227.mp3]
</div>
<div style="direction:rtl; text-align:right">

{{meaning_fa}}. {{concept_explained_fa}}

</div>
<hr>
<div style="">
<table >

<tr >
<td  >
{{base_form}} 
<div style="white-space: nowrap"> /{{phonetic_us}}/</div>
</td>
<td  style="text-align:right">
{{base_form_audio}}
</td>

</tr>

<tr>
<td>
<div style='font-family: "Arial"; font-size: 20px;'>{{sentence_en}}</div>

</td>
<td  style="text-align:right">
<div style="display:none">

[sound:rec1778206722.mp3]

</div>{{sentence_en_audio}}

</td>

</tr>




</table>
</div>

<div style="display:none">

[sound:rec1778206722.mp3]

</div>




`,
  },
} as const;
