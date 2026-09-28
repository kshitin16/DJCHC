/// The root widget, the shell and the routing/gating rules (FR1.3, FR4.1).
///
/// The root notifiers (`AuthState`, `LocalizationController`,
/// `DeviceIdentityState`) are constructed ONCE by `main.dart` and handed to this
/// widget, which passes them down by constructor injection — no global singleton
/// and no Provider package (team.md Q10).
///
/// **Gating here is a UX convenience, never a security boundary** (NFR-AUTHZ.2).
/// Redirecting a signed-out user off a gated tab and hiding the Admin entry from
/// a non-admin are read-only checks against values `AuthState` already holds. The
/// enforcing layer is each backend Unit's own AppSync authorization rule: a bug
/// in this file can at most show or hide a UI element wrongly, because no backend
/// Unit trusts anything this file decides.
library;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'l10n/app_strings.dart';
import 'screens/account_screen.dart';
import 'screens/admin/admin_pdf_library_screen.dart';
import 'screens/admin/admin_post_list_screen.dart';
import 'screens/admin/admin_suggestions_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/donate_screen.dart';
import 'screens/feed_screen.dart';
import 'screens/my_donations_screen.dart';
import 'screens/my_suggestions_screen.dart';
import 'screens/pdf_library_screen.dart';
import 'screens/sign_in_screen.dart';
import 'screens/submit_suggestion_screen.dart';
import 'services/donation_service.dart';
import 'services/feed_service.dart';
import 'services/pdf_service.dart';
import 'services/reminder_service.dart';
import 'services/suggestion_service.dart';
import 'state/auth_state.dart';
import 'state/device_identity_state.dart';
import 'state/localization_controller.dart';
import 'utils/feature_flags.dart';
import 'widgets/bottom_nav_bar.dart';

/// Everything the shell needs, gathered once so `main.dart` and the widget tests
/// build the app the same way.
class AppDependencies {
  const AppDependencies({
    required this.authState,
    required this.strings,
    required this.deviceIdentity,
    required this.feedService,
    required this.suggestionService,
    required this.donationService,
    required this.pdfService,
    required this.reminderService,
    required this.launchUrl,
    required this.pickPdf,
    this.flags = FeatureFlags.current,
    this.now,
  });

  final AuthState authState;
  final LocalizationController strings;
  final DeviceIdentityState deviceIdentity;
  final FeedService feedService;
  final SuggestionService suggestionService;
  final DonationService donationService;
  final PdfService pdfService;
  final ReminderService reminderService;
  final UrlLauncher launchUrl;
  final PdfPicker pickPdf;
  final FeatureFlags flags;

  /// Injected clock for tests.
  final DateTime? now;
}

class SarovarJinalayaApp extends StatelessWidget {
  const SarovarJinalayaApp({
    required this.dependencies,
    this.initialPostId,
    super.key,
  });

  final AppDependencies dependencies;

  /// A post id from a notification tap that opened the app — routes to Calendar.
  final String? initialPostId;

  /// The temple's saffron/gold palette seed.
  static const Color seedColor = Color(0xFFB8560F);

  @override
  Widget build(BuildContext context) {
    // Rebuilding on a language change is what re-renders every screen's text.
    return ListenableBuilder(
      listenable: dependencies.strings,
      builder: (context, _) => MaterialApp(
        title: dependencies.strings.t('app.title'),
        debugShowCheckedModeBanner: false,
        locale: Locale(dependencies.strings.languageCode),
        supportedLocales: const [
          Locale(AppLanguages.english),
          Locale(AppLanguages.hindi),
        ],
        // The app's own strings (AppStrings.en/.hi) are entirely custom and need
        // no delegate. These three cover Flutter's built-in Material/Widgets/
        // Cupertino strings (e.g. default tooltips, date pickers) for `hi`.
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: seedColor),
          useMaterial3: true,
        ),
        home: AppShell(
          dependencies: dependencies,
          initialPostId: initialPostId,
        ),
      ),
    );
  }
}

/// The bottom-navigation shell.
class AppShell extends StatefulWidget {
  const AppShell({required this.dependencies, this.initialPostId, super.key});

  final AppDependencies dependencies;
  final String? initialPostId;

  static const Key adminEntryKey = ValueKey('shell.admin');
  static const Key adminPostsKey = ValueKey('shell.admin.posts');
  static const Key adminSuggestionsKey = ValueKey('shell.admin.suggestions');
  static const Key adminLibraryKey = ValueKey('shell.admin.library');
  static const Key myDonationsKey = ValueKey('shell.myDonations');
  static const Key mySuggestionsKey = ValueKey('shell.mySuggestions');

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  AppTab _tab = AppTab.feed;

  /// The tab a signed-out user was headed to, so they land there after signing in.
  AppTab? _pendingTab;

  AppDependencies get _deps => widget.dependencies;

  /// The tabs that require a signed-in session (FR1.3 step 2). Calendar is
  /// deliberately NOT here: its reminders use the device guest identity.
  static const Set<AppTab> _signedInTabs = {
    AppTab.suggest,
    AppTab.donate,
    AppTab.account,
  };

  @override
  void initState() {
    super.initState();
    if (widget.initialPostId != null) _tab = AppTab.calendar;
    _deps.authState.addListener(_onAuthChanged);
  }

  @override
  void dispose() {
    _deps.authState.removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    if (!mounted) return;
    // Signing out of a gated tab returns the user to Feed.
    if (!_deps.authState.isSignedIn && _signedInTabs.contains(_tab)) {
      setState(() => _tab = AppTab.feed);
      return;
    }
    setState(() {});
  }

  void _select(AppTab tab) {
    // UX gate only: the underlying operations are refused server-side anyway.
    if (_signedInTabs.contains(tab) && !_deps.authState.isSignedIn) {
      setState(() {
        _pendingTab = tab;
        _tab = AppTab.account; // the Sign In surface lives on the Account slot
      });
      return;
    }
    setState(() {
      _pendingTab = null;
      _tab = tab;
    });
  }

  void _onSignedIn() {
    final pending = _pendingTab;
    setState(() {
      _pendingTab = null;
      if (pending != null) _tab = pending;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tabs = AppTab.visibleUnder(_deps.flags);
    return Scaffold(
      body: _body(),
      bottomNavigationBar: BottomNavBar(
        tabs: tabs,
        currentTab: _tab,
        onSelected: _select,
        strings: _deps.strings,
      ),
      // The Admin entry exists only for an admin — and only as a shortcut; the
      // screens behind it are refused server-side for anyone else.
      floatingActionButton: _deps.authState.isAdmin && _tab != AppTab.calendar
          ? FloatingActionButton(
              key: AppShell.adminEntryKey,
              tooltip: _deps.strings.t('admin.title'),
              onPressed: _openAdminMenu,
              child: const Icon(Icons.admin_panel_settings_outlined),
            )
          : null,
    );
  }

  Widget _body() {
    final deps = _deps;
    if (!deps.authState.isSignedIn &&
        (_pendingTab != null || _tab == AppTab.account)) {
      return SignInScreen(
        authState: deps.authState,
        strings: deps.strings,
        showSignInRequiredNotice: _pendingTab != null,
        onSignedIn: _onSignedIn,
      );
    }
    return switch (_tab) {
      AppTab.feed => FeedScreen(
        feedService: deps.feedService,
        authState: deps.authState,
        strings: deps.strings,
        onSignInTap: () => _select(AppTab.account),
      ),
      AppTab.calendar => CalendarScreen(
        feedService: deps.feedService,
        reminderService: deps.reminderService,
        deviceIdentity: deps.deviceIdentity,
        authState: deps.authState,
        strings: deps.strings,
        now: deps.now,
        initialPostId: widget.initialPostId,
      ),
      AppTab.suggest => _SuggestTab(dependencies: deps),
      AppTab.donate => _DonateTab(dependencies: deps),
      AppTab.library => PdfLibraryScreen(
        pdfService: deps.pdfService,
        authState: deps.authState,
        strings: deps.strings,
        launchUrl: deps.launchUrl,
      ),
      AppTab.account => AccountScreen(
        authState: deps.authState,
        deviceIdentity: deps.deviceIdentity,
        strings: deps.strings,
        onSignedOut: () => setState(() => _tab = AppTab.feed),
      ),
    };
  }

  Future<void> _openAdminMenu() async {
    final deps = _deps;
    await showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              key: AppShell.adminPostsKey,
              leading: const Icon(Icons.post_add),
              title: Text(deps.strings.t('admin.posts')),
              onTap: () {
                Navigator.of(sheetContext).pop();
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => AdminPostListScreen(
                      feedService: deps.feedService,
                      strings: deps.strings,
                      now: deps.now,
                    ),
                  ),
                );
              },
            ),
            ListTile(
              key: AppShell.adminSuggestionsKey,
              leading: const Icon(Icons.inbox_outlined),
              title: Text(deps.strings.t('admin.suggestions')),
              onTap: () {
                Navigator.of(sheetContext).pop();
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => AdminSuggestionsScreen(
                      suggestionService: deps.suggestionService,
                      strings: deps.strings,
                    ),
                  ),
                );
              },
            ),
            // Flagged off with the rest of the PDF Library.
            if (deps.flags.pdfLibrary)
              ListTile(
                key: AppShell.adminLibraryKey,
                leading: const Icon(Icons.menu_book_outlined),
                title: Text(deps.strings.t('admin.library')),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AdminPdfLibraryScreen(
                        pdfService: deps.pdfService,
                        strings: deps.strings,
                        pickPdf: deps.pickPdf,
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

/// The Suggest tab: submit, with a shortcut to the user's own history.
class _SuggestTab extends StatelessWidget {
  const _SuggestTab({required this.dependencies});

  final AppDependencies dependencies;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      SubmitSuggestionScreen(
        suggestionService: dependencies.suggestionService,
        strings: dependencies.strings,
      ),
      Positioned(
        right: 16,
        bottom: 16,
        child: OutlinedButton.icon(
          key: AppShell.mySuggestionsKey,
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => MySuggestionsScreen(
                suggestionService: dependencies.suggestionService,
                strings: dependencies.strings,
              ),
            ),
          ),
          icon: const Icon(Icons.history),
          label: Text(dependencies.strings.t('mySuggestions.title')),
        ),
      ),
    ],
  );
}

/// The Donate tab: donate, with a shortcut to the user's donation history.
class _DonateTab extends StatelessWidget {
  const _DonateTab({required this.dependencies});

  final AppDependencies dependencies;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      DonateScreen(
        donationService: dependencies.donationService,
        strings: dependencies.strings,
        launchUrl: dependencies.launchUrl,
      ),
      Positioned(
        right: 16,
        bottom: 16,
        child: OutlinedButton.icon(
          key: AppShell.myDonationsKey,
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => MyDonationsScreen(
                donationService: dependencies.donationService,
                strings: dependencies.strings,
              ),
            ),
          ),
          icon: const Icon(Icons.history),
          label: Text(dependencies.strings.t('myDonations.title')),
        ),
      ),
    ],
  );
}
