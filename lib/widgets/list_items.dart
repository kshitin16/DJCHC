/// The per-entity list items (frontend-components.md "Key widgets").
///
/// Each one renders a model and, where the screen allows it, exposes actions by
/// callback — none of them calls a service, and none imports Amplify.
library;

import 'package:flutter/material.dart';

import '../models/document.dart';
import '../models/donation.dart';
import '../models/post.dart';
import '../models/reminder.dart';
import '../models/suggestion.dart';
import '../state/localization_controller.dart';
import '../utils/ist_time.dart';

/// A feed post: type badge, title, IST date, description.
class PostCard extends StatelessWidget {
  const PostCard({
    required this.post,
    required this.strings,
    this.onTap,
    this.trailing,
    super.key,
  });

  final Post post;
  final LocalizationController strings;
  final VoidCallback? onTap;
  final Widget? trailing;

  static Key keyFor(String postId) => ValueKey('feed.post.$postId');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      key: keyFor(post.id),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Chip(
                          label: Text(
                            strings.t('postType.${post.type.graphQlValue}'),
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                        Text(
                          formatIstDateTime(post.dateTime),
                          style: theme.textTheme.labelMedium,
                        ),
                      ],
                    ),
                  ),
                  ?trailing,
                ],
              ),
              const SizedBox(height: 8),
              Text(post.title, style: theme.textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(post.description, style: theme.textTheme.bodyMedium),
            ],
          ),
        ),
      ),
    );
  }
}

/// A suggestion: truncated text plus submission date. Read-only everywhere —
/// FR3.5 has nothing to mark read or resolved.
class SuggestionListItem extends StatelessWidget {
  const SuggestionListItem({
    required this.suggestion,
    this.showSubmitter = false,
    super.key,
  });

  final Suggestion suggestion;

  /// The admin list shows who submitted it; the user's own list does not.
  final bool showSubmitter;

  static Key keyFor(String id) => ValueKey('suggestion.$id');

  @override
  Widget build(BuildContext context) => ListTile(
    key: keyFor(suggestion.id),
    title: Text(suggestion.text, maxLines: 3, overflow: TextOverflow.ellipsis),
    subtitle: Text(
      showSubmitter
          ? '${suggestion.submittedByGoogleId} · '
                '${formatIstDate(suggestion.submittedAt)}'
          : formatIstDate(suggestion.submittedAt),
    ),
  );
}

/// A donation: amount, type, status badge, date, and Cancel when it applies.
class DonationListItem extends StatelessWidget {
  const DonationListItem({
    required this.donation,
    required this.strings,
    this.onCancel,
    super.key,
  });

  final Donation donation;
  final LocalizationController strings;

  /// Wired only when [Donation.canCancel]; the screen decides.
  final VoidCallback? onCancel;

  static Key keyFor(String id) => ValueKey('donation.$id');
  static Key cancelKeyFor(String id) => ValueKey('donation.cancel.$id');

  @override
  Widget build(BuildContext context) {
    final frequency = donation.frequency;
    final subtitleParts = [
      strings.t('donate.${donation.donationType.graphQlValue}'),
      if (frequency != null) strings.t('donate.${frequency.graphQlValue}'),
      formatIstDate(donation.createdAt),
    ];
    return ListTile(
      key: keyFor(donation.id),
      title: Text('₹${donation.amount.toStringAsFixed(2)}'),
      subtitle: Text(subtitleParts.join(' · ')),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Chip(
            label: Text(
              strings.t('donationStatus.${donation.status.graphQlValue}'),
            ),
            visualDensity: VisualDensity.compact,
          ),
          if (donation.canCancel && onCancel != null)
            IconButton(
              key: cancelKeyFor(donation.id),
              tooltip: strings.t('myDonations.cancel'),
              icon: const Icon(Icons.cancel_outlined),
              onPressed: onCancel,
            ),
        ],
      ),
    );
  }
}

/// A library document: title, category, upload date, and an open action.
class DocumentListItem extends StatelessWidget {
  const DocumentListItem({
    required this.document,
    required this.strings,
    this.onOpen,
    this.onDelete,
    super.key,
  });

  final Document document;
  final LocalizationController strings;
  final VoidCallback? onOpen;

  /// Admin-only; the public library passes null.
  final VoidCallback? onDelete;

  static Key keyFor(String id) => ValueKey('document.$id');
  static Key openKeyFor(String id) => ValueKey('document.open.$id');
  static Key deleteKeyFor(String id) => ValueKey('document.delete.$id');

  @override
  Widget build(BuildContext context) => ListTile(
    key: keyFor(document.id),
    leading: const Icon(Icons.picture_as_pdf_outlined),
    title: Text(document.title),
    subtitle: Text(
      '${strings.t('category.${document.category.graphQlValue}')} · '
      '${formatIstDate(document.uploadedAt)}',
    ),
    onTap: onOpen,
    trailing: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (onOpen != null)
          IconButton(
            key: openKeyFor(document.id),
            tooltip: strings.t('library.title'),
            icon: const Icon(Icons.open_in_new),
            onPressed: onOpen,
          ),
        if (onDelete != null)
          IconButton(
            key: deleteKeyFor(document.id),
            tooltip: strings.t('common.delete'),
            icon: const Icon(Icons.delete_outline),
            onPressed: onDelete,
          ),
      ],
    ),
  );
}

/// A reminder's status, as a small badge next to an event's controls.
class ReminderStatusBadge extends StatelessWidget {
  const ReminderStatusBadge({
    required this.status,
    required this.strings,
    super.key,
  });

  /// Null means this device has no reminder row for the event yet (it will be
  /// backfilled on the next `myReminders` sync, BR7.1).
  final ReminderStatus? status;
  final LocalizationController strings;

  static const Key badgeKey = ValueKey('reminder.badge');

  @override
  Widget build(BuildContext context) {
    final value = status;
    if (value == null) return const SizedBox.shrink();
    return Chip(
      key: badgeKey,
      label: Text(strings.t('reminderStatus.${value.graphQlValue}')),
      visualDensity: VisualDensity.compact,
    );
  }
}
