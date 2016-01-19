import naturalSort from 'javascript-natural-sort';
import { get as levenshtein } from 'fast-levenshtein';

/**
 * Detects if given folder is an anime
 *
 * @param {ClassifiedItems} classifiedItems
 * @returns {boolean}
 */
export default function isAnimeFolder(classifiedItems) {
  const videos = classifiedItems.videos.slice().sort(naturalSort);
  const videosLength = videos.length;
  const distances = [];
  const pairs = [];
  const percentile = .9;

  for (let i = 0; i < videosLength; i++) {
    for (let j = 0; j < videosLength; j++) {
      const compositeKey = `${i}${j}`;

      if (i === j || pairs.indexOf(compositeKey) > -1) {
        continue;
      } else {
        pairs[pairs.length] = compositeKey;
      }

      distances[distances.length] = levenshtein(videos[i], videos[j]);
    }
  }

  distances.sort((a, b) => a > b);
  const index = Math.round(distances.length * percentile) + 1;
  const mean = distances.slice(0, index).reduce((acc, n) => acc + n, 0) / index;

  // 90% times diff should be less than 3 symbols, that should be enough, huh?
  return mean < 3;
}