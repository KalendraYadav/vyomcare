import { PrismaClient, UserRole, FacilityType, FacilityStatus, WasteUnit, ComplianceStage, VehicleStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BioTrack database...');

  // ─── Waste Categories ────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.wasteCategory.upsert({
      where: { code: 'SHARPS' },
      update: {},
      create: { code: 'SHARPS', name: 'Sharps', description: 'Needles, syringes, scalpels, blades', colorCode: '#DC2626', isActive: true },
    }),
    prisma.wasteCategory.upsert({
      where: { code: 'INFECTIOUS' },
      update: {},
      create: { code: 'INFECTIOUS', name: 'Infectious', description: 'Cultures, pathological waste, blood-soaked materials', colorCode: '#D97706', isActive: true },
    }),
    prisma.wasteCategory.upsert({
      where: { code: 'PATHOLOGICAL' },
      update: {},
      create: { code: 'PATHOLOGICAL', name: 'Pathological', description: 'Human or animal tissue, organs, body parts', colorCode: '#7C3AED', isActive: true },
    }),
    prisma.wasteCategory.upsert({
      where: { code: 'GENERAL_BIO' },
      update: {},
      create: { code: 'GENERAL_BIO', name: 'General Biomedical', description: 'Non-hazardous biomedical waste', colorCode: '#2563EB', isActive: true },
    }),
  ]);

  const [sharps, infectious, pathological, generalBio] = categories;
  console.log('✅ Waste categories seeded');

  // ─── Compliance Rules ─────────────────────────────────────────────
  for (const cat of categories) {
    const rules = [
      { stage: ComplianceStage.COLLECTION, hours: 24 },
      { stage: ComplianceStage.TRANSPORT, hours: 12 },
      { stage: ComplianceStage.TREATMENT, hours: 48 },
    ];
    for (const rule of rules) {
      await prisma.complianceRule.upsert({
        where: { wasteCategoryId_stage: { wasteCategoryId: cat.id, stage: rule.stage } },
        update: {},
        create: { wasteCategoryId: cat.id, stage: rule.stage, maxDurationHours: rule.hours },
      });
    }
  }
  console.log('✅ Compliance rules seeded');

  // ─── Demo Facilities ──────────────────────────────────────────────
  const hospital = await prisma.facility.upsert({
    where: { registrationNumber: 'HOSP-MUM-001' },
    update: {},
    create: {
      name: 'City General Hospital',
      type: FacilityType.HOSPITAL,
      registrationNumber: 'HOSP-MUM-001',
      address: '14 Medical Park Road, Mumbai, Maharashtra 400001',
      latitude: 19.076,
      longitude: 72.8777,
      geofenceRadiusM: 500,
      // MySQL-compatible: Json field stores a JSON array (Prisma handles serialization)
      authorizedCategoryIds: [],
      status: FacilityStatus.APPROVED,
    },
  });

  const treatmentFacility = await prisma.facility.upsert({
    where: { registrationNumber: 'CBWTF-MUM-002' },
    update: {},
    create: {
      name: 'GreenDispose CBWTF',
      type: FacilityType.TREATMENT_FACILITY,
      registrationNumber: 'CBWTF-MUM-002',
      address: '7 Industrial Zone, Thane, Maharashtra 400601',
      latitude: 19.2183,
      longitude: 72.9781,
      geofenceRadiusM: 300,
      // MySQL-compatible: Json field — Prisma serializes this JS array to JSON
      authorizedCategoryIds: [sharps.id, infectious.id, pathological.id, generalBio.id],
      status: FacilityStatus.APPROVED,
    },
  });
  console.log('✅ Facilities seeded');

  // ─── Demo Users (one per role) ────────────────────────────────────
  const password = await bcrypt.hash('BioTrack@2026', 10);

  const userDefs = [
    { name: 'Aisha Sharma', email: 'admin@citygeneral.in', role: UserRole.HOSPITAL_ADMIN, facilityId: hospital.id },
    { name: 'Ravi Kumar', email: 'staff@citygeneral.in', role: UserRole.HOSPITAL_STAFF, facilityId: hospital.id },
    { name: 'Priya Nair', email: 'collection@biotrack.in', role: UserRole.COLLECTION_STAFF, facilityId: null },
    { name: 'Deepak Singh', email: 'transport@biotrack.in', role: UserRole.TRANSPORT_PERSONNEL, facilityId: null },
    { name: 'Meera Joshi', email: 'facility@greendispose.in', role: UserRole.TREATMENT_FACILITY_STAFF, facilityId: treatmentFacility.id },
    { name: 'IAS Rajiv Mehta', email: 'gov@mpcb.gov.in', role: UserRole.GOVERNMENT_AUTHORITY, facilityId: null },
    { name: 'Super Admin', email: 'admin@biotrack.in', role: UserRole.SUPER_ADMIN, facilityId: null },
  ];

  for (const u of userDefs) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        emailVerified: true,
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash: password,
        role: u.role,
        facilityId: u.facilityId,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }
  console.log('✅ Demo users seeded (password: BioTrack@2026)');

  // ─── Demo Vehicles ────────────────────────────────────────────────
  await prisma.vehicle.upsert({
    where: { registrationNumber: 'MH-04-AB-1234' },
    update: {},
    create: {
      registrationNumber: 'MH-04-AB-1234',
      type: 'Closed Van',
      capacity: 500,
      status: VehicleStatus.ACTIVE,
    },
  });
  await prisma.vehicle.upsert({
    where: { registrationNumber: 'MH-04-CD-5678' },
    update: {},
    create: {
      registrationNumber: 'MH-04-CD-5678',
      type: 'Refrigerated Van',
      capacity: 300,
      status: VehicleStatus.ACTIVE,
    },
  });
  console.log('✅ Vehicles seeded');

  console.log('\n🎉 Seed complete! Login credentials:');
  for (const u of userDefs) {
    console.log(`  ${u.role.padEnd(28)} | ${u.email}`);
  }
  console.log('  Password for all: BioTrack@2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
