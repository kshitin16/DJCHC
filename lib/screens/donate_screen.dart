/// Screen 8 — Donate (FR5.1, FR5.2; Contract 5 `initiateDonation`).
///
/// Behind `featureFlags.donationsEnabled` until donation-unit's aggregator
/// account exists.
///
/// This screen NEVER collects or transmits payment details (project.md
/// Forbidden): it collects an amount and a type, calls `initiateDonation`, and
/// hands the returned `checkoutUrl` to the OS browser. The aggregator's own page
/// takes the card/UPI details, and the donation's outcome is decided server-side
/// by Contract 7's webhook — never inferred here.
library;

import 'package:flutter/material.dart';

import '../models/donation.dart';
import '../services/donation_service.dart';
import '../services/gateways.dart';
import '../state/localization_controller.dart';

/// Opens an external URL. Injected so widget tests can assert the hand-off
/// without launching a browser.
typedef UrlLauncher = Future<bool> Function(Uri url);

class DonateScreen extends StatefulWidget {
  const DonateScreen({
    required this.donationService,
    required this.strings,
    required this.launchUrl,
    super.key,
  });

  final DonationService donationService;
  final LocalizationController strings;
  final UrlLauncher launchUrl;

  static const Key amountKey = ValueKey('donate.amount');
  static const Key typeKey = ValueKey('donate.type');
  static const Key frequencyKey = ValueKey('donate.frequency');
  static const Key submitKey = ValueKey('donate.submit');
  static const Key errorKey = ValueKey('donate.error');

  @override
  State<DonateScreen> createState() => _DonateScreenState();
}

class _DonateScreenState extends State<DonateScreen> {
  final TextEditingController _amount = TextEditingController();
  DonationType _type = DonationType.oneTime;
  DonationFrequency _frequency = DonationFrequency.monthly;
  bool _inFlight = false;
  String? _error;

  bool get _isRecurring => _type == DonationType.recurring;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amount.text.trim());
    // Advisory client guard matching donation-unit's technical floor; the server
    // re-checks regardless.
    if (amount == null || amount <= 0) {
      setState(() => _error = widget.strings.t('donate.amountInvalid'));
      return;
    }
    setState(() {
      _inFlight = true;
      _error = null;
    });
    try {
      final initiation = await widget.donationService.initiate(
        amount: amount,
        donationType: _type,
        frequency: _isRecurring ? _frequency : null,
      );
      final launched = await widget.launchUrl(
        Uri.parse(initiation.checkoutUrl),
      );
      if (!mounted) return;
      setState(() {
        _inFlight = false;
        // A failure to open the browser is the one thing this screen can report
        // itself; whether the payment then succeeds is never inferred here.
        _error = launched ? null : widget.strings.t('donate.launchFailed');
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _inFlight = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('donate.title'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            key: DonateScreen.amountKey,
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: strings.t('donate.amount'),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<DonationType>(
            key: DonateScreen.typeKey,
            initialValue: _type,
            decoration: InputDecoration(
              labelText: strings.t('donate.type'),
              border: const OutlineInputBorder(),
            ),
            items: [
              for (final type in DonationType.values)
                if (type != DonationType.unknown)
                  DropdownMenuItem(
                    value: type,
                    child: Text(strings.t('donate.${type.graphQlValue}')),
                  ),
            ],
            onChanged: (value) {
              if (value != null) setState(() => _type = value);
            },
          ),
          // FrequencyPicker is shown ONLY for RECURRING — that conditional
          // visibility is how "frequency required when recurring" is enforced in
          // the UI (frontend-components.md "Form Validation").
          if (_isRecurring) ...[
            const SizedBox(height: 16),
            DropdownButtonFormField<DonationFrequency>(
              key: DonateScreen.frequencyKey,
              initialValue: _frequency,
              decoration: InputDecoration(
                labelText: strings.t('donate.frequency'),
                border: const OutlineInputBorder(),
              ),
              items: [
                for (final frequency in DonationFrequency.values)
                  if (frequency != DonationFrequency.unknown)
                    DropdownMenuItem(
                      value: frequency,
                      child: Text(
                        strings.t('donate.${frequency.graphQlValue}'),
                      ),
                    ),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _frequency = value);
              },
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            key: DonateScreen.submitKey,
            onPressed: _inFlight ? null : _submit,
            child: Text(strings.t('donate.submit')),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(
                _error!,
                key: DonateScreen.errorKey,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
        ],
      ),
    );
  }
}
