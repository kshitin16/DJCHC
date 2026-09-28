/// English and Hindi string tables (FR4.1).
///
/// A plain `Map<String, String>` per language rather than generated ARB
/// localizations: the app has two languages and one string table, and
/// `LocalizationController` already owns the lookup and the fallback.
///
/// **The Hindi copy below is machine-written and needs a native-speaker review
/// before release** (README, "Mobile App" > Localization).
library;

/// Supported language codes. [defaultLanguage] is what an unrecognised device
/// locale resolves to.
class AppLanguages {
  static const String english = 'en';
  static const String hindi = 'hi';
  static const String defaultLanguage = english;
  static const List<String> supported = [english, hindi];

  static bool isSupported(String code) => supported.contains(code);
}

class AppStrings {
  /// English — the complete table and the fallback for every missing key.
  static const Map<String, String> en = {
    'app.title': 'Sarovar Jinalaya',

    // Navigation
    'nav.feed': 'Feed',
    'nav.calendar': 'Calendar',
    'nav.suggest': 'Suggest',
    'nav.donate': 'Donate',
    'nav.library': 'Library',
    'nav.account': 'Account',
    'nav.admin': 'Admin',

    // Shared controls and states
    'common.retry': 'Try again',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.close': 'Close',
    'common.signIn': 'Sign In',
    'common.signOut': 'Sign Out',
    'common.loading': 'Loading',
    'common.required': 'This field is required',
    'error.generic': 'Something went wrong. Please try again.',

    // Feed (Screen 1)
    'feed.title': 'Feed',
    'feed.empty': 'Nothing here yet. New temple happenings will appear here.',

    'postType.EVENT': 'Event',
    'postType.VISITING_DIGNITARY': 'Visiting Dignitary',
    'postType.DONATION_CALL_OUT': 'Donation Call-out',
    'postType.UNKNOWN': 'Announcement',

    // Sign In (Screen 2)
    'signIn.title': 'Sign In',
    'signIn.intro':
        'Sign in with Google to submit suggestions and see your history.',
    'signIn.google': 'Continue with Google',
    'signIn.required': 'Please sign in to continue.',

    // Submit a Suggestion (Screen 3)
    'suggest.title': 'Submit a Suggestion',
    'suggest.hint': 'Share an idea for the temple',
    'suggest.submit': 'Submit',
    'suggest.success': 'Thank you — your suggestion has been submitted.',
    'suggest.emptyInput': 'Please write something before submitting.',

    // My Suggestions (Screen 4)
    'mySuggestions.title': 'My Suggestions',
    'mySuggestions.empty':
        'You have not submitted any suggestions yet. Tap Submit to add one.',

    // Account (Screen 5)
    'account.title': 'Account',
    'account.signedInAs': 'Signed in as',
    'account.language': 'Language',
    'account.reminders': 'Event reminders',
    'account.remindersHint':
        'Get a reminder at 9:00 AM IST the day before each event.',

    // Admin
    'admin.title': 'Admin',
    'admin.posts': 'Posts',
    'admin.suggestions': 'Suggestions',
    'admin.library': 'PDF Library',
    'admin.accessRequired': 'Admin access is required for this screen.',

    'adminPosts.title': 'Manage Posts',
    'adminPosts.new': 'New Post',
    'adminPosts.empty': 'No posts yet. Tap New Post to add the first one.',
    'adminPosts.edit': 'Edit',
    'adminPosts.deleteConfirm':
        'Delete this post? It will no longer appear in the feed.',
    'adminPosts.agedOut': 'Past',

    'postForm.titleNew': 'New Post',
    'postForm.titleEdit': 'Edit Post',
    'postForm.type': 'Type',
    'postForm.postTitle': 'Title',
    'postForm.description': 'Description',
    'postForm.dateTime': 'Date and time (IST)',
    'postForm.notFound': 'That post could not be found.',

    'adminSuggestions.title': 'All Suggestions',
    'adminSuggestions.empty': 'No suggestions have been submitted yet.',

    // Donate / My Donations (Screens 8-9, later release)
    'donate.title': 'Donate',
    'donate.amount': 'Amount (INR)',
    'donate.type': 'Donation type',
    'donate.ONE_TIME': 'One-time',
    'donate.RECURRING': 'Recurring',
    'donate.frequency': 'Frequency',
    'donate.MONTHLY': 'Monthly',
    'donate.QUARTERLY': 'Quarterly',
    'donate.YEARLY': 'Yearly',
    'donate.submit': 'Continue to payment',
    'donate.amountInvalid': 'Please enter an amount greater than zero.',
    'donate.frequencyRequired': 'Please choose a frequency.',
    'donate.launchFailed': 'Could not open the payment page. Please try again.',

    'myDonations.title': 'My Donations',
    'myDonations.empty': 'You have not made any donations yet.',
    'myDonations.cancel': 'Cancel recurring donation',
    'myDonations.cancelConfirm':
        'Cancel this recurring donation? No further payments will be taken.',

    'donationStatus.INITIATED': 'Started',
    'donationStatus.PENDING': 'Pending',
    'donationStatus.SUCCEEDED': 'Successful',
    'donationStatus.FAILED': 'Failed',
    'donationStatus.CANCELLED': 'Cancelled',
    'donationStatus.UNKNOWN': 'Unknown',

    // PDF Library (Screens 10-11, later release)
    'library.title': 'PDF Library',
    'library.all': 'All',
    'library.empty': 'No documents in this category yet.',
    'library.openFailed': 'Could not open that document. Please try again.',

    'category.DAILY_POOJAN': 'Daily Poojan',
    'category.VARIOUS_VIDHAANS': 'Various Vidhaans',
    'category.BHAKTAMAR': 'Bhaktamar',
    'category.UNKNOWN': 'Other',

    'adminLibrary.title': 'Manage PDF Library',
    'adminLibrary.upload': 'Upload a PDF',
    'adminLibrary.pick': 'Choose a PDF file',
    'adminLibrary.picked': 'Selected file',
    'adminLibrary.deleteConfirm':
        'Delete this document? It will disappear from the public library.',
    'adminLibrary.notPdf': 'Please choose a PDF file.',
    'adminLibrary.uploaded': 'The document has been added to the library.',

    // Calendar (Screen 12)
    'calendar.title': 'Calendar',
    'calendar.empty': 'No upcoming events yet.',
    'calendar.noEventsOnDay': 'No events on this day.',
    'calendar.snooze': 'Snooze',
    'calendar.cancelReminder': 'Cancel reminder',
    'calendar.cancelConfirm':
        'Cancel the reminder for this event? You will not be notified.',
    'calendar.permissionDenied':
        'Notifications are turned off for this app, so event reminders cannot '
        'be delivered. Turn them on in your device settings to get reminders.',
    'calendar.reminders': 'Event reminders',

    'reminderStatus.SCHEDULED': 'Reminder set',
    'reminderStatus.SNOOZED': 'Snoozed',
    'reminderStatus.FIRED': 'Reminded',
    'reminderStatus.CLEARED': 'Done',
    'reminderStatus.CANCELLED': 'No reminder',
    'reminderStatus.UNKNOWN': 'Reminder',
  };

  /// Hindi. Deliberately NOT exhaustive in places — any key missing here falls
  /// back to the English string above, which is a correct (if untranslated)
  /// rendering rather than a raw key.
  static const Map<String, String> hi = {
    'app.title': 'सरोवर जिनालय',

    'nav.feed': 'फ़ीड',
    'nav.calendar': 'कैलेंडर',
    'nav.suggest': 'सुझाव',
    'nav.donate': 'दान',
    'nav.library': 'पुस्तकालय',
    'nav.account': 'खाता',
    'nav.admin': 'प्रशासन',

    'common.retry': 'पुनः प्रयास करें',
    'common.cancel': 'रद्द करें',
    'common.confirm': 'पुष्टि करें',
    'common.delete': 'हटाएँ',
    'common.save': 'सहेजें',
    'common.close': 'बंद करें',
    'common.signIn': 'साइन इन करें',
    'common.signOut': 'साइन आउट करें',
    'common.loading': 'लोड हो रहा है',
    'common.required': 'यह जानकारी आवश्यक है',
    'error.generic': 'कुछ गड़बड़ हो गई। कृपया पुनः प्रयास करें।',

    'feed.title': 'फ़ीड',
    'feed.empty': 'अभी कुछ नहीं है। मंदिर की नई गतिविधियाँ यहाँ दिखेंगी।',

    'postType.EVENT': 'कार्यक्रम',
    'postType.VISITING_DIGNITARY': 'पधारे अतिथि',
    'postType.DONATION_CALL_OUT': 'दान आग्रह',
    'postType.UNKNOWN': 'सूचना',

    'signIn.title': 'साइन इन करें',
    'signIn.intro':
        'सुझाव भेजने और अपना इतिहास देखने के लिए Google से साइन इन करें।',
    'signIn.google': 'Google से जारी रखें',
    'signIn.required': 'जारी रखने के लिए कृपया साइन इन करें।',

    'suggest.title': 'सुझाव भेजें',
    'suggest.hint': 'मंदिर के लिए अपना विचार साझा करें',
    'suggest.submit': 'भेजें',
    'suggest.success': 'धन्यवाद — आपका सुझाव भेज दिया गया है।',
    'suggest.emptyInput': 'भेजने से पहले कुछ लिखें।',

    'mySuggestions.title': 'मेरे सुझाव',
    'mySuggestions.empty':
        'आपने अभी कोई सुझाव नहीं भेजा है। जोड़ने के लिए भेजें दबाएँ।',

    'account.title': 'खाता',
    'account.signedInAs': 'साइन इन किया हुआ',
    'account.language': 'भाषा',
    'account.reminders': 'कार्यक्रम अनुस्मारक',
    'account.remindersHint':
        'प्रत्येक कार्यक्रम से एक दिन पहले सुबह 9:00 बजे (IST) अनुस्मारक पाएँ।',

    'admin.title': 'प्रशासन',
    'admin.posts': 'पोस्ट',
    'admin.suggestions': 'सुझाव',
    'admin.library': 'पीडीएफ़ पुस्तकालय',
    'admin.accessRequired': 'इस स्क्रीन के लिए प्रशासक अनुमति आवश्यक है।',

    'adminPosts.title': 'पोस्ट प्रबंधन',
    'adminPosts.new': 'नई पोस्ट',
    'adminPosts.empty':
        'अभी कोई पोस्ट नहीं है। पहली जोड़ने के लिए नई पोस्ट दबाएँ।',
    'adminPosts.edit': 'संपादित करें',
    'adminPosts.deleteConfirm': 'यह पोस्ट हटाएँ? यह फ़ीड में दिखाई नहीं देगी।',
    'adminPosts.agedOut': 'बीत चुका',

    'postForm.titleNew': 'नई पोस्ट',
    'postForm.titleEdit': 'पोस्ट संपादित करें',
    'postForm.type': 'प्रकार',
    'postForm.postTitle': 'शीर्षक',
    'postForm.description': 'विवरण',
    'postForm.dateTime': 'दिनांक और समय (IST)',
    'postForm.notFound': 'वह पोस्ट नहीं मिली।',

    'adminSuggestions.title': 'सभी सुझाव',
    'adminSuggestions.empty': 'अभी कोई सुझाव नहीं भेजा गया है।',

    'donate.title': 'दान',
    'donate.amount': 'राशि (रुपये)',
    'donate.type': 'दान का प्रकार',
    'donate.ONE_TIME': 'एक बार',
    'donate.RECURRING': 'नियमित',
    'donate.frequency': 'अवधि',
    'donate.MONTHLY': 'मासिक',
    'donate.QUARTERLY': 'त्रैमासिक',
    'donate.YEARLY': 'वार्षिक',
    'donate.submit': 'भुगतान पर जाएँ',
    'donate.amountInvalid': 'कृपया शून्य से अधिक राशि दर्ज करें।',
    'donate.frequencyRequired': 'कृपया अवधि चुनें।',
    'donate.launchFailed': 'भुगतान पृष्ठ नहीं खुल सका। कृपया पुनः प्रयास करें।',

    'myDonations.title': 'मेरे दान',
    'myDonations.empty': 'आपने अभी कोई दान नहीं किया है।',
    'myDonations.cancel': 'नियमित दान रद्द करें',
    'myDonations.cancelConfirm':
        'यह नियमित दान रद्द करें? आगे कोई भुगतान नहीं लिया जाएगा।',

    'donationStatus.INITIATED': 'आरंभ',
    'donationStatus.PENDING': 'प्रतीक्षारत',
    'donationStatus.SUCCEEDED': 'सफल',
    'donationStatus.FAILED': 'असफल',
    'donationStatus.CANCELLED': 'रद्द',

    'library.title': 'पीडीएफ़ पुस्तकालय',
    'library.all': 'सभी',
    'library.empty': 'इस श्रेणी में अभी कोई दस्तावेज़ नहीं है।',
    'library.openFailed': 'वह दस्तावेज़ नहीं खुल सका। कृपया पुनः प्रयास करें।',

    'category.DAILY_POOJAN': 'नित्य पूजन',
    'category.VARIOUS_VIDHAANS': 'विविध विधान',
    'category.BHAKTAMAR': 'भक्तामर',

    'adminLibrary.title': 'पुस्तकालय प्रबंधन',
    'adminLibrary.upload': 'पीडीएफ़ अपलोड करें',
    'adminLibrary.pick': 'पीडीएफ़ फ़ाइल चुनें',
    'adminLibrary.deleteConfirm':
        'यह दस्तावेज़ हटाएँ? यह सार्वजनिक पुस्तकालय से हट जाएगा।',
    'adminLibrary.notPdf': 'कृपया पीडीएफ़ फ़ाइल चुनें।',
    'adminLibrary.uploaded': 'दस्तावेज़ पुस्तकालय में जोड़ दिया गया है।',

    'calendar.title': 'कैलेंडर',
    'calendar.empty': 'अभी कोई आगामी कार्यक्रम नहीं है।',
    'calendar.noEventsOnDay': 'इस दिन कोई कार्यक्रम नहीं है।',
    'calendar.snooze': 'बाद में याद दिलाएँ',
    'calendar.cancelReminder': 'अनुस्मारक रद्द करें',
    'calendar.cancelConfirm':
        'इस कार्यक्रम का अनुस्मारक रद्द करें? आपको सूचना नहीं मिलेगी।',
    'calendar.permissionDenied':
        'इस ऐप के लिए सूचनाएँ बंद हैं, इसलिए कार्यक्रम अनुस्मारक नहीं भेजे जा '
        'सकते। अनुस्मारक पाने के लिए डिवाइस सेटिंग्स में इन्हें चालू करें।',
    'calendar.reminders': 'कार्यक्रम अनुस्मारक',

    'reminderStatus.SCHEDULED': 'अनुस्मारक सेट',
    'reminderStatus.SNOOZED': 'टाला गया',
    'reminderStatus.FIRED': 'याद दिलाया',
    'reminderStatus.CLEARED': 'पूर्ण',
    'reminderStatus.CANCELLED': 'कोई अनुस्मारक नहीं',

    // Deliberately absent from Hindi, to exercise the English fallback:
    // 'library.all' variants, 'donationStatus.UNKNOWN', 'category.UNKNOWN',
    // 'reminderStatus.UNKNOWN', 'postForm.*' extras.
  };

  /// The table for [languageCode], or the English table for anything else.
  static Map<String, String> tableFor(String languageCode) =>
      languageCode == AppLanguages.hindi ? hi : en;
}
