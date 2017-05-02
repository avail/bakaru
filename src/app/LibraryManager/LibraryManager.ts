import { Plugin } from '../PluginManager';
import { ServerContext } from "../server";
import FS from '../lib/FS';

export default class LibraryManager implements Plugin {
  protected fs: FS;

  getId(): string {
    return 'library-manager';
  }

  constructor(protected context: ServerContext) {
    this.fs = new FS(global.bakaru.paths.library);

    this.fs.resurrect().then(async (entriesIds: Set<string>) => {
      for (const entryId of entriesIds) {
        const entry = await this.fs.read(entryId).catch(() => null);

        if (entry !== null) {
          this.context.library.set(
            entryId,
            entry
          );
        }
      }

      this.context.events.emit(
        this.context.events.core.libraryResurrected,
        this.context.library
      );
    });

    this.context.events.on(
      this.context.events.core.entryExplore,
      this.onEntryExplore.bind(this)
    );
    this.context.events.on(
      this.context.events.core.entryUpdate,
      this.onEntryUpdate.bind(this)
    );
    this.context.events.on(
      this.context.events.core.entryStateUpdate,
      this.onEntryStateUpdate.bind(this)
    );

    // FIXME: No media props explored events handlers
  }

  protected onEntryExplore(entry: Bakaru.Entry) {
    this.fs.write(entry);
    this.emitExplored(entry);

    this.processEpisodes(entry);
  }

  protected processEpisodes(entry: Bakaru.Entry): void {
    const episodes = [...entry.episodes.values()];

    episodes.forEach((episode, index) => {
      const priority = index === 0
        ? 2 // High priority
        : 1; // Low priority

      this.context.events.emit(
        this.context.events.core.mediaPropsRequest,
        {
          entryId: entry.id,
          mediaId: episode.id,
          path: episode.path
        },
        priority
      );
    });
  }

  protected onEntryUpdate(entry: Bakaru.Entry) {
    if (this.context.library.has(entry.id)) {
      this.context.library.set(entry.id, entry);
      this.fs.write(entry);
      this.emitUpdated(entry);
    }
  }

  protected onEntryStateUpdate(id: string, state: Bakaru.EntryState) {
    const entry = this.context.library.get(id);

    if (entry) {
      entry.state = state;

      this.context.library.set(id, entry);
      this.fs.write(entry);
      this.emitStateUpdated(id, state);
    }
  }

  protected emitExplored(entry: Bakaru.Entry) {
    this.context.events.emit(
      this.context.events.core.entryExplored,
      entry
    );
  }

  protected emitUpdated(entry: Bakaru.Entry) {
    this.context.events.emit(
      this.context.events.core.entryExplored,
      entry
    );
  }

  protected emitStateUpdated(id: string, state: Bakaru.EntryState) {
    this.context.events.emit(
      this.context.events.core.entryExplored,
      { id, state }
    );
  }
}
