'use strict';
/**
 * FormatRegistry.isExportCompatible() — the single thing a Save UI asks
 * "can I offer this format right now": delegates to a handler's own
 * canExport() when it has one, and defaults to true for handlers (png,
 * bmp, jpg, gif, ...) that are valid in every screen mode and so never
 * registered one.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/io/format-registry.js');

FormatRegistry.registerExport('gated-true', { export: () => null, canExport: () => true });
FormatRegistry.registerExport('gated-false', { export: () => null, canExport: () => false });
FormatRegistry.registerExport('ungated', { export: () => null });

check('delegates true to a compatible handler',
  FormatRegistry.isExportCompatible('gated-true') === true);
check('delegates false to an incompatible handler',
  FormatRegistry.isExportCompatible('gated-false') === false);
check('defaults to true for a handler with no canExport',
  FormatRegistry.isExportCompatible('ungated') === true);
check('is false for an unregistered extension (nothing to export)',
  FormatRegistry.isExportCompatible('nonexistent') === false);
check('extension is matched case-insensitively',
  FormatRegistry.isExportCompatible('GATED-FALSE') === false);

summary();
