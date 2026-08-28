'use strict';

/**
 * Storage Manager
 * IndexedDB wrapper with localStorage fallback
 */

const Storage = {
    /* The database name and the `pixula-` localStorage prefix ARE the on-disk
     * identity of an artist's saved work - autosave, presets, fonts, maps,
     * clipboard. A browser has no rename for a database: a new name is a new,
     * empty one, and everything stored under the old name becomes unreachable.
     * Both were renamed with the app (from `zx-pixel-smoosher` and the
     * `zx-smoosher-` prefix) on 2026-08-07, pre-release, when there was no
     * user data to strand and matching the product name was worth more. After
     * release, changing either needs a migration that copies every store
     * across first. */
    DB_NAME: 'pixula',
    DB_VERSION: 7,
    STORES: {
        PREFERENCES: 'preferences',
        PATTERNS: 'patterns',
        WINDOW_STATE: 'window-state',
        RECENT_FILES: 'recent-files',
        CLIPBOARD: 'clipboard',
        MAPS: 'maps',
        FONTS: 'fonts',
        PRESETS: 'presets',
        PRESET_ASSETS: 'preset-assets',
        TOOL_PRESETS: 'tool-presets'
    },

    db: null,
    useLocalStorage: false,
    initialized: false,

    /**
     * Initialize the storage system
     * @returns {Promise<boolean>}
     */
    async initialize() {
        if (this.initialized) {
            return true;
        }

        try {
            this.db = await this._openDatabase();
            this.initialized = true;
            Logger.info('Storage', 'IndexedDB initialized successfully');
            return true;
        } catch (error) {
            Logger.warn('Storage', 'IndexedDB not available, falling back to localStorage', error);
            this.useLocalStorage = true;
            this.initialized = true;
            return true;
        }
    },

    /**
     * Open the IndexedDB database
     * @private
     * @returns {Promise<IDBDatabase>}
     */
    _openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.STORES.PREFERENCES)) {
                    db.createObjectStore(this.STORES.PREFERENCES, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(this.STORES.PATTERNS)) {
                    const patternStore = db.createObjectStore(this.STORES.PATTERNS, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    patternStore.createIndex('name', 'name', { unique: false });
                    patternStore.createIndex('category', 'category', { unique: false });
                }

                // Recreate WINDOW_STATE store if upgrading from v1 to fix keyPath
                if (db.objectStoreNames.contains(this.STORES.WINDOW_STATE) && event.oldVersion < 2) {
                    db.deleteObjectStore(this.STORES.WINDOW_STATE);
                }
                if (!db.objectStoreNames.contains(this.STORES.WINDOW_STATE)) {
                    db.createObjectStore(this.STORES.WINDOW_STATE, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(this.STORES.RECENT_FILES)) {
                    const recentStore = db.createObjectStore(this.STORES.RECENT_FILES, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    recentStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // v3: persistent internal clipboard (Phase 9)
                if (!db.objectStoreNames.contains(this.STORES.CLIPBOARD)) {
                    db.createObjectStore(this.STORES.CLIPBOARD, { keyPath: 'key' });
                }

                // v4: persistent tilesets + maps (Phase 11)
                if (!db.objectStoreNames.contains(this.STORES.MAPS)) {
                    db.createObjectStore(this.STORES.MAPS, { keyPath: 'key' });
                }

                // v5: working font + named-font library (Phase 10)
                if (!db.objectStoreNames.contains(this.STORES.FONTS)) {
                    db.createObjectStore(this.STORES.FONTS, { keyPath: 'key' });
                }

                // v6: user presets — one record per slot, plus the reference
                // images they carry in their own content-addressed store, so a
                // slot's record stays small and several slots can trace the
                // same photo without storing it twice.
                if (!db.objectStoreNames.contains(this.STORES.PRESETS)) {
                    db.createObjectStore(this.STORES.PRESETS, { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains(this.STORES.PRESET_ASSETS)) {
                    db.createObjectStore(this.STORES.PRESET_ASSETS, { keyPath: 'key' });
                }

                // v7: tool presets — one record per TOOL, holding that tool's
                // whole named list. Their own store rather than a key prefix in
                // PRESETS: the two are different records with different shapes,
                // and a store that has to be filtered by key shape is one that
                // will eventually be read wrong.
                if (!db.objectStoreNames.contains(this.STORES.TOOL_PRESETS)) {
                    db.createObjectStore(this.STORES.TOOL_PRESETS, { keyPath: 'key' });
                }
            };
        });
    },

    /**
     * Get a value from storage
     * @param {string} key - Storage key
     * @param {string} store - Store name (default: preferences)
     * @returns {Promise<*>}
     */
    async get(key, store = this.STORES.PREFERENCES) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.useLocalStorage) {
            return this._getFromLocalStorage(key, store);
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([store], 'readonly');
                const objectStore = transaction.objectStore(store);
                const request = objectStore.get(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.value : null);
                };
            } catch (error) {
                Logger.error('Storage', 'Get failed', { key, store, error: error.message });
                reject(error);
            }
        });
    },

    /**
     * Set a value in storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @param {string} store - Store name (default: preferences)
     * @returns {Promise<void>}
     */
    async set(key, value, store = this.STORES.PREFERENCES) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.useLocalStorage) {
            return this._setToLocalStorage(key, value, store);
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([store], 'readwrite');
                const objectStore = transaction.objectStore(store);

                const data = {
                    key,
                    value,
                    modified: Date.now()
                };

                const request = objectStore.put(data);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            } catch (error) {
                Logger.error('Storage', 'Set failed', { key, store, error: error.message });
                reject(error);
            }
        });
    },

    /**
     * Delete a value from storage
     * @param {string} key - Storage key
     * @param {string} store - Store name (default: preferences)
     * @returns {Promise<void>}
     */
    async delete(key, store = this.STORES.PREFERENCES) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.useLocalStorage) {
            return this._deleteFromLocalStorage(key, store);
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([store], 'readwrite');
                const objectStore = transaction.objectStore(store);
                const request = objectStore.delete(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            } catch (error) {
                Logger.error('Storage', 'Delete failed', { key, store, error: error.message });
                reject(error);
            }
        });
    },

    /**
     * Get all values from a store
     * @param {string} store - Store name
     * @returns {Promise<Array>}
     */
    async getAll(store) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.useLocalStorage) {
            return this._getAllFromLocalStorage(store);
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([store], 'readonly');
                const objectStore = transaction.objectStore(store);
                const request = objectStore.getAll();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    resolve(request.result || []);
                };
            } catch (error) {
                Logger.error('Storage', 'GetAll failed', { store, error: error.message });
                reject(error);
            }
        });
    },

    /**
     * Clear all data from a store
     * @param {string} store - Store name
     * @returns {Promise<void>}
     */
    async clear(store) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.useLocalStorage) {
            return this._clearLocalStorage(store);
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([store], 'readwrite');
                const objectStore = transaction.objectStore(store);
                const request = objectStore.clear();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            } catch (error) {
                Logger.error('Storage', 'Clear failed', { store, error: error.message });
                reject(error);
            }
        });
    },

    /**
     * What is stored, where, and how much of it.
     *
     * Written for the Privacy block in Preferences: the answer to "what does
     * this program keep about me" should be the live contents of the database,
     * not a paragraph someone wrote once and never checked again. Counts come
     * from the stores themselves; the byte figure is the browser's own
     * `navigator.storage.estimate()`, which covers the whole origin, so it
     * includes the localStorage keys as well as IndexedDB.
     * @returns {Promise<{stores: Array<{store: string, records: number}>,
     *   localKeys: number, bytes: number|null}>}
     */
    async describeUsage() {
        if (!this.initialized) {
            await this.initialize();
        }

        const stores = [];
        for (const store of Object.values(this.STORES)) {
            try {
                stores.push({ store, records: await this.count(store) });
            } catch (error) {
                // A store that will not open still belongs in the list - an
                // omission would read as "nothing stored here".
                stores.push({ store, records: null });
            }
        }

        let localKeys = 0;
        try {
            const prefix = 'pixula-';
            for (let i = 0; i < localStorage.length; i++) {
                if (String(localStorage.key(i)).startsWith(prefix)) localKeys++;
            }
        } catch (error) {
            Logger.warn('Storage', 'Could not count local keys', error);
        }

        let bytes = null;
        try {
            if (navigator.storage && navigator.storage.estimate) {
                bytes = (await navigator.storage.estimate()).usage;
            }
        } catch (error) {
            Logger.warn('Storage', 'Could not estimate usage', error);
        }

        return { stores, localKeys, bytes };
    },

    /**
     * Delete everything this app has stored on this machine.
     *
     * The withdrawal mechanism: every IndexedDB store emptied and every
     * `pixula-` localStorage key removed, so what is left is what a first run
     * would find. It does NOT touch files the artist chose to write - backup
     * versions already on disk are their documents, not our data, and deleting
     * someone's artwork to honour a privacy request would be the opposite of
     * the point. It also cannot revoke the folder permission itself; that
     * lives in browser settings, which the Privacy block says.
     * @returns {Promise<{stores: number, localKeys: number}>}
     */
    async clearEverything() {
        if (!this.initialized) {
            await this.initialize();
        }

        let cleared = 0;
        for (const store of Object.values(this.STORES)) {
            try {
                await this.clear(store);
                cleared++;
            } catch (error) {
                Logger.warn('Storage', `Could not clear ${store}`, error);
            }
        }

        let removed = 0;
        try {
            const prefix = 'pixula-';
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (String(key).startsWith(prefix)) keys.push(key);
            }
            keys.forEach(key => localStorage.removeItem(key));
            removed = keys.length;
        } catch (error) {
            Logger.warn('Storage', 'Could not clear local keys', error);
        }

        Logger.info('Storage', `Cleared ${cleared} stores and ${removed} local keys`);
        return { stores: cleared, localKeys: removed };
    },

    /**
     * Check if a key exists
     * @param {string} key - Storage key
     * @param {string} store - Store name
     * @returns {Promise<boolean>}
     */
    async has(key, store = this.STORES.PREFERENCES) {
        const value = await this.get(key, store);
        return value !== null;
    },

    /**
     * Get count of items in a store
     * @param {string} store - Store name
     * @returns {Promise<number>}
     */
    async count(store) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.useLocalStorage) {
            const items = await this._getAllFromLocalStorage(store);
            return items.length;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([store], 'readonly');
                const objectStore = transaction.objectStore(store);
                const request = objectStore.count();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            } catch (error) {
                Logger.error('Storage', 'Count failed', { store, error: error.message });
                reject(error);
            }
        });
    },

    // LocalStorage fallback methods

    /**
     * Get storage key with prefix. Must match the `pixula-${store}-` prefix
     * _getAllFromLocalStorage/_clearLocalStorage scan for, or a value written
     * by set() is invisible to getAll()/count()/clear() (the store namespace
     * used to be dropped here entirely, which silently broke describeUsage()'s
     * counts and the pattern/preset/font libraries under this fallback).
     * @private
     * @param {string} key
     * @param {string} store
     * @returns {string}
     */
    _getStorageKey(key, store) {
        return `pixula-${store}-${key}`;
    },

    /**
     * Get value from localStorage
     * @private
     * @param {string} key
     * @param {string} store
     * @returns {*}
     */
    _getFromLocalStorage(key, store) {
        try {
            const raw = localStorage.getItem(this._getStorageKey(key, store));
            if (!raw) return null;
            const data = JSON.parse(raw);
            return data ? data.value : null;
        } catch (error) {
            Logger.error('Storage', 'localStorage get failed', { key, error: error.message });
            return null;
        }
    },

    /**
     * Set value in localStorage, wrapped the same way the IndexedDB path
     * wraps it ({key, value, modified}) so _clearOldLocalStorageData can
     * actually evict by age instead of an always-0 timestamp.
     * @private
     * @param {string} key
     * @param {*} value
     * @param {string} store
     */
    _setToLocalStorage(key, value, store) {
        try {
            localStorage.setItem(this._getStorageKey(key, store), JSON.stringify({ key, value, modified: Date.now() }));
        } catch (error) {
            Logger.error('Storage', 'localStorage set failed', { key, error: error.message });
            if (error.name === 'QuotaExceededError') {
                Logger.warn('Storage', 'localStorage quota exceeded, clearing old data');
                this._clearOldLocalStorageData();
            }
        }
    },

    /**
     * Delete value from localStorage
     * @private
     * @param {string} key
     * @param {string} store
     */
    _deleteFromLocalStorage(key, store) {
        try {
            localStorage.removeItem(this._getStorageKey(key, store));
        } catch (error) {
            Logger.error('Storage', 'localStorage delete failed', { key, error: error.message });
        }
    },

    /**
     * Get all values from localStorage for a store prefix
     * @private
     * @param {string} store
     * @returns {Array}
     */
    _getAllFromLocalStorage(store) {
        const results = [];
        const prefix = `pixula-${store}-`;

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const data = localStorage.getItem(key);
                    if (data) {
                        results.push(JSON.parse(data));
                    }
                }
            }
        } catch (error) {
            Logger.error('Storage', 'localStorage getAll failed', { store, error: error.message });
        }

        return results;
    },

    /**
     * Clear localStorage items with our prefix
     * @private
     * @param {string} store
     */
    _clearLocalStorage(store) {
        const prefix = store ? `pixula-${store}-` : 'pixula-';
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
    },

    /**
     * Clear old localStorage data when quota exceeded
     * @private
     */
    _clearOldLocalStorageData() {
        const keysWithTimestamp = [];
        const prefix = 'pixula-';

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    keysWithTimestamp.push({
                        key,
                        timestamp: data.modified || 0
                    });
                } catch (e) {
                    keysWithTimestamp.push({ key, timestamp: 0 });
                }
            }
        }

        keysWithTimestamp.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = keysWithTimestamp.slice(0, Math.floor(keysWithTimestamp.length / 2));
        toRemove.forEach(item => localStorage.removeItem(item.key));
    }
};

// Expose to global scope
window.Storage = Storage;
