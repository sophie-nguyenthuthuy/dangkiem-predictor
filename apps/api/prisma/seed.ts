// Seed script — real(istic) HN/HCM vehicle inspection centers, slots, demo users.
// Run: pnpm --filter @dangkiem/api db:seed
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// Real registered VN inspection centers (a representative subset).
// Codes follow the official format: <province>-<sequence>V.
const CENTERS = [
  // Hà Nội — province code 29
  {
    code: '29-01S',
    name: 'Trung tâm Đăng kiểm xe cơ giới 2901S',
    city: 'HN' as const,
    district: 'Thanh Trì',
    address: 'Km10 Quốc lộ 1A, Tựu Liệt, Thanh Trì, Hà Nội',
    latitude: 20.9354,
    longitude: 105.8413,
    phone: '02438615383',
    laneCount: 3,
    capacityPerHour: 14,
  },
  {
    code: '29-03V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 2903V',
    city: 'HN' as const,
    district: 'Thanh Xuân',
    address: 'Số 3 Lê Quang Đạo, Mễ Trì, Nam Từ Liêm, Hà Nội',
    latitude: 21.0142,
    longitude: 105.7710,
    phone: '02437877090',
    laneCount: 4,
    capacityPerHour: 16,
  },
  {
    code: '29-05V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 2905V',
    city: 'HN' as const,
    district: 'Hoàng Mai',
    address: '454 Kim Ngưu, Vĩnh Tuy, Hai Bà Trưng, Hà Nội',
    latitude: 21.0008,
    longitude: 105.8676,
    phone: '02436362266',
    laneCount: 3,
    capacityPerHour: 14,
  },
  {
    code: '29-06V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 2906V',
    city: 'HN' as const,
    district: 'Đông Anh',
    address: 'Thôn Mạnh Tân, Xã Thụy Lâm, Đông Anh, Hà Nội',
    latitude: 21.1769,
    longitude: 105.8806,
    phone: '02439655389',
    laneCount: 3,
    capacityPerHour: 12,
  },
  {
    code: '29-07V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 2907V',
    city: 'HN' as const,
    district: 'Hà Đông',
    address: 'Khu CN Cầu Bươu, Tân Triều, Thanh Trì, Hà Nội',
    latitude: 20.9594,
    longitude: 105.8108,
    phone: '02433549669',
    laneCount: 4,
    capacityPerHour: 16,
  },
  {
    code: '29-08D',
    name: 'Trung tâm Đăng kiểm xe cơ giới 2908D',
    city: 'HN' as const,
    district: 'Sóc Sơn',
    address: 'Km 28, Quốc lộ 3, Sóc Sơn, Hà Nội',
    latitude: 21.2467,
    longitude: 105.8439,
    phone: '02438843366',
    laneCount: 2,
    capacityPerHour: 10,
  },
  // TP. Hồ Chí Minh — province code 50
  {
    code: '50-01S',
    name: 'Trung tâm Đăng kiểm xe cơ giới 5001S',
    city: 'HCM' as const,
    district: 'Quận 7',
    address: '464 Nguyễn Văn Linh, Tân Thuận Tây, Quận 7, TP.HCM',
    latitude: 10.7411,
    longitude: 106.7245,
    phone: '02838725665',
    laneCount: 4,
    capacityPerHour: 18,
  },
  {
    code: '50-03V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 5003V',
    city: 'HCM' as const,
    district: 'Bình Tân',
    address: '359 Hồ Học Lãm, An Lạc, Bình Tân, TP.HCM',
    latitude: 10.7398,
    longitude: 106.6005,
    phone: '02837525007',
    laneCount: 3,
    capacityPerHour: 14,
  },
  {
    code: '50-04V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 5004V',
    city: 'HCM' as const,
    district: 'Thủ Đức',
    address: '63 Đường số 6, Hiệp Bình Phước, Thủ Đức, TP.HCM',
    latitude: 10.8478,
    longitude: 106.7195,
    phone: '02837269091',
    laneCount: 4,
    capacityPerHour: 16,
  },
  {
    code: '50-05V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 5005V',
    city: 'HCM' as const,
    district: 'Bình Chánh',
    address: 'Km 1900 Quốc lộ 1A, Tân Kiên, Bình Chánh, TP.HCM',
    latitude: 10.7264,
    longitude: 106.5912,
    phone: '02837560799',
    laneCount: 3,
    capacityPerHour: 14,
  },
  {
    code: '50-06V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 5006V',
    city: 'HCM' as const,
    district: 'Quận 12',
    address: '343/20 Tô Ký, Tân Chánh Hiệp, Quận 12, TP.HCM',
    latitude: 10.8669,
    longitude: 106.6293,
    phone: '02837179179',
    laneCount: 3,
    capacityPerHour: 14,
  },
  {
    code: '50-07V',
    name: 'Trung tâm Đăng kiểm xe cơ giới 5007V',
    city: 'HCM' as const,
    district: 'Củ Chi',
    address: 'Tỉnh lộ 8, Tân Thông Hội, Củ Chi, TP.HCM',
    latitude: 10.9817,
    longitude: 106.5128,
    phone: '02837960079',
    laneCount: 2,
    capacityPerHour: 10,
  },
];

async function main() {
  console.log('🌱 Seeding database…');

  // Centers
  const createdCenters = await Promise.all(
    CENTERS.map((c) =>
      prisma.center.upsert({
        where: { code: c.code },
        create: {
          ...c,
          supportedVehicleTypes:
            c.laneCount >= 3 ? ['car', 'truck', 'bus', 'specialized'] : ['car', 'truck'],
        },
        update: c,
      }),
    ),
  );
  console.log(`  ✓ Upserted ${createdCenters.length} centers`);

  // Lanes per center
  for (const center of createdCenters) {
    const existing = await prisma.lane.count({ where: { centerId: center.id } });
    if (existing === 0) {
      await prisma.lane.createMany({
        data: Array.from({ length: center.laneCount }).map((_, i) => ({
          centerId: center.id,
          laneNumber: i + 1,
          laneType: i === 0 ? 'LIGHT' : i === 1 ? 'HEAVY' : 'MIXED',
        })),
      });
    }
    await prisma.centerLiveStatus.upsert({
      where: { centerId: center.id },
      create: {
        centerId: center.id,
        queueLength: Math.floor(Math.random() * 25),
        activeLanes: Math.max(1, center.laneCount - Math.floor(Math.random() * 2)),
      },
      update: {},
    });
  }
  console.log(`  ✓ Created lanes + live status for centers`);

  // Slots: 7 days × 8am-5pm × hourly per center, 4 vehicles per slot capacity
  const now = new Date();
  const slotPromises: Promise<unknown>[] = [];
  for (const center of createdCenters) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() + d);
      day.setUTCHours(0, 0, 0, 0);
      if (day.getUTCDay() === 0) continue; // closed Sundays
      for (let h = 8; h < 17; h++) {
        const startsAt = new Date(day);
        startsAt.setUTCHours(h, 0, 0, 0);
        const endsAt = new Date(startsAt);
        endsAt.setUTCHours(h + 1, 0, 0, 0);
        const capacity = Math.max(2, Math.floor(center.capacityPerHour / 4));
        slotPromises.push(
          prisma.slot.upsert({
            where: { centerId_startsAt: { centerId: center.id, startsAt } },
            create: { centerId: center.id, startsAt, endsAt, capacity },
            update: {},
          }),
        );
      }
    }
  }
  await Promise.all(slotPromises);
  console.log(`  ✓ Upserted ${slotPromises.length} slots`);

  // Demo users
  const passwordHash = await argon2.hash('demo1234');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@dangkiem.local' },
    create: {
      email: 'admin@dangkiem.local',
      passwordHash,
      fullName: 'Admin',
      phone: '0901000000',
      role: 'ADMIN',
    },
    update: {},
  });
  const demoUser = await prisma.user.upsert({
    where: { email: 'user@dangkiem.local' },
    create: {
      email: 'user@dangkiem.local',
      passwordHash,
      fullName: 'Nguyễn Văn A',
      phone: '0902000000',
      role: 'USER',
    },
    update: {},
  });
  const proxyWorker = await prisma.user.upsert({
    where: { email: 'worker@dangkiem.local' },
    create: {
      email: 'worker@dangkiem.local',
      passwordHash,
      fullName: 'Trần Văn B',
      phone: '0903000000',
      role: 'PROXY_WORKER',
    },
    update: {},
  });
  console.log(`  ✓ Demo users: admin / user / worker (password: demo1234)`);

  // Demo fleet
  const fleet = await prisma.fleet.upsert({
    where: { taxCode: '0123456789' },
    create: {
      name: 'Mai Linh Taxi (demo)',
      taxCode: '0123456789',
      contactName: 'Lê Thị C',
      contactPhone: '0904000000',
      contactEmail: 'fleet@dangkiem.local',
    },
    update: {},
  });
  const fleetAdmin = await prisma.user.upsert({
    where: { email: 'fleet@dangkiem.local' },
    create: {
      email: 'fleet@dangkiem.local',
      passwordHash,
      fullName: 'Lê Thị C',
      phone: '0904000000',
      role: 'FLEET_ADMIN',
      fleetId: fleet.id,
    },
    update: { fleetId: fleet.id, role: 'FLEET_ADMIN' },
  });

  // Demo vehicle
  await prisma.vehicle.upsert({
    where: { plateNumber: '30A-12345' },
    create: {
      plateNumber: '30A-12345',
      vehicleType: 'car',
      brand: 'Toyota',
      model: 'Vios',
      yearOfManufacture: 2022,
      vin: 'JTDBR32E600123456',
      ownerId: demoUser.id,
      temExpiresAt: new Date(Date.now() + 45 * 86400000),
    },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { plateNumber: '51F-67890' },
    create: {
      plateNumber: '51F-67890',
      vehicleType: 'car',
      brand: 'Hyundai',
      model: 'Accent',
      yearOfManufacture: 2021,
      ownerId: fleetAdmin.id,
      fleetId: fleet.id,
      temExpiresAt: new Date(Date.now() + 15 * 86400000),
    },
    update: {},
  });

  console.log(`  ✓ Demo fleet, vehicles, and worker user created`);
  console.log(`\n✅ Seed complete. Login:\n  admin@dangkiem.local / demo1234`);
  console.log(`  user@dangkiem.local / demo1234`);
  console.log(`  fleet@dangkiem.local / demo1234`);
  console.log(`  worker@dangkiem.local / demo1234`);

  // Suppress unused-warning for adminUser / proxyWorker
  void adminUser;
  void proxyWorker;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
