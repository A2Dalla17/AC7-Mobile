/// Galeyr — the driver record.
///
/// Mirrors `public.drivers`. Field names follow the columns, snake_case
/// preserved, because a model that renames columns forces every reader to hold
/// two vocabularies and guess which one a given line is speaking.
library;

/// Where an application has got to.
///
/// A driver is not on the road because they installed the app. The control
/// centre verifies a private hire licence, hire-and-reward insurance, an MOT
/// and right to work first, and until that is done the app must say so rather
/// than let someone go online and wait for jobs that will never arrive.
enum ApplicationStatus {
  draft,
  submitted,
  underReview,
  approved,
  rejected,
  suspended;

  static ApplicationStatus fromString(String? v) => switch (v) {
        'submitted' => ApplicationStatus.submitted,
        'under_review' => ApplicationStatus.underReview,
        'approved' => ApplicationStatus.approved,
        'rejected' => ApplicationStatus.rejected,
        'suspended' => ApplicationStatus.suspended,
        _ => ApplicationStatus.draft,
      };

  bool get canDrive => this == ApplicationStatus.approved;

  String get label => switch (this) {
        ApplicationStatus.draft => 'Application not finished',
        ApplicationStatus.submitted => 'Application received',
        ApplicationStatus.underReview => 'Documents being checked',
        ApplicationStatus.approved => 'Approved',
        ApplicationStatus.rejected => 'Application declined',
        ApplicationStatus.suspended => 'Account suspended',
      };

  String get detail => switch (this) {
        ApplicationStatus.draft =>
          'Send your licence, insurance and MOT to the control room to finish.',
        ApplicationStatus.submitted =>
          'We have your documents. Checks usually take two to three working days.',
        ApplicationStatus.underReview =>
          'Someone is verifying your documents now. We will call when it is done.',
        ApplicationStatus.approved => '',
        ApplicationStatus.rejected =>
          'Ring the control room — they can tell you what was missing.',
        ApplicationStatus.suspended =>
          'Ring the control room. You cannot accept jobs until this is lifted.',
      };
}

class Driver {
  const Driver({
    required this.id,
    required this.userId,
    required this.driverCode,
    required this.isOnline,
    required this.isAvailable,
    required this.applicationStatus,
    required this.acceptsDirectRequests,
    this.rating,
    this.totalRides,
    this.vehicleMake,
    this.vehicleModel,
    this.vehiclePlate,
    this.vehicleColor,
    this.vehicleSeats,
  });

  final String id;
  final String userId;

  /// Shown to riders before they get into the car, and how the control room
  /// identifies a driver on the phone.
  final String driverCode;

  final bool isOnline;
  final bool isAvailable;
  final ApplicationStatus applicationStatus;
  final bool acceptsDirectRequests;

  final double? rating;
  final int? totalRides;

  final String? vehicleMake;
  final String? vehicleModel;
  final String? vehiclePlate;
  final String? vehicleColor;
  final int? vehicleSeats;

  String get vehicleDescription {
    final parts = [vehicleMake, vehicleModel].where((p) => p != null && p.isNotEmpty);
    final name = parts.join(' ');
    if (name.isEmpty) return 'Vehicle not set';
    return vehicleColor == null || vehicleColor!.isEmpty ? name : '$name · $vehicleColor';
  }

  factory Driver.fromMap(Map<String, dynamic> m) => Driver(
        id: m['id'] as String,
        userId: m['user_id'] as String,
        driverCode: (m['driver_code'] as String?) ?? '',
        /* Both default to false rather than true. A null here means we do not
           know, and assuming a driver is online when we do not know puts them
           in the dispatch pool for jobs they cannot see. */
        isOnline: (m['is_online'] as bool?) ?? false,
        isAvailable: (m['is_available'] as bool?) ?? false,
        applicationStatus: ApplicationStatus.fromString(m['application_status'] as String?),
        acceptsDirectRequests: (m['accepts_direct_requests'] as bool?) ?? false,
        rating: (m['rating'] as num?)?.toDouble(),
        totalRides: m['total_rides'] as int?,
        vehicleMake: m['vehicle_make'] as String?,
        vehicleModel: m['vehicle_model'] as String?,
        vehiclePlate: m['vehicle_plate'] as String?,
        vehicleColor: m['vehicle_color'] as String?,
        vehicleSeats: m['vehicle_seats'] as int?,
      );

  Driver copyWith({bool? isOnline, bool? isAvailable}) => Driver(
        id: id,
        userId: userId,
        driverCode: driverCode,
        isOnline: isOnline ?? this.isOnline,
        isAvailable: isAvailable ?? this.isAvailable,
        applicationStatus: applicationStatus,
        acceptsDirectRequests: acceptsDirectRequests,
        rating: rating,
        totalRides: totalRides,
        vehicleMake: vehicleMake,
        vehicleModel: vehicleModel,
        vehiclePlate: vehiclePlate,
        vehicleColor: vehicleColor,
        vehicleSeats: vehicleSeats,
      );
}
