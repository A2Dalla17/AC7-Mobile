/// AC7 — the signed-in user
///
/// Mirrors `public.users` exactly. Field names are the column names, snake_case
/// preserved, because a model that renames columns forces every reader to hold
/// two vocabularies and guess which one a given piece of code is speaking.
///
/// ── The auth_id distinction ────────────────────────────────────────────────
/// Supabase Auth has its own user with its own id, in `auth.users`. This app's
/// profile row is a separate record in `public.users`, joined by `auth_id`.
/// They are NOT the same id, and using one where the other is expected returns
/// an empty result rather than an error — a silent failure that looks like the
/// account does not exist.
library;

enum UserRole {
  rider,
  driver,
  admin;

  static UserRole fromString(String? value) => switch (value) {
        'driver' => UserRole.driver,
        'admin' => UserRole.admin,
        _ => UserRole.rider,
      };

  String get wire => name;
}

/// How the rider has agreed to be contacted.
///
/// UK PECR requires consent to be evidenced — who, which channel, and when —
/// which is why `messagingConsentAt` exists beside this rather than a bare
/// boolean. "They ticked a box at some point" is not a defence.
enum MessagingChannel {
  none,
  whatsapp,
  sms,
  both;

  static MessagingChannel fromString(String? value) => switch (value) {
        'whatsapp' => MessagingChannel.whatsapp,
        'sms' => MessagingChannel.sms,
        'both' => MessagingChannel.both,
        _ => MessagingChannel.none,
      };

  String get wire => name;

  String get label => switch (this) {
        MessagingChannel.none => 'Not set — app only',
        MessagingChannel.whatsapp => 'WhatsApp',
        MessagingChannel.sms => 'SMS',
        MessagingChannel.both => 'WhatsApp and SMS',
      };
}

class AppUser {
  const AppUser({
    required this.id,
    required this.authId,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.isActive,
    required this.isVerified,
    required this.messagingChannel,
    required this.phoneVerified,
    this.phoneNumber,
    this.profileImage,
    this.riderCode,
    this.onboardedAt,
    this.messagingConsentAt,
  });

  final String id;
  final String? authId;
  final String email;
  final String firstName;
  final String lastName;
  final UserRole role;
  final bool isActive;
  final bool isVerified;
  final String? phoneNumber;
  final String? profileImage;

  /// The rider's own code, shown on their home screen and in the control
  /// centre. Null until the trigger assigns one.
  final String? riderCode;

  /// Null until the rider has given a phone number and chosen a channel. The
  /// app uses this to decide whether to prompt, so it must not be faked.
  final DateTime? onboardedAt;

  final MessagingChannel messagingChannel;
  final DateTime? messagingConsentAt;
  final bool phoneVerified;

  String get fullName => '$firstName $lastName'.trim();

  String get initials {
    final f = firstName.isNotEmpty ? firstName[0] : '';
    final l = lastName.isNotEmpty ? lastName[0] : '';
    final joined = '$f$l'.trim();
    return joined.isEmpty ? '?' : joined.toUpperCase();
  }

  /// True while the rider still needs to finish setting up.
  bool get needsOnboarding => onboardedAt == null;

  factory AppUser.fromMap(Map<String, dynamic> map) => AppUser(
        id: map['id'] as String,
        authId: map['auth_id'] as String?,
        email: map['email'] as String,
        firstName: (map['first_name'] as String?) ?? '',
        lastName: (map['last_name'] as String?) ?? '',
        role: UserRole.fromString(map['role'] as String?),
        /* Defaulting these to true would mean a suspended account reads as
           active whenever the column is null. Deny by default. */
        isActive: (map['is_active'] as bool?) ?? false,
        isVerified: (map['is_verified'] as bool?) ?? false,
        phoneNumber: map['phone_number'] as String?,
        profileImage: map['profile_image'] as String?,
        riderCode: map['rider_code'] as String?,
        onboardedAt: _date(map['onboarded_at']),
        messagingChannel: MessagingChannel.fromString(map['messaging_channel'] as String?),
        messagingConsentAt: _date(map['messaging_consent_at']),
        phoneVerified: (map['phone_verified'] as bool?) ?? false,
      );

  static DateTime? _date(Object? value) =>
      value is String ? DateTime.tryParse(value) : null;

  AppUser copyWith({
    String? phoneNumber,
    String? profileImage,
    String? riderCode,
    DateTime? onboardedAt,
    MessagingChannel? messagingChannel,
    DateTime? messagingConsentAt,
    bool? phoneVerified,
  }) =>
      AppUser(
        id: id,
        authId: authId,
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role,
        isActive: isActive,
        isVerified: isVerified,
        phoneNumber: phoneNumber ?? this.phoneNumber,
        profileImage: profileImage ?? this.profileImage,
        riderCode: riderCode ?? this.riderCode,
        onboardedAt: onboardedAt ?? this.onboardedAt,
        messagingChannel: messagingChannel ?? this.messagingChannel,
        messagingConsentAt: messagingConsentAt ?? this.messagingConsentAt,
        phoneVerified: phoneVerified ?? this.phoneVerified,
      );
}
