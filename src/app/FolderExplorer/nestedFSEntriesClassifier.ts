import { join } from 'path';
import { readdir } from 'fs';
import { promisify } from 'bluebird';
import classifyFSEntries from './FSEntriesClassifier';

const read = promisify(readdir);

/**
 * Transforms all items to absolute paths to those items
 *
 * @param {string} folderPath
 * @param {string[]} items
 * @returns {string[]}
 */
function normalizeItems(folderPath: string, items: string[]): string[] {
  return items.map(item => join(folderPath, item));
}

/**
 * Reads folder
 *
 * @param {string} folderPath
 * @returns {Promise<Bakaru.ClassifiedFolderItems>}
 */
async function readFolder(folderPath: string): Promise<Bakaru.ClassifiedFolderItems> {
  const items = await read(folderPath);

  return await classifyFSEntries(normalizeItems(folderPath, items));
}

/**
 * Builds flat tree of classified sub folders structure
 *
 * @param {string} folderPath
 * @returns {Promise<Map<string, Bakaru.ClassifiedFolderItems>>}
 */
export default async function flatten(folderPath: string): Promise<Map<string, Bakaru.ClassifiedFolderItems>> {
  const flatTree = new Map<string, Bakaru.ClassifiedFolderItems>();
  const unreadFolders = new Set<string>([folderPath]);
  const addUnreadFolder = unreadFolders.add.bind(unreadFolders);

  while (unreadFolders.size > 0) {
    for (const subFolderPath of unreadFolders.values()) {
      unreadFolders.delete(subFolderPath);

      const classes = await readFolder(subFolderPath);

      if (classes.folders.length > 0) {
        classes.folders.map(addUnreadFolder);
        classes.folders.length = 0;
      }

      if ((classes.audios.length + classes.videos.length + classes.subtitles.length) > 0) {
        flatTree.set(subFolderPath, classes);
      }
    }
  }

  return flatTree;
}