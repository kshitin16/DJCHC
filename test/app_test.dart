/// App shell tests (plan Step 10.9) — routing, gating and localization.
///
/// Gating assertions here prove the UX behaviour only. Every operation behind a
/// gated screen is refused server-side by the owning backend Unit's own AppSync
/// authorization rule, so a bug in the shell can hide or reveal a control but
/// cannot grant access (NFR-AUTHZ.2).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/app.dart';
import 'package:sarovar_jinalaya/l10n/app_strings.dart';
import 'package:sarovar_jinalaya/screens/account_screen.dart';
import 'package:sarovar_jinalaya/screens/feed_screen.dart';
import 'package:sarovar_jinalaya/screens/sign_in_screen.dart';
import 'package:sarovar_jinalaya/screens/submit_suggestion_screen.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';
import 'package:sarovar_jinalaya/state/device_identity_state.dart';
import 'package:sarovar_jinalaya/state/localization_controller.dart';
import 'package:sarovar_jinalaya/utils/feature_flags.dart';
import 'package:sarovar_jinalaya/widgets/bottom_nav_bar.dart';

import 'support/fake_gateways.dart';
import 'support/fake_services.dart';
import 'support/fixtures.dart';
import 'support/pump_app.dart';

void main() {
  late FakeAuthGateway authGateway;
  late AuthState authState;
  late DeviceIdentityState deviceIdentity;
  late FakeFeedService feed;
  late FakeSuggestionService suggestions;
  late FakeReminderService reminders;
  late LocalizationController strings;

  Future<void> build({
    bool signedIn = false,
    bool admin = false,
    String language = AppLanguages.english,
  }) async {
    authGateway = FakeAuthGateway(
      session: aSession(signedIn: signedIn, admin: admin),
    );
    authState = AuthState(AuthService(authGateway));
    await authState.refresh();
    reminders = FakeReminderService();
    deviceIdentity = DeviceIdentityState(reminders);
    feed = FakeFeedService()..posts = [aPost(title: 'Paryushan begins')];
    suggestions = FakeSuggestionService()..submitted = aSuggestion();
    strings = stringsFor(language);
  }

  tearDown(() async {
    authState.dispose();
    deviceIdentity.dispose();
    await authGateway.close();
  });

  AppDependencies deps({FeatureFlags flags = FeatureFlags.allOff}) =>
      AppDependencies(
        authState: authState,
        strings: strings,
        deviceIdentity: deviceIdentity,
        feedService: feed,
        suggestionService: suggestions,
        donationService: FakeDonationService(),
        pdfService: FakePdfService(),
        reminderService: reminders,
        launchUrl: FakeUrlLauncher().call,
        pickPdf: FakePdfPicker().call,
        flags: flags,
        now: DateTime.utc(2026, 3, 1, 10),
      );

  testWidgets('the signed-out shell shows 4 tabs and no Admin entry', (
    tester,
  ) async {
    await build();

    await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
    await tester.pumpAndSettle();

    expect(find.byType(FeedScreen), findsOneWidget);
    expect(find.text('Paryushan begins'), findsOneWidget);
    expect(find.byType(NavigationDestination), findsNWidgets(4));
    // No admin shortcut for a signed-out visitor.
    expect(find.byKey(AppShell.adminEntryKey), findsNothing);
  });

  testWidgets('a gated tab redirects to Sign In and returns after signing in', (
    tester,
  ) async {
    await build();

    await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
    await tester.pumpAndSettle();

    // Suggest requires a signed-in session (FR1.3 step 2).
    await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.suggest)));
    await tester.pumpAndSettle();

    expect(find.byType(SignInScreen), findsOneWidget);
    expect(find.byKey(SignInScreen.noticeKey), findsOneWidget);
    expect(find.byType(SubmitSuggestionScreen), findsNothing);

    await tester.tap(find.byKey(SignInScreen.googleButtonKey));
    await tester.pumpAndSettle();

    // The user lands on the screen they were originally headed to.
    expect(find.byType(SubmitSuggestionScreen), findsOneWidget);
    expect(find.byType(SignInScreen), findsNothing);
  });

  testWidgets('Calendar is reachable signed out — reminders need no sign-in', (
    tester,
  ) async {
    await build();

    await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.calendar)));
    await tester.pumpAndSettle();

    // FR7.8 / BR7.6: the device-guest-identity tier, not the signed-in tier.
    expect(find.byType(SignInScreen), findsNothing);
    expect(find.text('Calendar'), findsWidgets);
    expect(reminders.log.of('resolveIdentity'), isNotEmpty);
  });

  testWidgets('an admin sees the Admin entry; a signed-in non-admin does not', (
    tester,
  ) async {
    await build(signedIn: true, admin: false);
    await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
    await tester.pumpAndSettle();
    expect(find.byKey(AppShell.adminEntryKey), findsNothing);

    authState.dispose();
    deviceIdentity.dispose();
    await authGateway.close();

    await build(signedIn: true, admin: true);
    await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
    await tester.pumpAndSettle();
    expect(find.byKey(AppShell.adminEntryKey), findsOneWidget);

    // The Admin sheet lists Posts and Suggestions; PDF Library stays flagged off.
    await tester.tap(find.byKey(AppShell.adminEntryKey));
    await tester.pumpAndSettle();
    expect(find.byKey(AppShell.adminPostsKey), findsOneWidget);
    expect(find.byKey(AppShell.adminSuggestionsKey), findsOneWidget);
    expect(find.byKey(AppShell.adminLibraryKey), findsNothing);
  });

  testWidgets(
    'the flagged tabs are hidden by default and appear when enabled',
    (tester) async {
      await build(signedIn: true);

      await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
      await tester.pumpAndSettle();
      expect(find.byKey(BottomNavBar.keyFor(AppTab.donate)), findsNothing);
      expect(find.byKey(BottomNavBar.keyFor(AppTab.library)), findsNothing);
      expect(find.byType(NavigationDestination), findsNWidgets(4));

      await tester.pumpWidget(
        SarovarJinalayaApp(dependencies: deps(flags: FeatureFlags.allOn)),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(BottomNavBar.keyFor(AppTab.donate)), findsOneWidget);
      expect(find.byKey(BottomNavBar.keyFor(AppTab.library)), findsOneWidget);
      expect(find.byType(NavigationDestination), findsNWidgets(6));
    },
  );

  testWidgets('a Hindi device locale renders the app in Hindi', (tester) async {
    await build(language: AppLanguages.hindi);

    await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
    await tester.pumpAndSettle();

    expect(strings.languageCode, AppLanguages.hindi);
    expect(find.text('फ़ीड'), findsWidgets);
    expect(find.text('कैलेंडर'), findsOneWidget);
    expect(find.text('खाता'), findsOneWidget);
    expect(find.text('Feed'), findsNothing);
  });

  testWidgets('a language change from Account re-renders the whole shell', (
    tester,
  ) async {
    await build(signedIn: true);

    await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.account)));
    await tester.pumpAndSettle();
    expect(find.byType(AccountScreen), findsOneWidget);

    await tester.tap(find.byKey(LanguageToggle.hindiKey));
    await tester.pumpAndSettle();

    // Both the screen AND the navigation bar switch language.
    expect(find.text('खाता'), findsWidgets);
    expect(find.text('फ़ीड'), findsOneWidget);
    expect(find.text('Account'), findsNothing);
  });

  testWidgets('signing out of a gated tab returns to Feed', (tester) async {
    await build(signedIn: true);

    await tester.pumpWidget(SarovarJinalayaApp(dependencies: deps()));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.account)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(AccountScreen.signOutKey));
    await tester.pumpAndSettle();

    expect(authState.isSignedIn, isFalse);
    expect(find.byType(FeedScreen), findsOneWidget);
    expect(find.byKey(AppShell.adminEntryKey), findsNothing);
  });

  testWidgets('the root notifiers are constructed once and shared', (
    tester,
  ) async {
    await build(signedIn: true);
    final dependencies = deps();

    await tester.pumpWidget(SarovarJinalayaApp(dependencies: dependencies));
    await tester.pumpAndSettle();

    // Navigating between tabs must not rebuild the root notifiers — the Feed and
    // Account screens are handed the very same instances.
    await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.account)));
    await tester.pumpAndSettle();
    expect(
      tester.widget<AccountScreen>(find.byType(AccountScreen)).authState,
      same(authState),
    );
    expect(
      tester.widget<AccountScreen>(find.byType(AccountScreen)).deviceIdentity,
      same(deviceIdentity),
    );

    await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.feed)));
    await tester.pumpAndSettle();
    expect(
      tester.widget<FeedScreen>(find.byType(FeedScreen)).authState,
      same(authState),
    );
    expect(
      tester.widget<FeedScreen>(find.byType(FeedScreen)).strings,
      same(strings),
    );
  });

  testWidgets('a notification tap opens the app on Calendar', (tester) async {
    await build();

    await tester.pumpWidget(
      SarovarJinalayaApp(dependencies: deps(), initialPostId: 'p-1'),
    );
    await tester.pumpAndSettle();

    // Not Feed: the deep link put the shell on the Calendar tab.
    expect(find.byType(FeedScreen), findsNothing);
    expect(find.text('Calendar'), findsWidgets);
  });
}
