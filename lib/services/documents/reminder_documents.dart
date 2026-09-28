/// Contract 9 GraphQL documents, hand-written from `amplify/data/resource.ts`.
///
/// Every operation here is reachable by a GUEST identity (BR7.6) and is always
/// called with `AuthMode.identityPool`, signed in or not, so that the device's
/// reminders stay keyed to one Identity Pool id (FR7.8).
library;

/// Contract 9 `Reminder` selection set.
const String reminderFields = '''
    id
    postId
    ownerIdentityId
    status
    initialFireAt
    snoozeFireAt
    createdAt''';

/// Contract 9 `DeviceToken` selection set.
const String deviceTokenFields = '''
    id
    ownerIdentityId
    pushToken
    platform
    remindersEnabled
    registeredAt''';

/// `myReminders` — this device identity's reminders. Also triggers
/// reminder-unit's lazy backfill (BR7.1): an Event post this identity has not
/// seen yet gets a Reminder created automatically, on by default.
const String myRemindersDocument =
    '''
query MyReminders {
  myReminders {
$reminderFields
  }
}''';

/// `registerDeviceToken(pushToken, platform)` — idempotent per identity.
const String registerDeviceTokenDocument =
    '''
mutation RegisterDeviceToken(
  \$pushToken: String!
  \$platform: DevicePlatform!
) {
  registerDeviceToken(pushToken: \$pushToken, platform: \$platform) {
$deviceTokenFields
  }
}''';

/// `setRemindersEnabled(enabled)` — the app-wide toggle. Affects FUTURE
/// auto-creation only, never existing reminders (BR7.7).
const String setRemindersEnabledDocument =
    '''
mutation SetRemindersEnabled(\$enabled: Boolean!) {
  setRemindersEnabled(enabled: \$enabled) {
$deviceTokenFields
  }
}''';

/// `snoozeReminder(id)` — refused server-side once the 9:00 PM IST cutoff has
/// passed (BR7.3).
const String snoozeReminderDocument =
    '''
mutation SnoozeReminder(\$id: ID!) {
  snoozeReminder(id: \$id) {
$reminderFields
  }
}''';

/// `cancelReminder(id)` — one event only; never the app-wide toggle.
const String cancelReminderDocument =
    '''
mutation CancelReminder(\$id: ID!) {
  cancelReminder(id: \$id) {
$reminderFields
  }
}''';
