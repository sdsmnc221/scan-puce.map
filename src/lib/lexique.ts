// List of French words that should remain lowercase (articles, prepositions, etc.)
const lowercaseWords = new Set([
  "le",
  "la",
  "les",
  "l",
  "de",
  "du",
  "des",
  "d",
  "en",
  "sur",
  "sous",
  "et",
  "à",
  "aux",
]);

// List of special prefixes that should be capitalized
const specialPrefixes = new Set([
  "saint",
  "sainte",
  "saints",
  "saintes",
  "mont",
  "monts",
]);

const transformToCapitalize = (name: string) => {
  if (!name) return "";

  // Split the name into words, preserving spaces
  const words = name.toLowerCase().split(/\s+/);

  return words
    .map((word, index) => {
      // Handle contractions like "l'" or "d'"
      if (word.includes("'")) {
        const [prefix, rest] = word.split("'");
        if (lowercaseWords.has(prefix)) {
          return (
            prefix +
            "'" +
            (rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "")
          );
        }
      }

      // Always capitalize first word
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      // Handle hyphenated words
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part, partIndex) => {
            if (lowercaseWords.has(part) && partIndex !== 0) {
              return part;
            }
            return part.charAt(0).toUpperCase() + part.slice(1);
          })
          .join("-");
      }

      // Handle special prefixes (like Saint-, Mont-)
      if (specialPrefixes.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      // Keep articles and prepositions lowercase unless they're the first word
      if (lowercaseWords.has(word)) {
        return word;
      }

      // Capitalize other words
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

export { transformToCapitalize };
