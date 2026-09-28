/// **LOCAL-ONLY integration suite — NOT part of CI and NOT run by
/// `flutter test test/`.**
///
/// Prerequisites (README, "Mobile App" > Running the integration suite):
///   1. A running sandbox with its outputs written into the app:
///      `npx ampx sandbox --outputs-format dart --outputs-out-dir lib`
///   2. A connected device or emulator — which needs the Android SDK (Android)
///      or Xcode + CocoaPods (iOS). Neither is installed on the machine that
///      generated this code, which is exactly why this suite is not run here.
///   3. Firebase configured (`flutterfire configure`) for the push-token steps.
///   4. A Google account, and for the admin flow a second account that is NOT in
///      the Cognito `Admin` group.
///
/// Run with: `flutter test integration_test/app_test.dart -d <device-id>`
///
/// Why this suite matters more than usual here (team.md § Testing Posture): a
/// unit test with a faked `ApiGateway` passes whether or not the real
/// integration works. These three flows are the ones where that gap bites:
///
///   - **Google sign-in through the real Cognito hosted UI** — the custom URL
///     scheme (`sarovarjinalaya://callback/`) has to round-trip through the OS,
///     and no unit test exercises it.
///   - **The admin allowlist gate** — the client-side gate is a UX convenience;
///     this is where AppSync's `allow.group('Admin')` is proved to be the layer
///     that actually refuses a non-admin.
///   - **Calendar's guest identity end to end** — the FIRST real exercise of
///     Contract 9's `identityPool` auth mode, and the place the open question in
///     code-generation-plan.md rule 4 gets answered: whether the Identity Pool
///     id changing at sign-in leaves the earlier identity's already-scheduled
///     reminders able to produce a duplicate push. Record what is observed.
library;

import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:sarovar_jinalaya/amplify_outputs.dart';
import 'package:sarovar_jinalaya/app.dart';
import 'package:sarovar_jinalaya/models/document.dart';
import 'package:sarovar_jinalaya/screens/calendar_screen.dart';
import 'package:sarovar_jinalaya/screens/feed_screen.dart';
import 'package:sarovar_jinalaya/screens/sign_in_screen.dart';
import 'package:sarovar_jinalaya/services/amplify_gateway.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/services/donation_service.dart';
import 'package:sarovar_jinalaya/services/feed_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/services/pdf_service.dart';
import 'package:sarovar_jinalaya/services/push_gateway.dart';
import 'package:sarovar_jinalaya/services/reminder_service.dart';
import 'package:sarovar_jinalaya/services/shared_preferences_store.dart';
import 'package:sarovar_jinalaya/services/suggestion_service.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';
import 'package:sarovar_jinalaya/state/device_identity_state.dart';
import 'package:sarovar_jinalaya/state/localization_controller.dart';
import 'package:sarovar_jinalaya/widgets/bottom_nav_bar.dart';

/// The smallest byte sequence S3 and `confirmDocumentUpload` will both accept as
/// a PDF: a one-page document with the `%PDF-` header the server checks for.
Uint8List minimalPdfBytes() => Uint8List.fromList(
  '%PDF-1.4\n'
          '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
          '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
          '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
          'trailer<</Root 1 0 R>>\n'
          '%%EOF\n'
      .codeUnits,
);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late AmplifyGateway gateway;
  late AppDependencies dependencies;
  late AuthState authState;
  late DeviceIdentityState deviceIdentity;
  late ReminderService reminderService;

  setUpAll(() async {
    // The real Amplify client against the sandbox outputs. If this throws with
    // an empty-config error, `lib/amplify_outputs.dart` is still the CI stub —
    // run `npx ampx sandbox --outputs-format dart --outputs-out-dir lib` first.
    gateway = AmplifyGateway();
    await gateway.configure(amplifyConfig);
  });

  tearDownAll(() async {
    await gateway.dispose();
  });

  setUp(() async {
    final push = FirebasePushGateway();
    reminderService = ReminderService(gateway, gateway, push);
    authState = AuthState(AuthService(gateway));
    await authState.refresh();
    deviceIdentity = DeviceIdentityState(reminderService);
    dependencies = AppDependencies(
      authState: authState,
      strings: LocalizationController(SharedPreferencesStore()),
      deviceIdentity: deviceIdentity,
      feedService: FeedService(gateway),
      suggestionService: SuggestionService(gateway),
      donationService: DonationService(gateway),
      pdfService: PdfService(gateway, http.Client()),
      reminderService: reminderService,
      launchUrl: (_) async => true,
      pickPdf: () async => null,
    );
  });

  tearDown(() {
    authState.dispose();
    deviceIdentity.dispose();
  });

  group('Contract 3 — the public feed reaches a signed-out visitor', () {
    testWidgets('listPosts succeeds over the Identity Pool guest role', (
      tester,
    ) async {
      // This is the guest (IAM) auth mode against a REAL AppSync endpoint: if the
      // Identity Pool's unauthenticated role is missing its `appsync:GraphQL`
      // grant, this is where it shows up — no unit test can catch that.
      await tester.pumpWidget(SarovarJinalayaApp(dependencies: dependencies));
      await tester.pumpAndSettle(const Duration(seconds: 15));

      expect(find.byType(FeedScreen), findsOneWidget);
      // Either posts or the empty state — but NOT the error state.
      expect(find.text('Try again'), findsNothing);
    });
  });

  group('Contract 1 — Google sign-in through the real hosted UI', () {
    testWidgets(
      'a hosted-UI sign-in round-trips through the custom URL scheme',
      (tester) async {
        await tester.pumpWidget(SarovarJinalayaApp(dependencies: dependencies));
        await tester.pumpAndSettle(const Duration(seconds: 15));

        // A gated tab redirects to Sign In.
        await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.suggest)));
        await tester.pumpAndSettle();
        expect(find.byType(SignInScreen), findsOneWidget);

        await tester.tap(find.byKey(SignInScreen.googleButtonKey));

        // MANUAL STEP: the OS browser opens Cognito's hosted UI. Complete the
        // Google sign-in on the device. The app is returned to through
        // `sarovarjinalaya://callback/`, which `android/app/src/main/
        // AndroidManifest.xml` and `ios/Runner/Info.plist` register and
        // `amplify/auth/resource.ts` allow-lists — both halves must match.
        await tester.pumpAndSettle(const Duration(seconds: 90));

        expect(authState.isSignedIn, isTrue);
        expect(authState.sub, isNotNull);
        expect(authState.email, isNotNull);
        // Contract 2's claim is present (empty for a non-admin, which is fine).
        expect(authState.session.groups, isNotNull);
      },
      // SKIPPED — manual: requires interactive Google sign-in on a device
      skip: true,
    );
  });

  group('Contract 2 — the admin allowlist gate is enforced SERVER-side', () {
    testWidgets(
      'a non-admin caller is refused by AppSync, not just by the UI',
      (tester) async {
        // Sign in first with an account that is NOT in the Cognito `Admin` group.
        expect(
          authState.isSignedIn,
          isTrue,
          reason: 'sign in with a NON-admin account before running this test',
        );
        expect(authState.isAdmin, isFalse);

        // Call the admin operation DIRECTLY, bypassing the client-side gate
        // entirely — which is the whole point. The client gate is a UX
        // convenience; `allow.group('Admin')` is the security boundary, and this
        // assertion is what proves it.
        await expectLater(
          FeedService(gateway).listAllForAdmin(),
          throwsA(
            isA<ApiException>().having(
              (e) => e.isTransport,
              'is a server refusal, not a transport failure',
              isFalse,
            ),
          ),
        );

        // Same for the other two admin surfaces.
        await expectLater(
          SuggestionService(gateway).allSuggestions(),
          throwsA(isA<ApiException>()),
        );
        await expectLater(
          PdfService(gateway, http.Client()).delete('does-not-matter'),
          throwsA(isA<ApiException>()),
        );
      },
      // SKIPPED — manual: requires a signed-in NON-admin account on the device
      skip: true,
    );

    testWidgets(
      'an admin caller reaches the same operations',
      (tester) async {
        expect(
          authState.isAdmin,
          isTrue,
          reason: 'sign in with an ADMIN account before running this test',
        );

        final posts = await FeedService(gateway).listAllForAdmin();
        // Admin listing includes aged-out posts, so it is a superset of the feed.
        final publicPosts = await FeedService(gateway)
            .listPosts(signedIn: true);
        expect(posts.length, greaterThanOrEqualTo(publicPosts.length));
      },
      // SKIPPED — manual: requires a signed-in ADMIN account on the device
      skip: true,
    );
  });

  group('Contract 9 — Calendar, guest identity, reminders', () {
    testWidgets(
      'guest identity -> register -> myReminders -> snooze -> cancel',
      (tester) async {
        await tester.pumpWidget(SarovarJinalayaApp(dependencies: dependencies));
        await tester.pumpAndSettle(const Duration(seconds: 15));

        await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.calendar)));
        // The OS notification prompt appears here on the first visit only.
        await tester.pumpAndSettle(const Duration(seconds: 30));

        // 1. The Identity Pool issued a guest identity with NO sign-in (BR7.6).
        final guestIdentityId = deviceIdentity.identityId;
        expect(guestIdentityId, isNotNull);
        expect(authState.isSignedIn, isFalse);

        // 2. The device registered its push token (needs permission granted).
        expect(deviceIdentity.permissionRequested, isTrue);

        // 3. myReminders succeeded over `identityPool` and lazily backfilled a
        //    Reminder for every EVENT post (BR7.1, on by default).
        final reminders = await reminderService.myReminders();
        expect(
          reminders.every((r) => r.ownerIdentityId == guestIdentityId),
          isTrue,
          reason: 'every reminder must be scoped to THIS device identity',
        );

        // 4. Snooze and Cancel, on a real reminder.
        final snoozable = reminders.where((r) => r.canSnooze).firstOrNull;
        if (snoozable != null) {
          // BR7.3: this succeeds before 9:00 PM IST on the event's eve and is
          // refused after — note which branch was observed when recording results.
          try {
            final snoozed = await reminderService.snooze(snoozable.id);
            expect(snoozed.snoozeFireAt, isNotNull);
          } on ReminderFailure catch (e) {
            expect(e.kind, ReminderFailureKind.cutoffPassed);
          }
        }
        final cancellable = reminders.where((r) => r.canCancel).firstOrNull;
        if (cancellable != null) {
          await tester.tap(
            find.byKey(CalendarScreen.cancelKeyFor(cancellable.postId)),
          );
          await tester.pumpAndSettle();
        }

        // 5. THE OPEN QUESTION (code-generation-plan.md rule 4). Signing in
        //    gives the Identity Pool a DIFFERENT id, so `myReminders` returns a
        //    different set and the app re-syncs. What is NOT yet known is
        //    whether the reminders already scheduled under `guestIdentityId`
        //    still fire — producing a duplicate push for the same event.
        //    Record the answer here; no cancel-all logic was added, per the
        //    builder's simplicity preference for the reminder module.
      },
      // SKIPPED — manual: needs a device, Firebase, and a notification-permission tap

      skip: true,
    );
  });

  group('Contract 6 — the two-step upload against real S3', () {
    testWidgets(
      'createUploadUrl -> PUT -> confirmDocumentUpload',
      (tester) async {
        expect(authState.isAdmin, isTrue, reason: 'sign in as an ADMIN first');
        final pdf = PdfService(gateway, http.Client());

        // A minimal but genuinely valid PDF, because `confirmDocumentUpload`
        // inspects the object's real content type and removes a non-PDF.
        final target = await pdf.createUploadUrl(
          title: 'Integration test document',
          category: DocumentCategory.dailyPoojan,
        );
        await pdf.uploadBytes(target.uploadUrl, minimalPdfBytes());
        final created = await pdf.confirmUpload(
          s3Key: target.s3Key,
          title: 'Integration test document',
          category: DocumentCategory.dailyPoojan,
        );
        expect(created.title, 'Integration test document');

        // The public read finds it, signed out or in (BR6.5).
        final url = await pdf.downloadUrl(created.id, signedIn: true);
        expect(url, startsWith('https://'));

        // Clean up after ourselves.
        expect(await pdf.delete(created.id), created.id);
      },
      // SKIPPED — manual: requires a signed-in ADMIN account and a live sandbox
      skip: true,
    );
  });
}
