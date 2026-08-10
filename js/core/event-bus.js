/**
 * Event Bus
 *
 * Central pub/sub system for component communication
 * All inter-component communication should use this system
 */

'use strict';

// Wrap in IIFE to prevent class name from polluting global scope
(function() {

class EventBusClass {
  constructor() {
    // Map of event name -> array of listener objects
    this._listeners = new Map();

    // Debug mode flag
    this._debugMode = false;

    // Event history for debugging
    this._eventHistory = [];
    this._maxHistory = 100;

    // Batch mode for grouping related events
    this._batchMode = false;
    this._batchQueue = [];
  }

  /**
   * Enable or disable debug mode
   * In debug mode, all events are logged to console and history
   * @param {boolean} enabled
   */
  setDebugMode(enabled) {
    this._debugMode = enabled;
    Logger.info('EventBus', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Start batch mode - queues events until endBatch is called
   * Useful for grouping related changes (e.g., multiple pixel updates)
   */
  startBatch() {
    if (this._batchMode) {
      Logger.warn('EventBus', 'Batch mode already active');
      return;
    }
    this._batchMode = true;
    this._batchQueue = [];
    if (this._debugMode) {
      Logger.debug('EventBus', 'Batch mode started');
    }
  }

  /**
   * End batch mode and emit all queued events
   * @param {boolean} consolidate - If true, consolidate duplicate event names
   */
  endBatch(consolidate = false) {
    if (!this._batchMode) {
      Logger.warn('EventBus', 'Batch mode not active');
      return;
    }

    this._batchMode = false;
    const queue = this._batchQueue;
    this._batchQueue = [];

    if (this._debugMode) {
      Logger.debug('EventBus', `Batch mode ended, processing ${queue.length} events`);
    }

    if (consolidate) {
      // Consolidate: keep only the last event of each type
      const consolidated = new Map();
      queue.forEach(item => {
        consolidated.set(item.eventName, item.data);
      });
      consolidated.forEach((data, eventName) => {
        this._emitImmediate(eventName, data);
      });
    } else {
      // Emit all events in order
      queue.forEach(item => {
        this._emitImmediate(item.eventName, item.data);
      });
    }
  }

  /**
   * Check if batch mode is active
   * @returns {boolean}
   */
  isBatching() {
    return this._batchMode;
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to call when event fires
   * @param {Object} context - Optional 'this' context for callback
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, callback, context = null) {
    if (typeof callback !== 'function') {
      Logger.error('EventBus', 'Callback must be a function', { eventName });
      return () => {};
    }

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }

    const listener = {
      callback,
      context,
      once: false
    };

    this._listeners.get(eventName).push(listener);

    if (this._debugMode) {
      Logger.debug('EventBus', `Subscribed to "${eventName}"`, {
        totalListeners: this._listeners.get(eventName).length
      });
    }

    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  /**
   * Subscribe to an event (fires only once)
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to call when event fires
   * @param {Object} context - Optional 'this' context for callback
   * @returns {Function} - Unsubscribe function
   */
  once(eventName, callback, context = null) {
    if (typeof callback !== 'function') {
      Logger.error('EventBus', 'Callback must be a function', { eventName });
      return () => {};
    }

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }

    const listener = {
      callback,
      context,
      once: true
    };

    this._listeners.get(eventName).push(listener);

    if (this._debugMode) {
      Logger.debug('EventBus', `Subscribed once to "${eventName}"`);
    }

    return () => this.off(eventName, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - The callback to remove
   */
  off(eventName, callback) {
    if (!this._listeners.has(eventName)) return;

    const listeners = this._listeners.get(eventName);
    const index = listeners.findIndex(l => l.callback === callback);

    if (index !== -1) {
      listeners.splice(index, 1);

      if (this._debugMode) {
        Logger.debug('EventBus', `Unsubscribed from "${eventName}"`, {
          remainingListeners: listeners.length
        });
      }
    }

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this._listeners.delete(eventName);
    }
  }

  /**
   * Emit an event
   * @param {string} eventName - Name of the event
   * @param {*} data - Data to pass to listeners
   */
  emit(eventName, data = null) {
    // If in batch mode, queue the event
    if (this._batchMode) {
      this._batchQueue.push({ eventName, data });
      if (this._debugMode) {
        Logger.debug('EventBus', `Queued "${eventName}" (batch mode)`);
      }
      return;
    }

    this._emitImmediate(eventName, data);
  }

  /**
   * Internal method to emit event immediately (bypasses batch mode)
   * @private
   * @param {string} eventName - Name of the event
   * @param {*} data - Data to pass to listeners
   */
  _emitImmediate(eventName, data) {
    if (this._debugMode) {
      this._recordEvent(eventName, data);
      Logger.debug('EventBus', `Emitting "${eventName}"`, data);
    }

    if (!this._listeners.has(eventName)) return;

    const listeners = this._listeners.get(eventName);
    const toRemove = [];

    // Call all listeners
    listeners.forEach((listener, index) => {
      try {
        if (listener.context) {
          listener.callback.call(listener.context, data);
        } else {
          listener.callback(data);
        }

        // Mark once listeners for removal
        if (listener.once) {
          toRemove.push(index);
        }
      } catch (error) {
        Logger.error('EventBus', `Error in listener for "${eventName}"`, error);
      }
    });

    // Remove once listeners (in reverse order to maintain indices)
    toRemove.reverse().forEach(index => {
      listeners.splice(index, 1);
    });

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this._listeners.delete(eventName);
    }
  }

  /**
   * Emit an event asynchronously (non-blocking)
   * @param {string} eventName - Name of the event
   * @param {*} data - Data to pass to listeners
   * @returns {Promise}
   */
  async emitAsync(eventName, data = null) {
    return new Promise(resolve => {
      setTimeout(() => {
        this.emit(eventName, data);
        resolve();
      }, 0);
    });
  }

  /**
   * Remove all listeners for an event
   * @param {string} eventName - Name of the event (optional, clears all if not provided)
   */
  removeAllListeners(eventName = null) {
    if (eventName) {
      this._listeners.delete(eventName);
      if (this._debugMode) {
        Logger.debug('EventBus', `Removed all listeners for "${eventName}"`);
      }
    } else {
      this._listeners.clear();
      if (this._debugMode) {
        Logger.debug('EventBus', 'Removed all listeners for all events');
      }
    }
  }

  /**
   * Get count of listeners for an event
   * @param {string} eventName - Name of the event
   * @returns {number}
   */
  listenerCount(eventName) {
    if (!this._listeners.has(eventName)) return 0;
    return this._listeners.get(eventName).length;
  }

  /**
   * Get all registered event names
   * @returns {Array<string>}
   */
  eventNames() {
    return [...this._listeners.keys()];
  }

  /**
   * Check if there are any listeners for an event
   * @param {string} eventName
   * @returns {boolean}
   */
  hasListeners(eventName) {
    return this.listenerCount(eventName) > 0;
  }

  /**
   * Record event in history (for debugging)
   * Only stores metadata to avoid retaining large data objects that prevent GC
   * @private
   */
  _recordEvent(eventName, data) {
    // Only store metadata, not the full data object (which can contain
    // large layer snapshots, Uint8Arrays, etc. that would prevent GC)
    let dataInfo = null;
    if (data !== null && data !== undefined) {
      if (typeof data === 'object') {
        dataInfo = {
          type: Array.isArray(data) ? 'array' : 'object',
          keys: Object.keys(data).slice(0, 10), // Only first 10 keys
          size: Array.isArray(data) ? data.length : Object.keys(data).length
        };
      } else {
        dataInfo = { type: typeof data, value: String(data).slice(0, 100) };
      }
    }

    this._eventHistory.push({
      timestamp: Date.now(),
      event: eventName,
      dataInfo: dataInfo,
      listenerCount: this.listenerCount(eventName)
    });

    // Trim history if needed
    if (this._eventHistory.length > this._maxHistory) {
      this._eventHistory.shift();
    }
  }

  /**
   * Get event history (for debugging)
   * @returns {Array}
   */
  getEventHistory() {
    return [...this._eventHistory];
  }

  /**
   * Clear event history
   */
  clearEventHistory() {
    this._eventHistory = [];
  }

  /**
   * Get statistics about the event bus
   * @returns {Object}
   */
  getStats() {
    const eventNames = this.eventNames();
    const totalListeners = eventNames.reduce((sum, name) =>
      sum + this.listenerCount(name), 0
    );

    return {
      eventCount: eventNames.length,
      totalListeners,
      events: eventNames.map(name => ({
        name,
        listeners: this.listenerCount(name)
      })),
      batchMode: this._batchMode,
      batchQueueSize: this._batchQueue.length
    };
  }
}

// Create singleton instance and export to window
window.EventBus = new EventBusClass();

Logger.debug('EventBus', 'Event bus loaded');

})(); // End IIFE
