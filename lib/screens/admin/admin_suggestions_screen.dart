/// Screen 7 — Admin: Suggestions List (FR3.5; Contract 4 `allSuggestions`).
///
/// Read-only by design: FR3.5 has no read/resolved tracking, so there is nothing
/// to act on and no action row. Group scoping is enforced server-side by
/// `allow.group('Admin')` (BR3.3).
///
/// Personal data: suggestion text is rendered but never logged.
library;

import 'package:flutter/material.dart';

import '../../models/suggestion.dart';
import '../../services/gateways.dart';
import '../../services/suggestion_service.dart';
import '../../state/localization_controller.dart';
import '../../utils/screen_state.dart';
import '../../widgets/list_items.dart';
import '../../widgets/state_widgets.dart';

class AdminSuggestionsScreen extends StatefulWidget {
  const AdminSuggestionsScreen({
    required this.suggestionService,
    required this.strings,
    super.key,
  });

  final SuggestionService suggestionService;
  final LocalizationController strings;

  static const Key retryKey = ValueKey('adminSuggestions.retry');
  static const Key listKey = ValueKey('adminSuggestions.list');

  @override
  State<AdminSuggestionsScreen> createState() => _AdminSuggestionsScreenState();
}

class _AdminSuggestionsScreenState extends State<AdminSuggestionsScreen> {
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
      final all = await widget.suggestionService.allSuggestions();
      if (!mounted) return;
      _state.value = ScreenState.loaded(all);
    } on ApiException catch (e) {
      if (!mounted) return;
      _state.value = ScreenState.error(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('adminSuggestions.title'))),
      body: ValueListenableBuilder<ScreenState<List<Suggestion>>>(
        valueListenable: _state,
        builder: (context, state, _) => ScreenStateView<List<Suggestion>>(
          state: state,
          emptyMessage: strings.t('adminSuggestions.empty'),
          emptyIcon: Icons.inbox_outlined,
          retryLabel: strings.t('common.retry'),
          onRetry: _load,
          retryKey: AdminSuggestionsScreen.retryKey,
          isEmpty: (items) => items.isEmpty,
          builder: (context, items) => ListView.separated(
            key: AdminSuggestionsScreen.listKey,
            itemCount: items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) => SuggestionListItem(
              suggestion: items[index],
              showSubmitter: true,
            ),
          ),
        ),
      ),
    );
  }
}
