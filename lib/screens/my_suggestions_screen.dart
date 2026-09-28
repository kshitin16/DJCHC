/// Screen 4 — My Suggestions (FR3.2; Contract 4 `myPastSuggestions`).
///
/// Owner scoping is enforced server-side by suggestion-unit's owner-read rule
/// (BR3.3); this screen simply renders what came back, in the server's own
/// newest-first order.
library;

import 'package:flutter/material.dart';

import '../models/suggestion.dart';
import '../services/gateways.dart';
import '../services/suggestion_service.dart';
import '../state/localization_controller.dart';
import '../utils/screen_state.dart';
import '../widgets/list_items.dart';
import '../widgets/state_widgets.dart';

class MySuggestionsScreen extends StatefulWidget {
  const MySuggestionsScreen({
    required this.suggestionService,
    required this.strings,
    super.key,
  });

  final SuggestionService suggestionService;
  final LocalizationController strings;

  static const Key retryKey = ValueKey('mySuggestions.retry');
  static const Key listKey = ValueKey('mySuggestions.list');

  @override
  State<MySuggestionsScreen> createState() => _MySuggestionsScreenState();
}

class _MySuggestionsScreenState extends State<MySuggestionsScreen> {
  final ValueNotifier<ScreenState<List<Suggestion>>> _state = ValueNotifier(
    const ScreenState.loading(),
  );

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _state.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    _state.value = const ScreenState.loading();
    try {
      final mine = await widget.suggestionService.myPast();
      if (!mounted) return;
      _state.value = ScreenState.loaded(mine);
    } on ApiException catch (e) {
      if (!mounted) return;
      _state.value = ScreenState.error(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('mySuggestions.title'))),
      body: ValueListenableBuilder<ScreenState<List<Suggestion>>>(
        valueListenable: _state,
        builder: (context, state, _) => ScreenStateView<List<Suggestion>>(
          state: state,
          emptyMessage: strings.t('mySuggestions.empty'),
          emptyIcon: Icons.lightbulb_outline,
          retryLabel: strings.t('common.retry'),
          onRetry: _load,
          retryKey: MySuggestionsScreen.retryKey,
          isEmpty: (items) => items.isEmpty,
          builder: (context, items) => ListView.separated(
            key: MySuggestionsScreen.listKey,
            itemCount: items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) =>
                SuggestionListItem(suggestion: items[index]),
          ),
        ),
      ),
    );
  }
}
