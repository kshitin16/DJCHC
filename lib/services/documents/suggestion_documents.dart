/// Contract 4 GraphQL documents, hand-written from `amplify/data/resource.ts`.
library;

/// Contract 4 `Suggestion` selection set. No `deletedAt`, no status — the
/// backend model has neither (BR3.4: suggestions are never deleted).
const String suggestionFields = '''
    id
    submittedByGoogleId
    text
    submittedAt''';

/// `submitSuggestion(text)` — any signed-in user (BR3.2). The 300-word limit
/// (BR3.1) and the 5-per-IST-day cap (BR3.5) are enforced server-side; a
/// refusal comes back as a GraphQL error whose message is shown verbatim.
const String submitSuggestionDocument =
    '''
mutation SubmitSuggestion(\$text: String!) {
  submitSuggestion(text: \$text) {
$suggestionFields
  }
}''';

/// `myPastSuggestions` — the caller's own submissions, newest first (BR3.3).
const String myPastSuggestionsDocument =
    '''
query MyPastSuggestions {
  myPastSuggestions {
$suggestionFields
  }
}''';

/// `allSuggestions` — admin-only read of every submission (BR3.3).
const String allSuggestionsDocument =
    '''
query AllSuggestions {
  allSuggestions {
$suggestionFields
  }
}''';
