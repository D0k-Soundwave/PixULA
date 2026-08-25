'use strict';
(function() {

/**
 * BackupService - autosave that lands on disk, as numbered versions.
 *
 * WHAT IT DOES. Each autosave tick writes the whole document to a folder the
 * artist chose, as `<name> V1.pixula`, `<name> V2.pixula`, and so on. The
 * numbers are a history: open V7 to get the picture back as it stood seven
 * saves ago. The interval is the artist's (Preferences, 0 = off), so how far
 * back the trail reaches is theirs to set.
 *
 * IT IS ADDITIVE, NEVER A REPLACEMENT. The IndexedDB autosave record still
 * happens on the same tick, first, whatever this does. A folder can go away -
 * unplugged drive, moved directory, a permission that lapsed on reload - and
 * none of that may cost the artist their crash recovery. Disk backups are the
 * better artefact; the database record is the one that cannot fail.
 *
 * THE PERMISSION PROBLEM, stated plainly. A `FileSystemDirectoryHandle`
 * structured-clones into IndexedDB and survives a reload, but Chrome will not
 * silently reopen it in a new session: `requestPermission()` needs a user
 * gesture, and an autosave TIMER is not one. So after every reload the first
 * tick finds the permission in the 'prompt' state and cannot ask. Rather than
 * fail silently every minute - the worst possible behaviour for a backup, since
 * you find out when you need it - the service goes into a `needsPermission`
 * state, announces it once on the bus, and stops trying. The Preferences panel
 * shows a Resume Backups button; clicking it IS the gesture, and writing
 * continues from the next version number. `resume()` is safe to call from any
 * click.
 *
 * VERSION NUMBERS SURVIVE RELOADS because they are read off the folder, not
 * remembered: `_nextVersion` lists the directory and takes the highest `V<n>`
 * matching the base name. Two sessions backing up the same picture continue one
 * sequence rather than overwriting each other's V1.
 */

/*
 * [C] How many versions to keep, by default.
 *
 * The interval controls FREQUENCY, not total count - at the 1-minute default an
 * eight-hour session is 480 files, which is not a history anyone reads. 20 is
 * the last 20 minutes at the default interval, or the last 10 hours at a
 * 30-minute one; either way it is a list you can look down. The artist sets
 * both numbers, and 0 means keep everything.
 */
const DEFAULT_KEEP_VERSIONS = 20;

/** Storage keys. The handle needs its own record - it is not a JSON value. */
const HANDLE_KEY = 'backupFolder';
const KEEP_KEY = 'backupKeepVersions';

/** `<base> V<n>.pixula` - the shape both the writer and the scanner agree on. */
const VERSION_RE = /^(.*) V(\d+)\.pixula$/i;

/** The label passed to the native folder picker and shown to the artist. */
const BACKUP_FOLDER_LABEL = 'PixULA Backups';

class BackupServiceClass {
    constructor() {
        this.directory = null;
        this.needsPermission = false;
        this.lastError = null;
        this.lastWritten = null;
        this._keep = DEFAULT_KEEP_VERSIONS;

        this._provider = new BrowserFSAProvider();
    }

    /** Is the browser able to do this at all? @returns {boolean} */
    get isSupported() {
        return this._provider.isAvailable();
    }

    /** Is a folder configured (whether or not it is currently permitted)? */
    get isConfigured() {
        return !!this.directory;
    }

    /** Are we actually able to write right now? */
    get isActive() {
        return !!this.directory && !this.needsPermission;
    }

    /** How many versions are kept; 0 = every one. @returns {number} */
    getKeepVersions() { return this._keep; }

    /** @param {number} n - 0 keeps everything */
    async setKeepVersions(n) {
        this._keep = clamp(Math.round(Number(n) || 0), 0, 999);
        await Storage.set(KEEP_KEY, this._keep);
        EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
    }

    /**
     * Restore the configured folder at boot.
     *
     * Deliberately does NOT request permission: there is no gesture here, and
     * a rejected request would spend the one chance the artist gets.
     */
    async initialize() {
        const keep = await Storage.get(KEEP_KEY);
        if (typeof keep === 'number') this._keep = keep;

        const handle = await Storage.get(HANDLE_KEY);
        if (!this._isValidFolderRef(handle)) {
            EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
            return;
        }

        this.directory = handle;

        this.needsPermission = (await this._permission(false)) !== 'granted';
        Logger.info('BackupService', this.needsPermission
            ? 'Backup folder restored; waiting for permission'
            : 'Backup folder restored and writable');
        EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
    }

    /**
     * Ask for a folder. MUST be called from a user gesture.
     * @returns {Promise<boolean>} false if cancelled or unsupported
     */
    async chooseFolder() {
        if (!this.isSupported) {
            Logger.warn('BackupService', 'This browser cannot pick a folder');
            return false;
        }
        try {
            const folderRef = await this._provider.chooseFolder(BACKUP_FOLDER_LABEL);
            if (!folderRef) return false;
            this.directory = folderRef;
            this.needsPermission = (await this._permission(true)) !== 'granted';
            await Storage.set(HANDLE_KEY, folderRef);
            Logger.info('BackupService', `Backup folder set: ${this._folderName()}`);
            EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
            return !this.needsPermission;
        } catch (error) {
            if (error && error.name === 'AbortError') return false;
            this.lastError = error.message;
            Logger.warn('BackupService', 'Could not set backup folder', error);
            EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
            return false;
        }
    }

    /** Stop backing up to disk. The folder and its files are left alone. */
    async forgetFolder() {
        this.directory = null;
        this.needsPermission = false;
        await Storage.delete(HANDLE_KEY);
        EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
    }

    /**
     * Re-grant a permission that lapsed. MUST be called from a user gesture -
     * this is what the Resume Backups button is for.
     * @returns {Promise<boolean>}
     */
    async resume() {
        if (!this.directory) return false;
        this.needsPermission = (await this._permission(true)) !== 'granted';
        EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
        return !this.needsPermission;
    }

    /**
     * Write the next version.
     *
     * @param {Object} project - an `App._getProjectData()` payload
     * @param {string} baseName - the document name, without extension
     * @returns {Promise<string|null>} the filename written, or null
     */
    async writeVersion(project, baseName) {
        if (!this.isActive) return null;

        const base = this._sanitize(baseName);
        try {
            // Re-check rather than trust the flag: a folder can be removed or
            // revoked between ticks, and the failure must be visible.
            if ((await this._permission(false)) !== 'granted') {
                this.needsPermission = true;
                EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
                return null;
            }

            const bytes = await ProjectFormat.encode(project);
            if (!bytes) return null;

            const version = await this._nextVersion(base);
            const name = `${base} V${version}.pixula`;

            await this._provider.writeFile(this.directory, name, bytes);

            this.lastWritten = { name, version, bytes: bytes.length, at: Date.now() };
            this.lastError = null;
            await this._prune(base);

            Logger.info('BackupService', `Wrote ${name} (${bytes.length} B)`);
            EventBus.emit(EVENTS.BACKUP_WRITTEN, { ...this.lastWritten });
            EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
            return name;
        } catch (error) {
            this.lastError = error.message;
            Logger.error('BackupService', 'Backup write failed', error);
            EventBus.emit(EVENTS.BACKUP_STATE_CHANGED, this.getState());
            return null;
        }
    }

    /** Every version of one document in the folder, newest first. */
    async listVersions(baseName) {
        if (!this.directory) return [];
        const base = this._sanitize(baseName);
        const found = [];
        try {
            const files = await this._provider.listFiles(this.directory);
            for (const file of files) {
                const m = VERSION_RE.exec(file.name);
                if (m && m[1] === base) found.push({ name: file.name, version: Number(m[2]) });
            }
        } catch (error) {
            Logger.warn('BackupService', 'Could not list versions', error);
        }
        return found.sort((a, b) => b.version - a.version);
    }

    /** What the UI renders from. */
    getState() {
        return {
            supported: this.isSupported,
            configured: this.isConfigured,
            active: this.isActive,
            needsPermission: this.needsPermission,
            folderName: this._folderName(),
            keepVersions: this._keep,
            lastWritten: this.lastWritten,
            lastError: this.lastError
        };
    }

    /** @private */
    async _permission(request) {
        if (!this.directory) return 'denied';
        const opts = { mode: 'readwrite' };
        try {
            let state = await this.directory.queryPermission(opts);
            if (state === 'prompt' && request) {
                state = await this.directory.requestPermission(opts);
            }
            return state;
        } catch (error) {
            Logger.warn('BackupService', 'Permission check failed', error);
            return 'denied';
        }
    }

    /** @private */
    _isValidFolderRef(handle) {
        return !!handle && typeof handle.getFileHandle === 'function';
    }

    /** @private */
    _folderName() {
        return this.directory ? this.directory.name : '';
    }

    /**
     * One past the highest version already in the folder.
     *
     * Read from disk rather than counted in memory, so numbering survives a
     * reload and two sessions on one picture continue a single sequence
     * instead of fighting over V1.
     * @private
     */
    async _nextVersion(base) {
        const versions = await this.listVersions(base);
        return versions.length ? versions[0].version + 1 : 1;
    }

    /** Delete the oldest versions past the keep count. @private */
    async _prune(base) {
        if (!this._keep) return;
        const versions = await this.listVersions(base);
        if (versions.length <= this._keep) return;

        for (const entry of versions.slice(this._keep)) {
            try {
                await this._provider.deleteFile(this.directory, entry.name);
                Logger.debug('BackupService', `Pruned ${entry.name}`);
            } catch (error) {
                // A file the artist has open elsewhere is not our problem to
                // solve; the next prune will get it.
                Logger.warn('BackupService', `Could not prune ${entry.name}`, error);
            }
        }
    }

    /**
     * A filename that will not be refused by the filesystem, and that the
     * version scanner can still parse back.
     * @private
     */
    _sanitize(name) {
        const clean = String(name || '')
            .replace(/\.[^.]*$/, '')          // drop any extension
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 64);
        return clean || 'Untitled';
    }
}

BackupServiceClass.DEFAULT_KEEP_VERSIONS = DEFAULT_KEEP_VERSIONS;
BackupServiceClass.VERSION_RE = VERSION_RE;

window.BackupService = new BackupServiceClass();

Logger.debug('BackupService', 'Backup service loaded');

})(); // End IIFE
