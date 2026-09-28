/// The three shared per-screen state widgets (frontend-components.md
/// "Shared Widgets"): error, empty and loading.
///
/// Used identically across every screen, which is what makes the error and
/// loading experience uniform (wireframes.md's established pattern).
///
/// Every interactive control carries a `Key` so widget tests and future
/// automation can address it.
library;

import 'package:flutter/material.dart';

import '../utils/screen_state.dart';

/// A plain-language message with a retry action.
///
/// The message is always copy the user can act on: either the server's own
/// refusal text (each backend Unit writes those as plain language) or this app's
/// network copy. It is never a stack trace or a raw SDK string.
class ErrorState extends StatelessWidget {
  const ErrorState({
    required this.message,
    required this.retryLabel,
    this.onRetry,
    this.retryKey = const ValueKey('error.retry'),
    super.key,
  });

  final String message;
  final String retryLabel;

  /// When null, no retry button is shown (a failure with nothing to retry).
  final VoidCallback? onRetry;
  final Key retryKey;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline,
            size: 40,
            color: Theme.of(context).colorScheme.error,
          ),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            FilledButton(
              key: retryKey,
              onPressed: onRetry,
              child: Text(retryLabel),
            ),
          ],
        ],
      ),
    ),
  );
}

/// A short explanatory message with no error styling. Per-screen copy.
class EmptyState extends StatelessWidget {
  const EmptyState({required this.message, this.icon, super.key});

  final String message;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 40, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
          ],
          Text(
            message,
            key: const ValueKey('empty.message'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    ),
  );
}

/// Skeleton list-item placeholders, shown the moment a list screen is pushed —
/// before its service call is even issued, which is what keeps the screen
/// transition inside NFR-PERF.2's 300ms budget.
class LoadingSkeleton extends StatelessWidget {
  const LoadingSkeleton({this.itemCount = 4, super.key});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return ListView.builder(
      key: const ValueKey('loading.skeleton'),
      padding: const EdgeInsets.all(16),
      itemCount: itemCount,
      itemBuilder: (context, index) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(height: 14, width: 120, color: base),
            const SizedBox(height: 8),
            Container(height: 20, width: double.infinity, color: base),
            const SizedBox(height: 6),
            Container(height: 14, width: 220, color: base),
          ],
        ),
      ),
    );
  }
}

/// Renders a [ScreenState] through the three widgets above plus a builder for
/// the loaded case, so every screen's four states look the same without each one
/// repeating the switch.
///
/// `Loaded` with an empty payload is NOT automatically the empty state — the
/// screen passes [isEmpty] when it wants that, which keeps the empty copy
/// per-screen (`ScreenState`'s own contract).
class ScreenStateView<T> extends StatelessWidget {
  const ScreenStateView({
    required this.state,
    required this.builder,
    required this.emptyMessage,
    required this.retryLabel,
    this.onRetry,
    this.isEmpty,
    this.emptyIcon,
    this.retryKey = const ValueKey('error.retry'),
    this.skeletonItemCount = 4,
    super.key,
  });

  final ScreenState<T> state;
  final Widget Function(BuildContext context, T data) builder;
  final String emptyMessage;
  final String retryLabel;
  final VoidCallback? onRetry;

  /// Decides whether loaded data should render as the empty state.
  final bool Function(T data)? isEmpty;
  final IconData? emptyIcon;

  /// The screen's own retry key, e.g. `ValueKey('feed.retry')`.
  final Key retryKey;
  final int skeletonItemCount;

  @override
  Widget build(BuildContext context) => state.when(
    loading: () => LoadingSkeleton(itemCount: skeletonItemCount),
    empty: () => EmptyState(message: emptyMessage, icon: emptyIcon),
    error: (message) => ErrorState(
      message: message,
      retryLabel: retryLabel,
      onRetry: onRetry,
      retryKey: retryKey,
    ),
    loaded: (data) => (isEmpty?.call(data) ?? false)
        ? EmptyState(message: emptyMessage, icon: emptyIcon)
        : builder(context, data),
  );
}
