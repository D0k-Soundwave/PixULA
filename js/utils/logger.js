'use strict';

/**
 * Logging System
 * Provides leveled logging with optional persistence
 */

// Wrap in IIFE to prevent class name from polluting global scope
(function() {

/**
 * Log levels
 * @const {Object}
 */
const LOG_LEVELS = Object.freeze({
    OFF: 0,
    CRITICAL: 1,
    ERROR: 2,
    WARNING: 3,
    INFO: 4,
    DEBUG: 5
});

/**
 * Logger class
 */
class LoggerClass {
    constructor() {
        this.level = LOG_LEVELS.ERROR;
        this.prefix = '[PixULA]';
        this.history = [];
        this.maxHistory = 1000;
    }

    /**
     * Set the logging level
     * @param {number} level - Log level from LOG_LEVELS
     */
    setLevel(level) {
        if (level >= LOG_LEVELS.OFF && level <= LOG_LEVELS.DEBUG) {
            this.level = level;
        }
    }

    /**
     * Get current logging level
     * @returns {number}
     */
    getLevel() {
        return this.level;
    }

    /**
     * Format a log message
     * @private
     * @param {number} level
     * @param {string} module
     * @param {string} message
     * @param {*} data
     * @returns {Object}
     */
    _format(level, module, message, data) {
        const timestamp = new Date().toISOString();
        const levelName = Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level);
        return {
            timestamp,
            level: levelName,
            module,
            message,
            data
        };
    }

    /**
     * Store entry in history
     * @private
     * @param {Object} entry
     */
    _store(entry) {
        this.history.push(entry);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    /**
     * Log a debug message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {*} data - Optional data
     */
    debug(module, message, data = null) {
        if (this.level >= LOG_LEVELS.DEBUG) {
            const entry = this._format(LOG_LEVELS.DEBUG, module, message, data);
            this._store(entry);
            console.log(`${this.prefix}[DEBUG][${module}]`, message, data !== null ? data : '');
        }
    }

    /**
     * Log an info message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {*} data - Optional data
     */
    info(module, message, data = null) {
        if (this.level >= LOG_LEVELS.INFO) {
            const entry = this._format(LOG_LEVELS.INFO, module, message, data);
            this._store(entry);
            console.info(`${this.prefix}[INFO][${module}]`, message, data !== null ? data : '');
        }
    }

    /**
     * Log a warning message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {*} data - Optional data
     */
    warn(module, message, data = null) {
        if (this.level >= LOG_LEVELS.WARNING) {
            const entry = this._format(LOG_LEVELS.WARNING, module, message, data);
            this._store(entry);
            console.warn(`${this.prefix}[WARN][${module}]`, message, data !== null ? data : '');
        }
    }

    /**
     * Log an error message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {*} data - Optional data
     */
    error(module, message, data = null) {
        if (this.level >= LOG_LEVELS.ERROR) {
            const entry = this._format(LOG_LEVELS.ERROR, module, message, data);
            this._store(entry);
            console.error(`${this.prefix}[ERROR][${module}]`, message, data !== null ? data : '');
        }
    }

    /**
     * Log a critical message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {*} data - Optional data
     */
    critical(module, message, data = null) {
        if (this.level >= LOG_LEVELS.CRITICAL) {
            const entry = this._format(LOG_LEVELS.CRITICAL, module, message, data);
            this._store(entry);
            console.error(`${this.prefix}[CRITICAL][${module}]`, message, data !== null ? data : '');
        }
    }

    /**
     * Shorthand log (alias for info)
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {*} data - Optional data
     */
    log(module, message, data = null) {
        this.info(module, message, data);
    }

    /**
     * Get log history
     * @returns {Array}
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Clear log history
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * Export history as JSON string
     * @returns {string}
     */
    exportHistory() {
        return JSON.stringify(this.history, null, 2);
    }

    /**
     * Filter history by level
     * @param {number} minLevel - Minimum log level
     * @returns {Array}
     */
    getHistoryByLevel(minLevel) {
        return this.history.filter(entry => {
            const entryLevel = LOG_LEVELS[entry.level];
            return entryLevel <= minLevel;
        });
    }

    /**
     * Filter history by module
     * @param {string} module - Module name
     * @returns {Array}
     */
    getHistoryByModule(module) {
        return this.history.filter(entry => entry.module === module);
    }
}

// Create singleton instance and export to window
window.Logger = new LoggerClass();
window.LOG_LEVELS = LOG_LEVELS;

console.log('[Logger] Logger loaded');

})(); // End IIFE
