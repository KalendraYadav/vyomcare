enum UserRole {
  HOSPITAL_ADMIN,
  HOSPITAL_STAFF,
  COLLECTION_STAFF,
  TRANSPORT_PERSONNEL,
  TREATMENT_FACILITY_STAFF,
  GOVERNMENT_AUTHORITY,
  SUPER_ADMIN,
}

enum WasteBatchStatus {
  REGISTERED,
  QR_ASSIGNED,
  COLLECTED,
  IN_TRANSIT,
  RECEIVED,
  TREATED,
  VERIFIED_CLOSED,
  VIOLATION,
}

enum WasteUnit {
  KG,
  COUNT,
}

enum CustodyEventType {
  REGISTERED,
  QR_ASSIGNED,
  COLLECTION_ACCEPTED,
  TRANSPORT_STARTED,
  TRANSPORT_UPDATED,
  ARRIVAL_VERIFIED,
  TREATMENT_CONFIRMED,
  VERIFIED_CLOSED,
}

enum AlertType {
  DISPOSAL_DELAY,
  UNAUTHORIZED_LOCATION,
  ROUTE_DEVIATION,
  MISSING_SCAN,
}

enum AlertSeverity {
  LOW,
  MEDIUM,
  HIGH,
}

enum AlertStatus {
  OPEN,
  INVESTIGATING,
  RESOLVED,
}

class Facility {
  final String id;
  final String name;
  final String type;
  final String registrationNumber;
  final String address;
  final double? latitude;
  final double? longitude;
  final double? geofenceRadiusM;
  final List<String> authorizedCategoryIds;
  final String status;

  Facility({
    required this.id,
    required this.name,
    required this.type,
    required this.registrationNumber,
    required this.address,
    this.latitude,
    this.longitude,
    this.geofenceRadiusM,
    this.authorizedCategoryIds = const [],
    required this.status,
  });

  factory Facility.fromJson(Map<String, dynamic> json) {
    return Facility(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      type: json['type'] ?? '',
      registrationNumber: json['registrationNumber'] ?? '',
      address: json['address'] ?? '',
      latitude: json['latitude'] != null ? (json['latitude'] as num).toDouble() : null,
      longitude: json['longitude'] != null ? (json['longitude'] as num).toDouble() : null,
      geofenceRadiusM: json['geofenceRadiusM'] != null ? (json['geofenceRadiusM'] as num).toDouble() : null,
      authorizedCategoryIds: (json['authorizedCategoryIds'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      status: json['status'] ?? 'PENDING',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type,
    'registrationNumber': registrationNumber,
    'address': address,
    'latitude': latitude,
    'longitude': longitude,
    'geofenceRadiusM': geofenceRadiusM,
    'authorizedCategoryIds': authorizedCategoryIds,
    'status': status,
  };
}

class AuthUser {
  final String id;
  final String name;
  final String email;
  final UserRole role;
  final String? facilityId;
  final Facility? facility;

  AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.facilityId,
    this.facility,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    UserRole roleEnum = UserRole.HOSPITAL_STAFF;
    final roleStr = json['role'] as String?;
    if (roleStr != null) {
      try {
        roleEnum = UserRole.values.firstWhere((e) => e.name == roleStr);
      } catch (_) {}
    }

    return AuthUser(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: roleEnum,
      facilityId: json['facilityId'],
      facility: json['facility'] != null ? Facility.fromJson(json['facility']) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'role': role.name,
    'facilityId': facilityId,
    'facility': facility?.toJson(),
  };
}

class WasteCategory {
  final String id;
  final String code;
  final String name;
  final String? description;
  final String colorCode;
  final bool isActive;

  WasteCategory({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    required this.colorCode,
    this.isActive = true,
  });

  factory WasteCategory.fromJson(Map<String, dynamic> json) {
    return WasteCategory(
      id: json['id'] ?? '',
      code: json['code'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      colorCode: json['colorCode'] ?? '#EAB308',
      isActive: json['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'name': name,
    'description': description,
    'colorCode': colorCode,
    'isActive': isActive,
  };
}

class QrCode {
  final String id;
  final String wasteBatchId;
  final String codeValue;
  final String generatedAt;

  QrCode({
    required this.id,
    required this.wasteBatchId,
    required this.codeValue,
    required this.generatedAt,
  });

  factory QrCode.fromJson(Map<String, dynamic> json) {
    return QrCode(
      id: json['id'] ?? '',
      wasteBatchId: json['wasteBatchId'] ?? '',
      codeValue: json['codeValue'] ?? '',
      generatedAt: json['generatedAt'] ?? '',
    );
  }
}

class CustodyEvent {
  final String id;
  final String wasteBatchId;
  final String eventType;
  final String? fromUserId;
  final String? toUserId;
  final double? latitude;
  final double? longitude;
  final String occurredAt;
  final String? notes;
  final String? photoUrl;
  final Map<String, dynamic>? fromUser;
  final Map<String, dynamic>? toUser;

  CustodyEvent({
    required this.id,
    required this.wasteBatchId,
    required this.eventType,
    this.fromUserId,
    this.toUserId,
    this.latitude,
    this.longitude,
    required this.occurredAt,
    this.notes,
    this.photoUrl,
    this.fromUser,
    this.toUser,
  });

  factory CustodyEvent.fromJson(Map<String, dynamic> json) {
    return CustodyEvent(
      id: json['id'] ?? '',
      wasteBatchId: json['wasteBatchId'] ?? '',
      eventType: json['eventType'] ?? '',
      fromUserId: json['fromUserId'],
      toUserId: json['toUserId'],
      latitude: json['latitude'] != null ? (json['latitude'] as num).toDouble() : null,
      longitude: json['longitude'] != null ? (json['longitude'] as num).toDouble() : null,
      occurredAt: json['occurredAt'] ?? '',
      notes: json['notes'],
      photoUrl: json['photoUrl'],
      fromUser: json['fromUser'],
      toUser: json['toUser'],
    );
  }
}

class WasteBatch {
  final String id;
  final String wasteId;
  final String categoryId;
  final String hospitalId;
  final String department;
  final double quantity;
  final String unit;
  final String status;
  final String? photoUrl;
  final String createdAt;
  final WasteCategory? category;
  final Facility? hospital;
  final QrCode? qrCode;
  final List<CustodyEvent>? custodyEvents;
  final List<Alert>? alerts;
  final Map<String, dynamic>? generatedByUser;

  WasteBatch({
    required this.id,
    required this.wasteId,
    required this.categoryId,
    required this.hospitalId,
    required this.department,
    required this.quantity,
    required this.unit,
    required this.status,
    this.photoUrl,
    required this.createdAt,
    this.category,
    this.hospital,
    this.qrCode,
    this.custodyEvents,
    this.alerts,
    this.generatedByUser,
  });

  factory WasteBatch.fromJson(Map<String, dynamic> json) {
    return WasteBatch(
      id: json['id'] ?? '',
      wasteId: json['wasteId'] ?? '',
      categoryId: json['categoryId'] ?? '',
      hospitalId: json['hospitalId'] ?? '',
      department: json['department'] ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0.0,
      unit: json['unit'] ?? 'KG',
      status: json['status'] ?? 'REGISTERED',
      photoUrl: json['photoUrl'],
      createdAt: json['createdAt'] ?? '',
      category: json['category'] != null ? WasteCategory.fromJson(json['category']) : null,
      hospital: json['hospital'] != null ? Facility.fromJson(json['hospital']) : null,
      qrCode: json['qrCode'] != null ? QrCode.fromJson(json['qrCode']) : null,
      custodyEvents: (json['custodyEvents'] as List<dynamic>?)
          ?.map((e) => CustodyEvent.fromJson(e))
          .toList(),
      alerts: (json['alerts'] as List<dynamic>?)
          ?.map((e) => Alert.fromJson(e))
          .toList(),
      generatedByUser: json['generatedByUser'],
    );
  }
}

class Vehicle {
  final String id;
  final String registrationNumber;
  final String type;
  final double? capacity;
  final String status;

  Vehicle({
    required this.id,
    required this.registrationNumber,
    required this.type,
    this.capacity,
    required this.status,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['id'] ?? '',
      registrationNumber: json['registrationNumber'] ?? '',
      type: json['type'] ?? '',
      capacity: (json['capacity'] as num?)?.toDouble(),
      status: json['status'] ?? 'ACTIVE',
    );
  }
}

class GpsPing {
  final String id;
  final String transportAssignmentId;
  final double latitude;
  final double longitude;
  final String recordedAt;

  GpsPing({
    required this.id,
    required this.transportAssignmentId,
    required this.latitude,
    required this.longitude,
    required this.recordedAt,
  });

  factory GpsPing.fromJson(Map<String, dynamic> json) {
    return GpsPing(
      id: json['id'] ?? '',
      transportAssignmentId: json['transportAssignmentId'] ?? '',
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      recordedAt: json['recordedAt'] ?? '',
    );
  }
}

class TransportAssignment {
  final String id;
  final String wasteBatchId;
  final String vehicleId;
  final String driverUserId;
  final String startTime;
  final String expectedFacilityId;
  final String? endTime;
  final String status;
  final WasteBatch? wasteBatch;
  final Vehicle? vehicle;
  final Facility? expectedFacility;
  final List<GpsPing>? gpsPings;

  TransportAssignment({
    required this.id,
    required this.wasteBatchId,
    required this.vehicleId,
    required this.driverUserId,
    required this.startTime,
    required this.expectedFacilityId,
    this.endTime,
    required this.status,
    this.wasteBatch,
    this.vehicle,
    this.expectedFacility,
    this.gpsPings,
  });

  factory TransportAssignment.fromJson(Map<String, dynamic> json) {
    return TransportAssignment(
      id: json['id'] ?? '',
      wasteBatchId: json['wasteBatchId'] ?? '',
      vehicleId: json['vehicleId'] ?? '',
      driverUserId: json['driverUserId'] ?? '',
      startTime: json['startTime'] ?? '',
      expectedFacilityId: json['expectedFacilityId'] ?? '',
      endTime: json['endTime'],
      status: json['status'] ?? 'IN_PROGRESS',
      wasteBatch: json['wasteBatch'] != null ? WasteBatch.fromJson(json['wasteBatch']) : null,
      vehicle: json['vehicle'] != null ? Vehicle.fromJson(json['vehicle']) : null,
      expectedFacility: json['expectedFacility'] != null ? Facility.fromJson(json['expectedFacility']) : null,
      gpsPings: (json['gpsPings'] as List<dynamic>?)
          ?.map((e) => GpsPing.fromJson(e))
          .toList(),
    );
  }
}

class Alert {
  final String id;
  final String? wasteBatchId;
  final String type;
  final String severity;
  final String status;
  final String createdAt;
  final String? resolvedAt;
  final String? notes;
  final WasteBatch? wasteBatch;

  Alert({
    required this.id,
    this.wasteBatchId,
    required this.type,
    required this.severity,
    required this.status,
    required this.createdAt,
    this.resolvedAt,
    this.notes,
    this.wasteBatch,
  });

  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      id: json['id'] ?? '',
      wasteBatchId: json['wasteBatchId'],
      type: json['type'] ?? '',
      severity: json['severity'] ?? 'LOW',
      status: json['status'] ?? 'OPEN',
      createdAt: json['createdAt'] ?? '',
      resolvedAt: json['resolvedAt'],
      notes: json['notes'],
      wasteBatch: json['wasteBatch'] != null ? WasteBatch.fromJson(json['wasteBatch']) : null,
    );
  }
}
