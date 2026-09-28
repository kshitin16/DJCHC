/// Application entry point.
///
/// **Startup order is performance-design.md's, and the split matters** for
/// NFR-PERF.1's 3-second cold-start budget:
///
/// BLOCKING (before the first frame):
///   - `Amplify.configure` — plugin registration and config parsing, no network.
///   - one `fetchAuthSession` into `AuthState` — served from Amplify's local,
///     platform-secure store, so it resolves on a microtask rather than after I/O.
///
/// ASYNC (after the first frame, fire-and-forget):
///   - Firebase init + the two Crashlytics error handlers.
///   - the stored language override.
///   - the Cognito guest identity (`DeviceIdentityState`).
///
/// The OS notification prompt is raised only on the first Calendar visit — never
/// here.
///
/// **Crashlytics wiring is explicit and NOT automatic** (security-design.md):
/// the Flutter plugin captures native crashes on its own, but Dart/Flutter-level
/// and async errors — the majority of a Flutter UI app's crashes — are captured
/// only because [_installCrashHandlers] assigns `FlutterError.onError` and
/// `PlatformDispatcher.instance.onError` below. Removing either silently defeats
/// NFR-CRASH.1 while still looking configured.
///
/// Personal data: no custom Crashlytics keys or user identifiers are ever set, so
/// no email, suggestion text, donation amount or push token can reach a crash
/// report (project.md Mandated; security-design.md "Payload scoping").
library;

import 'package:file_picker/file_picker.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart' as url_launcher;

import 'amplify_outputs.dart';
import 'app.dart';
import 'screens/admin/admin_pdf_library_screen.dart';
import 'services/amplify_gateway.dart';
import 'services/app_bootstrap.dart';
import 'services/auth_service.dart';
import 'services/donation_service.dart';
import 'services/feed_service.dart';
import 'services/pdf_service.dart';
import 'services/push_gateway.dart';
import 'services/reminder_service.dart';
import 'services/shared_preferences_store.dart';
import 'services/suggestion_service.dart';
import 'state/auth_state.dart';
import 'state/device_identity_state.dart';
import 'state/localization_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final gateway = AmplifyGateway();
  final bootstrap = AppBootstrap(
    configureAmplifyFn: gateway.configure,
    initFirebaseFn: _initFirebase,
  );

  // --- Blocking path ------------------------------------------------------
  await bootstrap.configureAmplify(amplifyConfig);

  final preferences = SharedPreferencesStore();
  final strings = LocalizationController(
    preferences,
    deviceLanguageCode: PlatformDispatcher.instance.locale.languageCode,
  );
  final authState = AuthState(AuthService(gateway));
  await authState.refresh();

  final httpClient = http.Client();
  final push = FirebasePushGateway();
  final reminderService = ReminderService(gateway, gateway, push);
  final deviceIdentity = DeviceIdentityState(reminderService);

  final dependencies = AppDependencies(
    authState: authState,
    strings: strings,
    deviceIdentity: deviceIdentity,
    feedService: FeedService(gateway),
    suggestionService: SuggestionService(gateway),
    donationService: DonationService(gateway),
    pdfService: PdfService(gateway, httpClient),
    reminderService: reminderService,
    launchUrl: _launchExternally,
    pickPdf: _pickPdf,
  );

  final initialPostId = await push.initialPostId();

  runApp(
    SarovarJinalayaApp(
      dependencies: dependencies,
      initialPostId: initialPostId,
    ),
  );

  // --- Async path: nothing below here blocks the first frame ---------------
  await _afterFirstFrame(
    bootstrap: bootstrap,
    strings: strings,
    deviceIdentity: deviceIdentity,
  );
}

Future<void> _afterFirstFrame({
  required AppBootstrap bootstrap,
  required LocalizationController strings,
  required DeviceIdentityState deviceIdentity,
}) async {
  final firebase = await bootstrap.initFirebase();
  if (firebase == FirebaseAvailability.available) {
    await _installCrashHandlers();
  }
  // Both are independent of the first frame and of each other.
  await strings.loadOverride();
  await deviceIdentity.ensureResolved();
}

Future<bool> _initFirebase() async {
  // Throws when google-services.json / GoogleService-Info.plist is absent;
  // `AppBootstrap.initFirebase` catches that and reports it as unavailable.
  await Firebase.initializeApp();
  return true;
}

/// The two handlers Crashlytics does NOT install for you.
Future<void> _installCrashHandlers() async {
  final crashlytics = FirebaseCrashlytics.instance;
  // Off in debug so local runs do not fill the Crashlytics console.
  await crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);

  // 1. Uncaught errors inside the Flutter framework / widget tree.
  FlutterError.onError = crashlytics.recordFlutterFatalError;

  // 2. Uncaught errors in async callbacks OUTSIDE the Flutter framework.
  PlatformDispatcher.instance.onError = (error, stack) {
    crashlytics.recordError(error, stack, fatal: true);
    return true;
  };
}

/// Opens a pre-signed PDF URL or an aggregator checkout page in the device's own
/// browser. The app never renders either itself.
Future<bool> _launchExternally(Uri url) => url_launcher.launchUrl(
  url,
  mode: url_launcher.LaunchMode.externalApplication,
);

/// The admin's PDF picker (Screen 11).
///
/// `file_picker` 13 reads the bytes lazily, so the whole file is pulled into
/// memory here — deliberate, because Contract 6's pre-signed PUT needs the
/// complete body and BR6.2 sets no size limit.
Future<PickedPdf?> _pickPdf() async {
  final file = await FilePicker.pickFile(
    type: FileType.custom,
    allowedExtensions: const ['pdf'],
  );
  if (file == null) return null;
  final bytes = await file.readAsBytes();
  return PickedPdf(fileName: file.name, bytes: bytes);
}
