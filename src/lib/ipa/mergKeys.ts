import { PictureWord, PictureWordType } from "@prisma/client";
import Word from "@prisma/client";

export function mergeKeysAndPictureWords(
  keys1: PictureWord[],
  keys2: PictureWord[],
  ipa?: string
) {
  const mergedList: [PictureWord, PictureWord][] = [];
  const preHumans = getPreHuman(keys1);
  const afterHumans = getAfterHuman(keys2);
  const humans = getHumans(keys2);
  for (const preHuman of preHumans) {
    if (humans.length === 0) continue;
    for (const human of humans) {
      if (preHuman.fa === human.fa) continue;
      mergedList.push([preHuman, human]);
    }
  }
  const humansAsPart1 = getHumans(keys1);
  //   for (const human of humansAsPart1) {
  //     if (humans.length === 0) continue;
  //     for (const afterHuman of afterHumans) {
  //       if (afterHuman.fa === human.fa) continue;
  //       mergedList.push([human, afterHuman]);
  //     }
  //   }
  return mergedList;
}
function getHumans(keys: PictureWord[]) {
  return keys.filter(
    (k) =>
      k.type === PictureWordType.person ||
      k.type === PictureWordType.animal ||
      k.type === PictureWordType.tool //||
    //   k.type === PictureWordType.accessory ||
    //   k.type === PictureWordType.food
  );
}
function getPreHuman(keys: PictureWord[]) {
  return keys.filter(
    (k) =>
      k.type === PictureWordType.animal ||
      k.type === PictureWordType.food ||
      k.type === PictureWordType.humanBody ||
      k.type === PictureWordType.tool ||
      k.type === PictureWordType.accessory ||
      // k.type === PictureWordType.sport ||
      //   k.type === PictureWordType.noun ||
      k.canBePersonal === true
  );
}
function getAfterHuman(keys: PictureWord[]) {
  return keys.filter(
    (k) =>
      k.type === PictureWordType.personAdj ||
      k.type === PictureWordType.adj ||
      k.type === PictureWordType.personAdj_adj
    //
    //   k.type === PictureWordType.food ||
    //   k.type === PictureWordType.humanBody ||
    //   k.type === PictureWordType.tool ||
    //   k.type === PictureWordType.accessory
  );
}
