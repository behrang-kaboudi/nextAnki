# Legacy Persian sentence-audio mismatch audit

Read-only comparison with the first historical database snapshot whose internal timestamp is at or after each legacy audio timestamp.

## Results

- Legacy audio candidates: 4292
- Historical source recovered: 4190
- Historical/current spoken-text mismatches: 239
- Priority 1 (difference >= 15%): 181
- Priority 2 (difference < 15%): 58
- Unresolved historical source: 102

## Files

- [mismatches.csv](./mismatches.csv) and [mismatches.json](./mismatches.json)
- [unresolved.csv](./unresolved.csv) and [unresolved.json](./unresolved.json)
- [qa.md](./qa.md) and [manifest.json](./manifest.json)

## Local inspection links

- [Open Priority 1 in Sentence Table](http://localhost:3000/words/tables/sentences?ids=386,361,354,129,3570,298,205,177,4075,116,199,267,216,224,272,287,336,243,246,302,232,242,29,103,240,320,212,104,140,266,252,356,268,196,215,297,391,370,202,50,372,81,352,106,227,260,225,369,211,250,347,238,41,210,233,306,388,308,313,318,234,35,48,162,93,209,271,241,249,316,64,214,277,324,373,85,292,357,147,90,96,339,24,175,63,317,261,65,49,310,259,171,328,340,1,228,127,92,248,154,188,337,396,314,16,204,303,53,264,304,101,321,376,25,206,295,218,393,59,197,360,55,110,135,219,229,231,368,77,201,115,97,145,307,338,45,164,254,84,178,5,57,351,305,2,88,130,39,325,182,379,151,72,163,7,107,184,109,46,239,38,56,113,179,301,343,392,47,51,74,91,385,73,102,122,174,54,258,332,111,390&pageSize=200)
- [Open Priority 2 in Sentence Table](http://localhost:3000/words/tables/sentences?ids=359,165,3,173,344,353,136,149,309,36,71,34,160,364,78,326,342,330,358,200,75,398,87,69,170,79,335,98,291,377,334,285,18,329,341,378,274,380,350,126,245,76,42,70,62,17,331,52,44,180,131,43,40,99,152,15,256,172&pageSize=100)

Each row contains an individual local URL and absolute MP3 path. No database row or audio file was changed.
