/// Screen 11 — Admin: PDF Library Management (FR6.2, FR6.3; Contract 6).
///
/// Behind `featureFlags.pdfLibraryEnabled`.
///
/// The upload is BR6.2's strict three-step sequence and the order matters:
///   1. `createDocumentUploadUrl(title, category)` -> a pre-signed PUT target
///   2. HTTP PUT the bytes straight to S3 (never through this app's API)
///   3. `confirmDocumentUpload(s3Key, title, category)` -> the Document row
/// If step 3 finds the object is not a PDF, the server removes it and creates
/// nothing — the refusal is shown here verbatim.
library;

import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../models/document.dart';
import '../../services/gateways.dart';
import '../../services/pdf_service.dart';
import '../../state/localization_controller.dart';
import '../../utils/screen_state.dart';
import '../../widgets/confirm_destructive_action_dialog.dart';
import '../../widgets/list_items.dart';
import '../../widgets/state_widgets.dart';

/// A PDF the admin chose. Injected as a function so widget tests never touch the
/// platform file picker.
typedef PdfPicker = Future<PickedPdf?> Function();

/// The picked file's name and bytes.
class PickedPdf {
  const PickedPdf({required this.fileName, required this.bytes});

  final String fileName;
  final Uint8List bytes;

  /// An advisory extension check; `confirmDocumentUpload` is the authority and
  /// inspects the object's actual content type server-side.
  bool get looksLikePdf => fileName.toLowerCase().endsWith('.pdf');
}

class AdminPdfLibraryScreen extends StatefulWidget {
  const AdminPdfLibraryScreen({
    required this.pdfService,
    required this.strings,
    required this.pickPdf,
    super.key,
  });

  final PdfService pdfService;
  final LocalizationController strings;
  final PdfPicker pickPdf;

  static const Key retryKey = ValueKey('adminLibrary.retry');
  static const Key listKey = ValueKey('adminLibrary.list');
  static const Key titleFieldKey = ValueKey('adminLibrary.title');
  static const Key categoryFieldKey = ValueKey('adminLibrary.category');
  static const Key pickKey = ValueKey('adminLibrary.pick');
  static const Key uploadKey = ValueKey('adminLibrary.upload');
  static const Key errorKey = ValueKey('adminLibrary.error');
  static const Key successKey = ValueKey('adminLibrary.success');
  static const Key pickedNameKey = ValueKey('adminLibrary.pickedName');

  @override
  State<AdminPdfLibraryScreen> createState() => _AdminPdfLibraryScreenState();
}

class _AdminPdfLibraryScreenState extends State<AdminPdfLibraryScreen> {
  final ValueNotifier<ScreenState<List<Document>>> _state = ValueNotifier(
    const ScreenState.loading(),
  );
  final TextEditingController _title = TextEditingController();
  DocumentCategory _category = DocumentCategory.dailyPoojan;
  PickedPdf? _picked;
  bool _uploading = false;
  String? _error;
  bool _succeeded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _title.dispose();
    _state.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    _state.value = const ScreenState.loading();
    try {
      // The admin screen reads the same public listing, with actions added.
      final documents = await widget.pdfService.list(signedIn: true);
      if (!mounted) return;
      _state.value = ScreenState.loaded(documents);
    } on ApiException catch (e) {
      if (!mounted) return;
      _state.value = ScreenState.error(e.message);
    }
  }

  Future<void> _pick() async {
    final picked = await widget.pickPdf();
    if (picked == null || !mounted) return;
    if (!picked.looksLikePdf) {
      setState(() {
        _picked = null;
        _succeeded = false;
        _error = widget.strings.t('adminLibrary.notPdf');
      });
      return;
    }
    setState(() {
      _picked = picked;
      _error = null;
      _succeeded = false;
    });
  }

  Future<void> _upload() async {
    final picked = _picked;
    final title = _title.text.trim();
    if (picked == null || title.isEmpty) {
      setState(() => _error = widget.strings.t('common.required'));
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
      _succeeded = false;
    });
    try {
      // Step 1, 2, 3 — strictly in this order (BR6.2).
      final target = await widget.pdfService.createUploadUrl(
        title: title,
        category: _category,
      );
      await widget.pdfService.uploadBytes(target.uploadUrl, picked.bytes);
      await widget.pdfService.confirmUpload(
        s3Key: target.s3Key,
        title: title,
        category: _category,
      );
      if (!mounted) return;
      setState(() {
        _uploading = false;
        _succeeded = true;
        _picked = null;
      });
      _title.clear();
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _uploading = false;
        _error = e.message;
      });
    }
  }

  Future<void> _delete(Document document) async {
    final confirmed = await ConfirmDestructiveActionDialog.show(
      context,
      message: widget.strings.t('adminLibrary.deleteConfirm'),
      confirmLabel: widget.strings.t('common.delete'),
      cancelLabel: widget.strings.t('common.cancel'),
    );
    if (!confirmed) return;
    setState(() => _error = null);
    try {
      await widget.pdfService.delete(document.id);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('adminLibrary.title'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  strings.t('adminLibrary.upload'),
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                TextField(
                  key: AdminPdfLibraryScreen.titleFieldKey,
                  controller: _title,
                  decoration: InputDecoration(
                    labelText: strings.t('postForm.postTitle'),
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<DocumentCategory>(
                  key: AdminPdfLibraryScreen.categoryFieldKey,
                  initialValue: _category,
                  decoration: InputDecoration(
                    labelText: strings.t('postForm.type'),
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: [
                    for (final category in DocumentCategory.known)
                      DropdownMenuItem(
                        value: category,
                        child: Text(
                          strings.t('category.${category.graphQlValue}'),
                        ),
                      ),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _category = value);
                  },
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    OutlinedButton.icon(
                      key: AdminPdfLibraryScreen.pickKey,
                      onPressed: _uploading ? null : _pick,
                      icon: const Icon(Icons.attach_file),
                      label: Text(strings.t('adminLibrary.pick')),
                    ),
                    const SizedBox(width: 12),
                    if (_picked != null)
                      Expanded(
                        child: Text(
                          _picked!.fileName,
                          key: AdminPdfLibraryScreen.pickedNameKey,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                FilledButton(
                  key: AdminPdfLibraryScreen.uploadKey,
                  onPressed: _uploading ? null : _upload,
                  child: Text(strings.t('adminLibrary.upload')),
                ),
                if (_succeeded)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      strings.t('adminLibrary.uploaded'),
                      key: AdminPdfLibraryScreen.successKey,
                      style: TextStyle(color: theme.colorScheme.primary),
                    ),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _error!,
                      key: AdminPdfLibraryScreen.errorKey,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ValueListenableBuilder<ScreenState<List<Document>>>(
              valueListenable: _state,
              builder: (context, state, _) => ScreenStateView<List<Document>>(
                state: state,
                emptyMessage: strings.t('library.empty'),
                emptyIcon: Icons.menu_book_outlined,
                retryLabel: strings.t('common.retry'),
                onRetry: _load,
                retryKey: AdminPdfLibraryScreen.retryKey,
                isEmpty: (items) => items.isEmpty,
                skeletonItemCount: 2,
                builder: (context, items) => ListView.separated(
                  key: AdminPdfLibraryScreen.listKey,
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) => DocumentListItem(
                    document: items[index],
                    strings: strings,
                    onDelete: () => _delete(items[index]),
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
