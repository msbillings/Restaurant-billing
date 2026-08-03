import translate from 'google-translate-api-x';

// All supported languages for translation
const SUPPORTED_LANGUAGES = ['hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu'];

/**
 * Translate a single text into all supported languages.
 * Returns an object like { hi: "...", te: "...", ta: "...", ... }
 * If translation fails for a language, it falls back to the original English text.
 */
export const translateText = async (text) => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {};
  }

  const translations = {};

  try {
    // Use batch translation for efficiency — translate to all languages at once
    const results = await translate(text, { to: SUPPORTED_LANGUAGES, forceTo: true });

    // results is an array when multiple targets are given
    if (Array.isArray(results)) {
      results.forEach((result, index) => {
        translations[SUPPORTED_LANGUAGES[index]] = result.text || text;
      });
    } else if (results && results.text) {
      // Single result fallback
      translations[SUPPORTED_LANGUAGES[0]] = results.text;
    }
  } catch (batchError) {
    console.warn('[Translation] Batch translation failed, trying one by one:', batchError.message);

    // Fallback: translate one language at a time
    for (const lang of SUPPORTED_LANGUAGES) {
      try {
        const result = await translate(text, { to: lang });
        translations[lang] = result.text || text;
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.warn(`[Translation] Failed for ${lang}:`, err.message);
        translations[lang] = text; // Fallback to English
      }
    }
  }

  return translations;
};

/**
 * Translate name and description for a menu item.
 * Returns { nameTranslations: {...}, descriptionTranslations: {...} }
 */
export const translateMenuItem = async (name, description) => {
  const result = {
    nameTranslations: {},
    descriptionTranslations: {}
  };

  try {
    // Translate name (always)
    if (name) {
      result.nameTranslations = await translateText(name);
    }

    // Translate description (if exists)
    if (description) {
      result.descriptionTranslations = await translateText(description);
    }
  } catch (err) {
    console.error('[Translation] translateMenuItem error:', err.message);
  }

  return result;
};

/**
 * Translate a category name into all supported languages.
 * Returns { nameTranslations: {...} }
 */
export const translateCategoryName = async (name) => {
  const result = { nameTranslations: {} };

  try {
    if (name) {
      result.nameTranslations = await translateText(name);
    }
  } catch (err) {
    console.error('[Translation] translateCategoryName error:', err.message);
  }

  return result;
};

export { SUPPORTED_LANGUAGES };
