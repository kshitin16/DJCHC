/// Screen 3 — Submit a Suggestion (FR3.1; Contract 4 `submitSuggestion`).
///
/// The live word count and the near-limit warning are ADVISORY: Submit is never
/// disabled on the client's own count, because suggestion-unit's BR3.1 is the
/// authority and its refusal carries the exact count
/// (frontend-components.md "Form Validation").
///
/// On a refusal the input is PRESERVED, never cleared.
///
/// Personal data: the suggestion text is never logged.
library;

import 'package:flutter/material.dart';

import '../services/gateways.dart';
import '../services/suggestion_service.dart';
import '../state/localization_controller.dart';
import '../utils/word_count.dart';

class SubmitSuggestionScreen extends StatefulWidget {
  const SubmitSuggestionScreen({
    required this.suggestionService,
    required this.strings,
    super.key,
  });

  final SuggestionService suggestionService;
  final LocalizationController strings;

  static const Key inputKey = ValueKey('suggest.input');
  static const Key submitKey = ValueKey('suggest.submit');
  static const Key wordCountKey = ValueKey('suggest.wordCount');
  static const Key warningKey = ValueKey('suggest.warning');
  static const Key successKey = ValueKey('suggest.success');
  static const Key errorKey = ValueKey('suggest.error');

  @override
  State<SubmitSuggestionScreen> createState() => _SubmitSuggestionScreenState();
}

class _SubmitSuggestionScreenState extends State<SubmitSuggestionScreen> {
  final TextEditingController _input = TextEditingController();
  int _wordCount = 0;
  bool _inFlight = false;
  String? _error;
  bool _succeeded = false;

  @override
  void initState() {
    super.initState();
    _input.addListener(_recount);
  }

  @override
  void dispose() {
    _input
      ..removeListener(_recount)
      ..dispose();
    super.dispose();
  }

  void _recount() {
    final next = countWords(_input.text);
    if (next == _wordCount) return;
    setState(() => _wordCount = next);
  }

  Future<void> _submit() async {
    final text = _input.text.trim();
    if (text.isEmpty) {
      setState(() {
        _succeeded = false;
        _error = widget.strings.t('suggest.emptyInput');
      });
      return;
    }
    setState(() {
      _inFlight = true;
      _error = null;
      _succeeded = false;
    });
    try {
      await widget.suggestionService.submit(text);
      if (!mounted) return;
      setState(() {
        _inFlight = false;
        _succeeded = true;
      });
      // Only a SUCCESS clears the input; an error keeps what the user wrote.
      _input.clear();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _inFlight = false;
        // The server's own message — e.g. "…is 342 words; the limit is 300".
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    final theme = Theme.of(context);
    final nearLimit = isNearWordLimit(_wordCount);
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('suggest.title'))),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: SubmitSuggestionScreen.inputKey,
              controller: _input,
              maxLines: 8,
              minLines: 4,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                hintText: strings.t('suggest.hint'),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '$_wordCount / $suggestionWordLimit',
              key: SubmitSuggestionScreen.wordCountKey,
              style: theme.textTheme.labelMedium,
            ),
            if (nearLimit) ...[
              const SizedBox(height: 4),
              Text(
                // Advisory only — Submit stays enabled above the limit too.
                'Approaching the $suggestionWordLimit-word limit.',
                key: SubmitSuggestionScreen.warningKey,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.tertiary,
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              key: SubmitSuggestionScreen.submitKey,
              // Disabled ONLY while a request is in flight — never because of
              // the client's own word count.
              onPressed: _inFlight ? null : _submit,
              child: Text(strings.t('suggest.submit')),
            ),
            if (_succeeded) ...[
              const SizedBox(height: 16),
              Text(
                strings.t('suggest.success'),
                key: SubmitSuggestionScreen.successKey,
                style: TextStyle(color: theme.colorScheme.primary),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(
                _error!,
                key: SubmitSuggestionScreen.errorKey,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
