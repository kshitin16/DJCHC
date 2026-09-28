/// Contract 4 (Suggestion Data) — submit a suggestion, read your own, and (for
/// an admin) read all of them.
///
/// Realizes: FR3.1-FR3.5.
///
/// The 300-word limit (BR3.1) and the 5-per-IST-day cap (BR3.5) are enforced
/// server-side. This service never pre-empts either: a refusal arrives as a
/// GraphQL error and its message is surfaced verbatim, because suggestion-unit
/// writes those messages as plain language for exactly this purpose.
///
/// Personal data: suggestion text is never logged (project.md Mandated).
library;

import '../models/suggestion.dart';
import 'gateways.dart';
import 'documents/suggestion_documents.dart';
import 'service_parsing.dart';

class SuggestionService {
  SuggestionService(this._api);

  final ApiGateway _api;

  /// `submitSuggestion(text)`.
  Future<Suggestion> submit(String text) async {
    final data = await _api.mutate(
      document: submitSuggestionDocument,
      field: 'submitSuggestion',
      authMode: AuthMode.userPool,
      variables: {'text': text},
    );
    return parseObject(data, Suggestion.fromJson, field: 'submitSuggestion');
  }

  /// `myPastSuggestions` — the caller's own submissions, newest first. The
  /// ordering is the server's (a Query on `submitterIndex` descending); this
  /// service passes it through unchanged rather than re-sorting.
  Future<List<Suggestion>> myPast() async {
    final data = await _api.query(
      document: myPastSuggestionsDocument,
      field: 'myPastSuggestions',
      authMode: AuthMode.userPool,
    );
    return parseList(data, Suggestion.fromJson, field: 'myPastSuggestions');
  }

  /// `allSuggestions` — admin-only, read-only (FR3.5: nothing to mark read).
  Future<List<Suggestion>> allSuggestions() async {
    final data = await _api.query(
      document: allSuggestionsDocument,
      field: 'allSuggestions',
      authMode: AuthMode.userPool,
    );
    return parseList(data, Suggestion.fromJson, field: 'allSuggestions');
  }
}
