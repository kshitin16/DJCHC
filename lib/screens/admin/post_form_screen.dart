/// Screen 6's create/edit form (FR2.2, FR2.4; Contract 3 `getPost`,
/// `createPost`, `updatePost`).
///
/// An edit loads the post through `getPost(id)` — which works even when the post
/// has aged out of the public feed — and saves only the fields that actually
/// changed, matching `updatePost`'s all-optional input.
///
/// Required-field checks here are advisory; feed-unit's BR2.2 is the authority.
library;

import 'package:flutter/material.dart';

import '../../models/post.dart';
import '../../services/feed_service.dart';
import '../../services/gateways.dart';
import '../../state/localization_controller.dart';
import '../../utils/ist_time.dart';
import '../../widgets/state_widgets.dart';

class PostFormScreen extends StatefulWidget {
  const PostFormScreen({
    required this.feedService,
    required this.strings,
    this.postId,
    super.key,
  });

  final FeedService feedService;
  final LocalizationController strings;

  /// Null for a new post; an id loads that post for editing.
  final String? postId;

  static const Key titleFieldKey = ValueKey('postForm.title');
  static const Key descriptionFieldKey = ValueKey('postForm.description');
  static const Key typeFieldKey = ValueKey('postForm.type');
  static const Key saveKey = ValueKey('postForm.save');
  static const Key errorKey = ValueKey('postForm.error');
  static const Key retryKey = ValueKey('postForm.retry');

  @override
  State<PostFormScreen> createState() => _PostFormScreenState();
}

class _PostFormScreenState extends State<PostFormScreen> {
  final TextEditingController _title = TextEditingController();
  final TextEditingController _description = TextEditingController();
  PostType _type = PostType.event;
  DateTime _dateTime = DateTime.now().toUtc();

  Post? _existing;
  bool _loading = false;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.postId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _loadExisting();
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _loadExisting() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final post = await widget.feedService.getPost(widget.postId!);
      if (!mounted) return;
      if (post == null) {
        setState(() {
          _loading = false;
          _error = widget.strings.t('postForm.notFound');
        });
        return;
      }
      setState(() {
        _loading = false;
        _existing = post;
        _type = post.type == PostType.unknown ? PostType.event : post.type;
        _title.text = post.title;
        _description.text = post.description;
        _dateTime = post.dateTime;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    final description = _description.text.trim();
    if (title.isEmpty || description.isEmpty) {
      setState(() => _error = widget.strings.t('common.required'));
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final existing = _existing;
      if (existing == null) {
        await widget.feedService.create(
          CreatePostInput(
            type: _type,
            title: title,
            description: description,
            dateTime: _dateTime,
          ),
        );
      } else {
        // Only the changed fields are sent — `UpdatePost`'s fields are all
        // optional and an unchanged one must not be echoed back.
        await widget.feedService.update(
          existing.id,
          UpdatePostInput(
            type: _type == existing.type ? null : _type,
            title: title == existing.title ? null : title,
            description: description == existing.description
                ? null
                : description,
            dateTime: _dateTime == existing.dateTime ? null : _dateTime,
          ),
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.message;
      });
    }
  }

  Future<void> _pickDate() async {
    final ist = toIst(_dateTime);
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(ist.year, ist.month, ist.day),
      firstDate: DateTime(2020),
      lastDate: DateTime(2040),
    );
    if (picked == null || !mounted) return;
    // Keep the existing IST time-of-day and move only the date.
    setState(() {
      _dateTime = DateTime.utc(
        picked.year,
        picked.month,
        picked.day,
        ist.hour,
        ist.minute,
      ).subtract(istOffset);
    });
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          strings.t(_isEdit ? 'postForm.titleEdit' : 'postForm.titleNew'),
        ),
      ),
      body: _loading
          ? const LoadingSkeleton(itemCount: 3)
          : (_isEdit && _existing == null && _error != null)
          ? ErrorState(
              message: _error!,
              retryLabel: strings.t('common.retry'),
              onRetry: _loadExisting,
              retryKey: PostFormScreen.retryKey,
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                DropdownButtonFormField<PostType>(
                  key: PostFormScreen.typeFieldKey,
                  initialValue: _type,
                  decoration: InputDecoration(
                    labelText: strings.t('postForm.type'),
                    border: const OutlineInputBorder(),
                  ),
                  items: [
                    for (final type in PostType.values)
                      if (type != PostType.unknown)
                        DropdownMenuItem(
                          value: type,
                          child: Text(
                            strings.t('postType.${type.graphQlValue}'),
                          ),
                        ),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _type = value);
                  },
                ),
                const SizedBox(height: 16),
                TextField(
                  key: PostFormScreen.titleFieldKey,
                  controller: _title,
                  decoration: InputDecoration(
                    labelText: strings.t('postForm.postTitle'),
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  key: PostFormScreen.descriptionFieldKey,
                  controller: _description,
                  minLines: 3,
                  maxLines: 8,
                  decoration: InputDecoration(
                    labelText: strings.t('postForm.description'),
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                ListTile(
                  key: const ValueKey('postForm.dateTime'),
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event),
                  title: Text(strings.t('postForm.dateTime')),
                  subtitle: Text(formatIstDateTime(_dateTime)),
                  trailing: const Icon(Icons.edit_calendar_outlined),
                  onTap: _pickDate,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  key: PostFormScreen.saveKey,
                  onPressed: _saving ? null : _save,
                  child: Text(strings.t('common.save')),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(
                      _error!,
                      key: PostFormScreen.errorKey,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ),
              ],
            ),
    );
  }
}
