/// The one confirmation dialog every consequential action goes through.
///
/// wireframes.md's rule: a destructive action NEVER fires from a bare one-tap
/// control. Reused by post delete, donation cancel, document delete and reminder
/// cancel (frontend-components.md "Shared Widgets").
library;

import 'package:flutter/material.dart';

class ConfirmDestructiveActionDialog extends StatelessWidget {
  const ConfirmDestructiveActionDialog({
    required this.message,
    required this.confirmLabel,
    required this.cancelLabel,
    this.title,
    super.key,
  });

  final String message;
  final String confirmLabel;
  final String cancelLabel;
  final String? title;

  static const Key confirmKey = ValueKey('confirm.confirm');
  static const Key cancelKey = ValueKey('confirm.cancel');

  /// Shows the dialog and resolves to `true` only when the user confirmed.
  ///
  /// A dismissal (back button, tap outside) resolves to `false`, so the caller's
  /// `if (!confirmed) return;` is always the safe path.
  static Future<bool> show(
    BuildContext context, {
    required String message,
    required String confirmLabel,
    required String cancelLabel,
    String? title,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => ConfirmDestructiveActionDialog(
        message: message,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
        title: title,
      ),
    );
    return confirmed ?? false;
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: title == null ? null : Text(title!),
    content: Text(message),
    actions: [
      TextButton(
        key: cancelKey,
        onPressed: () => Navigator.of(context).pop(false),
        child: Text(cancelLabel),
      ),
      FilledButton(
        key: confirmKey,
        style: FilledButton.styleFrom(
          backgroundColor: Theme.of(context).colorScheme.error,
          foregroundColor: Theme.of(context).colorScheme.onError,
        ),
        onPressed: () => Navigator.of(context).pop(true),
        child: Text(confirmLabel),
      ),
    ],
  );
}
