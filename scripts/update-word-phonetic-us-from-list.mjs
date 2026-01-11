import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UPDATES = [
  { id: 31, base_form: "bald", phonetic_us: "bɑld" },
  { id: 32, base_form: "bald", phonetic_us: "bɑld" },
  { id: 99, base_form: "corresponding", phonetic_us: "ˌkorəˈspɑndɪŋ" },
  { id: 100, base_form: "corresponding", phonetic_us: "ˌkorəˈspɑndɪŋ" },
  { id: 105, base_form: "authorized", phonetic_us: "ˈoθəˌraɪzd" },
  { id: 106, base_form: "authorized", phonetic_us: "ˈoθəˌraɪzd" },
  { id: 137, base_form: "lawsuit", phonetic_us: "ˈlɑˌsut" },
  { id: 138, base_form: "lawsuit", phonetic_us: "ˈlɑˌsut" },
  { id: 171, base_form: "outperform", phonetic_us: "ˌaʊt pərˈform" },
  { id: 172, base_form: "outperform", phonetic_us: "ˌaʊt pərˈform" },
  { id: 197, base_form: "avoid", phonetic_us: "əˈvoɪd" },
  { id: 198, base_form: "avoid", phonetic_us: "əˈvoɪd" },
  { id: 217, base_form: "sore", phonetic_us: "sor" },
  { id: 218, base_form: "sore", phonetic_us: "sor" },
  { id: 233, base_form: "clear off", phonetic_us: "klir ɑf" },
  { id: 234, base_form: "clear off", phonetic_us: "klir ɑf" },
  { id: 277, base_form: "transform", phonetic_us: "trænsˈform" },
  { id: 278, base_form: "transform", phonetic_us: "trænsˈform" },
  { id: 289, base_form: "come along", phonetic_us: "kʌm əˈlɑŋ" },
  { id: 290, base_form: "come along", phonetic_us: "kʌm əˈlɑŋ" },
  { id: 305, base_form: "alternative", phonetic_us: "ɑlˈtərnətɪv" },
  { id: 306, base_form: "alternative", phonetic_us: "ɑlˈtərnətɪv" },
  { id: 343, base_form: "ordinary", phonetic_us: "ˈordəˌnɛri" },
  { id: 344, base_form: "ordinary", phonetic_us: "ˈordəˌnɛri" },
  { id: 535, base_form: "explore", phonetic_us: "ɪkˈsplor" },
  { id: 536, base_form: "explore", phonetic_us: "ɪkˈsplor" },
  { id: 559, base_form: "reform", phonetic_us: "rɪˈform" },
  { id: 560, base_form: "reform", phonetic_us: "rɪˈform" },
  { id: 621, base_form: "mentor", phonetic_us: "ˈmentor" },
  { id: 622, base_form: "mentor", phonetic_us: "ˈmentor" },
  { id: 677, base_form: "moist", phonetic_us: "moɪst" },
  { id: 678, base_form: "moist", phonetic_us: "moɪst" },
  { id: 697, base_form: "incorporate", phonetic_us: "ɪnˈkorpoˌreɪt" },
  { id: 698, base_form: "incorporate", phonetic_us: "ɪnˈkorpoˌreɪt" },
  { id: 721, base_form: "prioritize", phonetic_us: "praɪˈorɪˌtaɪz" },
  { id: 722, base_form: "prioritize", phonetic_us: "praɪˈorɪˌtaɪz" },
  { id: 723, base_form: "alter", phonetic_us: "ˈɑltər" },
  { id: 724, base_form: "alter", phonetic_us: "ˈɑltər" },
  { id: 813, base_form: "deploy", phonetic_us: "dɪˈploɪ" },
  { id: 814, base_form: "deploy", phonetic_us: "dɪˈploɪ" },
  { id: 827, base_form: "authority", phonetic_us: "əˈθorɪti" },
  { id: 828, base_form: "authority", phonetic_us: "əˈθorɪti" },
  { id: 845, base_form: "loss", phonetic_us: "lɑs" },
  { id: 846, base_form: "loss", phonetic_us: "lɑs" },
  { id: 869, base_form: "authorize", phonetic_us: "ˈoθəˌraɪz" },
  { id: 870, base_form: "authorize", phonetic_us: "ˈoθəˌraɪz" },
  { id: 919, base_form: "sort out", phonetic_us: "sort aʊt" },
  { id: 920, base_form: "sort out", phonetic_us: "sort aʊt" },
  { id: 923, base_form: "accost", phonetic_us: "əˈkɑst" },
  { id: 924, base_form: "accost", phonetic_us: "əˈkɑst" },
  { id: 935, base_form: "ward", phonetic_us: "word" },
  { id: 936, base_form: "ward", phonetic_us: "word" },
  { id: 984, base_form: "hang on", phonetic_us: "hæŋ ɑn" },
  { id: 989, base_form: "immortal", phonetic_us: "ɪˈmortəl" },
  { id: 990, base_form: "immortal", phonetic_us: "ɪˈmortəl" },
  { id: 1015, base_form: "horrific", phonetic_us: "həˈrɪfɪk" },
  { id: 1016, base_form: "horrific", phonetic_us: "həˈrɪfɪk" },
  { id: 1021, base_form: "performance", phonetic_us: "pərˈforməns" },
  { id: 1022, base_form: "performance", phonetic_us: "pərˈforməns" },
  { id: 1051, base_form: "disorder", phonetic_us: "dɪsˈordər" },
  { id: 1052, base_form: "disorder", phonetic_us: "dɪsˈordər" },
  { id: 1073, base_form: "trauma", phonetic_us: "ˈtrɑmə" },
  { id: 1074, base_form: "trauma", phonetic_us: "ˈtrɑmə" },
  { id: 1075, base_form: "torment", phonetic_us: "torˈment" },
  { id: 1076, base_form: "torment", phonetic_us: "torˈment" },
  { id: 1697, base_form: "see off", phonetic_us: "si ɑf" },

  { id: 7, base_form: "jade", phonetic_us: "dʒeɪd" },
  { id: 11, base_form: "jasmine", phonetic_us: "ˈdʒæzmɪn" },
  { id: 14, base_form: "plaster", phonetic_us: "ˈplæstər" },
  { id: 32, base_form: "flower", phonetic_us: "ˈflaʊər" },
  { id: 41, base_form: "capsule", phonetic_us: "ˈkæpsəl" },
  { id: 78, base_form: "book", phonetic_us: "bʊk" },
  { id: 121, base_form: "money", phonetic_us: "ˈmʌni" },
  { id: 139, base_form: "mail", phonetic_us: "meɪl" },
  { id: 188, base_form: "reed", phonetic_us: "rid" },
  { id: 197, base_form: "thread", phonetic_us: "θrɛd" },
  { id: 201, base_form: "rod", phonetic_us: "rɑd" },
  { id: 214, base_form: "seal", phonetic_us: "sil" },
  { id: 215, base_form: "fog", phonetic_us: "fɑɡ" },
  { id: 240, base_form: "stain", phonetic_us: "steɪn" },
  { id: 247, base_form: "clothes", phonetic_us: "kloʊz" },
  { id: 253, base_form: "can", phonetic_us: "kæn" },
  { id: 285, base_form: "bud", phonetic_us: "bʌd" },
  { id: 293, base_form: "container", phonetic_us: "kənˈteɪnər" },
  { id: 298, base_form: "meteorite", phonetic_us: "ˈmitiəˌraɪt" },
  { id: 305, base_form: "horn", phonetic_us: "horn" },
  { id: 321, base_form: "stone", phonetic_us: "stoʊn" },
  { id: 341, base_form: "shadow", phonetic_us: "ˈʃædoʊ" },
  { id: 353, base_form: "poison", phonetic_us: "ˈpɔɪzən" },
  { id: 370, base_form: "gravel", phonetic_us: "ˈɡrævəl" },
  { id: 412, base_form: "tree", phonetic_us: "tri" },
  { id: 414, base_form: "seed", phonetic_us: "sid" },
  { id: 438, base_form: "soil", phonetic_us: "soɪl" },
  { id: 473, base_form: "seed", phonetic_us: "sid" },
  { id: 547, base_form: "cloud", phonetic_us: "klaʊd" },
  { id: 557, base_form: "iron", phonetic_us: "ˈaɪərn" },
  { id: 572, base_form: "brick", phonetic_us: "brɪk" },
  { id: 573, base_form: "fire", phonetic_us: "faɪr" },
  { id: 588, base_form: "dust", phonetic_us: "dʌst" },
  { id: 589, base_form: "bubble", phonetic_us: "ˈbʌbəl" },
  { id: 1196, base_form: "penalty", phonetic_us: "ˈpɛnəlti" },
  { id: 1198, base_form: "reward", phonetic_us: "rɪˈwɑrd" },
  { id: 1200, base_form: "flight", phonetic_us: "flaɪt" },
  { id: 1205, base_form: "storm", phonetic_us: "storm" },
  { id: 1207, base_form: "traffic", phonetic_us: "ˈtræfɪk" },
  { id: 1208, base_form: "certificate", phonetic_us: "sərˈtɪfɪkət" },
  { id: 1213, base_form: "recital", phonetic_us: "rɪˈsaɪtəl" },
  { id: 1220, base_form: "soot", phonetic_us: "sʊt" },
  { id: 1225, base_form: "beating", phonetic_us: "ˈbitɪŋ" },
  { id: 1226, base_form: "harvest", phonetic_us: "ˈhɑrvəst" },
  { id: 1235, base_form: "clod", phonetic_us: "klɑd" },
  { id: 1244, base_form: "app", phonetic_us: "æp" },
  { id: 1247, base_form: "legend", phonetic_us: "ˈlɛdʒənd" },
  { id: 1250, base_form: "action", phonetic_us: "ˈækʃən" },
  { id: 1251, base_form: "jinn", phonetic_us: "dʒɪn" },
  { id: 1252, base_form: "knot", phonetic_us: "nɑt" },
  { id: 1255, base_form: "diamond", phonetic_us: "ˈdaɪəmənd" },
  { id: 1258, base_form: "demon", phonetic_us: "ˈdimən" },
  { id: 1259, base_form: "apple", phonetic_us: "ˈæpəl" },
  { id: 1260, base_form: "news", phonetic_us: "nuz" },
  { id: 1265, base_form: "forging", phonetic_us: "ˈfordʒɪŋ" },
  { id: 1266, base_form: "melody", phonetic_us: "ˈmɛlədi" },
  { id: 1267, base_form: "makeup", phonetic_us: "ˈmeɪkʌp" },
  { id: 1275, base_form: "cleanup", phonetic_us: "ˈklinʌp" },
  { id: 1276, base_form: "advert", phonetic_us: "ˈædvɝt" },
  { id: 1277, base_form: "awareness", phonetic_us: "əˈwɛrnəs" },
  { id: 1279, base_form: "freedom", phonetic_us: "ˈfridəm" },
  { id: 1280, base_form: "email", phonetic_us: "ˈimeɪl" },
  { id: 1281, base_form: "instagram", phonetic_us: "ˈɪnstəˌɡræm" },
  { id: 1285, base_form: "x", phonetic_us: "ɛks" },
  { id: 1286, base_form: "emoji", phonetic_us: "ɪˈmoʊdʒi" },
  { id: 1288, base_form: "interview", phonetic_us: "ˈɪntərˌvju" },
  { id: 1298, base_form: "meteor", phonetic_us: "ˈmitiər" },
  { id: 1300, base_form: "kernel", phonetic_us: "ˈkɝnəl" },
  { id: 1306, base_form: "thunder", phonetic_us: "ˈθʌndər" },
  { id: 1316, base_form: "story", phonetic_us: "ˈstori" },
  { id: 1322, base_form: "opera", phonetic_us: "ˈɑpərə" },
  { id: 1330, base_form: "flood", phonetic_us: "flʌd" },
  { id: 1334, base_form: "explosion", phonetic_us: "ɪkˈsploʊʒən" },
  { id: 1337, base_form: "warning", phonetic_us: "ˈwɑrnɪŋ" },
  { id: 1338, base_form: "notice", phonetic_us: "ˈnoʊtɪs" },
  { id: 1339, base_form: "dismissal", phonetic_us: "dɪsˈmɪsəl" },
  { id: 1341, base_form: "devil", phonetic_us: "ˈdɛvəl" },
  { id: 1345, base_form: "signature", phonetic_us: "ˈsɪɡnətʃər" },
  { id: 1346, base_form: "gospel", phonetic_us: "ˈɡɑspəl" },
  { id: 1348, base_form: "notice", phonetic_us: "ˈnoʊtɪs" },
  { id: 1350, base_form: "rent", phonetic_us: "rɛnt" },
  { id: 1351, base_form: "permission", phonetic_us: "pərˈmɪʃən" },
  { id: 1354, base_form: "riot", phonetic_us: "ˈraɪət" },
  { id: 1361, base_form: "visa", phonetic_us: "ˈvizə" },
  { id: 1362, base_form: "ikea", phonetic_us: "aɪˈkiə" },
  { id: 1364, base_form: "willow", phonetic_us: "ˈwɪloʊ" },
  { id: 1365, base_form: "tobacco", phonetic_us: "təˈbækoʊ" },
  { id: 1367, base_form: "marriage", phonetic_us: "ˈmærɪdʒ" },
  { id: 1371, base_form: "cotton", phonetic_us: "ˈkɑtən" },
  { id: 1372, base_form: "cardboard", phonetic_us: "ˈkɑrdˌbord" },
  { id: 1373, base_form: "concrete", phonetic_us: "ˈkɑŋkrit" },
  { id: 1374, base_form: "cement", phonetic_us: "sɪˈmɛnt" },
  { id: 1375, base_form: "silver", phonetic_us: "ˈsɪlvər" },
  { id: 1376, base_form: "gold", phonetic_us: "ɡoʊld" },
  { id: 1377, base_form: "ink", phonetic_us: "ɪŋk" },
  { id: 1378, base_form: "lacquer", phonetic_us: "ˈlækər" },
  { id: 1379, base_form: "oil", phonetic_us: "oɪl" },
  { id: 1380, base_form: "oil", phonetic_us: "oɪl" },
  { id: 1381, base_form: "gas", phonetic_us: "ɡæs" },
  { id: 1382, base_form: "tar", phonetic_us: "tɑr" },
  { id: 1383, base_form: "steam", phonetic_us: "stim" },
  { id: 1384, base_form: "gravel", phonetic_us: "ˈɡrævəl" },
  { id: 1385, base_form: "sand", phonetic_us: "sænd" },
  { id: 1386, base_form: "mud", phonetic_us: "mʌd" },
  { id: 1387, base_form: "sugar", phonetic_us: "ˈʃʊɡər" },
  { id: 1388, base_form: "soap", phonetic_us: "soʊp" },
  { id: 1389, base_form: "gel", phonetic_us: "dʒɛl" },
  { id: 1390, base_form: "cream", phonetic_us: "krim" },
  { id: 1391, base_form: "rice", phonetic_us: "raɪs" },
  { id: 1392, base_form: "corn", phonetic_us: "korn" },
  { id: 1393, base_form: "bean", phonetic_us: "bin" },
  { id: 1394, base_form: "almond", phonetic_us: "ˈɑmənd" },
  { id: 1395, base_form: "walnut", phonetic_us: "ˈwɑlnʌt" },
  { id: 1396, base_form: "mat", phonetic_us: "mæt" },
  { id: 1397, base_form: "bamboo", phonetic_us: "bæmˈbu" },
  { id: 1398, base_form: "straw", phonetic_us: "strɑ" },
  { id: 1399, base_form: "sponge", phonetic_us: "spʌndʒ" },
  { id: 1426, base_form: "cactus", phonetic_us: "ˈkæktəs" },
  { id: 1427, base_form: "thorn", phonetic_us: "θorn" },
  { id: 1429, base_form: "column", phonetic_us: "ˈkɑləm" },
  { id: 1433, base_form: "root", phonetic_us: "rut" },
  { id: 1434, base_form: "stem", phonetic_us: "stɛm" },
  { id: 1443, base_form: "opium", phonetic_us: "ˈoʊpiəm" },

  { id: 2115, base_form: "core", phonetic_us: "kor" },
  { id: 2116, base_form: "core", phonetic_us: "kor" },
  { id: 1374, base_form: "forth", phonetic_us: "forθ" },
  { id: 1375, base_form: "forth", phonetic_us: "forθ" },
  { id: 2257, base_form: "forth", phonetic_us: "forθ" },
  { id: 1326, base_form: "cord", phonetic_us: "kord" },
  { id: 1601, base_form: "shore", phonetic_us: "ʃor" },
  { id: 1657, base_form: "soil", phonetic_us: "soɪl" },
  { id: 1975, base_form: "broad", phonetic_us: "brɑd" },
  { id: 1736, base_form: "pork", phonetic_us: "pork" },
  { id: 2072, base_form: "ball", phonetic_us: "bɑl" },
  { id: 2073, base_form: "ball", phonetic_us: "bɑl" },
  { id: 1961, base_form: "annoy", phonetic_us: "əˈnoɪ" },
  { id: 1566, base_form: "stalk", phonetic_us: "stɑk" },
  { id: 2077, base_form: "adore", phonetic_us: "əˈdor" },
  { id: 2078, base_form: "adore", phonetic_us: "əˈdor" },
  { id: 1907, base_form: "auger", phonetic_us: "ˈoɡər" },
  { id: 1205, base_form: "haunt", phonetic_us: "hɑnt" },
  { id: 1840, base_form: "straw", phonetic_us: "strɑ" },
];

async function updateWords() {
  let updated = 0;
  let skippedMismatch = 0;
  let skippedMissing = 0;

  for (const item of UPDATES) {
    const res = await prisma.$executeRawUnsafe(
      "UPDATE Word SET phonetic_us = ? WHERE id = ? AND base_form = ?",
      item.phonetic_us,
      item.id,
      item.base_form
    );
    const count = Number(res ?? 0);
    if (count === 1) {
      updated += 1;
      continue;
    }

    const exists = await prisma.$queryRawUnsafe(
      "SELECT id, base_form FROM Word WHERE id = ? LIMIT 1",
      item.id
    );
    if (!exists.length) skippedMissing += 1;
    else skippedMismatch += 1;
  }

  return { updated, skippedMismatch, skippedMissing };
}

async function backfillNormalizedFrom(minId) {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const url = new URL("/api/ipa-test/backfill-normalized", baseUrl);
  url.searchParams.set("batch", "2000");
  url.searchParams.set("startId", String(Math.max(0, (minId ?? 0) - 1)));
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backfill failed: ${res.status} ${res.statusText}\n${text}`);
  }
  let json = await res.json();
  while (!json.done) {
    url.searchParams.set("startId", String(json.nextStartId ?? 0));
    const r = await fetch(url, { method: "POST" });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`Backfill failed: ${r.status} ${r.statusText}\n${text}`);
    }
    json = await r.json();
  }
}

async function main() {
  const minId = Math.min(...UPDATES.map((u) => u.id));
  const result = await updateWords();
  process.stdout.write(
    `Word phonetic_us update: updated=${result.updated} skippedMissing=${result.skippedMissing} skippedMismatch=${result.skippedMismatch}\n`
  );
  await backfillNormalizedFrom(minId);
  process.stdout.write("Backfill normalized: done\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
