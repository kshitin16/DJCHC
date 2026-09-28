/// Screen 1 — Feed (FR1.3, FR2.6; Contract 3 `listPosts`).
///
/// Public: renders for a signed-out visitor without any auth check. The auth mode
/// of the underlying call still follows sign-in state (`FeedService` rule 3), so
/// a signed-in reader uses their User Pool token.
library;

import 'package:flutter/material.dart';

import '../models/post.dart';
import '../services/gateways.dart';
import '../services/feed_service.dart';
import '../state/auth_state.dart';
import '../state/localization_controller.dart';
import '../utils/screen_state.dart';
import '../widgets/list_items.dart';
import '../widgets/state_widgets.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({
    required this.feedService,
    required this.authState,
    required this.strings,
    this.onSignInTap,
    super.key,
  });

  final FeedService feedService;
  final AuthState authState;
  final LocalizationController strings;

  /// Tapping the app-bar action: Sign In when signed out, Account when signed in.
  final VoidCallback? onSignInTap;

  static const Key retryKey = ValueKey('feed.retry');
  static const Key signInKey = ValueKey('feed.signIn');
  static const Key listKey = ValueKey('feed.list');

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final ValueNotifier<ScreenState<List<Post>>> _state = ValueNotifier(
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
      final posts = await widget.feedService.listPosts(
        signedIn: widget.authState.isSignedIn,
      );
      if (!mounted) return;
      _state.value = ScreenState.loaded(posts);
    } on ApiException catch (e) {
      if (!mounted) return;
      _state.value = ScreenState.error(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.t('feed.title')),
        actions: [
          TextButton(
            key: FeedScreen.signInKey,
            onPressed: widget.onSignInTap,
            child: Text(
              widget.authState.isSignedIn
                  ? strings.t('nav.account')
                  : strings.t('common.signIn'),
            ),
          ),
        ],
      ),
      body: ValueListenableBuilder<ScreenState<List<Post>>>(
        valueListenable: _state,
        builder: (context, state, _) => ScreenStateView<List<Post>>(
          state: state,
          emptyMessage: strings.t('feed.empty'),
          emptyIcon: Icons.dynamic_feed_outlined,
          retryLabel: strings.t('common.retry'),
          onRetry: _load,
          retryKey: FeedScreen.retryKey,
          isEmpty: (posts) => posts.isEmpty,
          builder: (context, posts) => RefreshIndicator(
            onRefresh: _load,
            child: ListView.builder(
              key: FeedScreen.listKey,
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: posts.length,
              itemBuilder: (context, index) =>
                  PostCard(post: posts[index], strings: strings),
            ),
          ),
        ),
      ),
    );
  }
}
