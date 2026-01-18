OUTPUT FORMAT (STRICT)

Return a JSON object with exactly these fields:

{
"input": "<original word or phrase>",
"visual_score": <number 1-100>,
"reason": "<one short sentence explaining why>"
}

EXAMPLES (FOR CALIBRATION ONLY)

Input: "سیب"
Output:
{
"input": "سیب",
"visual_score": 98,
"reason": "A physical object with clear shape, color, and form."
}

Input: "صندلی شکسته"
Output:
{
"input": "صندلی شکسته",
"visual_score": 95,
"reason": "A concrete object with a visible physical condition."
}

Input: "دویدن"
Output:
{
"input": "دویدن",
"visual_score": 55,
"reason": "An action that can be imagined but lacks a fixed shape."
}

Input: "عدالت"
Output:
{
"input": "عدالت",
"visual_score": 3,
"reason": "An abstract concept with no physical form."
}

Input: "میز پرتقال‌فروش"
Output:
{
"input": "میز پرتقال‌فروش",
"visual_score": 82,
"reason": "A physical object combined with a concrete role."
}

NOW evaluate the following input word or phrase strictly based on the rules above.
