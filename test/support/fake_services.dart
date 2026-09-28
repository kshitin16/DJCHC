/// Recording fakes for the five contract services plus the injected
/// browser-launch and PDF-picker functions (plan Step 2.3).
///
/// Widget tests inject these so that call ORDERING is assertable — permission
/// before register, confirm before delete, createUploadUrl -> PUT -> confirm.
///
/// Each service class is `implements`-ed rather than subclassed, so adding a
/// method to a real service makes these fail to compile instead of silently
/// falling through to the real Amplify path.
library;

import 'dart:typed_data';

import 'package:sarovar_jinalaya/models/document.dart';
import 'package:sarovar_jinalaya/models/donation.dart';
import 'package:sarovar_jinalaya/models/post.dart';
import 'package:sarovar_jinalaya/models/reminder.dart';
import 'package:sarovar_jinalaya/models/suggestion.dart';
import 'package:sarovar_jinalaya/screens/admin/admin_pdf_library_screen.dart';
import 'package:sarovar_jinalaya/services/donation_service.dart';
import 'package:sarovar_jinalaya/services/feed_service.dart';
import 'package:sarovar_jinalaya/services/pdf_service.dart';
import 'package:sarovar_jinalaya/services/reminder_service.dart';
import 'package:sarovar_jinalaya/services/suggestion_service.dart';

/// A shared, ordered log so a test can assert the sequence ACROSS fakes.
class CallLog {
  final List<String> entries = [];

  void record(String entry) => entries.add(entry);

  /// The recorded entries whose name matches [name].
  List<String> of(String name) =>
      entries.where((e) => e == name || e.startsWith('$name:')).toList();

  int countOf(String name) => of(name).length;

  bool get isEmpty => entries.isEmpty;

  @override
  String toString() => entries.toString();
}

class FakeFeedService implements FeedService {
  FakeFeedService({CallLog? log}) : log = log ?? CallLog();

  final CallLog log;

  List<Post> posts = const [];
  List<Post> adminPosts = const [];
  Post? post;
  Object? listFailure;
  Object? adminListFailure;
  Object? getFailure;
  Object? writeFailure;

  /// The `signedIn` flag the screen passed to `listPosts`.
  bool? lastListSignedIn;
  CreatePostInput? createdInput;
  UpdatePostInput? updatedInput;
  String? deletedId;

  @override
  Future<List<Post>> listPosts({required bool signedIn}) async {
    log.record('listPosts:signedIn=$signedIn');
    lastListSignedIn = signedIn;
    if (listFailure != null) throw listFailure!;
    return posts;
  }

  @override
  Future<List<Post>> listAllForAdmin() async {
    log.record('listAllForAdmin');
    if (adminListFailure != null) throw adminListFailure!;
    return adminPosts;
  }

  @override
  Future<Post?> getPost(String id) async {
    log.record('getPost:$id');
    if (getFailure != null) throw getFailure!;
    return post;
  }

  @override
  Future<Post> create(CreatePostInput input) async {
    log.record('createPost');
    createdInput = input;
    if (writeFailure != null) throw writeFailure!;
    return post ?? posts.first;
  }

  @override
  Future<Post> update(String id, UpdatePostInput input) async {
    log.record('updatePost:$id');
    updatedInput = input;
    if (writeFailure != null) throw writeFailure!;
    return post ?? posts.first;
  }

  @override
  Future<Post> delete(String id) async {
    log.record('deletePost:$id');
    deletedId = id;
    if (writeFailure != null) throw writeFailure!;
    return post ?? adminPosts.first;
  }
}

class FakeSuggestionService implements SuggestionService {
  FakeSuggestionService({CallLog? log}) : log = log ?? CallLog();

  final CallLog log;

  List<Suggestion> mine = const [];
  List<Suggestion> all = const [];
  Suggestion? submitted;
  Object? submitFailure;
  Object? myPastFailure;
  Object? allFailure;

  /// Every text that was submitted, in order.
  final List<String> submittedTexts = [];

  @override
  Future<Suggestion> submit(String text) async {
    log.record('submit');
    submittedTexts.add(text);
    if (submitFailure != null) throw submitFailure!;
    return submitted ??
        (throw StateError('FakeSuggestionService: no result set'));
  }

  @override
  Future<List<Suggestion>> myPast() async {
    log.record('myPast');
    if (myPastFailure != null) throw myPastFailure!;
    return mine;
  }

  @override
  Future<List<Suggestion>> allSuggestions() async {
    log.record('allSuggestions');
    if (allFailure != null) throw allFailure!;
    return all;
  }
}

class FakeDonationService implements DonationService {
  FakeDonationService({CallLog? log}) : log = log ?? CallLog();

  final CallLog log;

  List<Donation> donations = const [];
  DonationInitiation? initiation;
  Donation? cancelled;
  Object? initiateFailure;
  Object? listFailure;
  Object? cancelFailure;

  double? lastAmount;
  DonationType? lastType;
  DonationFrequency? lastFrequency;
  String? cancelledId;

  @override
  Future<DonationInitiation> initiate({
    required double amount,
    required DonationType donationType,
    DonationFrequency? frequency,
  }) async {
    log.record('initiate');
    lastAmount = amount;
    lastType = donationType;
    lastFrequency = frequency;
    if (initiateFailure != null) throw initiateFailure!;
    return initiation ??
        (throw StateError('FakeDonationService: no initiation set'));
  }

  @override
  Future<List<Donation>> myDonations() async {
    log.record('myDonations');
    if (listFailure != null) throw listFailure!;
    return donations;
  }

  @override
  Future<Donation> cancel(String id) async {
    log.record('cancelDonation:$id');
    cancelledId = id;
    if (cancelFailure != null) throw cancelFailure!;
    return cancelled ?? donations.first;
  }
}

class FakePdfService implements PdfService {
  FakePdfService({CallLog? log}) : log = log ?? CallLog();

  final CallLog log;

  List<Document> documents = const [];
  String downloadUrlValue = 'https://s3.example.test/doc.pdf?sig=abc';
  DocumentUploadTarget uploadTarget = const DocumentUploadTarget(
    uploadUrl: 'https://s3.example.test/put?sig=abc',
    s3Key: 'documents/new.pdf',
  );
  Document? confirmed;
  Object? listFailure;
  Object? downloadFailure;
  Object? createUploadFailure;
  Object? uploadFailure;
  Object? confirmFailure;
  Object? deleteFailure;

  DocumentCategory? lastListedCategory;
  bool? lastListSignedIn;
  String? lastDownloadedId;
  String? lastConfirmedTitle;
  DocumentCategory? lastConfirmedCategory;
  Uint8List? lastUploadedBytes;
  String? deletedId;

  @override
  Future<List<Document>> list({
    DocumentCategory? category,
    required bool signedIn,
  }) async {
    log.record('list:${category?.graphQlValue ?? 'all'}');
    lastListedCategory = category;
    lastListSignedIn = signedIn;
    if (listFailure != null) throw listFailure!;
    return documents;
  }

  @override
  Future<String> downloadUrl(String id, {required bool signedIn}) async {
    log.record('downloadUrl:$id');
    lastDownloadedId = id;
    if (downloadFailure != null) throw downloadFailure!;
    return downloadUrlValue;
  }

  @override
  Future<DocumentUploadTarget> createUploadUrl({
    required String title,
    required DocumentCategory category,
  }) async {
    log.record('createUploadUrl');
    if (createUploadFailure != null) throw createUploadFailure!;
    return uploadTarget;
  }

  @override
  Future<void> uploadBytes(String uploadUrl, Uint8List bytes) async {
    log.record('uploadBytes');
    lastUploadedBytes = bytes;
    if (uploadFailure != null) throw uploadFailure!;
  }

  @override
  Future<Document> confirmUpload({
    required String s3Key,
    required String title,
    required DocumentCategory category,
  }) async {
    log.record('confirmUpload');
    lastConfirmedTitle = title;
    lastConfirmedCategory = category;
    if (confirmFailure != null) throw confirmFailure!;
    return confirmed ??
        (throw StateError('FakePdfService: no confirmed document set'));
  }

  @override
  Future<String> delete(String id) async {
    log.record('deleteDocument:$id');
    deletedId = id;
    if (deleteFailure != null) throw deleteFailure!;
    return id;
  }
}

class FakeReminderService implements ReminderService {
  FakeReminderService({CallLog? log}) : log = log ?? CallLog();

  final CallLog log;

  String? identityId = 'ap-south-1:guest-identity-1';
  bool permissionGranted = true;
  bool registrationSucceeds = true;
  List<Reminder> reminders = const [];
  Reminder? snoozed;
  Reminder? cancelledReminder;
  bool remindersEnabledValue = true;

  Object? myRemindersFailure;
  Object? snoozeFailure;
  Object? cancelFailure;
  Object? setEnabledFailure;

  String? snoozedId;
  String? cancelledId;
  bool? lastSetEnabled;

  @override
  Future<String?> resolveIdentity() async {
    log.record('resolveIdentity');
    return identityId;
  }

  @override
  Future<PushRegistration> requestPermissionAndToken() async {
    log.record('requestPermissionAndToken');
    if (!permissionGranted) {
      return const PushRegistration(
        permissionGranted: false,
        registered: false,
      );
    }
    return PushRegistration(
      permissionGranted: true,
      registered: registrationSucceeds,
      platform: DevicePlatform.android,
    );
  }

  @override
  Stream<String> get onTokenRefresh => const Stream<String>.empty();

  @override
  DevicePlatform? get platform => DevicePlatform.android;

  @override
  Future<DeviceToken> register({
    required String pushToken,
    required DevicePlatform platform,
  }) async {
    log.record('register');
    return _token();
  }

  @override
  Future<List<Reminder>> myReminders() async {
    log.record('myReminders');
    if (myRemindersFailure != null) throw myRemindersFailure!;
    return reminders;
  }

  @override
  Future<DeviceToken> setEnabled(bool enabled) async {
    log.record('setEnabled:$enabled');
    lastSetEnabled = enabled;
    if (setEnabledFailure != null) throw setEnabledFailure!;
    remindersEnabledValue = enabled;
    return _token();
  }

  @override
  Future<Reminder> snooze(String id) async {
    log.record('snooze:$id');
    snoozedId = id;
    if (snoozeFailure != null) throw snoozeFailure!;
    return snoozed ?? (throw StateError('FakeReminderService: no snoozed set'));
  }

  @override
  Future<Reminder> cancel(String id) async {
    log.record('cancelReminder:$id');
    cancelledId = id;
    if (cancelFailure != null) throw cancelFailure!;
    return cancelledReminder ??
        (throw StateError('FakeReminderService: no cancelled set'));
  }

  DeviceToken _token() => DeviceToken(
    id: 'tok-1',
    ownerIdentityId: identityId ?? 'unknown',
    pushToken: 'fcm-token-abc',
    platform: DevicePlatform.android,
    remindersEnabled: remindersEnabledValue,
    registeredAt: DateTime.utc(2026, 3, 1),
  );
}

/// Records the URLs a screen handed to the OS browser.
class FakeUrlLauncher {
  FakeUrlLauncher({this.succeeds = true, CallLog? log})
    : log = log ?? CallLog();

  final CallLog log;
  bool succeeds;
  final List<Uri> launched = [];

  Future<bool> call(Uri url) async {
    log.record('launchUrl');
    launched.add(url);
    return succeeds;
  }
}

/// Returns a scripted [PickedPdf] instead of opening the platform picker.
class FakePdfPicker {
  FakePdfPicker({this.result, CallLog? log}) : log = log ?? CallLog();

  final CallLog log;
  PickedPdf? result;
  int callCount = 0;

  Future<PickedPdf?> call() async {
    log.record('pickPdf');
    callCount++;
    return result;
  }
}

/// A valid picked PDF.
PickedPdf aPickedPdf({
  String fileName = 'daily-poojan.pdf',
  List<int> bytes = const [0x25, 0x50, 0x44, 0x46],
}) => PickedPdf(fileName: fileName, bytes: Uint8List.fromList(bytes));
