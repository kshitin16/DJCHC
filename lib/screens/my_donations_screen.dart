/// Screen 9 — My Donations (FR5.3; Contract 5 `myDonations`, `cancelDonation`).
///
/// Behind `featureFlags.donationsEnabled`.
///
/// Display-only apart from Cancel: this Unit does not own the Donation state
/// machine (donation-unit does) and never infers a payment's outcome. Cancel is
/// offered only for an active recurring donation (`Donation.canCancel`, BR5.6),
/// and the server re-checks regardless.
library;

import 'package:flutter/material.dart';

import '../models/donation.dart';
import '../services/donation_service.dart';
import '../services/gateways.dart';
import '../state/localization_controller.dart';
import '../utils/screen_state.dart';
import '../widgets/confirm_destructive_action_dialog.dart';
import '../widgets/list_items.dart';
import '../widgets/state_widgets.dart';

class MyDonationsScreen extends StatefulWidget {
  const MyDonationsScreen({
    required this.donationService,
    required this.strings,
    super.key,
  });

  final DonationService donationService;
  final LocalizationController strings;

  static const Key retryKey = ValueKey('myDonations.retry');
  static const Key listKey = ValueKey('myDonations.list');
  static const Key actionErrorKey = ValueKey('myDonations.actionError');

  @override
  State<MyDonationsScreen> createState() => _MyDonationsScreenState();
}

class _MyDonationsScreenState extends State<MyDonationsScreen> {
  final ValueNotifier<ScreenState<List<Donation>>> _state = ValueNotifier(
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
      final mine = await widget.donationService.myDonations();
      if (!mounted) return;
      _state.value = ScreenState.loaded(mine);
    } on ApiException catch (e) {
      if (!mounted) return;
      _state.value = ScreenState.error(e.message);
    }
  }

  Future<void> _cancel(Donation donation) async {
    // Cancelling stops future charges — a consequential action, so it goes
    // through the same confirmation dialog as a delete.
    final confirmed = await ConfirmDestructiveActionDialog.show(
      context,
      message: widget.strings.t('myDonations.cancelConfirm'),
      confirmLabel: widget.strings.t('myDonations.cancel'),
      cancelLabel: widget.strings.t('common.cancel'),
    );
    if (!confirmed) return;
    setState(() => _actionError = null);
    try {
      await widget.donationService.cancel(donation.id);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      // The donation remains active until cancellation actually succeeds.
      setState(() => _actionError = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('myDonations.title'))),
      body: Column(
        children: [
          if (_actionError != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _actionError!,
                key: MyDonationsScreen.actionErrorKey,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          Expanded(
            child: ValueListenableBuilder<ScreenState<List<Donation>>>(
              valueListenable: _state,
              builder: (context, state, _) => ScreenStateView<List<Donation>>(
                state: state,
                emptyMessage: strings.t('myDonations.empty'),
                emptyIcon: Icons.volunteer_activism_outlined,
                retryLabel: strings.t('common.retry'),
                onRetry: _load,
                retryKey: MyDonationsScreen.retryKey,
                isEmpty: (items) => items.isEmpty,
                builder: (context, items) => ListView.separated(
                  key: MyDonationsScreen.listKey,
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final donation = items[index];
                    return DonationListItem(
                      donation: donation,
                      strings: strings,
                      onCancel: donation.canCancel
                          ? () => _cancel(donation)
                          : null,
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
