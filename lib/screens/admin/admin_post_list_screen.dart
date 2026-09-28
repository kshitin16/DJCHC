/// Screen 6 — Admin: Post List (FR2.1-FR2.5; Contract 3 admin operations).
///
/// Shows every non-deleted post INCLUDING aged-out ones, unlike the public Feed
/// (`listAllPostsForAdmin`, BR2.3/BR2.7).
///
/// The screen being reachable at all is a UX gate on `AuthState.isAdmin`. AppSync's
/// `allow.group('Admin')` is what actually enforces admin access: an admin who
/// lost the group mid-session gets a server refusal, rendered here as plain copy.
library;

import 'package:flutter/material.dart';

import '../../models/post.dart';
import '../../services/feed_service.dart';
import '../../services/gateways.dart';
import '../../state/localization_controller.dart';
import '../../utils/ist_time.dart';
import '../../utils/screen_state.dart';
import '../../widgets/confirm_destructive_action_dialog.dart';
import '../../widgets/list_items.dart';
import '../../widgets/state_widgets.dart';
import 'post_form_screen.dart';

class AdminPostListScreen extends StatefulWidget {
  const AdminPostListScreen({
    required this.feedService,
    required this.strings,
    this.now,
    super.key,
  });

  final FeedService feedService;
  final LocalizationController strings;

  /// Injected for tests; defaults to the real clock. Used only to label a post
  /// as past — never to filter one out.
  final DateTime? now;

  static const Key retryKey = ValueKey('adminPosts.retry');
  static const Key listKey = ValueKey('adminPosts.list');
  static const Key newPostKey = ValueKey('adminPosts.new');
  static const Key actionErrorKey = ValueKey('adminPosts.actionError');
  static Key editKeyFor(String id) => ValueKey('adminPosts.edit.$id');
  static Key deleteKeyFor(String id) => ValueKey('adminPosts.delete.$id');
  static Key pastBadgeKeyFor(String id) => ValueKey('adminPosts.past.$id');

  @override
  State<AdminPostListScreen> createState() => _AdminPostListScreenState();
}

class _AdminPostListScreenState extends State<AdminPostListScreen> {
  final ValueNotifier<ScreenState<List<Post>>> _state = ValueNotifier(
    const ScreenState.loading(),
  );
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
      final posts = await widget.feedService.listAllForAdmin();
      if (!mounted) return;
      _state.value = ScreenState.loaded(posts);
    } on ApiException catch (e) {
      if (!mounted) return;
      // A caller who lost admin status mid-session lands here with the server's
      // own "admin access required" copy.
      _state.value = ScreenState.error(e.message);
    }
  }

  Future<void> _openForm({Post? existing}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (context) => PostFormScreen(
          feedService: widget.feedService,
          strings: widget.strings,
          postId: existing?.id,
        ),
      ),
    );
    if (saved == true) await _load();
  }

  Future<void> _delete(Post post) async {
    // wireframes.md: a destructive action never fires from a bare one-tap control.
    final confirmed = await ConfirmDestructiveActionDialog.show(
      context,
      message: widget.strings.t('adminPosts.deleteConfirm'),
      confirmLabel: widget.strings.t('common.delete'),
      cancelLabel: widget.strings.t('common.cancel'),
    );
    if (!confirmed) return;
    setState(() => _actionError = null);
    try {
      await widget.feedService.delete(post.id);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _actionError = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    final now = widget.now ?? DateTime.now().toUtc();
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('adminPosts.title'))),
      floatingActionButton: FloatingActionButton.extended(
        key: AdminPostListScreen.newPostKey,
        onPressed: _openForm,
        icon: const Icon(Icons.add),
        label: Text(strings.t('adminPosts.new')),
      ),
      body: Column(
        children: [
          if (_actionError != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _actionError!,
                key: AdminPostListScreen.actionErrorKey,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          Expanded(
            child: ValueListenableBuilder<ScreenState<List<Post>>>(
              valueListenable: _state,
              builder: (context, state, _) => ScreenStateView<List<Post>>(
                state: state,
                emptyMessage: strings.t('adminPosts.empty'),
                emptyIcon: Icons.post_add,
                retryLabel: strings.t('common.retry'),
                onRetry: _load,
                retryKey: AdminPostListScreen.retryKey,
                isEmpty: (posts) => posts.isEmpty,
                builder: (context, posts) => ListView.builder(
                  key: AdminPostListScreen.listKey,
                  padding: const EdgeInsets.only(bottom: 88),
                  itemCount: posts.length,
                  itemBuilder: (context, index) {
                    final post = posts[index];
                    final isPast = !isUpcomingIst(post.dateTime, now: now);
                    return PostCard(
                      post: post,
                      strings: strings,
                      onTap: () => _openForm(existing: post),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isPast)
                            Padding(
                              padding: const EdgeInsets.only(right: 4),
                              child: Chip(
                                key: AdminPostListScreen.pastBadgeKeyFor(
                                  post.id,
                                ),
                                label: Text(strings.t('adminPosts.agedOut')),
                                visualDensity: VisualDensity.compact,
                              ),
                            ),
                          IconButton(
                            key: AdminPostListScreen.editKeyFor(post.id),
                            tooltip: strings.t('adminPosts.edit'),
                            icon: const Icon(Icons.edit_outlined),
                            onPressed: () => _openForm(existing: post),
                          ),
                          IconButton(
                            key: AdminPostListScreen.deleteKeyFor(post.id),
                            tooltip: strings.t('common.delete'),
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () => _delete(post),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
