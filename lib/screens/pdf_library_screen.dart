/// Screen 10 — PDF Library (FR6.1; Contract 6 `listDocuments`,
/// `getDocumentDownloadUrl`).
///
/// Behind `featureFlags.pdfLibraryEnabled`.
///
/// Public: browsable and downloadable without signing in (BR6.5). The PDF bytes
/// never pass through this app — the pre-signed URL is opened by the device's own
/// browser/PDF viewer.
library;

import 'package:flutter/material.dart';

import '../models/document.dart';
import '../services/gateways.dart';
import '../services/pdf_service.dart';
import '../state/auth_state.dart';
import '../state/localization_controller.dart';
import '../utils/screen_state.dart';
import '../widgets/list_items.dart';
import '../widgets/state_widgets.dart';
import 'donate_screen.dart' show UrlLauncher;

class PdfLibraryScreen extends StatefulWidget {
  const PdfLibraryScreen({
    required this.pdfService,
    required this.authState,
    required this.strings,
    required this.launchUrl,
    super.key,
  });

  final PdfService pdfService;
  final AuthState authState;
  final LocalizationController strings;
  final UrlLauncher launchUrl;

  static const Key retryKey = ValueKey('library.retry');
  static const Key listKey = ValueKey('library.list');
  static const Key actionErrorKey = ValueKey('library.actionError');
  static const Key allChipKey = ValueKey('library.category.all');
  static Key chipKeyFor(DocumentCategory category) =>
      ValueKey('library.category.${category.graphQlValue}');

  @override
  State<PdfLibraryScreen> createState() => _PdfLibraryScreenState();
}

class _PdfLibraryScreenState extends State<PdfLibraryScreen> {
  final ValueNotifier<ScreenState<List<Document>>> _state = ValueNotifier(
    const ScreenState.loading(),
  );

  /// Null means "all three categories" — `listDocuments` omits the argument.
  DocumentCategory? _category;
  String? _actionError;

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
      final documents = await widget.pdfService.list(
        category: _category,
        signedIn: widget.authState.isSignedIn,
      );
      if (!mounted) return;
      _state.value = ScreenState.loaded(documents);
    } on ApiException catch (e) {
      if (!mounted) return;
      _state.value = ScreenState.error(e.message);
    }
  }

  Future<void> _open(Document document) async {
    setState(() => _actionError = null);
    try {
      final url = await widget.pdfService.downloadUrl(
        document.id,
        signedIn: widget.authState.isSignedIn,
      );
      final launched = await widget.launchUrl(Uri.parse(url));
      if (!mounted || launched) return;
      setState(() => _actionError = widget.strings.t('library.openFailed'));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _actionError = e.message);
    }
  }

  void _selectCategory(DocumentCategory? category) {
    if (category == _category) return;
    setState(() => _category = category);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('library.title'))),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              spacing: 8,
              children: [
                FilterChip(
                  key: PdfLibraryScreen.allChipKey,
                  label: Text(strings.t('library.all')),
                  selected: _category == null,
                  onSelected: (_) => _selectCategory(null),
                ),
                for (final category in DocumentCategory.known)
                  FilterChip(
                    key: PdfLibraryScreen.chipKeyFor(category),
                    label: Text(strings.t('category.${category.graphQlValue}')),
                    selected: _category == category,
                    onSelected: (_) => _selectCategory(category),
                  ),
              ],
            ),
          ),
          if (_actionError != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _actionError!,
                key: PdfLibraryScreen.actionErrorKey,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          Expanded(
            child: ValueListenableBuilder<ScreenState<List<Document>>>(
              valueListenable: _state,
              builder: (context, state, _) => ScreenStateView<List<Document>>(
                state: state,
                emptyMessage: strings.t('library.empty'),
                emptyIcon: Icons.menu_book_outlined,
                retryLabel: strings.t('common.retry'),
                onRetry: _load,
                retryKey: PdfLibraryScreen.retryKey,
                isEmpty: (items) => items.isEmpty,
                builder: (context, items) => ListView.separated(
                  key: PdfLibraryScreen.listKey,
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) => DocumentListItem(
                    document: items[index],
                    strings: strings,
                    onOpen: () => _open(items[index]),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
