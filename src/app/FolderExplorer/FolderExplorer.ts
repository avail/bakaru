import { Plugin } from '../PluginManager';
import { promisify } from 'bluebird';
import { ServerContext } from "../server";
import classify from './FSEntriesClassifier';
import isSeries from './isSeries';
import makeSeriesEntry from './makers/seriesEntry';
// import * as makeStandAlone from './makers/standAlone';
import {
  readdir as readdirOrigin,
  stat as statOrigin
} from 'fs';

const read = promisify(readdirOrigin);
const stat = promisify(statOrigin);

export default class FolderExplorer implements Plugin {
  getId(): string {
    return 'folder-reader';
  }

  constructor(protected context: ServerContext) {
    context.events.on(
      this.context.events.coreEvents.folderAdded,
      this.onFolderAdded.bind(this)
    );
  }

  /**
   * Listens for folder added events
   *
   * @param {string} folderPath
   */
  async onFolderAdded(folderPath: string): Promise<void> {
    const normalizedPath = folderPath.normalize();

    try {
      const normalizedPathStats = await stat(normalizedPath);

      if (!normalizedPathStats.isDirectory()) {
        this.context.events.emit(
          this.context.events.coreEvents.errors.folderNotFolder,
          folderPath
        );
      } else {
        this.readFolder(folderPath);
      }
    } catch(error) {
      this.context.events.emit(
        this.context.events.coreEvents.errors.folderNotExist,
        folderPath
      );
    }
  }

  /**
   * Recursively reads folder
   *
   * @param {string} folderPath
   * @returns {Promise}
   */
  async readFolder(folderPath: string): Promise<void> {
    const items = await read(folderPath);
    const classes = await classify(items);

    if (isSeries(classes)) {
      this.processSeries(folderPath, classes);
    } else {
      // TODO: DO IT, JUST DO IT!!!
      // this.processNonSeries(classes);
    }
  }

  /**
   * Process series
   *
   * @param {string} seriesPath
   * @param {ClassifiedFolderItems} classes
   */
  async processSeries(seriesPath: string, classes: ClassifiedFolderItems) {
    const entry = await makeSeriesEntry(seriesPath, classes);

    this.context.events.emit(
      this.context.events.coreEvents.entryUpdate,
      entry
    );
  }

  /**
   * Processes non series folder items
   *
   * @param {ClassifiedFolderItems} classes
   */
  // processNonSeries(classes: ClassifiedFolderItems): void {
  //   // Sub folders
  //   if (classes.folders.length > 0) {
  //     classes.folders.forEach(folder => this.readFolder(folder));
  //   }
  //
  //   // Standalone videos, movies may be?
  //   if (classes.videos.length > 0) {
  //     classes.videos.forEach(video => this.context.events.emit(
  //       coreEvents.entryRead,
  //       makeStandAlone.entry(video)
  //     ));
  //   }
  //
  //   // Standalone voice-overs
  //   if (classes.audios.length > 0) {
  //     classes.audios.forEach(audio => this.context.events.emit(
  //       coreEvents.voiceOverRead,
  //       makeStandAlone.voiceOver(audio)
  //     ));
  //   }
  //
  //   // Standalone subtitles
  //   if (classes.subtitles.length > 0) {
  //     classes.subtitles.forEach(subtitles => this.context.events.emit(
  //       coreEvents.subtitlesRead,
  //       makeStandAlone.subtitles(subtitles)
  //     ));
  //   }
  // }
}