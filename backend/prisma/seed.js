import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Full-Reset Seeding for Demo App ---');

  // 0) Wipe existing data in correct order
  console.log('🗑️ Clearing tables...');
  await prisma.inspectionLogs.deleteMany();
  await prisma.lotProcessSetpoint.deleteMany();
  await prisma.activeBuilds.deleteMany();
  await prisma.lots.deleteMany();
  await prisma.processRecipe.deleteMany();
  await prisma.configMpSpecs.deleteMany();
  await prisma.configurations.deleteMany();
  await prisma.products.deleteMany();
  await prisma.rejectAssignments.deleteMany();
  await prisma.productRejects.deleteMany();
  await prisma.rejectType.deleteMany();
  await prisma.manufacturingProcedures.deleteMany();
  await prisma.equipmentParameter.deleteMany();
  await prisma.parameter.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.buildRecords.deleteMany();
  await prisma.userFavoriteSpec.deleteMany();
  await prisma.users.deleteMany();

  // 1) Seed Users
  console.log('👤 Seeding users...');
  const engineer = await prisma.users.create({ data: { username: 'bob', password: await bcrypt.hash('password123', 10), role: 'engineer' } });
  const operator1 = await prisma.users.create({ data: { username: 'joe', password: await bcrypt.hash('password123', 10), role: 'operator' } });

  // 2) Seed Master Data
  console.log('🛠️ Seeding equipment, parameters, MPs, rejects...');
  const demoWinder = await prisma.equipment.create({ data: { name: 'ED123', description: 'Coil Winder' } });
  const demoBraider = await prisma.equipment.create({ data: { name: 'ED234', description: 'Demo Braiding Machine' } });

  const demoSpeedParam = await prisma.parameter.create({ data: { name: 'Speed (RPM)' } });
  const demoTempParam  = await prisma.parameter.create({ data: { name: 'Temp (°C)' } });

  await prisma.equipmentParameter.create({ data: { equipment_id: demoWinder.id, parameter_id: demoSpeedParam.id } });
  await prisma.equipmentParameter.create({ data: { equipment_id: demoBraider.id, parameter_id: demoTempParam.id } });

  await prisma.manufacturingProcedures.createMany({ data: [
    { mp_number: 'MP123', procedure_name: 'Demo Winding' },
    { mp_number: 'MP234', procedure_name: 'Demo Braiding' }
  ]});

  await prisma.rejectType.createMany({ data: [ { reject_code: 'DEMO-FAIL', description: 'Demo Failure Mode' } ] });

  // 3) Seed Product & Configuration
  console.log('📦 Seeding product & configuration...');
  await prisma.products.create({ data: { mvd_number: 'MVD123', product_name: 'Babak 6F Omega Select Plus' } });
  await prisma.configurations.create({
    data: {
      config_number: 'MVD123-01',
      mvd_number: 'MVD123',
      config_name: 'Babak 6F Omega Select Plus',
      manufacturing_procedures: { connect: [ { mp_number: 'MP123' }, { mp_number: 'MP234' } ] }
    }
  });

  // 4) Seed Specs
  console.log('📊 Seeding specs...');
  await prisma.configMpSpecs.upsert({
    where: { config_number_mp_number_spec_name: { config_number: 'MVD123-01', mp_number: 'MP123', spec_name: 'Demo Winding OD' } },
    update: {},
    create: { config_number: 'MVD123-01', mp_number: 'MP123', spec_name: 'Demo Winding OD', type: 'Variable', lower_spec: 9.9, upper_spec: 10.1, nominal: 10.0 }
  });
  await prisma.configMpSpecs.upsert({
    where: { config_number_mp_number_spec_name: { config_number: 'MVD123-01', mp_number: 'MP234', spec_name: 'Demo Braid Visual' } },
    update: {},
    create: { config_number: 'MVD123-01', mp_number: 'MP234', spec_name: 'Demo Braid Visual', type: 'Attribute', attribute_value: null }
  });

  // 5) Seed Recipes
  console.log('📜 Seeding recipes...');
  await prisma.processRecipe.createMany({ data: [
    { config_number: 'MVD123-01', mp_number: 'MP123', recipe_name: 'Demo Winding Recipe',   equipment_id: demoWinder.id, parameter_id: demoSpeedParam.id, nominal_setpoint: 500, min_setpoint: 490, max_setpoint: 510 },
    { config_number: 'MVD123-01', mp_number: 'MP234', recipe_name: 'Demo Braiding Recipe',  equipment_id: demoBraider.id, parameter_id: demoTempParam.id,  nominal_setpoint: 95,  min_setpoint: 90,  max_setpoint: 100 }
  ]});

  // 6) Seed Lots, Active Builds, Setpoints & Logs
  console.log('🏭 Seeding lots, builds & logs...');
  const demoLots = [
    { lot_number: 'DEMO-LOT-001', mp_number: 'MP123' },
    { lot_number: 'DEMO-LOT-002', mp_number: 'MP234' },
    { lot_number: 'DEMO-LOT-003', mp_number: 'MP123' },
    { lot_number: 'DEMO-LOT-004', mp_number: 'MP234' },
    { lot_number: 'DEMO-LOT-005', mp_number: 'MP123' },
    { lot_number: 'DEMO-LOT-006', mp_number: 'MP234' }
  ];

  for (const { lot_number, mp_number } of demoLots) {
    await prisma.lots.create({ data: { lot_number, config_number: 'MVD123-01', quantity: 16 } });
    await prisma.activeBuilds.create({ data: { username: engineer.username, lot_number, config_number: 'MVD123-01', mp_number } });

    const recipes = await prisma.processRecipe.findMany({ where: { config_number: 'MVD123-01', mp_number }, include: { parameter: true } });
    for (const r of recipes) {
      await prisma.lotProcessSetpoint.create({ data: { lot_number, recipe_name: r.recipe_name, parameter_name: r.parameter.name, setpoint_value: r.nominal_setpoint } });
    }

    const logs = [];
    const snap = { 'Demo Winding Recipe': { 'Speed (RPM)': 500 }, 'Demo Braiding Recipe': { 'Temp (°C)': 95 } };
    for (let unit = 1; unit <= 16; unit++) {
      if (mp_number === 'MP123') {
        // Both Bob and Joe collect variable measurements
        logs.push({ username: engineer.username, lot_number, config_number: 'MVD123-01', mp_number, spec_name: 'Demo Winding OD', inspection_type: 'variable', unit_number: unit, inspection_value: 10 + (Math.random() - 0.5)*0.2, pass_fail: 'Pass', process_parameters_snapshot: JSON.stringify(snap) });
        logs.push({ username: operator1.username, lot_number, config_number: 'MVD123-01', mp_number, spec_name: 'Demo Winding OD', inspection_type: 'variable', unit_number: unit, inspection_value: 10 + (Math.random() - 0.5)*0.2, pass_fail: 'Pass', process_parameters_snapshot: JSON.stringify(snap) });
      }
      if (mp_number === 'MP234') {
        // Both Bob and Joe collect attribute inspections
        const fail = unit % 5 === 0;
        logs.push({ username: operator1.username, lot_number, config_number: 'MVD123-01', mp_number, spec_name: 'Demo Braid Visual', inspection_type: 'attribute', unit_number: unit, inspection_value: null, pass_fail: fail ? 'Fail' : 'Pass', reject_code: fail ? 'DEMO-FAIL' : null, process_parameters_snapshot: JSON.stringify(snap) });
        logs.push({ username: engineer.username, lot_number, config_number: 'MVD123-01', mp_number, spec_name: 'Demo Braid Visual', inspection_type: 'attribute', unit_number: unit, inspection_value: null, pass_fail: fail ? 'Fail' : 'Pass', reject_code: fail ? 'DEMO-FAIL' : null, process_parameters_snapshot: JSON.stringify(snap) });
      }
    }
    await prisma.inspectionLogs.createMany({ data: logs });
    console.log(`✅ Logged ${logs.length} inspections for ${lot_number}`);
  }

  console.log('--- Seeding Complete ---');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
