/// Word counting for the suggestion form's advisory warning (BR3.1).
///
/// The count mirrors suggestion-unit's own server-side rule: split on runs of
/// whitespace and count the non-empty pieces. This is ADVISORY only — the server
/// is the authority and the Submit button is never disabled on this count
/// (frontend-components.md "Form Validation").
library;

/// The server-side limit (BR3.1), in words.
const int suggestionWordLimit = 300;

/// The count at which the form starts warning the user.
const int suggestionWarnAt = 280;

final RegExp _whitespaceRun = RegExp(r'\s+');

/// Counts words in [text] by whitespace runs.
///
/// Punctuation attached to a word does not split it (`"hello, world"` is 2), and
/// scripts without spaces between words — Devanagari included — count the same
/// way the server does, by whitespace.
int countWords(String text) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) return 0;
  return trimmed.split(_whitespaceRun).where((w) => w.isNotEmpty).length;
}

/// Whether the form should show its advisory near-limit warning.
bool isNearWordLimit(int wordCount) => wordCount >= suggestionWarnAt;

/// Whether the count is already past the server's limit. Even then the form
/// still lets the user submit — the refusal comes from the server, with its own
/// exact count.
bool isOverWordLimit(int wordCount) => wordCount > suggestionWordLimit;
