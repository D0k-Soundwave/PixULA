'use strict';
(function() {

/**
 * FontProbe - which system font families are actually installed.
 *
 * WHY THIS EXISTS. `queryLocalFonts()` is the only API that truly enumerates
 * installed fonts, and on `file://` it resolves with an EMPTY ARRAY: the
 * permission reads "prompt" but no prompt is ever shown (measured 2026-08-07,
 * Chrome, this app over file://). The text tool used to fall back to sixteen
 * hardcoded family names, which was wrong in both directions - it offered
 * fonts the machine might not have (Helvetica and Palatino Linotype are
 * routinely absent on Windows) and hid the hundred it did.
 *
 * HOW IT WORKS. Set a candidate family with a generic behind it, measure a
 * probe string, and compare against the generic measured alone. If the family
 * is missing the browser falls straight through and the widths match exactly;
 * if it is present the widths differ. Three generics are tried because a font
 * can coincidentally match one of them.
 *
 * WHAT IT CANNOT DO - and this is the honest limit. It cannot enumerate. It
 * answers "is THIS name installed?", so it finds only the fonts CANDIDATES
 * thinks to ask about; a family missing from that list stays invisible however
 * many the machine has. It also cannot see a font whose metrics match a
 * generic exactly in all three comparisons, which is the case for the
 * metric-compatible clones (Liberation Sans for Arial, Arimo, Carlito).
 * `queryLocalFonts` remains the preferred path wherever it actually returns
 * something - served over http(s) the permission can be granted and the result
 * is the real, complete list.
 *
 * IT ALSO SEES THROUGH SUBSTITUTION, which the naive version of this trick does
 * not. Windows answers a request for Helvetica with Arial, for Times with Times
 * New Roman and for Courier with Courier New; each renders, so each measures
 * differently from the generics and each looks "installed". Measured on this
 * machine 2026-08-07, "Helvetica" and "Arial" both came back at exactly
 * 1269.2109375 px. Offering both is offering one typeface twice under two
 * names. ALIASES below names those legacy pairs, and an alias is dropped only
 * when its widths match its target EXACTLY - so on a Mac, where Helvetica is a
 * real and different font, it survives.
 */

/*
 * Candidate families, grouped by where they come from. Names must be the
 * family as the system registers it: "Sitka" finds nothing on Windows because
 * the six optical sizes register as "Sitka Text", "Sitka Small" and so on -
 * which is exactly the mistake that produced a 64-of-65 result while this was
 * being written, and the reason each variant is listed separately here.
 */
const CANDIDATES = Object.freeze([
  // Windows core
  'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold', 'Bahnschrift',
  'Calibri', 'Calibri Light', 'Cambria', 'Cambria Math', 'Candara', 'Comic Sans MS',
  'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Ebrima',
  'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia', 'Impact', 'Ink Free',
  'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode',
  'Malgun Gothic', 'Marlett', 'Microsoft Himalaya', 'Microsoft JhengHei',
  'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif',
  'Microsoft Tai Le', 'Microsoft YaHei', 'MingLiU-ExtB', 'Mongolian Baiti',
  'MS Gothic', 'MS PGothic', 'MS UI Gothic', 'MV Boli', 'Myanmar Text',
  'Nirmala UI', 'Palatino Linotype', 'Segoe Fluent Icons', 'Segoe MDL2 Assets',
  'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Black', 'Segoe UI Emoji',
  'Segoe UI Historic', 'Segoe UI Light', 'Segoe UI Semibold', 'Segoe UI Semilight',
  'Segoe UI Symbol', 'Segoe UI Variable', 'SimSun', 'SimSun-ExtB', 'NSimSun',
  // Sitka is six optical-size families, never a bare "Sitka"
  'Sitka Banner', 'Sitka Display', 'Sitka Heading', 'Sitka Small',
  'Sitka Subheading', 'Sitka Text',
  'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  'Webdings', 'Wingdings', 'Wingdings 2', 'Wingdings 3', 'Yu Gothic', 'Yu Gothic UI',
  'Cascadia Code', 'Cascadia Mono', 'Lucida Sans', 'Lucida Bright',
  'Bookman Old Style', 'Book Antiqua', 'Bookshelf Symbol 7', 'Bradley Hand ITC',
  'Britannic Bold', 'Broadway', 'Brush Script MT', 'Californian FB', 'Castellar',
  'Centaur', 'Century', 'Century Gothic', 'Century Schoolbook', 'Chiller',
  'Colonna MT', 'Cooper Black', 'Copperplate Gothic Bold', 'Copperplate Gothic Light',
  'Curlz MT', 'Elephant', 'Engravers MT', 'Eras Bold ITC', 'Felix Titling',
  'Footlight MT Light', 'Forte', 'Franklin Gothic Book', 'Freestyle Script',
  'French Script MT', 'Garamond', 'Gigi', 'Gill Sans MT', 'Gloucester MT Extra Condensed',
  'Goudy Old Style', 'Haettenschweiler', 'Harlow Solid Italic', 'Harrington',
  'High Tower Text', 'Imprint MT Shadow', 'Informal Roman', 'Jokerman',
  'Juice ITC', 'Kristen ITC', 'Kunstler Script', 'Lucida Calligraphy',
  'Lucida Fax', 'Lucida Handwriting', 'Magneto', 'Maiandra GD', 'Matura MT Script Capitals',
  'Mistral', 'Modern No. 20', 'Monotype Corsiva', 'Niagara Engraved', 'Niagara Solid',
  'OCR A Extended', 'Old English Text MT', 'Onyx', 'Palace Script MT', 'Papyrus',
  'Parchment', 'Perpetua', 'Playbill', 'Poor Richard', 'Pristina', 'Rage Italic',
  'Ravie', 'Rockwell', 'Script MT Bold', 'Showcard Gothic', 'Snap ITC', 'Stencil',
  'Tempus Sans ITC', 'Viner Hand ITC', 'Vivaldi', 'Vladimir Script', 'Wide Latin',

  // macOS
  'Helvetica', 'Helvetica Neue', 'San Francisco', 'SF Pro', 'SF Pro Text',
  'SF Pro Display', 'SF Mono', 'New York', 'Menlo', 'Monaco', 'Andale Mono',
  'American Typewriter', 'Apple Chancery', 'Apple Color Emoji', 'AppleGothic',
  'Avenir', 'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon',
  'Bodoni 72', 'Bradley Hand', 'Chalkboard', 'Chalkboard SE', 'Chalkduster',
  'Cochin', 'Copperplate', 'Didot', 'Futura', 'Geneva', 'Gill Sans',
  'Hebrew', 'Herculanum', 'Hoefler Text', 'Iowan Old Style', 'Kefa', 'Lucida Grande',
  'Marker Felt', 'Noteworthy', 'Optima', 'Palatino', 'Phosphate', 'Rockwell Nova',
  'Savoye LET', 'Seravek', 'Skia', 'Snell Roundhand', 'Superclarendon',
  'Times', 'Trattatello', 'Zapfino', 'Courier', 'Arial Unicode MS',

  // Linux and cross-platform open families
  'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif', 'Liberation Sans',
  'Liberation Serif', 'Liberation Mono', 'Nimbus Sans', 'Nimbus Roman',
  'Nimbus Mono PS', 'FreeSans', 'FreeSerif', 'FreeMono', 'Ubuntu', 'Ubuntu Mono',
  'Ubuntu Condensed', 'Cantarell', 'Droid Sans', 'Droid Sans Mono', 'Droid Serif',
  'Noto Sans', 'Noto Serif', 'Noto Sans Mono', 'Noto Color Emoji',
  'Roboto', 'Roboto Mono', 'Roboto Condensed', 'Open Sans', 'Lato', 'Oxygen',
  'Source Code Pro', 'Source Sans Pro', 'Source Serif Pro', 'Fira Sans',
  'Fira Mono', 'Fira Code', 'Inconsolata', 'JetBrains Mono', 'Hack',
  'IBM Plex Sans', 'IBM Plex Mono', 'IBM Plex Serif', 'PT Sans', 'PT Mono',
  'PT Serif', 'Bitstream Vera Sans', 'Luxi Mono', 'URW Bookman', 'URW Gothic',
  'Century Schoolbook L', 'Courier 10 Pitch', 'Arimo', 'Tinos', 'Cousine',
  'Carlito', 'Caladea', 'Comfortaa', 'Overpass', 'Merriweather', 'Raleway',

  // Bundled with Microsoft Office
  'Aptos', 'Aptos Display', 'Aptos Mono', 'Aptos Narrow', 'Aptos Serif',
  'Bierstadt', 'Grandview', 'Seaford', 'Skeena', 'Tenorite',
  'Agency FB', 'Algerian', 'Baskerville Old Face', 'Bauhaus 93', 'Bell MT',
  'Berlin Sans FB', 'Bernard MT Condensed', 'Blackadder ITC', 'Bodoni MT',
  'Calisto MT', 'Candara Light', 'Cavolini', 'Constantia Light', 'Corbel Light',
  'Dubai', 'Eras Light ITC', 'Gadugi Bold', 'HoloLens MDL2 Assets',
  'Lucida Sans Typewriter', 'Sans Serif Collection', 'Segoe UI Adobe',
  'Tw Cen MT', 'Yu Mincho'
]);

/*
 * Legacy name -> the family the system quietly serves instead.
 *
 * Only pairs where a platform is KNOWN to substitute. The check is exact width
 * equality, so a machine on which the alias is a genuine, distinct font keeps
 * it: this table says "these two are worth comparing", never "drop this one".
 */
const ALIASES = Object.freeze({
    'Helvetica': 'Arial',
    'Times': 'Times New Roman',
    'Courier': 'Courier New',
    'Arial Unicode MS': 'Arial'
});

/*
 * The measured string. Deliberately mixes wide and narrow glyphs, a space, a
 * capital pair and digits: a family that differs from a generic in only one
 * glyph class still moves this string's total width.
 */
const PROBE_TEXT = 'mmmmmmmmmmlli WM@1234567890';

/*
 * Three generics, because a candidate can coincidentally share one generic's
 * exact width while differing from the others. A font invisible against all
 * three is metric-identical to every generic, which is the documented hole.
 */
const GENERICS = Object.freeze(['monospace', 'sans-serif', 'serif']);

/*
 * Probe size. Bigger is better: width differences scale with size, and at
 * small sizes hinting can round two different fonts to the same total. 72px
 * is large enough that a one-unit-per-em difference is visible in the float
 * and small enough to stay well inside any canvas text limit.
 */
const PROBE_PX = 72;

class FontProbeClass {
    constructor() {
        this._cache = null;
    }

    /** The names this build knows to ask about. @returns {ReadonlyArray<string>} */
    get CANDIDATES() { return CANDIDATES; }

    /**
     * Every candidate family that is actually installed.
     *
     * Cached: the answer cannot change while the page is open, and the probe
     * is ~3 canvas measurements per candidate.
     * @returns {Array<string>} sorted, possibly empty
     */
    detect() {
        if (this._cache) return this._cache;

        const canvas = Helpers.createCanvas(200, 60);
        const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return [];

        const baseline = {};
        for (const generic of GENERICS) {
            ctx.font = `${PROBE_PX}px ${generic}`;
            baseline[generic] = ctx.measureText(PROBE_TEXT).width;
        }

        const found = [];
        for (const family of CANDIDATES) {
            if (this._isInstalled(ctx, baseline, family)) found.push(family);
        }

        this._cache = this._dropSubstitutions(ctx, found).sort((a, b) => a.localeCompare(b));
        return this._cache;
    }

    /**
     * Remove legacy names the system is merely substituting for another family
     * that is ALSO in the list. Exact width equality across all three generics
     * is the test, so a real distinct font of the same name is never dropped.
     * @private
     */
    _dropSubstitutions(ctx, families) {
        const width = (family, generic) => {
            ctx.font = `${PROBE_PX}px "${family}", ${generic}`;
            return ctx.measureText(PROBE_TEXT).width;
        };
        const present = new Set(families);

        return families.filter((family) => {
            const target = ALIASES[family];
            if (!target || !present.has(target)) return true;
            const same = GENERICS.every(g => width(family, g) === width(target, g));
            if (same) Logger.debug('FontProbe', `${family} is ${target} here; not listed twice`);
            return !same;
        });
    }

    /**
     * Compared RAW, never rounded. Rounding one side and not the other makes
     * every comparison unequal and every font look installed - which is
     * exactly what a first draft of this check did, and it reported a font
     * that does not exist as present.
     * @private
     */
    _isInstalled(ctx, baseline, family) {
        for (const generic of GENERICS) {
            ctx.font = `${PROBE_PX}px "${family}", ${generic}`;
            if (ctx.measureText(PROBE_TEXT).width !== baseline[generic]) return true;
        }
        return false;
    }
}

window.FontProbe = new FontProbeClass();

Logger.debug('FontProbe', 'Font probe loaded');

})(); // End IIFE
