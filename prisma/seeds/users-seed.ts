/**
 * 사용자, 역할, 연도별 역할 시드 데이터
 * 생성일: 2026-04-06
 * 사용자: 51명, 역할: 6개, 연도별역할: 28개
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 기본 비밀번호 (bcrypt 해시됨: chc2026)
const DEFAULT_PASSWORD_HASH = '$2b$10$y66Vh2AsfiG1z5rYPzk/Ge7OGLfJA8fyhjQPwNx.hmmbbNMrOSpsu';

// ============================================================
// 역할 (Role) 데이터
// ============================================================
const roles = [
  { id: 'cmk878p2v0000eg3mzdonk4zf', code: 'admin', name: '관리자', description: '시스템 관리자 - 모든 권한', stepNumber: null, sortOrder: 0, isActive: true, canApprove: false, canManageExpense: true, canAccessAdmin: true, canExportData: true, canRegisterUsers: true },
  { id: 'cmk878pjm0001eg3mjpjvg05s', code: 'finance_head', name: '재정팀장', description: '3차/최종 결재권자', stepNumber: 3, sortOrder: 1, isActive: true, canApprove: true, canManageExpense: true, canAccessAdmin: false, canExportData: true, canRegisterUsers: true },
  { id: 'cmk878plq0002eg3mbyuccaqa', code: 'accountant', name: '회계', description: '2차 결재권자', stepNumber: 2, sortOrder: 2, isActive: true, canApprove: true, canManageExpense: true, canAccessAdmin: false, canExportData: true, canRegisterUsers: true },
  { id: 'cmk878poo0003eg3mq7pxz5a0', code: 'team_leader', name: '팀장', description: '1차 결재권자', stepNumber: 1, sortOrder: 3, isActive: true, canApprove: true, canManageExpense: false, canAccessAdmin: false, canExportData: false, canRegisterUsers: true },
  { id: 'cmk878pre0004eg3m9yelxwsg', code: 'admin_assistant', name: '행정간사', description: '지출관리, 데이터 내보내기 권한', stepNumber: null, sortOrder: 4, isActive: true, canApprove: false, canManageExpense: true, canAccessAdmin: false, canExportData: true, canRegisterUsers: true },
  { id: 'cmk878pu00005eg3mptqb10hg', code: 'user', name: '사용자', description: '일반 사용자', stepNumber: null, sortOrder: 5, isActive: true, canApprove: false, canManageExpense: false, canAccessAdmin: false, canExportData: false, canRegisterUsers: false },
];

// ============================================================
// 사용자 (User) 데이터
// ============================================================
const users = [
  { id: 'cmnd83yhy0003h4294tl4vdjl', userid: 'testuser', username: 'Test Name', role: 'user', isActive: true },
  { id: 'cmk888mel003e2dg94g6z3pr1', userid: '청연강홍재', username: '강홍재', role: 'user', isActive: true },
  { id: 'cmk880hmj00002dg9l9hkp4hx', userid: '청연관리자', username: '관리자', role: 'admin', isActive: true },
  { id: 'cmk888mvb00702dg9ftvxu2cw', userid: '청연김경민', username: '김경민', role: 'user', isActive: true },
  { id: 'cmk888ly700092dg9phxe7mv4', userid: '청연김대현', username: '김대현', role: 'user', isActive: true },
  { id: 'cmncwyox3001pcam9k8lupzn3', userid: '청연김민광', username: '김민광', role: 'user', isActive: true },
  { id: 'cmkmp8uj600002eknmyzv4lb0', userid: '청연김수정', username: '김수정', role: 'user', isActive: true },
  { id: 'cmk888n2x008q2dg9jehsp6ka', userid: '청연김영은', username: '김영은', role: 'user', isActive: true },
  { id: 'cmk888m9z002j2dg9p6dzka1z', userid: '청연김예찬', username: '김예찬', role: 'user', isActive: true },
  { id: 'cmmj3d8nx000yfo29vt36oum3', userid: '청연김정자', username: '김정자', role: 'user', isActive: true },
  { id: 'cmnmrnune0001fr28zo8p7m1y', userid: '청연김종히', username: '김종히', role: 'user', isActive: true },
  { id: 'cmk888mgz003u2dg9pfnhkqlm', userid: '청연김지인', username: '김지인', role: 'user', isActive: true },
  { id: 'cmk884lxz00022dg97uj0k0zt', userid: '청연김흥래', username: '김흥래', role: 'user', isActive: true },
  { id: 'cmk888mfu003n2dg9th2dsx83', userid: '청연류지성', username: '류지성', role: 'user', isActive: true },
  { id: 'cmk888mp3005r2dg90t8kip94', userid: '청연박영미', username: '박영미', role: 'user', isActive: true },
  { id: 'cmk888mb9002s2dg9ksfruoa3', userid: '청연박예송', username: '박예송', role: 'user', isActive: true },
  { id: 'cmlc0trsa000628h0qisw9h2f', userid: '청연박지은', username: '박지은', role: 'user', isActive: true },
  { id: 'cmk9fa1ud00002demw7071vks', userid: '청연박현호', username: '박현호', role: 'user', isActive: true },
  { id: 'cmlc0rusj000328h07ru9f2fd', userid: '박현호날두', username: '박현호날두', role: 'user', isActive: true },
  { id: 'cmk888mda00362dg9v2xppd75', userid: '청연방순화', username: '방순화', role: 'user', isActive: true },
  { id: 'cmncskxgc0001i0289pc1meii', userid: '청연서은숙', username: '서은숙', role: 'user', isActive: true },
  { id: 'cmk888lzb000f2dg9oea0rnyt', userid: '청연서주형', username: '서주형', role: 'user', isActive: true },
  { id: 'cmk878pzg0007eg3mwa2fhj6t', userid: '청연송원경', username: '송원경', role: 'user', isActive: true },
  { id: 'cmk878q240008eg3m7shfiopv', userid: '청연신창국', username: '신창국', role: 'user', isActive: true },
  { id: 'cmk89zem5000d28gqazxri5el', userid: '청연심선미', username: '심선미', role: 'user', isActive: true },
  { id: 'cmnjstwt50007iv28i8oxfun5', userid: '청연양정열', username: '양정열', role: 'user', isActive: true },
  { id: 'cmk888m0t000p2dg93paineyi', userid: '청연양찬승', username: '양찬승', role: 'user', isActive: true },
  { id: 'cmncwyooh001hcam9ragwy4tn', userid: '청연오승환', username: '오승환', role: 'user', isActive: true },
  { id: 'cmnjw86b70009iv281xhjlcqp', userid: '청연오혜성', username: '오혜성', role: 'user', isActive: true },
  { id: 'cmlc0trbw000528h0ud1p4tre', userid: '청연원주현', username: '원주현', role: 'user', isActive: true },
  { id: 'cmncynpdi0001h429p7ewb4g1', userid: '청연유광하', username: '유광하', role: 'user', isActive: true },
  { id: 'cmk888mrv006f2dg9s93dfw6y', userid: '청연유미정', username: '유미정', role: 'user', isActive: true },
  { id: 'cmncwyp9k0021cam9n352iaya', userid: '청연유정희', username: '유정희', role: 'user', isActive: true },
  { id: 'cmk878q79000aeg3mqlt9wl3t', userid: '청연윤운문', username: '윤운문', role: 'finance_head', isActive: true },
  { id: 'cmlc0scsx000428h06khuxf8d', userid: '청연이가희', username: '이가희', role: 'user', isActive: true },
  { id: 'cmncwypyv002pcam9sidr6edt', userid: '청연이문희', username: '이문희', role: 'user', isActive: true },
  { id: 'cmk888mcb00302dg99h11phub', userid: '청연이선아B', username: '이선아B', role: 'user', isActive: true },
  { id: 'cmn9wsp6b0001mr28ivvbnkzx', userid: '청연이현재', username: '이현재', role: 'user', isActive: false },
  { id: 'cmk888mj0004a2dg909o9xcpd', userid: '청연임대웅', username: '임대웅', role: 'user', isActive: true },
  { id: 'cmk888m4e001e2dg93e7c8elb', userid: '청연임한결', username: '임한결', role: 'user', isActive: true },
  { id: 'cmncwynv8000pcam9808qf4js', userid: '청연장태규', username: '장태규', role: 'user', isActive: true },
  { id: 'cmlc0ufc7000728h0wn2kbu8h', userid: '청연전수희', username: '전수희', role: 'user', isActive: true },
  { id: 'cmk8837nf00012dg9vxibitsn', userid: '청연정동진', username: '정동진', role: 'user', isActive: true },
  { id: 'cmk878pwk0006eg3mflioxuga', userid: '청연정혜종', username: '정혜종', role: 'user', isActive: true },
  { id: 'cmk888my2007l2dg9ioyduwjm', userid: '청연조민경', username: '조민경', role: 'user', isActive: true },
  { id: 'cmk888m3200152dg9q760jzth', userid: '청연최보영', username: '최보영', role: 'user', isActive: true },
  { id: 'cmn132a9d0018hg2916db9ybb', userid: '청연최유정', username: '최유정', role: 'user', isActive: true },
  { id: 'cmk888m6c001t2dg9o7nzc0t4', userid: '청연최준영', username: '최준영', role: 'user', isActive: true },
  { id: 'cmnct2ywg0003i028hniu62dn', userid: '청연테스트', username: '테스트', role: 'user', isActive: true },
  { id: 'cmk888m8900272dg98915y8ih', userid: '청연허지혜', username: '허지혜', role: 'user', isActive: true },
  { id: 'cmn1dztrd0001hh28pv4r1pt0', userid: '청연홍길동', username: '홍길동', role: 'user', isActive: true },
];

// ============================================================
// 연도별 역할 (UserYearRole) 데이터 - 2026년
// ============================================================
const userYearRoles = [
  { id: 'cmnmoxqdl00qtcaq5n7zycrx8', userId: 'cmk878pwk0006eg3mflioxuga', year: 2026, role: 'accountant', roleId: 'cmk878plq0002eg3mbyuccaqa', departmentId: 'cmk9cl0bj000z2fif5j2fn1v1' },
  { id: 'cmnmoxq5200qpcaq5sft0xzjh', userId: 'cmk878pzg0007eg3mwa2fhj6t', year: 2026, role: 'admin_assistant', roleId: 'cmk878pre0004eg3m9yelxwsg', departmentId: 'cmk9cl0bj000z2fif5j2fn1v1' },
  { id: 'cmnn22jik002bcad3a6tu7wj6', userId: 'cmk878q79000aeg3mqlt9wl3t', year: 2026, role: 'finance_head', roleId: 'cmk878pjm0001eg3mjpjvg05s', departmentId: null },
  { id: 'cmnmoxq9k00qrcaq5xq4di629', userId: 'cmk878q79000aeg3mqlt9wl3t', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk9cl0bj000z2fif5j2fn1v1' },
  { id: 'cmnmwui2p000fcad3rypnkbgn', userId: 'cmk888ly700092dg9phxe7mv4', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmncwyqlp002ycam9howty56z' },
  { id: 'cmnmoxqpy00qzcaq5tj9xm71a', userId: 'cmk888ly700092dg9phxe7mv4', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mzw00822dg9eaj0qsuj' },
  { id: 'cmnmwfdfv0001cad3fluuka8t', userId: 'cmk888ly700092dg9phxe7mv4', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888m3n001a2dg976fi0d9z' },
  { id: 'cmnmwfqyt0003cad3p5nu536d', userId: 'cmk888ly700092dg9phxe7mv4', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888lx500042dg9z5mt91z8' },
  { id: 'cmnmoxs3n00rjcaq5sgyrx16p', userId: 'cmk888lzb000f2dg9oea0rnyt', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888lyl000b2dg9chruks28' },
  { id: 'cmnmoxs7r00rlcaq5zjkxg6jp', userId: 'cmk888m0t000p2dg93paineyi', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888lzu000k2dg9mccj9rkf' },
  { id: 'cmnmoxswj00rxcaq503ivsaq4', userId: 'cmk888m3200152dg9q760jzth', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888m2200102dg980vk9fmy' },
  { id: 'cmnmwg9m90005cad3jrbg4fv6', userId: 'cmk888m6c001t2dg9o7nzc0t4', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888m5l001p2dg9nnfh93c1' },
  { id: 'cmnmwgpct0007cad3s9uxx1qo', userId: 'cmk888m8900272dg98915y8ih', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888m7d00222dg9odzebl67' },
  { id: 'cmnmoxr6q00r7caq52x8qyg2t', userId: 'cmk888m9z002j2dg9p6dzka1z', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888m93002f2dg9zdvl63ts' },
  { id: 'cmnmoxrve00rfcaq5k2qyddjs', userId: 'cmk888mb9002s2dg9ksfruoa3', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mai002o2dg9em4twbaj' },
  { id: 'cmnmoxsk400rrcaq5esfofxqr', userId: 'cmk888mcb00302dg99h11phub', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mbt002x2dg9j50n1rdl' },
  { id: 'cmnmoxrzj00rhcaq531w80aqz', userId: 'cmk888mda00362dg9v2xppd75', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mcj00322dg9mvmdl57l' },
  { id: 'cmnmoxqhq00qvcaq5kgdno3dd', userId: 'cmk888mel003e2dg94g6z3pr1', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mdp00392dg9wpj2212f' },
  { id: 'cmnmoxrn500rbcaq5uw58d7u0', userId: 'cmk888mfu003n2dg9th2dsx83', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mf6003j2dg9iqa8sfcq' },
  { id: 'cmnmoxsob00rtcaq5jz98euhe', userId: 'cmk888mj0004a2dg909o9xcpd', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mi400452dg9tihbe4ap' },
  { id: 'cmnmoxrra00rdcaq54vnsbsgr', userId: 'cmk888mp3005r2dg90t8kip94', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888moe005n2dg9ic9j42rw' },
  { id: 'cmnmoxsfz00rpcaq5v9kx6ki6', userId: 'cmk888mrv006f2dg9s93dfw6y', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mr5006b2dg96a76pxew' },
  { id: 'cmnmoxqlv00qxcaq5uu6ti8kn', userId: 'cmk888mvb00702dg9ftvxu2cw', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888muk006w2dg9ypf5tvfp' },
  { id: 'cmnmoxssf00rvcaq52me74i37', userId: 'cmk888my2007l2dg9ioyduwjm', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mxd007h2dg96zjfkrxa' },
  { id: 'cmnmoxr2m00r5caq531kywa65', userId: 'cmk888n2x008q2dg9jehsp6ka', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888n27008m2dg9f0o1pbsy' },
  { id: 'cmnmoxqyf00r3caq5nwyul67w', userId: 'cmkmp8uj600002eknmyzv4lb0', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888n4300912dg9peipojq8' },
  { id: 'cmnmoxsbv00rncaq5vuyb0gnd', userId: 'cmnjw86b70009iv281xhjlcqp', year: 2026, role: 'team_leader', roleId: 'cmk878poo0003eg3mq7pxz5a0', departmentId: 'cmk888mg3003p2dg9kx89walb' },
];

async function main() {
  console.log('🚀 시드 시작...\n');

  // 1. Role 시드
  console.log('📋 역할(Role) 시드 중...');
  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {
        code: role.code,
        name: role.name,
        description: role.description,
        stepNumber: role.stepNumber,
        sortOrder: role.sortOrder,
        isActive: role.isActive,
        canApprove: role.canApprove,
        canManageExpense: role.canManageExpense,
        canAccessAdmin: role.canAccessAdmin,
        canExportData: role.canExportData,
        canRegisterUsers: role.canRegisterUsers,
      },
      create: role,
    });
  }
  console.log(`   ✅ ${roles.length}개 역할 시드 완료\n`);

  // 2. User 시드
  console.log('👤 사용자(User) 시드 중...');
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        userid: user.userid,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        password: DEFAULT_PASSWORD_HASH, // E2E 테스트를 위해 비밀번호 재설정
      },
      create: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        password: DEFAULT_PASSWORD_HASH, // 기본 비밀번호: chc2026
        role: user.role,
        isActive: user.isActive,
      },
    });
  }
  console.log(`   ✅ ${users.length}명 사용자 시드 완료\n`);

  // 3. UserYearRole 시드
  console.log('📅 연도별 역할(UserYearRole) 시드 중...');
  for (const yr of userYearRoles) {
    await prisma.userYearRole.upsert({
      where: { id: yr.id },
      update: {
        userId: yr.userId,
        year: yr.year,
        role: yr.role,
        roleId: yr.roleId,
        departmentId: yr.departmentId,
      },
      create: yr,
    });
  }
  console.log(`   ✅ ${userYearRoles.length}개 연도별 역할 시드 완료\n`);

  console.log('🎉 모든 시드 완료!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
