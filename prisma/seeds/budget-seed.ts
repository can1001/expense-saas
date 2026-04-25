/**
 * 예산 관련 시드 데이터
 * 생성일: 2026-04-25
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Committee (6개)
const committees = [
  {
    "id": "cmk888nke00ci2dg9f64kmeoi",
    "name": "(가칭)인사위",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n5h009c2dg9mmu1xbcv",
    "name": "(가칭)행정위",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888lwt00032dg95cwcr7l1",
    "name": "기획위원회",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m7600212dg93cfuqe9e",
    "name": "예배위원회",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mo7005m2dg9r6s3ie7f",
    "name": "교육훈련위원회",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mdi00382dg9q3ehv314",
    "name": "목양위원회",
    "sortOrder": 0,
    "isActive": true
  }
];

// Department (26개)
const departments = [
  {
    "id": "cmk888nkm00cj2dg98lssqchr",
    "name": "인사위",
    "committeeId": "cmk888nke00ci2dg9f64kmeoi",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mr5006b2dg96a76pxew",
    "name": "유치부",
    "committeeId": "cmk888mo7005m2dg9r6s3ie7f",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n5o009d2dg9crryo6c6",
    "name": "행정비",
    "committeeId": "cmk888n5h009c2dg9mmu1xbcv",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m2200102dg980vk9fmy",
    "name": "시설관리팀",
    "committeeId": "cmk888lwt00032dg95cwcr7l1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyqlp002ycam9howty56z",
    "name": "기획팀",
    "committeeId": "cmk888lwt00032dg95cwcr7l1",
    "sortOrder": 0,
    "isActive": false
  },
  {
    "id": "cmk888lzu000k2dg9mccj9rkf",
    "name": "공간사역팀",
    "committeeId": "cmk888lwt00032dg95cwcr7l1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888lyl000b2dg9chruks28",
    "name": "홍보팀",
    "committeeId": "cmk888lwt00032dg95cwcr7l1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m5l001p2dg9nnfh93c1",
    "name": "청세포팀",
    "committeeId": "cmk888lwt00032dg95cwcr7l1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888lx500042dg9z5mt91z8",
    "name": "전교인행사TF",
    "committeeId": "cmk888lwt00032dg95cwcr7l1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m3n001a2dg976fi0d9z",
    "name": "이웃사랑팀",
    "committeeId": "cmk888lwt00032dg95cwcr7l1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888moe005n2dg9ic9j42rw",
    "name": "영유아부",
    "committeeId": "cmk888mo7005m2dg9r6s3ie7f",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mbt002x2dg9j50n1rdl",
    "name": "안내팀",
    "committeeId": "cmk888m7600212dg93cfuqe9e",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m93002f2dg9zdvl63ts",
    "name": "방송팀",
    "committeeId": "cmk888m7600212dg93cfuqe9e",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mai002o2dg9em4twbaj",
    "name": "예배지원팀",
    "committeeId": "cmk888m7600212dg93cfuqe9e",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m7d00222dg9odzebl67",
    "name": "찬양팀",
    "committeeId": "cmk888m7600212dg93cfuqe9e",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mcj00322dg9mvmdl57l",
    "name": "기도팀",
    "committeeId": "cmk888m7600212dg93cfuqe9e",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mdp00392dg9wpj2212f",
    "name": "목양팀",
    "committeeId": "cmk888mdi00382dg9q3ehv314",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mg3003p2dg9kx89walb",
    "name": "청년유스",
    "committeeId": "cmk888mdi00382dg9q3ehv314",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mf6003j2dg9iqa8sfcq",
    "name": "마중물팀",
    "committeeId": "cmk888mdi00382dg9q3ehv314",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mi400452dg9tihbe4ap",
    "name": "양육지원",
    "committeeId": "cmk888mdi00382dg9q3ehv314",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mxd007h2dg96zjfkrxa",
    "name": "초등부",
    "committeeId": "cmk888mo7005m2dg9r6s3ie7f",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n4300912dg9peipojq8",
    "name": "세바맘팀",
    "committeeId": "cmk888mo7005m2dg9r6s3ie7f",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888muk006w2dg9ypf5tvfp",
    "name": "유년부",
    "committeeId": "cmk888mo7005m2dg9r6s3ie7f",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mzw00822dg9eaj0qsuj",
    "name": "중고등부",
    "committeeId": "cmk888mo7005m2dg9r6s3ie7f",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n27008m2dg9f0o1pbsy",
    "name": "새가족팀",
    "committeeId": "cmk888mo7005m2dg9r6s3ie7f",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk9cl0bj000z2fif5j2fn1v1",
    "name": "재정팀",
    "committeeId": "cmk888lwt00032dg95cwcr7l1",
    "sortOrder": 1,
    "isActive": true
  }
];

// BudgetCategory (17개)
const budgetCategories = [
  {
    "id": "cmk888lxd00052dg97vydlf0y",
    "name": "사역지원비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m02000l2dg9raaokbq2",
    "name": "비전사역비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m2a00112dg98dcfnl50",
    "name": "건물및시설유지관리비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m7k00232dg9np8d1ash",
    "name": "예배사역비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mdw003a2dg9nv7pf68w",
    "name": "목양사역비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mga003q2dg92l60s56s",
    "name": "교육사역비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mib00462dg9dbewi7hc",
    "name": "양육사역비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n6e009i2dg969m1942z",
    "name": "섬김사역비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n9x00aa2dg9ov9n014u",
    "name": "목회활동비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ncw00av2dg93cmh5eyr",
    "name": "사무행정비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nhz00c02dg92zb5tcrp",
    "name": "상회부담금",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888niz00c82dg9vtkbwaah",
    "name": "예비비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888njo00cd2dg93inmw8hk",
    "name": "적립금",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nkt00ck2dg9h2jz9w8q",
    "name": "교역자사례비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888np000dh2dg9f2oe7mz4",
    "name": "사무사역비",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nr700dy2dg91k6oe48z",
    "name": "예산외지출",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx056p00j1cam98jwnnh14",
    "name": "잡지출",
    "sortOrder": 0,
    "isActive": true
  }
];

// BudgetSubcategory (63개)
const budgetSubcategories = [
  {
    "id": "cmk888m5t001q2dg99z2nxrwf",
    "name": "청세포비(포럼비)",
    "categoryId": "cmk888lxd00052dg97vydlf0y",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888lyt000c2dg9uxhhaeb1",
    "name": "홍보비",
    "categoryId": "cmk888lxd00052dg97vydlf0y",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888lxn00062dg9ctwrseid",
    "name": "전교인행사",
    "categoryId": "cmk888lxd00052dg97vydlf0y",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mmq00592dg9uqbdntp7",
    "name": "교제비",
    "categoryId": "cmk888lxd00052dg97vydlf0y",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyr6g0031cam99sr8p84a",
    "name": "기획비",
    "categoryId": "cmk888lxd00052dg97vydlf0y",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m09000m2dg90obssenw",
    "name": "공간사역비",
    "categoryId": "cmk888m02000l2dg9raaokbq2",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m3v001b2dg9l7gpessx",
    "name": "이웃사랑사역비",
    "categoryId": "cmk888m02000l2dg9raaokbq2",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m2i00122dg9w9pveqrs",
    "name": "시설유지보수비",
    "categoryId": "cmk888m2a00112dg98dcfnl50",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n84009v2dg9087icy85",
    "name": "비품비",
    "categoryId": "cmk888m2a00112dg98dcfnl50",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n8m009z2dg9atajjp7w",
    "name": "공간임차료",
    "categoryId": "cmk888m2a00112dg98dcfnl50",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n9e00a62dg9k09l3xn3",
    "name": "건물관리비",
    "categoryId": "cmk888m2a00112dg98dcfnl50",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n5v009e2dg9mmp3zo0g",
    "name": "강사사례비",
    "categoryId": "cmk888m7k00232dg9np8d1ash",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mcr00332dg9efsq2s36",
    "name": "양육지원비",
    "categoryId": "cmk888m7k00232dg9np8d1ash",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888maq002p2dg9x65tglhu",
    "name": "예배준비비",
    "categoryId": "cmk888m7k00232dg9np8d1ash",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m9a002g2dg9qnox5bwg",
    "name": "방송비",
    "categoryId": "cmk888m7k00232dg9np8d1ash",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m7r00242dg9lqov0vq3",
    "name": "찬양팀운영비",
    "categoryId": "cmk888m7k00232dg9np8d1ash",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mfd003k2dg9vv6hzmzl",
    "name": "마중물비",
    "categoryId": "cmk888mdw003a2dg9nv7pf68w",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888me3003b2dg9utdpdtv5",
    "name": "목양비",
    "categoryId": "cmk888mdw003a2dg9nv7pf68w",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mxk007i2dg9z0lnepbq",
    "name": "초등사역비",
    "categoryId": "cmk888mga003q2dg92l60s56s",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n0400832dg9ytb693dh",
    "name": "중고등사역비",
    "categoryId": "cmk888mga003q2dg92l60s56s",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mrd006c2dg9j7cx8kpp",
    "name": "유치사역비",
    "categoryId": "cmk888mga003q2dg92l60s56s",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mol005o2dg9wwqk80wm",
    "name": "영유아사역비",
    "categoryId": "cmk888mga003q2dg92l60s56s",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mgh003r2dg9iuzo5cv1",
    "name": "청년유스사역비",
    "categoryId": "cmk888mga003q2dg92l60s56s",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mur006x2dg9ja99nhxq",
    "name": "유년사역비",
    "categoryId": "cmk888mga003q2dg92l60s56s",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n2f008n2dg9u2zz21c5",
    "name": "새가족운영비",
    "categoryId": "cmk888mib00462dg9dbewi7hc",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n4a00922dg9i7gtqnfs",
    "name": "세바맘운영비",
    "categoryId": "cmk888mib00462dg9dbewi7hc",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwztba00fucam9iivn3s9w",
    "name": "도서구입비",
    "categoryId": "cmk888mib00462dg9dbewi7hc",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mii00472dg9c8oaghjo",
    "name": "양육지원비",
    "categoryId": "cmk888mib00462dg9dbewi7hc",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n6l009j2dg96izzwzz4",
    "name": "경조비",
    "categoryId": "cmk888n6e009i2dg969m1942z",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n7m009r2dg9c4e6uclw",
    "name": "주차비",
    "categoryId": "cmk888n6e009i2dg969m1942z",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz52h007pcam9yodov2g0",
    "name": "중보기도사역비",
    "categoryId": "cmk888n6e009i2dg969m1942z",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n74009n2dg9xek8ut3o",
    "name": "주일식사비",
    "categoryId": "cmk888n6e009i2dg969m1942z",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nbe00aj2dg9zpvddd8l",
    "name": "도서구입비",
    "categoryId": "cmk888n9x00aa2dg9ov9n014u",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888na300ab2dg9qste3ryt",
    "name": "목회_통신비",
    "categoryId": "cmk888n9x00aa2dg9ov9n014u",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nav00af2dg9zwd1nk11",
    "name": "목회_회의 및 접대비",
    "categoryId": "cmk888n9x00aa2dg9ov9n014u",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nbw00an2dg95jo92rwx",
    "name": "교육지원비",
    "categoryId": "cmk888n9x00aa2dg9ov9n014u",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ncf00ar2dg9dzle78mi",
    "name": "차량관리비",
    "categoryId": "cmk888n9x00aa2dg9ov9n014u",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nfi00bf2dg9eh4xwup8",
    "name": "여비교통비",
    "categoryId": "cmk888ncw00av2dg93cmh5eyr",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nhg00bw2dg9qq8tjilo",
    "name": "잡지출",
    "categoryId": "cmk888ncw00av2dg93cmh5eyr",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nez00bb2dg9ythrc9np",
    "name": "인쇄비",
    "categoryId": "cmk888ncw00av2dg93cmh5eyr",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nd300aw2dg9fvjxzw2b",
    "name": "사무_통신비",
    "categoryId": "cmk888ncw00av2dg93cmh5eyr",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ndl00b02dg910exp13d",
    "name": "소모품및사무용품비",
    "categoryId": "cmk888ncw00av2dg93cmh5eyr",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ne400b42dg97g6c1kwa",
    "name": "사무_회의및접대비",
    "categoryId": "cmk888ncw00av2dg93cmh5eyr",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ng100bj2dg92kx6gia4",
    "name": "지급수수료",
    "categoryId": "cmk888ncw00av2dg93cmh5eyr",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ni600c12dg91s25b2y2",
    "name": "상회부담금",
    "categoryId": "cmk888nhz00c02dg92zb5tcrp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nj600c92dg9ky208e38",
    "name": "예비비",
    "categoryId": "cmk888niz00c82dg9vtkbwaah",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx04qb00iwcam948mogoh6",
    "name": "방송시설적립금",
    "categoryId": "cmk888njo00cd2dg93inmw8hk",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nqp00du2dg9yremkfyh",
    "name": "퇴직적립금",
    "categoryId": "cmk888njo00cd2dg93inmw8hk",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx06yj00jgcam98ousbtm7",
    "name": "전임사역자생활비",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nl000cl2dg9gu7dy07f",
    "name": "담임목사생활비",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nli00cp2dg921lkihnp",
    "name": "준전임사역자생활비",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nlz00ct2dg9mayexy2p",
    "name": "파트사역자생활비",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nmh00cx2dg9kzry8hr6",
    "name": "교역자_복리후생비",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nmz00d12dg9l1mhucoo",
    "name": "자녀학비보조비",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nnh00d52dg9ltyajjur",
    "name": "학자금지원비",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888no000d92dg99vhpkmku",
    "name": "교역자식대",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888noi00dd2dg9wzt8g0wj",
    "name": "사택관리비",
    "categoryId": "cmk888nkt00ck2dg9h2jz9w8q",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nq700dq2dg9y4qbsop1",
    "name": "사무간사식대",
    "categoryId": "cmk888np000dh2dg9f2oe7mz4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888npq00dm2dg9gatibhyz",
    "name": "사무_복리후생비",
    "categoryId": "cmk888np000dh2dg9f2oe7mz4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888np800di2dg9p4oqbn3l",
    "name": "사무간사급여",
    "categoryId": "cmk888np000dh2dg9f2oe7mz4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nrf00dz2dg9iqtlnt13",
    "name": "적립금",
    "categoryId": "cmk888nr700dy2dg91k6oe48z",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx05h100j3cam9j5h7z15x",
    "name": "잡지출",
    "categoryId": "cmncx056p00j1cam98jwnnh14",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888njv00ce2dg9pbw89etj",
    "name": "임차보증금(상환)적립금",
    "categoryId": "cmk888njo00cd2dg93inmw8hk",
    "sortOrder": 0,
    "isActive": true
  }
];

// BudgetDetail (195개)
const budgetDetails = [
  {
    "id": "cmncx05tc00j5cam926txncu4",
    "name": "잡지출",
    "subcategoryId": "cmncx05h100j3cam9j5h7z15x",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m4n001g2dg9d2jnw4qk",
    "name": "사역비",
    "subcategoryId": "cmk888m3v001b2dg9l7gpessx",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m9o002h2dg9keoula27",
    "name": "유지관리비_방송팀",
    "subcategoryId": "cmk888m9a002g2dg9qnox5bwg",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mgo003s2dg97po0utag",
    "name": "심방교제비",
    "subcategoryId": "cmk888mgh003r2dg9iuzo5cv1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m6v001y2dg9jau9d9xm",
    "name": "아웃팅비",
    "subcategoryId": "cmk888m5t001q2dg99z2nxrwf",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mh7003w2dg9sykl0r4b",
    "name": "행사비(수련회)",
    "subcategoryId": "cmk888mgh003r2dg9iuzo5cv1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mfk003l2dg9bp82hgyn",
    "name": "구제비",
    "subcategoryId": "cmk888mfd003k2dg9vv6hzmzl",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mmy005a2dg9fiftow4h",
    "name": "행사비(스몰토크)",
    "subcategoryId": "cmk888mmq00592dg9uqbdntp7",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mlr00502dg9ltfd0w1v",
    "name": "행사비(리더세미나)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mlg004x2dg9ljusnvsq",
    "name": "행사비(교역자워크샵)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m1s000x2dg9bm0ge5qb",
    "name": "운영비(조사비)",
    "subcategoryId": "cmk888m09000m2dg90obssenw",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mn9005d2dg9ruh24tga",
    "name": "행사비(암송대회)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mm300532dg9fwdot7dx",
    "name": "행사비(부부세미나)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mht00422dg92xk0iz5o",
    "name": "아웃팅비",
    "subcategoryId": "cmk888mgh003r2dg9iuzo5cv1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mnx005j2dg91ifbmzuw",
    "name": "행사비(일대일양육)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m2r00132dg9axvcstrr",
    "name": "시설보수비",
    "subcategoryId": "cmk888m2i00122dg9w9pveqrs",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m3b00172dg934kbomnj",
    "name": "아웃팅비",
    "subcategoryId": "cmk888m2i00122dg9w9pveqrs",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mku004r2dg92b5077r7",
    "name": "행사비(고난만찬회비)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m13000r2dg9p328rjxu",
    "name": "인건비",
    "subcategoryId": "cmk888m09000m2dg90obssenw",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888meb003c2dg9eqjy9c3y",
    "name": "심방교제비",
    "subcategoryId": "cmk888me3003b2dg9utdpdtv5",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888lxv00072dg9maye7e9a",
    "name": "행사비(전교인나들이)",
    "subcategoryId": "cmk888lxn00062dg9ctwrseid",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m1h000u2dg9b7k8vvsn",
    "name": "아웃팅비",
    "subcategoryId": "cmk888m09000m2dg90obssenw",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888may002q2dg9kb6gmfn0",
    "name": "성례비",
    "subcategoryId": "cmk888maq002p2dg9x65tglhu",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m43001c2dg9rkiszwqd",
    "name": "후원(기관)",
    "subcategoryId": "cmk888m3v001b2dg9l7gpessx",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mki004o2dg98hrsvyk5",
    "name": "행사비(고난만찬)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m59001m2dg97hfk671q",
    "name": "아웃팅비",
    "subcategoryId": "cmk888m3v001b2dg9l7gpessx",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888lzj000h2dg96o1spyng",
    "name": "행사비(청나잇)",
    "subcategoryId": "cmk888lyt000c2dg9uxhhaeb1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888lz0000d2dg9zh63l9tg",
    "name": "아웃팅비",
    "subcategoryId": "cmk888lyt000c2dg9uxhhaeb1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m4y001j2dg9e42lne81",
    "name": "선교비",
    "subcategoryId": "cmk888m3v001b2dg9l7gpessx",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m61001r2dg92z3px1ko",
    "name": "행사비",
    "subcategoryId": "cmk888m5t001q2dg99z2nxrwf",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m6k001v2dg9jyqwo3so",
    "name": "강사비",
    "subcategoryId": "cmk888m5t001q2dg99z2nxrwf",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m8h00292dg92j19ymqo",
    "name": "유지관리비_찬양팀",
    "subcategoryId": "cmk888m7r00242dg9lqov0vq3",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m7z00252dg9u3331aky",
    "name": "관리운영비(악기보수)",
    "subcategoryId": "cmk888m7r00242dg9lqov0vq3",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ma7002l2dg9j9qhsbbn",
    "name": "아웃팅비",
    "subcategoryId": "cmk888m9a002g2dg9qnox5bwg",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mc0002y2dg9epgzr8kh",
    "name": "아웃팅비_안내팀",
    "subcategoryId": "cmk888maq002p2dg9x65tglhu",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888meu003g2dg9lwzgn2l3",
    "name": "아웃팅비",
    "subcategoryId": "cmk888me3003b2dg9utdpdtv5",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mip00482dg96svglb17",
    "name": "교육비(결혼학교)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mjl004f2dg9xhfw3aix",
    "name": "교육비(상담학교)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mjx004i2dg9tmk42szu",
    "name": "교육비(신임집사교육)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mj8004c2dg9di8znom0",
    "name": "교육비(목자교육)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mnm005g2dg96oqf2kk2",
    "name": "행사비(기타)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mmf00562dg95ws97esu",
    "name": "행사비(부부세미나회비)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mk7004l2dg94d646uv4",
    "name": "교육비(전도학교)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ml5004u2dg9czmzxfr0",
    "name": "행사비(교사세미나)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mot005p2dg90xpaab8k",
    "name": "교육교재비",
    "subcategoryId": "cmk888mol005o2dg9wwqk80wm",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mse006k2dg952bdujb6",
    "name": "행사비(성경학교)",
    "subcategoryId": "cmk888mrd006c2dg9j7cx8kpp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mw600782dg905ejteey",
    "name": "행사비(선물)",
    "subcategoryId": "cmk888mur006x2dg9ja99nhxq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mvk00722dg9zvea9wp0",
    "name": "심방교제비",
    "subcategoryId": "cmk888mur006x2dg9ja99nhxq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mwo007b2dg9mw12jbs3",
    "name": "행사비(기타)",
    "subcategoryId": "cmk888mur006x2dg9ja99nhxq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888myy007t2dg91i3j2koy",
    "name": "행사비(선물)",
    "subcategoryId": "cmk888mxk007i2dg9z0lnepbq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n2m008o2dg9dw774qza",
    "name": "교육교재비",
    "subcategoryId": "cmk888n2f008n2dg9u2zz21c5",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mx1007e2dg9o34outfe",
    "name": "아웃팅비",
    "subcategoryId": "cmk888mur006x2dg9ja99nhxq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mvv00752dg9x2f3rt5e",
    "name": "행사비(성경학교)",
    "subcategoryId": "cmk888mur006x2dg9ja99nhxq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mxr007j2dg9f25b6nt2",
    "name": "교육교재비",
    "subcategoryId": "cmk888mxk007i2dg9z0lnepbq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n3g008v2dg90vdjd1gg",
    "name": "행사비(환영회)",
    "subcategoryId": "cmk888n2f008n2dg9u2zz21c5",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888muz006y2dg9esntgf8j",
    "name": "교육교재비",
    "subcategoryId": "cmk888mur006x2dg9ja99nhxq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mzl007z2dg9n7t8iy20",
    "name": "아웃팅비",
    "subcategoryId": "cmk888mxk007i2dg9z0lnepbq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n19008d2dg9vv68ss50",
    "name": "행사비(선물)",
    "subcategoryId": "cmk888n0400832dg9ytb693dh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mz9007w2dg96zncztn4",
    "name": "행사비(기타)",
    "subcategoryId": "cmk888mxk007i2dg9z0lnepbq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n0b00842dg9jpqc2lv6",
    "name": "교육교재비",
    "subcategoryId": "cmk888n0400832dg9ytb693dh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n5600992dg9bpwwtghh",
    "name": "아웃팅비",
    "subcategoryId": "cmk888n4a00922dg9i7gtqnfs",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mtb006q2dg9d21s2pji",
    "name": "행사비(기타)",
    "subcategoryId": "cmk888mrd006c2dg9j7cx8kpp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n0y008a2dg9l0dqo9gr",
    "name": "행사비(수련회)",
    "subcategoryId": "cmk888n0400832dg9ytb693dh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n1k008g2dg904ysvlkt",
    "name": "행사비(기타)",
    "subcategoryId": "cmk888n0400832dg9ytb693dh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n3r008y2dg94gd87ymb",
    "name": "아웃팅비",
    "subcategoryId": "cmk888n2f008n2dg9u2zz21c5",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n4i00932dg915bq6c4u",
    "name": "강사비",
    "subcategoryId": "cmk888n4a00922dg9i7gtqnfs",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n1w008j2dg95hw7e48u",
    "name": "아웃팅비",
    "subcategoryId": "cmk888n0400832dg9ytb693dh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n35008s2dg99ko3niof",
    "name": "행사비(선물)",
    "subcategoryId": "cmk888n2f008n2dg9u2zz21c5",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n4v00962dg94jyhwq87",
    "name": "다과간식비",
    "subcategoryId": "cmk888n4a00922dg9i7gtqnfs",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n63009f2dg9fttezph3",
    "name": "강사사례비",
    "subcategoryId": "cmk888n5v009e2dg9mmp3zo0g",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n8b009w2dg9ponj4dq0",
    "name": "기타 비품",
    "subcategoryId": "cmk888n84009v2dg9087icy85",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n7t009s2dg9k10cocjb",
    "name": "주차비",
    "subcategoryId": "cmk888n7m009r2dg9c4e6uclw",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n9l00a72dg9kcezf0qo",
    "name": "건물관리비",
    "subcategoryId": "cmk888n9e00a62dg9k09l3xn3",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n7b009o2dg98i1f9q46",
    "name": "주일식사비",
    "subcategoryId": "cmk888n74009n2dg9xek8ut3o",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mqv00682dg9wekhsk9n",
    "name": "아웃팅비",
    "subcategoryId": "cmk888mol005o2dg9wwqk80wm",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888naa00ac2dg9ye9o5hyi",
    "name": "목회_통신비",
    "subcategoryId": "cmk888na300ab2dg9qste3ryt",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n0m00872dg9o55bgb12",
    "name": "심방교제비",
    "subcategoryId": "cmk888n0400832dg9ytb693dh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n6t009k2dg97lmphlci",
    "name": "경조비",
    "subcategoryId": "cmk888n6l009j2dg96izzwzz4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mpx005z2dg9c06q3zxo",
    "name": "행사비(선물)",
    "subcategoryId": "cmk888mol005o2dg9wwqk80wm",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mqj00652dg956a12jig",
    "name": "소모품비",
    "subcategoryId": "cmk888mol005o2dg9wwqk80wm",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nb300ag2dg9xt7bij80",
    "name": "목회 회의 및 접대비",
    "subcategoryId": "cmk888nav00af2dg9zwd1nk11",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mq800622dg9fydpkz9o",
    "name": "행사비(기타)",
    "subcategoryId": "cmk888mol005o2dg9wwqk80wm",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mu7006t2dg9i5s4pn4t",
    "name": "아웃팅비",
    "subcategoryId": "cmk888mrd006c2dg9j7cx8kpp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mrk006d2dg91xg32jzj",
    "name": "교육교재비",
    "subcategoryId": "cmk888mrd006c2dg9j7cx8kpp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n9300a32dg907yg0gq5",
    "name": "장비임차료",
    "subcategoryId": "cmk888m2i00122dg9w9pveqrs",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mpm005w2dg9ldo81v9q",
    "name": "행사비(성경학교)",
    "subcategoryId": "cmk888mol005o2dg9wwqk80wm",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mym007q2dg9id5c66nj",
    "name": "행사비(성경학교)",
    "subcategoryId": "cmk888mxk007i2dg9z0lnepbq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888n8t00a02dg9pvdtk3hu",
    "name": "공간임차료",
    "subcategoryId": "cmk888n8m009z2dg9atajjp7w",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nbl00ak2dg9kne99m0j",
    "name": "도서구입비",
    "subcategoryId": "cmk888nbe00aj2dg9zpvddd8l",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ms3006h2dg9s13xzvlv",
    "name": "심방교제비",
    "subcategoryId": "cmk888mrd006c2dg9j7cx8kpp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyt83003tcam9oxl633re",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888lyt000c2dg9uxhhaeb1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nda00ax2dg9djvyuzpr",
    "name": "사무_통신비",
    "subcategoryId": "cmk888nd300aw2dg9fvjxzw2b",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyrsr0037cam96hm05si2",
    "name": "아웃팅비",
    "subcategoryId": "cmncwyr6g0031cam99sr8p84a",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx01si00i5cam9tp9153yi",
    "name": "기타",
    "subcategoryId": "cmk888ng100bj2dg92kx6gia4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nn600d22dg9nc484j0e",
    "name": "자녀학비보조비",
    "subcategoryId": "cmk888nmz00d12dg9l1mhucoo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nm700cu2dg9ofrm2q1w",
    "name": "파트사역자생활비",
    "subcategoryId": "cmk888nlz00ct2dg9mayexy2p",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nmp00cy2dg98n6r3h3o",
    "name": "교역자_복리후생비",
    "subcategoryId": "cmk888nmh00cx2dg9kzry8hr6",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888no700da2dg9whylry9k",
    "name": "교역자식대",
    "subcategoryId": "cmk888no000d92dg99vhpkmku",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nlp00cq2dg9gv8x6nl0",
    "name": "준전임사역자생활비",
    "subcategoryId": "cmk888nli00cp2dg921lkihnp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nk300cf2dg9hlvzg88r",
    "name": "임차보증금(상환)적립금",
    "subcategoryId": "cmk888njv00ce2dg9pbw89etj",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nl700cm2dg9rld6xis9",
    "name": "담임목사생활비",
    "subcategoryId": "cmk888nl000cl2dg9gu7dy07f",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nno00d62dg9tkox85og",
    "name": "학자금지원비",
    "subcategoryId": "cmk888nnh00d52dg9ltyajjur",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyrlo0033cam9quwirzjl",
    "name": "행사비(전교인행사)",
    "subcategoryId": "cmncwyr6g0031cam99sr8p84a",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nqw00dv2dg906gaa8z7",
    "name": "퇴직적립금",
    "subcategoryId": "cmk888nqp00du2dg9yremkfyh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888neb00b52dg93lviztow",
    "name": "운영위원회 회의비",
    "subcategoryId": "cmk888ne400b42dg97g6c1kwa",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyufc0046cam9t647nnbr",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888ne400b42dg97g6c1kwa",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nqf00dr2dg9jiflgip2",
    "name": "사무간사식대",
    "subcategoryId": "cmk888nq700dq2dg9y4qbsop1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ng800bk2dg9kkzrt575",
    "name": "세무사사무실 수수료",
    "subcategoryId": "cmk888ng100bj2dg92kx6gia4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888npx00dn2dg9ixmnoy3b",
    "name": "사무_복리후생비",
    "subcategoryId": "cmk888npq00dm2dg9gatibhyz",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ngj00bn2dg9g5r3arkh",
    "name": "교회음악 저작권 연회비",
    "subcategoryId": "cmk888ng100bj2dg92kx6gia4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nfq00bg2dg92zvtcla3",
    "name": "여비교통비",
    "subcategoryId": "cmk888nfi00bf2dg9eh4xwup8",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwywh0004vcam99f92xlm3",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888m09000m2dg90obssenw",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nh500bt2dg9tqefyek0",
    "name": "소프트웨어",
    "subcategoryId": "cmk888ng100bj2dg92kx6gia4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx035j00iicam9lq0npj25",
    "name": "동부시찰회 회비",
    "subcategoryId": "cmk888ni600c12dg91s25b2y2",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nen00b82dg9fptibgaz",
    "name": "재정팀 회의비",
    "subcategoryId": "cmk888ne400b42dg97g6c1kwa",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyxu10058cam9uaqo8ssd",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888m2i00122dg9w9pveqrs",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nf600bc2dg9agwvp3tq",
    "name": "인쇄비",
    "subcategoryId": "cmk888nez00bb2dg9ythrc9np",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyvyj004ncam9qw4c5wdn",
    "name": "운영비(소모임)",
    "subcategoryId": "cmk888m09000m2dg90obssenw",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mhi003z2dg9ljdpfi92",
    "name": "행사비(기타)",
    "subcategoryId": "cmk888mgh003r2dg9iuzo5cv1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nje00ca2dg9ho2h0qw6",
    "name": "예비비",
    "subcategoryId": "cmk888nj600c92dg9ky208e38",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx09qi00k6cam9qc5nj5ba",
    "name": "사택관리비",
    "subcategoryId": "cmk888noi00dd2dg9wzt8g0wj",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx052j00iycam9z4nrgvjo",
    "name": "방송시설적립금",
    "subcategoryId": "cmncx04qb00iwcam948mogoh6",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mbh002u2dg967s1nsmf",
    "name": "아웃팅비_예배지원팀",
    "subcategoryId": "cmk888maq002p2dg9x65tglhu",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nc400ao2dg93hmdv8di",
    "name": "교육지원비",
    "subcategoryId": "cmk888nbw00an2dg95jo92rwx",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ncm00as2dg99ip3n05g",
    "name": "차량관리비",
    "subcategoryId": "cmk888ncf00ar2dg9dzle78mi",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ngv00bq2dg9j9lpqx0y",
    "name": "구독료(유튜브)",
    "subcategoryId": "cmk888ng100bj2dg92kx6gia4",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyvm8004hcam9rv6qaq8b",
    "name": "운영비",
    "subcategoryId": "cmk888m09000m2dg90obssenw",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwysvq003ncam94n1ts460",
    "name": "사용료(구독료)",
    "subcategoryId": "cmk888lyt000c2dg9uxhhaeb1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nrx00e32dg933bfrfr3",
    "name": "적립금_해지(재가입)",
    "subcategoryId": "cmk888nrf00dz2dg9iqtlnt13",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nhn00bx2dg9lfnxtyna",
    "name": "잡지출",
    "subcategoryId": "cmk888nhg00bw2dg9qq8tjilo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyspg003jcam9swxpgilz",
    "name": "인쇄비",
    "subcategoryId": "cmk888lyt000c2dg9uxhhaeb1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nio00c52dg9sta2rirv",
    "name": "서울남부노회 동부시찰회 회비",
    "subcategoryId": "cmk888ni600c12dg91s25b2y2",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nop00de2dg9cscal610",
    "name": "전세자금대출이자",
    "subcategoryId": "cmk888noi00dd2dg9wzt8g0wj",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888ndt00b12dg9q0q9xnqm",
    "name": "소모품및사무용품비",
    "subcategoryId": "cmk888ndl00b02dg910exp13d",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m8s002c2dg9cp7bacuw",
    "name": "아웃팅비_찬양팀",
    "subcategoryId": "cmk888m7r00242dg9lqov0vq3",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzxr100gzcam9aqrozss2",
    "name": "목회_회의 및 접대비",
    "subcategoryId": "cmk888nav00af2dg9zwd1nk11",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzzqj00hjcam9ffj1izqt",
    "name": "식대_운영위원회",
    "subcategoryId": "cmk888ne400b42dg97g6c1kwa",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyu940042cam9bio453rp",
    "name": "아웃팅비_재정팀",
    "subcategoryId": "cmk888ne400b42dg97g6c1kwa",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nid00c22dg9qpbxml7c",
    "name": "상회부담금",
    "subcategoryId": "cmk888ni600c12dg91s25b2y2",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888npf00dj2dg98rlvh4u2",
    "name": "사무간사급여",
    "subcategoryId": "cmk888np800di2dg9p4oqbn3l",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888nrm00e02dg9gai2yn93",
    "name": "퇴직연금 지급",
    "subcategoryId": "cmk888nrf00dz2dg9iqtlnt13",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyryy003bcam94dkhunc6",
    "name": "(예산외세목)",
    "subcategoryId": "cmncwyr6g0031cam99sr8p84a",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz8h2008rcam9cte3xep6",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888mfd003k2dg9vv6hzmzl",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzn9v00dscam9409q8k2d",
    "name": "소모품비",
    "subcategoryId": "cmk888n0400832dg9ytb693dh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz5kv007vcam9ol13vl44",
    "name": "소모품비",
    "subcategoryId": "cmncwz52h007pcam9yodov2g0",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz41s007ecam9egvsxnq8",
    "name": "행사비(선물)_예배지원팀",
    "subcategoryId": "cmk888maq002p2dg9x65tglhu",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwztnf00fwcam95qtwx974",
    "name": "도서구입비",
    "subcategoryId": "cmncwztba00fucam9iivn3s9w",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz3vl007acam945yzua70",
    "name": "소모품비_예배지원팀",
    "subcategoryId": "cmk888maq002p2dg9x65tglhu",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwza0a0096cam9hc6on4gm",
    "name": "소모품비",
    "subcategoryId": "cmk888mgh003r2dg9iuzo5cv1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz8ax008ncam99odrncyw",
    "name": "아웃팅비",
    "subcategoryId": "cmk888mfd003k2dg9vv6hzmzl",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzacl009ccam9wzizi9qz",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888mgh003r2dg9iuzo5cv1",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzbjj009ncam9laq0fg0d",
    "name": "교육비(교재제작비)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz3fd0074cam9j0xttko6",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888maq002p2dg9x65tglhu",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz7eb008dcam95idy75eq",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888me3003b2dg9utdpdtv5",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzc8d009zcam98wi5pcqo",
    "name": "행사비(전도학교)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzloo00dacam9kyd7taoh",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888mxk007i2dg9z0lnepbq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzceh00a3cam94xr5i3mc",
    "name": "행사비(스몰토크)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzckn00a7cam9608io9lb",
    "name": "행사비(목자교육)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzdsm00arcam93j8y2zdw",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzskj00ficam96fyoz3tt",
    "name": "담임목사 이사비용",
    "subcategoryId": "cmk888noi00dd2dg9wzt8g0wj",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888mpb005t2dg9u24m5eep",
    "name": "심방교제비",
    "subcategoryId": "cmk888mol005o2dg9wwqk80wm",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzc24009vcam9dj0o14ca",
    "name": "행사비(상담학교)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyz30005ocam9i4uz6kya",
    "name": "선교비(정기후원)",
    "subcategoryId": "cmk888m3v001b2dg9l7gpessx",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzsqu00fmcam90seh92ai",
    "name": "전임사역자 사택관리비",
    "subcategoryId": "cmk888noi00dd2dg9wzt8g0wj",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyzfc005ucam9dikn1txf",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888m3v001b2dg9l7gpessx",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzsef00fecam9izcxeg4z",
    "name": "담임목사 전세자금대출이자",
    "subcategoryId": "cmk888noi00dd2dg9wzt8g0wj",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz265006ocam95fl6jein",
    "name": "비품비",
    "subcategoryId": "cmk888m9a002g2dg9qnox5bwg",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz0qv0064cam9pz5h1z0d",
    "name": "소모품비",
    "subcategoryId": "cmk888m7r00242dg9lqov0vq3",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzhmn00bwcam9m1fgpqkq",
    "name": "소모품비",
    "subcategoryId": "cmk888mrd006c2dg9j7cx8kpp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzp1c00eecam9qq2e48t9",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888n2f008n2dg9u2zz21c5",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzqav00escam9t14bxjip",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888n4a00922dg9i7gtqnfs",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzvgx00gecam9mi4djqhb",
    "name": "고장 전자제품 교체",
    "subcategoryId": "cmk888n84009v2dg9087icy85",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz5r5007zcam91svf3brn",
    "name": "(예산외세목)",
    "subcategoryId": "cmncwz52h007pcam9yodov2g0",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz19i006ccam99zrhb1s9",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888m7r00242dg9lqov0vq3",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz5em007rcam9il9ogot5",
    "name": "아웃팅비",
    "subcategoryId": "cmncwz52h007pcam9yodov2g0",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzg0w00becam9hywsergz",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888mol005o2dg9wwqk80wm",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888msq006n2dg9kzfpq45g",
    "name": "행사비(선물)",
    "subcategoryId": "cmk888mrd006c2dg9j7cx8kpp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwznm600dycam94jzrrz9k",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888n0400832dg9ytb693dh",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzlce00d4cam9h43j4rtk",
    "name": "소모품비",
    "subcategoryId": "cmk888mxk007i2dg9z0lnepbq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzcwz00adcam93frf3132",
    "name": "행사비(신입집사교육)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzjqz00cmcam9xjbxckez",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888mur006x2dg9ja99nhxq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz1zz006kcam9m35nstjr",
    "name": "소모품비",
    "subcategoryId": "cmk888m9a002g2dg9qnox5bwg",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwz2ik006ucam9wu4ltxuq",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888m9a002g2dg9qnox5bwg",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzhz000c2cam9u6ijddx7",
    "name": "(예산외세목)",
    "subcategoryId": "cmk888mrd006c2dg9j7cx8kpp",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwzdg700alcam9vk8c2ter",
    "name": "행사비(위원회)",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncx07ax00jicam94gwcy95u",
    "name": "전임사역자생활비",
    "subcategoryId": "cmncx06yj00jgcam98ousbtm7",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888myb007n2dg9brlqj34c",
    "name": "심방교제비",
    "subcategoryId": "cmk888mxk007i2dg9z0lnepbq",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmk888m0h000n2dg9jmqish1v",
    "name": "행사비(공간사역)",
    "subcategoryId": "cmk888m09000m2dg90obssenw",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmncwyywr005kcam9fjivu81t",
    "name": "교육교제비",
    "subcategoryId": "cmk888m3v001b2dg9l7gpessx",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmnmhbecs00aacax4nnloli36",
    "name": "아웃팅비",
    "subcategoryId": "cmk888m7r00242dg9lqov0vq3",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "id": "cmldfn2v0001h27fxlw0ewh3m",
    "name": "예산외지출",
    "subcategoryId": "cmk888m3v001b2dg9l7gpessx",
    "sortOrder": 1,
    "isActive": true
  },
  {
    "id": "cmnvffjas004vgs1qs0uw2kui",
    "name": "아웃팅비_기도팀",
    "subcategoryId": "cmk888mii00472dg9c8oaghjo",
    "sortOrder": 1,
    "isActive": true
  },
  {
    "id": "cmoefkkk9004tln28o6f0hujf",
    "name": "적립금_사용(410호)",
    "subcategoryId": "cmk888nrf00dz2dg9iqtlnt13",
    "sortOrder": 1,
    "isActive": true
  },
  {
    "id": "cmnmzrz080001cab2x5pzvtb5",
    "name": "차량관리비_인사위",
    "subcategoryId": "cmk888ncf00ar2dg9dzle78mi",
    "sortOrder": 1,
    "isActive": true
  },
  {
    "id": "cmnmzmosk0001ca5ms7co09hd",
    "name": "(예산외세목)_안내팀",
    "subcategoryId": "cmk888maq002p2dg9x65tglhu",
    "sortOrder": 1,
    "isActive": true
  }
];

// DepartmentBudgetDetail (195개)
const departmentBudgetDetails = [
  {
    "id": "cmk888m51001k2dg9y49yayia",
    "departmentId": "cmk888m3n001a2dg976fi0d9z",
    "budgetDetailId": "cmk888m4y001j2dg9e42lne81"
  },
  {
    "id": "cmk888m5c001n2dg956o6ds1j",
    "departmentId": "cmk888m3n001a2dg976fi0d9z",
    "budgetDetailId": "cmk888m59001m2dg97hfk671q"
  },
  {
    "id": "cmk888mex003h2dg9acua8zyg",
    "departmentId": "cmk888mdp00392dg9wpj2212f",
    "budgetDetailId": "cmk888meu003g2dg9lwzgn2l3"
  },
  {
    "id": "cmk888mgr003t2dg96tju5zu9",
    "departmentId": "cmk888mg3003p2dg9kx89walb",
    "budgetDetailId": "cmk888mgo003s2dg97po0utag"
  },
  {
    "id": "cmk888mpe005u2dg99nlcta6b",
    "departmentId": "cmk888moe005n2dg9ic9j42rw",
    "budgetDetailId": "cmk888mpb005t2dg9u24m5eep"
  },
  {
    "id": "cmk888mha003x2dg98o37rnz9",
    "departmentId": "cmk888mg3003p2dg9kx89walb",
    "budgetDetailId": "cmk888mh7003w2dg9sykl0r4b"
  },
  {
    "id": "cmk888mfn003m2dg9zkvtedbb",
    "departmentId": "cmk888mf6003j2dg9iqa8sfcq",
    "budgetDetailId": "cmk888mfk003l2dg9bp82hgyn"
  },
  {
    "id": "cmk888m9r002i2dg9rewv2a4c",
    "departmentId": "cmk888m93002f2dg9zdvl63ts",
    "budgetDetailId": "cmk888m9o002h2dg9keoula27"
  },
  {
    "id": "cmk888m4q001h2dg9f04sey3v",
    "departmentId": "cmk888m3n001a2dg976fi0d9z",
    "budgetDetailId": "cmk888m4n001g2dg9d2jnw4qk"
  },
  {
    "id": "cmk888mis00492dg98ia1u6sm",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mip00482dg96svglb17"
  },
  {
    "id": "cmk888mhl00402dg9ho246mb4",
    "departmentId": "cmk888mg3003p2dg9kx89walb",
    "budgetDetailId": "cmk888mhi003z2dg9ljdpfi92"
  },
  {
    "id": "cmk888mlj004y2dg9sgfarhbw",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mlg004x2dg9ljusnvsq"
  },
  {
    "id": "cmk888mqx00692dg9u69coy5i",
    "departmentId": "cmk888moe005n2dg9ic9j42rw",
    "budgetDetailId": "cmk888mqv00682dg9wekhsk9n"
  },
  {
    "id": "cmk888mmh00572dg9qn8hmn7b",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mmf00562dg95ws97esu"
  },
  {
    "id": "cmk888mlu00512dg9c0rn5t3n",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mlr00502dg9ltfd0w1v"
  },
  {
    "id": "cmk888mhw00432dg9jmrskfdr",
    "departmentId": "cmk888mg3003p2dg9kx89walb",
    "budgetDetailId": "cmk888mht00422dg92xk0iz5o"
  },
  {
    "id": "cmk888mm600542dg97zn4425p",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mm300532dg9fwdot7dx"
  },
  {
    "id": "cmk888mkx004s2dg9e6kvobbf",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mku004r2dg92b5077r7"
  },
  {
    "id": "cmk888mqb00632dg9z5jsrgd8",
    "departmentId": "cmk888moe005n2dg9ic9j42rw",
    "budgetDetailId": "cmk888mq800622dg9fydpkz9o"
  },
  {
    "id": "cmk888mrn006e2dg922bztkzn",
    "departmentId": "cmk888mr5006b2dg96a76pxew",
    "budgetDetailId": "cmk888mrk006d2dg91xg32jzj"
  },
  {
    "id": "cmk888mnp005h2dg9w2a4j123",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mnm005g2dg96oqf2kk2"
  },
  {
    "id": "cmk888mq000602dg98l31fn7b",
    "departmentId": "cmk888moe005n2dg9ic9j42rw",
    "budgetDetailId": "cmk888mpx005z2dg9c06q3zxo"
  },
  {
    "id": "cmk888mpp005x2dg9il905aro",
    "departmentId": "cmk888moe005n2dg9ic9j42rw",
    "budgetDetailId": "cmk888mpm005w2dg9ldo81v9q"
  },
  {
    "id": "cmk888mqm00662dg98qoh54w4",
    "departmentId": "cmk888moe005n2dg9ic9j42rw",
    "budgetDetailId": "cmk888mqj00652dg956a12jig"
  },
  {
    "id": "cmk888ms6006i2dg963ngv885",
    "departmentId": "cmk888mr5006b2dg96a76pxew",
    "budgetDetailId": "cmk888ms3006h2dg9s13xzvlv"
  },
  {
    "id": "cmk888mvn00732dg9jzmrpuui",
    "departmentId": "cmk888muk006w2dg9ypf5tvfp",
    "budgetDetailId": "cmk888mvk00722dg9zvea9wp0"
  },
  {
    "id": "cmk888mvy00762dg96p6he609",
    "departmentId": "cmk888muk006w2dg9ypf5tvfp",
    "budgetDetailId": "cmk888mvv00752dg9x2f3rt5e"
  },
  {
    "id": "cmk888msu006o2dg96p9f0urh",
    "departmentId": "cmk888mr5006b2dg96a76pxew",
    "budgetDetailId": "cmk888msq006n2dg9kzfpq45g"
  },
  {
    "id": "cmk888mtf006r2dg90p5ayzgj",
    "departmentId": "cmk888mr5006b2dg96a76pxew",
    "budgetDetailId": "cmk888mtb006q2dg9d21s2pji"
  },
  {
    "id": "cmk888msh006l2dg93jask8zg",
    "departmentId": "cmk888mr5006b2dg96a76pxew",
    "budgetDetailId": "cmk888mse006k2dg952bdujb6"
  },
  {
    "id": "cmk888mub006u2dg9tyqsfeq3",
    "departmentId": "cmk888mr5006b2dg96a76pxew",
    "budgetDetailId": "cmk888mu7006t2dg9i5s4pn4t"
  },
  {
    "id": "cmk888mws007c2dg9qdrluwjc",
    "departmentId": "cmk888muk006w2dg9ypf5tvfp",
    "budgetDetailId": "cmk888mwo007b2dg9mw12jbs3"
  },
  {
    "id": "cmk888myp007r2dg9kyrc6t12",
    "departmentId": "cmk888mxd007h2dg96zjfkrxa",
    "budgetDetailId": "cmk888mym007q2dg9id5c66nj"
  },
  {
    "id": "cmk888m1u000y2dg9axc9y1by",
    "departmentId": "cmk888lzu000k2dg9mccj9rkf",
    "budgetDetailId": "cmk888m1s000x2dg9bm0ge5qb"
  },
  {
    "id": "cmk888mx4007f2dg9q9qdbwbw",
    "departmentId": "cmk888muk006w2dg9ypf5tvfp",
    "budgetDetailId": "cmk888mx1007e2dg9o34outfe"
  },
  {
    "id": "cmk888mxu007k2dg9vrn63vhv",
    "departmentId": "cmk888mxd007h2dg96zjfkrxa",
    "budgetDetailId": "cmk888mxr007j2dg9f25b6nt2"
  },
  {
    "id": "cmk888myd007o2dg96xki9uv5",
    "departmentId": "cmk888mxd007h2dg96zjfkrxa",
    "budgetDetailId": "cmk888myb007n2dg9brlqj34c"
  },
  {
    "id": "cmk888m1k000v2dg9nxp90oyk",
    "departmentId": "cmk888lzu000k2dg9mccj9rkf",
    "budgetDetailId": "cmk888m1h000u2dg9b7k8vvsn"
  },
  {
    "id": "cmk888mw900792dg9ix4b442y",
    "departmentId": "cmk888muk006w2dg9ypf5tvfp",
    "budgetDetailId": "cmk888mw600782dg905ejteey"
  },
  {
    "id": "cmk888lxy00082dg9rypgzgn9",
    "departmentId": "cmk888lx500042dg9z5mt91z8",
    "budgetDetailId": "cmk888lxv00072dg9maye7e9a"
  },
  {
    "id": "cmk888m16000s2dg9zc4upye1",
    "departmentId": "cmk888lzu000k2dg9mccj9rkf",
    "budgetDetailId": "cmk888m13000r2dg9p328rjxu"
  },
  {
    "id": "cmk888m2u00142dg9d5ms9wxj",
    "departmentId": "cmk888m2200102dg980vk9fmy",
    "budgetDetailId": "cmk888m2r00132dg9axvcstrr"
  },
  {
    "id": "cmk888m3e00182dg929i3abol",
    "departmentId": "cmk888m2200102dg980vk9fmy",
    "budgetDetailId": "cmk888m3b00172dg934kbomnj"
  },
  {
    "id": "cmk888m46001d2dg9jn7ofc1q",
    "departmentId": "cmk888m3n001a2dg976fi0d9z",
    "budgetDetailId": "cmk888m43001c2dg9rkiszwqd"
  },
  {
    "id": "cmk888mb1002r2dg98psxeh7e",
    "departmentId": "cmk888mai002o2dg9em4twbaj",
    "budgetDetailId": "cmk888may002q2dg9kb6gmfn0"
  },
  {
    "id": "cmk888m8k002a2dg9c39v4u4w",
    "departmentId": "cmk888m7d00222dg9odzebl67",
    "budgetDetailId": "cmk888m8h00292dg92j19ymqo"
  },
  {
    "id": "cmk888lzl000i2dg944uyqju8",
    "departmentId": "cmk888lyl000b2dg9chruks28",
    "budgetDetailId": "cmk888lzj000h2dg96o1spyng"
  },
  {
    "id": "cmk888m0k000o2dg9o57kdyt9",
    "departmentId": "cmk888lzu000k2dg9mccj9rkf",
    "budgetDetailId": "cmk888m0h000n2dg9jmqish1v"
  },
  {
    "id": "cmk888m64001s2dg9uizfp4bw",
    "departmentId": "cmk888m5l001p2dg9nnfh93c1",
    "budgetDetailId": "cmk888m61001r2dg92z3px1ko"
  },
  {
    "id": "cmk888m6m001w2dg9y68zqjdo",
    "departmentId": "cmk888m5l001p2dg9nnfh93c1",
    "budgetDetailId": "cmk888m6k001v2dg9jyqwo3so"
  },
  {
    "id": "cmk888m6y001z2dg9qkoicu2g",
    "departmentId": "cmk888m5l001p2dg9nnfh93c1",
    "budgetDetailId": "cmk888m6v001y2dg9jau9d9xm"
  },
  {
    "id": "cmk888m8200262dg96m9car3c",
    "departmentId": "cmk888m7d00222dg9odzebl67",
    "budgetDetailId": "cmk888m7z00252dg9u3331aky"
  },
  {
    "id": "cmk888m8v002d2dg9mnw5sf68",
    "departmentId": "cmk888m7d00222dg9odzebl67",
    "budgetDetailId": "cmk888m8s002c2dg9cp7bacuw"
  },
  {
    "id": "cmk888maa002m2dg9r235vu6i",
    "departmentId": "cmk888m93002f2dg9zdvl63ts",
    "budgetDetailId": "cmk888ma7002l2dg9j9qhsbbn"
  },
  {
    "id": "cmk888mbk002v2dg94cbktpw0",
    "departmentId": "cmk888mai002o2dg9em4twbaj",
    "budgetDetailId": "cmk888mbh002u2dg967s1nsmf"
  },
  {
    "id": "cmk888mee003d2dg9edpfv9ke",
    "departmentId": "cmk888mdp00392dg9wpj2212f",
    "budgetDetailId": "cmk888meb003c2dg9eqjy9c3y"
  },
  {
    "id": "cmk888mjb004d2dg9encsa584",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mj8004c2dg9di8znom0"
  },
  {
    "id": "cmk888mjn004g2dg9fjkunmik",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mjl004f2dg9xhfw3aix"
  },
  {
    "id": "cmk888mjz004j2dg9f7skj31d",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mjx004i2dg9tmk42szu"
  },
  {
    "id": "cmk888mka004m2dg9qvjb24hv",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mk7004l2dg94d646uv4"
  },
  {
    "id": "cmk888mkl004p2dg95lsijsgs",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mki004o2dg98hrsvyk5"
  },
  {
    "id": "cmk888ml8004v2dg9f99ttut2",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888ml5004u2dg9czmzxfr0"
  },
  {
    "id": "cmk888mn1005b2dg9ehdax0b5",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mmy005a2dg9fiftow4h"
  },
  {
    "id": "cmk888mnd005e2dg93ma8hhot",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mn9005d2dg9ruh24tga"
  },
  {
    "id": "cmk888mo0005k2dg99fn1vp1h",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmk888mnx005j2dg91ifbmzuw"
  },
  {
    "id": "cmk888n3u008z2dg9l53clgii",
    "departmentId": "cmk888n27008m2dg9f0o1pbsy",
    "budgetDetailId": "cmk888n3r008y2dg94gd87ymb"
  },
  {
    "id": "cmk888n6w009l2dg9t3lhler2",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888n6t009k2dg97lmphlci"
  },
  {
    "id": "cmk888n38008t2dg93o3xwltn",
    "departmentId": "cmk888n27008m2dg9f0o1pbsy",
    "budgetDetailId": "cmk888n35008s2dg99ko3niof"
  },
  {
    "id": "cmk888n4y00972dg95c63yiyu",
    "departmentId": "cmk888n4300912dg9peipojq8",
    "budgetDetailId": "cmk888n4v00962dg94jyhwq87"
  },
  {
    "id": "cmk888n59009a2dg9q7j0sfiv",
    "departmentId": "cmk888n4300912dg9peipojq8",
    "budgetDetailId": "cmk888n5600992dg9bpwwtghh"
  },
  {
    "id": "cmk888n65009g2dg9r171vij5",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888n63009f2dg9fttezph3"
  },
  {
    "id": "cmk888n9600a42dg9a2jtv70e",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888n9300a32dg907yg0gq5"
  },
  {
    "id": "cmk888n8e009x2dg9xde9h71u",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888n8b009w2dg9ponj4dq0"
  },
  {
    "id": "cmk888n9o00a82dg99wyw81z6",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888n9l00a72dg9kcezf0qo"
  },
  {
    "id": "cmk888n7w009t2dg9aiujrs2p",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888n7t009s2dg9k10cocjb"
  },
  {
    "id": "cmk888nam00ad2dg9hgjixy0b",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888naa00ac2dg9ye9o5hyi"
  },
  {
    "id": "cmk888n3j008w2dg94hngicxz",
    "departmentId": "cmk888n27008m2dg9f0o1pbsy",
    "budgetDetailId": "cmk888n3g008v2dg90vdjd1gg"
  },
  {
    "id": "cmk888nos00df2dg9bxfzend5",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nop00de2dg9cscal610"
  },
  {
    "id": "cmk888ndd00ay2dg9cx9z54bi",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nda00ax2dg9djvyuzpr"
  },
  {
    "id": "cmk888ndv00b22dg9r7ypw7dd",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888ndt00b12dg9q0q9xnqm"
  },
  {
    "id": "cmk888nb500ah2dg9r7hwduo4",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nb300ag2dg9xt7bij80"
  },
  {
    "id": "cmk888nft00bh2dg9j9tov6v0",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nfq00bg2dg92zvtcla3"
  },
  {
    "id": "cmk888ngy00br2dg9g9x1kxqd",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888ngv00bq2dg9j9lpqx0y"
  },
  {
    "id": "cmk888nee00b62dg9bad6c4lj",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888neb00b52dg93lviztow"
  },
  {
    "id": "cmk888nh800bu2dg9dufrvihw",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nh500bt2dg9tqefyek0"
  },
  {
    "id": "cmk888ngn00bo2dg9l3blopdt",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888ngj00bn2dg9g5r3arkh"
  },
  {
    "id": "cmk888nhq00by2dg9s2eo6btj",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nhn00bx2dg9lfnxtyna"
  },
  {
    "id": "cmk888nig00c32dg9eda86nnu",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nid00c22dg9qpbxml7c"
  },
  {
    "id": "cmk888nk600cg2dg925umt48b",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nk300cf2dg9hlvzg88r"
  },
  {
    "id": "cmk888nnr00d72dg97cpzmdc1",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nno00d62dg9tkox85og"
  },
  {
    "id": "cmk888nis00c62dg90j8bg8os",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nio00c52dg9sta2rirv"
  },
  {
    "id": "cmk888nms00cz2dg94p0fpta7",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nmp00cy2dg98n6r3h3o"
  },
  {
    "id": "cmk888nla00cn2dg9cztadygk",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nl700cm2dg9rld6xis9"
  },
  {
    "id": "cmk888noa00db2dg9mrpubelj",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888no700da2dg9whylry9k"
  },
  {
    "id": "cmk888nma00cv2dg9hv992g9p",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nm700cu2dg9ofrm2q1w"
  },
  {
    "id": "cmk888nls00cr2dg951d6yo1f",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nlp00cq2dg9gv8x6nl0"
  },
  {
    "id": "cmk888ncp00at2dg9spadk0ck",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888ncm00as2dg99ip3n05g"
  },
  {
    "id": "cmk888nq000do2dg9pdmkp8w9",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888npx00dn2dg9ixmnoy3b"
  },
  {
    "id": "cmk888n7e009p2dg9k3uv1p7y",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888n7b009o2dg98i1f9q46"
  },
  {
    "id": "cmk888nqz00dw2dg9fj43zx5c",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nqw00dv2dg906gaa8z7"
  },
  {
    "id": "cmk888nrp00e12dg9jjysjth3",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nrm00e02dg9gai2yn93"
  },
  {
    "id": "cmncwyrut0039cam9i0vhp7zb",
    "departmentId": "cmncwyqlp002ycam9howty56z",
    "budgetDetailId": "cmncwyrsr0037cam96hm05si2"
  },
  {
    "id": "cmncwys10003dcam97p9a0xnt",
    "departmentId": "cmncwyqlp002ycam9howty56z",
    "budgetDetailId": "cmncwyryy003bcam94dkhunc6"
  },
  {
    "id": "cmncwysxt003pcam9bjbky0e8",
    "departmentId": "cmk888lyl000b2dg9chruks28",
    "budgetDetailId": "cmncwysvq003ncam94n1ts460"
  },
  {
    "id": "cmk888nqh00ds2dg9axktq2cy",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nqf00dr2dg9jiflgip2"
  },
  {
    "id": "cmncwyta6003vcam9l6nzn62y",
    "departmentId": "cmk888lyl000b2dg9chruks28",
    "budgetDetailId": "cmncwyt83003tcam9oxl633re"
  },
  {
    "id": "cmncwysrk003lcam9aig1q1ef",
    "departmentId": "cmk888lyl000b2dg9chruks28",
    "budgetDetailId": "cmncwyspg003jcam9swxpgilz"
  },
  {
    "id": "cmk888ngb00bl2dg9jtt14jlc",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888ng800bk2dg9kkzrt575"
  },
  {
    "id": "cmk888lz3000e2dg9sya43528",
    "departmentId": "cmk888lyl000b2dg9chruks28",
    "budgetDetailId": "cmk888lz0000d2dg9zh63l9tg"
  },
  {
    "id": "cmk888n1n008h2dg999egkqvn",
    "departmentId": "cmk888mzw00822dg9eaj0qsuj",
    "budgetDetailId": "cmk888n1k008g2dg904ysvlkt"
  },
  {
    "id": "cmncwyuhf0048cam9fanas7gw",
    "departmentId": "cmk9cl0bj000z2fif5j2fn1v1",
    "budgetDetailId": "cmncwyufc0046cam9t647nnbr"
  },
  {
    "id": "cmncwyro30035cam963edy17c",
    "departmentId": "cmncwyqlp002ycam9howty56z",
    "budgetDetailId": "cmncwyrlo0033cam9quwirzjl"
  },
  {
    "id": "cmncwyvo9004jcam9q21nauu5",
    "departmentId": "cmk888lzu000k2dg9mccj9rkf",
    "budgetDetailId": "cmncwyvm8004hcam9rv6qaq8b"
  },
  {
    "id": "cmk888n0p00882dg9ix3px9ox",
    "departmentId": "cmk888mzw00822dg9eaj0qsuj",
    "budgetDetailId": "cmk888n0m00872dg9o55bgb12"
  },
  {
    "id": "cmk888mzo00802dg9ix9k5y91",
    "departmentId": "cmk888mxd007h2dg96zjfkrxa",
    "budgetDetailId": "cmk888mzl007z2dg9n7t8iy20"
  },
  {
    "id": "cmk888n0e00852dg95z1uhqa2",
    "departmentId": "cmk888mzw00822dg9eaj0qsuj",
    "budgetDetailId": "cmk888n0b00842dg9jpqc2lv6"
  },
  {
    "id": "cmk888n11008b2dg9km0zrp5x",
    "departmentId": "cmk888mzw00822dg9eaj0qsuj",
    "budgetDetailId": "cmk888n0y008a2dg9l0dqo9gr"
  },
  {
    "id": "cmk888n1c008e2dg9maby3zsv",
    "departmentId": "cmk888mzw00822dg9eaj0qsuj",
    "budgetDetailId": "cmk888n19008d2dg9vv68ss50"
  },
  {
    "id": "cmldfn2ve001j27fxk5188192",
    "departmentId": "cmk888m3n001a2dg976fi0d9z",
    "budgetDetailId": "cmldfn2v0001h27fxlw0ewh3m"
  },
  {
    "id": "cmk888n1z008k2dg9lmunumd9",
    "departmentId": "cmk888mzw00822dg9eaj0qsuj",
    "budgetDetailId": "cmk888n1w008j2dg95hw7e48u"
  },
  {
    "id": "cmk888n2p008p2dg9lzexqbcc",
    "departmentId": "cmk888n27008m2dg9f0o1pbsy",
    "budgetDetailId": "cmk888n2m008o2dg9dw774qza"
  },
  {
    "id": "cmk888mzc007x2dg9y1snrtk6",
    "departmentId": "cmk888mxd007h2dg96zjfkrxa",
    "budgetDetailId": "cmk888mz9007w2dg96zncztn4"
  },
  {
    "id": "cmk888n8w00a12dg9vquoky59",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888n8t00a02dg9pvdtk3hu"
  },
  {
    "id": "cmk888nbo00al2dg98fqjtw4i",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nbl00ak2dg9kne99m0j"
  },
  {
    "id": "cmk888nc600ap2dg932b8v202",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nc400ao2dg93hmdv8di"
  },
  {
    "id": "cmk888neq00b92dg97imdpci3",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nen00b82dg9fptibgaz"
  },
  {
    "id": "cmk888nf900bd2dg94d0rrxro",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nf600bc2dg9agwvp3tq"
  },
  {
    "id": "cmk888njh00cb2dg95c80m0sk",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmk888nje00ca2dg9ho2h0qw6"
  },
  {
    "id": "cmk888npi00dk2dg9hz3y4mgh",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888npf00dj2dg98rlvh4u2"
  },
  {
    "id": "cmk888ns000e42dg99afd1p5j",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nrx00e32dg933bfrfr3"
  },
  {
    "id": "cmncwyub70044cam90i1fq2qp",
    "departmentId": "cmk9cl0bj000z2fif5j2fn1v1",
    "budgetDetailId": "cmncwyu940042cam9bio453rp"
  },
  {
    "id": "cmncwz220006mcam9sjtsp77e",
    "departmentId": "cmk888m93002f2dg9zdvl63ts",
    "budgetDetailId": "cmncwz1zz006kcam9m35nstjr"
  },
  {
    "id": "cmnmzmosk0003ca5m8twiinmo",
    "departmentId": "cmk888mbt002x2dg9j50n1rdl",
    "budgetDetailId": "cmnmzmosk0001ca5ms7co09hd"
  },
  {
    "id": "cmncwz4g7007kcam9opvubdup",
    "departmentId": "cmk888mai002o2dg9em4twbaj",
    "budgetDetailId": "cmncwz3fd0074cam9j0xttko6"
  },
  {
    "id": "cmncwzcz100afcam9q6uq2p1u",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmncwzcwz00adcam93frf3132"
  },
  {
    "id": "cmncwz2ko006wcam9hconr7sy",
    "departmentId": "cmk888m93002f2dg9zdvl63ts",
    "budgetDetailId": "cmncwz2ik006ucam9wu4ltxuq"
  },
  {
    "id": "cmncwz1bl006ecam9scr1b7i7",
    "departmentId": "cmk888m7d00222dg9odzebl67",
    "budgetDetailId": "cmncwz19i006ccam99zrhb1s9"
  },
  {
    "id": "cmncwz43v007gcam904jfuz85",
    "departmentId": "cmk888mai002o2dg9em4twbaj",
    "budgetDetailId": "cmncwz41s007ecam9egvsxnq8"
  },
  {
    "id": "cmncwz8cz008pcam9qe1ly9f9",
    "departmentId": "cmk888mf6003j2dg9iqa8sfcq",
    "budgetDetailId": "cmncwz8ax008ncam99odrncyw"
  },
  {
    "id": "cmncwz3xm007ccam9j0x8foxr",
    "departmentId": "cmk888mai002o2dg9em4twbaj",
    "budgetDetailId": "cmncwz3vl007acam945yzua70"
  },
  {
    "id": "cmncwz5n0007xcam9f8s4ixma",
    "departmentId": "cmk888mcj00322dg9mvmdl57l",
    "budgetDetailId": "cmncwz5kv007vcam9ol13vl44"
  },
  {
    "id": "cmncwzaen009ecam9f4degzmt",
    "departmentId": "cmk888mg3003p2dg9kx89walb",
    "budgetDetailId": "cmncwzacl009ccam9wzizi9qz"
  },
  {
    "id": "cmncwz7ge008fcam9dwares3a",
    "departmentId": "cmk888mdp00392dg9wpj2212f",
    "budgetDetailId": "cmncwz7eb008dcam95idy75eq"
  },
  {
    "id": "cmncwza2f0098cam9iuk66bqv",
    "departmentId": "cmk888mg3003p2dg9kx89walb",
    "budgetDetailId": "cmncwza0a0096cam9hc6on4gm"
  },
  {
    "id": "cmk888mc3002z2dg9lz4g82wk",
    "departmentId": "cmk888mbt002x2dg9j50n1rdl",
    "budgetDetailId": "cmk888mc0002y2dg9epgzr8kh"
  },
  {
    "id": "cmncwz8j4008tcam9ssrr4oin",
    "departmentId": "cmk888mf6003j2dg9iqa8sfcq",
    "budgetDetailId": "cmncwz8h2008rcam9cte3xep6"
  },
  {
    "id": "cmncwz5t70081cam99mmlqxdd",
    "departmentId": "cmk888mcj00322dg9mvmdl57l",
    "budgetDetailId": "cmncwz5r5007zcam91svf3brn"
  },
  {
    "id": "cmncwzblm009pcam920iiu1im",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmncwzbjj009ncam9laq0fg0d"
  },
  {
    "id": "cmncwzc48009xcam9myqb5g9x",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmncwzc24009vcam9dj0o14ca"
  },
  {
    "id": "cmncwzlqr00dccam989hcyx90",
    "departmentId": "cmk888mxd007h2dg96zjfkrxa",
    "budgetDetailId": "cmncwzloo00dacam9kyd7taoh"
  },
  {
    "id": "cmncwzcgj00a5cam95mvl717t",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmncwzceh00a3cam94xr5i3mc"
  },
  {
    "id": "cmncwzcmo00a9cam9y4hv0ri6",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmncwzckn00a7cam9608io9lb"
  },
  {
    "id": "cmncwzcaf00a1cam9zi1x0u4j",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmncwzc8d009zcam98wi5pcqo"
  },
  {
    "id": "cmncwzdia00ancam9x1qs9bla",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmncwzdg700alcam9vk8c2ter"
  },
  {
    "id": "cmncwzjt100cocam9nlh2rzrz",
    "departmentId": "cmk888muk006w2dg9ypf5tvfp",
    "budgetDetailId": "cmncwzjqz00cmcam9xjbxckez"
  },
  {
    "id": "cmk888mv2006z2dg9gt7qi7cu",
    "departmentId": "cmk888muk006w2dg9ypf5tvfp",
    "budgetDetailId": "cmk888muz006y2dg9esntgf8j"
  },
  {
    "id": "cmncwzdun00atcam960sjhw9m",
    "departmentId": "cmk888mi400452dg9tihbe4ap",
    "budgetDetailId": "cmncwzdsm00arcam93j8y2zdw"
  },
  {
    "id": "cmk888mz0007u2dg98hqynjl6",
    "departmentId": "cmk888mxd007h2dg96zjfkrxa",
    "budgetDetailId": "cmk888myy007t2dg91i3j2koy"
  },
  {
    "id": "cmncwzhoq00bycam9mw1nqeqt",
    "departmentId": "cmk888mr5006b2dg96a76pxew",
    "budgetDetailId": "cmncwzhmn00bwcam9m1fgpqkq"
  },
  {
    "id": "cmncwzleh00d6cam9r936bazu",
    "departmentId": "cmk888mxd007h2dg96zjfkrxa",
    "budgetDetailId": "cmncwzlce00d4cam9h43j4rtk"
  },
  {
    "id": "cmncwzi1300c4cam9hln0pogj",
    "departmentId": "cmk888mr5006b2dg96a76pxew",
    "budgetDetailId": "cmncwzhz000c2cam9u6ijddx7"
  },
  {
    "id": "cmncwzg2x00bgcam9r3whsoa8",
    "departmentId": "cmk888moe005n2dg9ic9j42rw",
    "budgetDetailId": "cmncwzg0w00becam9hywsergz"
  },
  {
    "id": "cmncwzqd000eucam9byp1vzf6",
    "departmentId": "cmk888n4300912dg9peipojq8",
    "budgetDetailId": "cmncwzqav00escam9t14bxjip"
  },
  {
    "id": "cmncwzsmm00fkcam9jl0i5kwh",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncwzskj00ficam96fyoz3tt"
  },
  {
    "id": "cmncwzno800e0cam99n0in1my",
    "departmentId": "cmk888mzw00822dg9eaj0qsuj",
    "budgetDetailId": "cmncwznm600dycam94jzrrz9k"
  },
  {
    "id": "cmncwzp3d00egcam9vrmfkbvy",
    "departmentId": "cmk888n27008m2dg9f0o1pbsy",
    "budgetDetailId": "cmncwzp1c00eecam9qq2e48t9"
  },
  {
    "id": "cmk888n4m00942dg90yuijxnw",
    "departmentId": "cmk888n4300912dg9peipojq8",
    "budgetDetailId": "cmk888n4i00932dg915bq6c4u"
  },
  {
    "id": "cmnmhbef000accax4hb8go77s",
    "departmentId": "cmk888m7d00222dg9odzebl67",
    "budgetDetailId": "cmnmhbecs00aacax4nnloli36"
  },
  {
    "id": "cmncwzsgh00fgcam94ur6k099",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncwzsef00fecam9izcxeg4z"
  },
  {
    "id": "cmncwyw0l004pcam9glodzwgr",
    "departmentId": "cmk888lzu000k2dg9mccj9rkf",
    "budgetDetailId": "cmncwyvyj004ncam9qw4c5wdn"
  },
  {
    "id": "cmncx01um00i7cam9bhiogfnq",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncx01si00i5cam9tp9153yi"
  },
  {
    "id": "cmncwzvj000ggcam95msjxix1",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncwzvgx00gecam9mi4djqhb"
  },
  {
    "id": "cmncwznbz00ducam9hjqi5u5f",
    "departmentId": "cmk888mzw00822dg9eaj0qsuj",
    "budgetDetailId": "cmncwzn9v00dscam9409q8k2d"
  },
  {
    "id": "cmncwztph00fycam9e4xdqtd7",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncwztnf00fwcam95qtwx974"
  },
  {
    "id": "cmncwzzsm00hlcam97frpmazc",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncwzzqj00hjcam9ffj1izqt"
  },
  {
    "id": "cmncwywj3004xcam9wvkx5j7e",
    "departmentId": "cmk888lzu000k2dg9mccj9rkf",
    "budgetDetailId": "cmncwywh0004vcam99f92xlm3"
  },
  {
    "id": "cmncwzxt300h1cam9bas0sf7u",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncwzxr100gzcam9aqrozss2"
  },
  {
    "id": "cmncx05ve00j7cam9w2qvrqp6",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncx05tc00j5cam926txncu4"
  },
  {
    "id": "cmncx037l00ikcam9rzv8ocex",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncx035j00iicam9lq0npj25"
  },
  {
    "id": "cmncx07d000jkcam9qmvkyrqa",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmncx07ax00jicam94gwcy95u"
  },
  {
    "id": "cmncwyxw2005acam9ciemsixm",
    "departmentId": "cmk888m2200102dg980vk9fmy",
    "budgetDetailId": "cmncwyxu10058cam9uaqo8ssd"
  },
  {
    "id": "cmncx054m00j0cam9avsnh9tz",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncx052j00iycam9z4nrgvjo"
  },
  {
    "id": "cmnmzrz080003cab2linh6fm5",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmnmzrz080001cab2x5pzvtb5"
  },
  {
    "id": "cmncwyyyw005mcam9ek9mptn7",
    "departmentId": "cmk888m3n001a2dg976fi0d9z",
    "budgetDetailId": "cmncwyywr005kcam9fjivu81t"
  },
  {
    "id": "cmk888nn900d32dg9roiaka8c",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmk888nn600d22dg9nc484j0e"
  },
  {
    "id": "cmncwzssy00focam9jovu3z81",
    "departmentId": "cmk888n5o009d2dg9crryo6c6",
    "budgetDetailId": "cmncwzsqu00fmcam90seh92ai"
  },
  {
    "id": "cmncwyz52005qcam9f06lod7y",
    "departmentId": "cmk888m3n001a2dg976fi0d9z",
    "budgetDetailId": "cmncwyz30005ocam9i4uz6kya"
  },
  {
    "id": "cmncwz0sx0066cam93orngq8g",
    "departmentId": "cmk888m7d00222dg9odzebl67",
    "budgetDetailId": "cmncwz0qv0064cam9pz5h1z0d"
  },
  {
    "id": "cmncwyzhe005wcam9z874iafy",
    "departmentId": "cmk888m3n001a2dg976fi0d9z",
    "budgetDetailId": "cmncwyzfc005ucam9dikn1txf"
  },
  {
    "id": "cmncwz288006qcam9k5hqkwd1",
    "departmentId": "cmk888m93002f2dg9zdvl63ts",
    "budgetDetailId": "cmncwz265006ocam95fl6jein"
  },
  {
    "id": "cmncx09sk00k8cam94qxjq70q",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmncx09qi00k6cam9qc5nj5ba"
  },
  {
    "id": "cmncwz5gq007tcam9xrb3y20h",
    "departmentId": "cmk888mcj00322dg9mvmdl57l",
    "budgetDetailId": "cmncwz5em007rcam9il9ogot5"
  },
  {
    "id": "cmk888mow005q2dg9jec3jzj8",
    "departmentId": "cmk888moe005n2dg9ic9j42rw",
    "budgetDetailId": "cmk888mot005p2dg90xpaab8k"
  },
  {
    "id": "cmnvffjbi004zgs1q8y6u310y",
    "departmentId": "cmk888mcj00322dg9mvmdl57l",
    "budgetDetailId": "cmnvffjas004vgs1qs0uw2kui"
  },
  {
    "id": "cmoefkkl0004xln28squx3lb6",
    "departmentId": "cmk888nkm00cj2dg98lssqchr",
    "budgetDetailId": "cmoefkkk9004tln28o6f0hujf"
  }
];

// BudgetDetailYear (357개)
const budgetDetailYears = [
  {
    "id": "cmnmhd3af010gcax4np92fmcf",
    "budgetDetailId": "cmncx09qi00k6cam9qc5nj5ba",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhb3rl005zcax48yh5uupp",
    "budgetDetailId": "cmk888lz0000d2dg9zh63l9tg",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmnmhb2bp005dcax4745jzfzy",
    "budgetDetailId": "cmncwyryy003bcam94dkhunc6",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhb36r005ncax4jp331jfv",
    "budgetDetailId": "cmncwyspg003jcam9swxpgilz",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmnmhb3h7005tcax4v94jphzz",
    "budgetDetailId": "cmncwysvq003ncam94n1ts460",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmnmhb1ql0051cax4pwjp6dqi",
    "budgetDetailId": "cmncwyrlo0033cam9quwirzjl",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhb2180057cax4vy61vwfd",
    "budgetDetailId": "cmncwyrsr0037cam96hm05si2",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhb4240065cax4yn13gp5i",
    "budgetDetailId": "cmncwyt83003tcam9oxl633re",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmnmhb57c006gcax4qdbhq4wd",
    "budgetDetailId": "cmncwyu940042cam9bio453rp",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhb7id007fcax46jbric0i",
    "budgetDetailId": "cmncwyvyj004ncam9qw4c5wdn",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhb8dk007xcax4y85ukfp8",
    "budgetDetailId": "cmncwywh0004vcam99f92xlm3",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhba66008kcax4us9lhfko",
    "budgetDetailId": "cmncwyxu10058cam9uaqo8ssd",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwypyv002pcam9sidr6edt"
  },
  {
    "id": "cmnmhbfx500b0cax486r7pfz1",
    "budgetDetailId": "cmncwz265006ocam95fl6jein",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmnmhbgjv00bccax4kn6wbncb",
    "budgetDetailId": "cmncwz2ik006ucam9wu4ltxuq",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmnmhbhpw00bscax452795hcv",
    "budgetDetailId": "cmncwz3fd0074cam9j0xttko6",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyp9k0021cam9n352iaya"
  },
  {
    "id": "cmnmhb7st007lcax4ln38fcta",
    "budgetDetailId": "cmk888m13000r2dg9p328rjxu",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhb9le0088cax4wudloai4",
    "budgetDetailId": "cmk888m2r00132dg9axvcstrr",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwypyv002pcam9sidr6edt"
  },
  {
    "id": "cmnmhb837007rcax4cz3biqh1",
    "budgetDetailId": "cmk888m1h000u2dg9b7k8vvsn",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhb77x0079cax4ljxltdlm",
    "budgetDetailId": "cmk888m1s000x2dg9bm0ge5qb",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhb9vp008ecax46hz3im9v",
    "budgetDetailId": "cmk888m3b00172dg934kbomnj",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwypyv002pcam9sidr6edt"
  },
  {
    "id": "cmnmhbb0u008ucax4th2v65rh",
    "budgetDetailId": "cmk888m43001c2dg9rkiszwqd",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m4e001e2dg93e7c8elb"
  },
  {
    "id": "cmnmhbkwn00d5cax4qvjcalpe",
    "budgetDetailId": "cmncwz5r5007zcam91svf3brn",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mda00362dg9v2xppd75"
  },
  {
    "id": "cmnmhbbb90090cax4qcrlitmd",
    "budgetDetailId": "cmk888m4n001g2dg9d2jnw4qk",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m4e001e2dg93e7c8elb"
  },
  {
    "id": "cmnmhbc6d009icax49ccxmftq",
    "budgetDetailId": "cmk888m4y001j2dg9e42lne81",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m4e001e2dg93e7c8elb"
  },
  {
    "id": "cmnmhbeha00aecax4hxj434lf",
    "budgetDetailId": "cmnmhbecs00aacax4nnloli36",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyox3001pcam9k8lupzn3"
  },
  {
    "id": "cmnmhbe6k00a6cax4y2cljasv",
    "budgetDetailId": "cmk888m7z00252dg9u3331aky",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyox3001pcam9k8lupzn3"
  },
  {
    "id": "cmnmhbg7m00b6cax41zb76697",
    "budgetDetailId": "cmk888ma7002l2dg9j9qhsbbn",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmnmhbkma00czcax441vf1v7v",
    "budgetDetailId": "cmncwz5kv007vcam9ol13vl44",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mda00362dg9v2xppd75"
  },
  {
    "id": "cmnmhb6mp006xcax462zx44k2",
    "budgetDetailId": "cmk888m0h000n2dg9jmqish1v",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhbivs00cccax44hoxjumk",
    "budgetDetailId": "cmk888mbh002u2dg967s1nsmf",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyp9k0021cam9n352iaya"
  },
  {
    "id": "cmnmhbhfl00bmcax473jic1s3",
    "budgetDetailId": "cmk888mc0002y2dg9epgzr8kh",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmlc0ufc7000728h0wn2kbu8h"
  },
  {
    "id": "cmnmhbmff00dhcax429n8fxow",
    "budgetDetailId": "cmk888meb003c2dg9eqjy9c3y",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mel003e2dg94g6z3pr1"
  },
  {
    "id": "cmnmhbmpy00dncax4fee82hcp",
    "budgetDetailId": "cmk888meu003g2dg9lwzgn2l3",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mel003e2dg94g6z3pr1"
  },
  {
    "id": "cmnmhbkbw00ctcax49zp2at75",
    "budgetDetailId": "cmncwz5em007rcam9il9ogot5",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mda00362dg9v2xppd75"
  },
  {
    "id": "cmnmhb5hs006mcax4dasvwqfp",
    "budgetDetailId": "cmncwyufc0046cam9t647nnbr",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhb6xm0073cax4iylkuo74",
    "budgetDetailId": "cmncwyvm8004hcam9rv6qaq8b",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhbbls0096cax4jkzzg3ub",
    "budgetDetailId": "cmncwyywr005kcam9fjivu81t",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m4e001e2dg93e7c8elb"
  },
  {
    "id": "cmnmhbbw2009ccax4dnx10y87",
    "budgetDetailId": "cmncwyz30005ocam9i4uz6kya",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhbcgt009ocax4x50ix80b",
    "budgetDetailId": "cmncwyzfc005ucam9dikn1txf",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m4e001e2dg93e7c8elb"
  },
  {
    "id": "cmnmhbdw700a0cax4v64ys4g3",
    "budgetDetailId": "cmncwz0qv0064cam9pz5h1z0d",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyox3001pcam9k8lupzn3"
  },
  {
    "id": "cmnmhberm00akcax4vnfnka1i",
    "budgetDetailId": "cmncwz19i006ccam99zrhb1s9",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyox3001pcam9k8lupzn3"
  },
  {
    "id": "cmnmhbfmq00aucax4vh0ve7k3",
    "budgetDetailId": "cmncwz1zz006kcam9m35nstjr",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmnmhbiam00c0cax4bq3skwe0",
    "budgetDetailId": "cmncwz3vl007acam945yzua70",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyp9k0021cam9n352iaya"
  },
  {
    "id": "cmnmhbil800c6cax4z2mj0wyx",
    "budgetDetailId": "cmncwz41s007ecam9egvsxnq8",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyp9k0021cam9n352iaya"
  },
  {
    "id": "cmnmhbokk00efcax44uy9g2qh",
    "budgetDetailId": "cmncwz8h2008rcam9cte3xep6",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mfu003n2dg9th2dsx83"
  },
  {
    "id": "cmnmhbqlv00f8cax45chx9pb7",
    "budgetDetailId": "cmncwza0a0096cam9hc6on4gm",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbso700g1cax4cm40h1i4",
    "budgetDetailId": "cmncwzbjj009ncam9laq0fg0d",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbtjh00gjcax4cgqjhsq0",
    "budgetDetailId": "cmncwzc24009vcam9dj0o14ca",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbpqc00eqcax489688rcb",
    "budgetDetailId": "cmk888mgo003s2dg97po0utag",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbttv00gpcax4sscoh06h",
    "budgetDetailId": "cmncwzc8d009zcam98wi5pcqo",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbu4j00gvcax4bgc100yy",
    "budgetDetailId": "cmncwzceh00a3cam94xr5i3mc",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbq0r00ewcax49hra6649",
    "budgetDetailId": "cmk888mh7003w2dg9sykl0r4b",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbqbc00f2cax4i6u7wwg3",
    "budgetDetailId": "cmk888mhi003z2dg9ljdpfi92",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbqwt00fecax4xsdcwy5r",
    "budgetDetailId": "cmk888mht00422dg92xk0iz5o",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbr7d00fkcax4wf7wj7eu",
    "budgetDetailId": "cmncwzacl009ccam9wzizi9qz",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbvl000hpcax4qe9bivmt",
    "budgetDetailId": "cmk888mki004o2dg98hrsvyk5",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbuex00h1cax496txp9z7",
    "budgetDetailId": "cmncwzckn00a7cam9608io9lb",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbupf00h7cax4ou3ur69n",
    "budgetDetailId": "cmk888mn9005d2dg9ruh24tga",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbv0300hdcax4y7ik5e1w",
    "budgetDetailId": "cmncwzcwz00adcam93frf3132",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbw5t00i1cax4m6r3zn1o",
    "budgetDetailId": "cmk888mlg004x2dg9ljusnvsq",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbxld00iicax4nw4z6lqt",
    "budgetDetailId": "cmk888mot005p2dg90xpaab8k",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhbvvg00hvcax4poiobhqa",
    "budgetDetailId": "cmncwzdg700alcam9vk8c2ter",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbt9000gdcax4kmktw35f",
    "budgetDetailId": "cmk888mnx005j2dg91ifbmzuw",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhc2ib00l4cax4qcjwit59",
    "budgetDetailId": "cmncwzhz000c2cam9u6ijddx7",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhbsdr00fvcax40vcr5zlo",
    "budgetDetailId": "cmk888mm300532dg9fwdot7dx",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbsyo00g7cax4ytnz4skn",
    "budgetDetailId": "cmk888ml5004u2dg9czmzxfr0",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbvak00hjcax48z1712bo",
    "budgetDetailId": "cmk888mlr00502dg9ltfd0w1v",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbo9z00e9cax4rqf72zy7",
    "budgetDetailId": "cmncwz8ax008ncam99odrncyw",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mfu003n2dg9th2dsx83"
  },
  {
    "id": "cmnmhbygo00j0cax4j5wlpe1k",
    "budgetDetailId": "cmk888mpx005z2dg9c06q3zxo",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhbyr100j6cax421elebl2",
    "budgetDetailId": "cmk888mq800622dg9fydpkz9o",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhbz1d00jccax4zf51rcun",
    "budgetDetailId": "cmk888mqj00652dg956a12jig",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhbzbp00jicax47hlvrs8k",
    "budgetDetailId": "cmk888mqv00682dg9wekhsk9n",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhc0rb00k4cax4910t2weo",
    "budgetDetailId": "cmk888ms3006h2dg9s13xzvlv",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhc1xl00kscax4qff2rghv",
    "budgetDetailId": "cmncwzhmn00bwcam9m1fgpqkq",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhc11q00kacax4sp1tbp2c",
    "budgetDetailId": "cmk888mse006k2dg952bdujb6",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhc1c400kgcax4dr84b6go",
    "budgetDetailId": "cmk888msq006n2dg9kzfpq45g",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhc1n100kmcax4mp04tjm1",
    "budgetDetailId": "cmk888mtb006q2dg9d21s2pji",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhc28000kycax4yui76uga",
    "budgetDetailId": "cmk888mu7006t2dg9i5s4pn4t",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhc3d200lecax4c2k41oti",
    "budgetDetailId": "cmk888muz006y2dg9esntgf8j",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmnmhbnzd00e3cax45vo4qdes",
    "budgetDetailId": "cmk888mfk003l2dg9bp82hgyn",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mfu003n2dg9th2dsx83"
  },
  {
    "id": "cmnmhbn0q00dtcax4pgll9ll2",
    "budgetDetailId": "cmncwz7eb008dcam95idy75eq",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mel003e2dg94g6z3pr1"
  },
  {
    "id": "cmnmhbxvs00iocax4agrledlx",
    "budgetDetailId": "cmk888mpb005t2dg9u24m5eep",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhby6500iucax4skr5k7pn",
    "budgetDetailId": "cmk888mpm005w2dg9ldo81v9q",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhbzm000jocax48qp6r2o6",
    "budgetDetailId": "cmncwzg0w00becam9hywsergz",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhc7yx00nucax44sa9br0r",
    "budgetDetailId": "cmncwzloo00dacam9kyd7taoh",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhca9s00oycax4kdl5p7bc",
    "budgetDetailId": "cmncwzn9v00dscam9409q8k2d",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhcauj00pacax4fw9udjwt",
    "budgetDetailId": "cmncwznm600dycam94jzrrz9k",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhccuw00q8cax4oz96oam4",
    "budgetDetailId": "cmncwzp1c00eecam9qq2e48t9",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwynv8000pcam9808qf4js"
  },
  {
    "id": "cmnmhc3ne00lkcax4tediz8zw",
    "budgetDetailId": "cmk888mvk00722dg9zvea9wp0",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmnmhc3xq00lqcax44lrm7skq",
    "budgetDetailId": "cmk888mvv00752dg9x2f3rt5e",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmnmhc48300lwcax4os4h1y41",
    "budgetDetailId": "cmk888mw600782dg905ejteey",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmnmhc4ii00m2cax4n0tps2fg",
    "budgetDetailId": "cmk888mwo007b2dg9mw12jbs3",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmnmhc4t000m8cax4tkoqkq8n",
    "budgetDetailId": "cmk888mx1007e2dg9o34outfe",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmnmhc5y400mocax4gek95waa",
    "budgetDetailId": "cmk888mxr007j2dg9f25b6nt2",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhc68i00mucax4uvwcc7n5",
    "budgetDetailId": "cmk888myb007n2dg9brlqj34c",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhc6iy00n0cax4ymy6mnjp",
    "budgetDetailId": "cmk888mym007q2dg9id5c66nj",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhc6ta00n6cax453vdgard",
    "budgetDetailId": "cmk888myy007t2dg91i3j2koy",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhc73q00nccax4z27hlvbg",
    "budgetDetailId": "cmk888mz9007w2dg96zncztn4",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhc7oj00nocax4qbpabji0",
    "budgetDetailId": "cmk888mzl007z2dg9n7t8iy20",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhc8tq00o4cax433zwjxaw",
    "budgetDetailId": "cmk888n0b00842dg9jpqc2lv6",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhc94100oacax4bjcqai6b",
    "budgetDetailId": "cmk888n0m00872dg9o55bgb12",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhc9ef00ogcax4t96pxnk6",
    "budgetDetailId": "cmk888n0y008a2dg9l0dqo9gr",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhc9oq00omcax45dci1o7l",
    "budgetDetailId": "cmk888n19008d2dg9vv68ss50",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhc9z500oscax4kfwxy0ob",
    "budgetDetailId": "cmk888n1k008g2dg904ysvlkt",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhcak500p4cax4iout3yso",
    "budgetDetailId": "cmk888n1w008j2dg95hw7e48u",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhcbp900pkcax47hvvynlh",
    "budgetDetailId": "cmk888n2m008o2dg9dw774qza",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwynv8000pcam9808qf4js"
  },
  {
    "id": "cmnmhcbzm00pqcax43yisdvop",
    "budgetDetailId": "cmk888n35008s2dg99ko3niof",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwynv8000pcam9808qf4js"
  },
  {
    "id": "cmnmhcc9z00pwcax4aqcjpq4n",
    "budgetDetailId": "cmk888n3g008v2dg90vdjd1gg",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwynv8000pcam9808qf4js"
  },
  {
    "id": "cmnmhcckf00q2cax4cmqmrysx",
    "budgetDetailId": "cmk888n3r008y2dg94gd87ymb",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwynv8000pcam9808qf4js"
  },
  {
    "id": "cmnmhcdpn00qicax4rle34xrw",
    "budgetDetailId": "cmk888n4i00932dg915bq6c4u",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmnmhce0300qocax4xpm8gf3b",
    "budgetDetailId": "cmk888n4v00962dg94jyhwq87",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmnmhceb000qucax4598vh308",
    "budgetDetailId": "cmk888n5600992dg9bpwwtghh",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmnmhcibo00sgcax4vmwbu9m4",
    "budgetDetailId": "cmk888n63009f2dg9fttezph3",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcjgr00swcax4ajf6cdd2",
    "budgetDetailId": "cmk888n6t009k2dg97lmphlci",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhck1m00t4cax4x45qibgx",
    "budgetDetailId": "cmk888n7b009o2dg98i1f9q46",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhckm800tccax4mgejovq4",
    "budgetDetailId": "cmk888n7t009s2dg9k10cocjb",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhclrh00tscax4fwto928o",
    "budgetDetailId": "cmk888n8t00a02dg9pvdtk3hu",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcm2300tycax43ks0ikvi",
    "budgetDetailId": "cmk888n9300a32dg907yg0gq5",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhc53a00mecax461l2w2tl",
    "budgetDetailId": "cmncwzjqz00cmcam9xjbxckez",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmnmhcelj00r0cax411jbiq42",
    "budgetDetailId": "cmncwzqav00escam9t14bxjip",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmnmhch6a00rwcax43xomhlgx",
    "budgetDetailId": "cmncwzsef00fecam9izcxeg4z",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhciw500socax45y2t6olr",
    "budgetDetailId": "cmncwztnf00fwcam95qtwx974",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhchgp00s2cax40ot7mpi7",
    "budgetDetailId": "cmncwzskj00ficam96fyoz3tt",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcl6t00tkcax41spmlcud",
    "budgetDetailId": "cmncwzvgx00gecam9mi4djqhb",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhchr600s8cax4j5ilxkjs",
    "budgetDetailId": "cmncwzsqu00fmcam90seh92ai",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcmmr00u6cax443mj7aq7",
    "budgetDetailId": "cmk888n9l00a72dg9kcezf0qo",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhc0h000jycax4hb76kjq3",
    "budgetDetailId": "cmk888mrk006d2dg91xg32jzj",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhcp8i00v3cax4pldbxhux",
    "budgetDetailId": "cmk888ncm00as2dg99ip3n05g",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcru800w5cax4v3fxx5ef",
    "budgetDetailId": "cmk888nfq00bg2dg92zvtcla3",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcnhr00ufcax47fcby7d0",
    "budgetDetailId": "cmk888naa00ac2dg9ye9o5hyi",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcseu00wdcax4z8iov7vg",
    "budgetDetailId": "cmk888ng800bk2dg9kkzrt575",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhct9y00wvcax4l107i40c",
    "budgetDetailId": "cmk888nh500bt2dg9tqefyek0",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhc7e400nicax4otf2oull",
    "budgetDetailId": "cmncwzlce00d4cam9h43j4rtk",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhcu4z00x9cax4vgnjln3j",
    "budgetDetailId": "cmk888nhn00bx2dg9lfnxtyna",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcuzv00xicax4sfboykr6",
    "budgetDetailId": "cmk888nid00c22dg9qpbxml7c",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcw5500xxcax423x8lxan",
    "budgetDetailId": "cmk888nje00ca2dg9ho2h0qw6",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcwzw00y6cax4tw2yqirp",
    "budgetDetailId": "cmk888nk300cf2dg9hlvzg88r",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhczk600yycax446b4c8g9",
    "budgetDetailId": "cmk888nl700cm2dg9rld6xis9",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcxki00yecax4sv776zwc",
    "budgetDetailId": "cmncx052j00iycam9z4nrgvjo",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcond00uvcax4hj72sit4",
    "budgetDetailId": "cmk888nc400ao2dg93hmdv8di",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhcpt300vbcax4kg6shkfe",
    "budgetDetailId": "cmk888nda00ax2dg9djvyuzpr",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd1a600zmcax4z8s2kcgg",
    "budgetDetailId": "cmk888nm700cu2dg9ofrm2q1w",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd1uu00zucax4d0furleb",
    "budgetDetailId": "cmk888nmp00cy2dg98n6r3h3o",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd04r00z6cax4ghvuadqk",
    "budgetDetailId": "cmncx07ax00jicam94gwcy95u",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd2fh0102cax4ri1azy45",
    "budgetDetailId": "cmk888nn600d22dg9nc484j0e",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcqdn00vjcax49qlz4104",
    "budgetDetailId": "cmk888ndt00b12dg9q0q9xnqm",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd304010acax401095662",
    "budgetDetailId": "cmk888nno00d62dg9tkox85og",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd3v2010ocax4zauhhn1m",
    "budgetDetailId": "cmk888no700da2dg9whylry9k",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd4px010xcax4r5eub8zh",
    "budgetDetailId": "cmk888npf00dj2dg98rlvh4u2",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd5ar0115cax4j2kay737",
    "budgetDetailId": "cmk888npx00dn2dg9ixmnoy3b",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd5vl011dcax4ni8ph8jp",
    "budgetDetailId": "cmk888nqf00dr2dg9jiflgip2",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd6qp011rcax48rexl8e4",
    "budgetDetailId": "cmk888nqw00dv2dg906gaa8z7",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhbwg900i7cax42nm312o9",
    "budgetDetailId": "cmncwzdsm00arcam93j8y2zdw",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmncwyooh001hcam9ragwy4tn"
  },
  {
    "id": "cmnmhcsp900wjcax4qcqlgrpt",
    "budgetDetailId": "cmk888ngj00bn2dg9g5r3arkh",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcr9600vxcax4zgl1wjdg",
    "budgetDetailId": "cmk888nf600bc2dg9agwvp3tq",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcvac00xocax4ughlq688",
    "budgetDetailId": "cmncx035j00iicam9lq0npj25",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcszk00wpcax4liukvu04",
    "budgetDetailId": "cmk888ngv00bq2dg9j9lpqx0y",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhd0pd00zecax4trp0yoeq",
    "budgetDetailId": "cmk888nlp00cq2dg9gv8x6nl0",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcqo900vpcax4crulfrl9",
    "budgetDetailId": "cmncwzzqj00hjcam9ffj1izqt",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhco2i00uncax4atn8lp4j",
    "budgetDetailId": "cmncwzxr100gzcam9aqrozss2",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhctkc00x1cax4isxkzw8m",
    "budgetDetailId": "cmncx01si00i5cam9tp9153yi",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhcyf700yncax4q0qb5p1i",
    "budgetDetailId": "cmncx05tc00j5cam926txncu4",
    "year": 2025,
    "budgetAmount": 0,
    "managerId": "cmk878q240008eg3m7shfiopv"
  },
  {
    "id": "cmnmhc1zo00kucax4kb9hirbq",
    "budgetDetailId": "cmncwzhmn00bwcam9m1fgpqkq",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhba88008mcax4jeb9jh5w",
    "budgetDetailId": "cmncwyxu10058cam9uaqo8ssd",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m3200152dg9q760jzth"
  },
  {
    "id": "cmnmhcl8x00tmcax4rtif5aut",
    "budgetDetailId": "cmncwzvgx00gecam9mi4djqhb",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbr9i00fmcax43md9pp3r",
    "budgetDetailId": "cmncwzacl009ccam9wzizi9qz",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhc2kd00l6cax4zsp6qvk6",
    "budgetDetailId": "cmncwzhz000c2cam9u6ijddx7",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmhbbnu0098cax4cx6q0sqg",
    "budgetDetailId": "cmncwyywr005kcam9fjivu81t",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhbqny00facax4od0zypoa",
    "budgetDetailId": "cmncwza0a0096cam9hc6on4gm",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbby3009ecax4uc72vflp",
    "budgetDetailId": "cmncwyz30005ocam9i4uz6kya",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhbsqb00g3cax45ojdaj9e",
    "budgetDetailId": "cmncwzbjj009ncam9laq0fg0d",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbcix009qcax4n9yptcdu",
    "budgetDetailId": "cmncwyzfc005ucam9dikn1txf",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhbdya00a2cax4eldr2h08",
    "budgetDetailId": "cmncwz0qv0064cam9pz5h1z0d",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmnmhc81000nwcax4h5wkznh4",
    "budgetDetailId": "cmncwzloo00dacam9kyd7taoh",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhbejd00agcax4vy52xwpo",
    "budgetDetailId": "cmnmhbecs00aacax4nnloli36",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmnmhc7g700nkcax4oyr9xagm",
    "budgetDetailId": "cmncwzlce00d4cam9h43j4rtk",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmnmhbett00amcax4j5jf564v",
    "budgetDetailId": "cmncwz19i006ccam99zrhb1s9",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmnmhbfov00awcax4cyzz7k7d",
    "budgetDetailId": "cmncwz1zz006kcam9m35nstjr",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmnmhceno00r2cax41jnrqk8i",
    "budgetDetailId": "cmncwzqav00escam9t14bxjip",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmkmp8uj600002eknmyzv4lb0"
  },
  {
    "id": "cmnmhbfz800b2cax4nq9tvtcs",
    "budgetDetailId": "cmncwz265006ocam95fl6jein",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmnmhbtll00glcax47oz4lq07",
    "budgetDetailId": "cmncwzc24009vcam9dj0o14ca",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbn2u00dvcax4mcowqsxe",
    "budgetDetailId": "cmncwz7eb008dcam95idy75eq",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mel003e2dg94g6z3pr1"
  },
  {
    "id": "cmnmhbgmf00becax4xiavdpra",
    "budgetDetailId": "cmncwz2ik006ucam9wu4ltxuq",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmnmhbtw200grcax4r0mxtfgf",
    "budgetDetailId": "cmncwzc8d009zcam98wi5pcqo",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbwic00i9cax4twcr91r6",
    "budgetDetailId": "cmncwzdsm00arcam93j8y2zdw",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhb59f006icax4112sp8aq",
    "budgetDetailId": "cmncwyu940042cam9bio453rp",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbu6m00gxcax4nwmvhqtn",
    "budgetDetailId": "cmncwzceh00a3cam94xr5i3mc",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhbuh400h3cax40ysmytmz",
    "budgetDetailId": "cmncwzckn00a7cam9608io9lb",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhb5jw006ocax4zd19w6x4",
    "budgetDetailId": "cmncwyufc0046cam9t647nnbr",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbkod00d1cax4rzt8is8g",
    "budgetDetailId": "cmncwz5kv007vcam9ol13vl44",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mda00362dg9v2xppd75"
  },
  {
    "id": "cmnmhctmf00x3cax4qqo4dx55",
    "budgetDetailId": "cmncx01si00i5cam9tp9153yi",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbkyp00d7cax413x460k7",
    "budgetDetailId": "cmncwz5r5007zcam91svf3brn",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mda00362dg9v2xppd75"
  },
  {
    "id": "cmnmhbv2600hfcax4pgwovxco",
    "budgetDetailId": "cmncwzcwz00adcam93frf3132",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888nh000bs2dg9dsqlck46",
    "budgetDetailId": "cmk888ngv00bq2dg9j9lpqx0y",
    "year": 2026,
    "budgetAmount": 234000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhcvcf00xqcax4elakihyt",
    "budgetDetailId": "cmncx035j00iicam9lq0npj25",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhcxml00ygcax42pxoi35g",
    "budgetDetailId": "cmncx052j00iycam9z4nrgvjo",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888m3500162dg9xzpjynfk",
    "budgetDetailId": "cmk888m2r00132dg9axvcstrr",
    "year": 2026,
    "budgetAmount": 2500000,
    "managerId": "cmk888m3200152dg9q760jzth"
  },
  {
    "id": "cmk888m1x000z2dg94s606ka9",
    "budgetDetailId": "cmk888m1s000x2dg9bm0ge5qb",
    "year": 2026,
    "budgetAmount": 150000,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmk888mbc002t2dg9qpb7f1ia",
    "budgetDetailId": "cmk888may002q2dg9kb6gmfn0",
    "year": 2026,
    "budgetAmount": 1360000,
    "managerId": "cmk888mb9002s2dg9ksfruoa3"
  },
  {
    "id": "cmk888mf0003i2dg9z8zty25i",
    "budgetDetailId": "cmk888meu003g2dg9lwzgn2l3",
    "year": 2026,
    "budgetAmount": 230000,
    "managerId": "cmk888mel003e2dg94g6z3pr1"
  },
  {
    "id": "cmk888mfy003o2dg9d9bxjjtn",
    "budgetDetailId": "cmk888mfk003l2dg9bp82hgyn",
    "year": 2026,
    "budgetAmount": 1500000,
    "managerId": "cmk888mfu003n2dg9th2dsx83"
  },
  {
    "id": "cmk888mh2003v2dg9a392t2gl",
    "budgetDetailId": "cmk888mgo003s2dg97po0utag",
    "year": 2026,
    "budgetAmount": 460000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mry006g2dg9c9vtvti6",
    "budgetDetailId": "cmk888mrk006d2dg91xg32jzj",
    "year": 2026,
    "budgetAmount": 950000,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmk888mhd003y2dg9lj9fkpqq",
    "budgetDetailId": "cmk888mh7003w2dg9sykl0r4b",
    "year": 2026,
    "budgetAmount": 6400000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888m0w000q2dg9lv1lrbjl",
    "budgetDetailId": "cmk888m0h000n2dg9jmqish1v",
    "year": 2026,
    "budgetAmount": 1780000,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmk888mho00412dg98voejgm0",
    "budgetDetailId": "cmk888mhi003z2dg9ljdpfi92",
    "year": 2026,
    "budgetAmount": 200000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mhz00442dg9hfrjse6q",
    "budgetDetailId": "cmk888mht00422dg92xk0iz5o",
    "year": 2026,
    "budgetAmount": 180000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mj3004b2dg9y5dqolxt",
    "budgetDetailId": "cmk888mip00482dg96svglb17",
    "year": 2026,
    "budgetAmount": 180000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mml00582dg904zqbood",
    "budgetDetailId": "cmk888mmf00562dg95ws97esu",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mll004z2dg9rfnnpp1d",
    "budgetDetailId": "cmk888mlg004x2dg9ljusnvsq",
    "year": 2026,
    "budgetAmount": 416000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mp6005s2dg9mco77l6e",
    "budgetDetailId": "cmk888mot005p2dg90xpaab8k",
    "year": 2026,
    "budgetAmount": 38000,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmk888mns005i2dg9y2jh8lh3",
    "budgetDetailId": "cmk888mnm005g2dg96oqf2kk2",
    "year": 2026,
    "budgetAmount": 50000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mm900552dg92u3yxsfq",
    "budgetDetailId": "cmk888mm300532dg9fwdot7dx",
    "year": 2026,
    "budgetAmount": 1800000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888m7100202dg9kloun1ty",
    "budgetDetailId": "cmk888m6v001y2dg9jau9d9xm",
    "year": 2026,
    "budgetAmount": 120000,
    "managerId": "cmk888m6c001t2dg9o7nzc0t4"
  },
  {
    "id": "cmk888m8n002b2dg95ohmw73k",
    "budgetDetailId": "cmk888m8h00292dg92j19ymqo",
    "year": 2026,
    "budgetAmount": 60000,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmk888m6q001x2dg9nhc46vag",
    "budgetDetailId": "cmk888m6k001v2dg9jyqwo3so",
    "year": 2026,
    "budgetAmount": 900000,
    "managerId": "cmk888m6c001t2dg9o7nzc0t4"
  },
  {
    "id": "cmk888m8y002e2dg9lhplc43q",
    "budgetDetailId": "cmk888m8s002c2dg9cp7bacuw",
    "year": 2026,
    "budgetAmount": 760000,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmk888ma2002k2dg970hcm8un",
    "budgetDetailId": "cmk888m9o002h2dg9keoula27",
    "year": 2026,
    "budgetAmount": 200000,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmk888mad002n2dg9bd895adn",
    "budgetDetailId": "cmk888ma7002l2dg9j9qhsbbn",
    "year": 2026,
    "budgetAmount": 110000,
    "managerId": "cmk888m9z002j2dg9p6dzka1z"
  },
  {
    "id": "cmk888mlx00522dg91t7ottz9",
    "budgetDetailId": "cmk888mlr00502dg9ltfd0w1v",
    "year": 2026,
    "budgetAmount": 240000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mbn002w2dg9t8mgnjcl",
    "budgetDetailId": "cmk888mbh002u2dg967s1nsmf",
    "year": 2026,
    "budgetAmount": 60000,
    "managerId": "cmk888mb9002s2dg9ksfruoa3"
  },
  {
    "id": "cmk888mph005v2dg98s8r54nv",
    "budgetDetailId": "cmk888mpb005t2dg9u24m5eep",
    "year": 2026,
    "budgetAmount": 360000,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmk888mps005y2dg9qyhj9qki",
    "budgetDetailId": "cmk888mpm005w2dg9ldo81v9q",
    "year": 2026,
    "budgetAmount": 600000,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmk888ms9006j2dg9sj7hy8xq",
    "budgetDetailId": "cmk888ms3006h2dg9s13xzvlv",
    "year": 2026,
    "budgetAmount": 260000,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmk888msk006m2dg976r582c8",
    "budgetDetailId": "cmk888mse006k2dg952bdujb6",
    "year": 2026,
    "budgetAmount": 1000000,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmnmzmp990005ca5mkqu0ftd1",
    "budgetDetailId": "cmnmzmosk0001ca5ms7co09hd",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mcb00302dg99h11phub"
  },
  {
    "id": "cmk888lzo000j2dg921loj6n2",
    "budgetDetailId": "cmk888lzj000h2dg96o1spyng",
    "year": 2026,
    "budgetAmount": 450000,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmk888mq300612dg96ea2rs11",
    "budgetDetailId": "cmk888mpx005z2dg9c06q3zxo",
    "year": 2026,
    "budgetAmount": 270000,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmk888mqe00642dg98v2uwa9z",
    "budgetDetailId": "cmk888mq800622dg9fydpkz9o",
    "year": 2026,
    "budgetAmount": 950000,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmk888mqp00672dg982fyn2qc",
    "budgetDetailId": "cmk888mqj00652dg956a12jig",
    "year": 2026,
    "budgetAmount": 50000,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmk888mr0006a2dg9a9nxzat8",
    "budgetDetailId": "cmk888mqv00682dg9wekhsk9n",
    "year": 2026,
    "budgetAmount": 660000,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmk888mje004e2dg90dv07meu",
    "budgetDetailId": "cmk888mj8004c2dg9di8znom0",
    "year": 2026,
    "budgetAmount": 245000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mk2004k2dg9ncl1wvmf",
    "budgetDetailId": "cmk888mjx004i2dg9tmk42szu",
    "year": 2026,
    "budgetAmount": 150000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mkd004n2dg9oddbvyaf",
    "budgetDetailId": "cmk888mk7004l2dg94d646uv4",
    "year": 2026,
    "budgetAmount": 450000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888ml0004t2dg9w2nfj5vq",
    "budgetDetailId": "cmk888mku004r2dg92b5077r7",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mlb004w2dg9wia00ig3",
    "budgetDetailId": "cmk888ml5004u2dg9czmzxfr0",
    "year": 2026,
    "budgetAmount": 480000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888lya000a2dg97cyixf1h",
    "budgetDetailId": "cmk888lxv00072dg9maye7e9a",
    "year": 2026,
    "budgetAmount": 2250000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888lzd000g2dg9afm5goyi",
    "budgetDetailId": "cmk888lz0000d2dg9zh63l9tg",
    "year": 2026,
    "budgetAmount": 84000,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmk888m1n000w2dg9dxpq9gpa",
    "budgetDetailId": "cmk888m1h000u2dg9b7k8vvsn",
    "year": 2026,
    "budgetAmount": 72000,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmk888mn4005c2dg9gc6pmkxk",
    "budgetDetailId": "cmk888mmy005a2dg9fiftow4h",
    "year": 2026,
    "budgetAmount": 1200000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888m3i00192dg9felbf4ui",
    "budgetDetailId": "cmk888m3b00172dg934kbomnj",
    "year": 2026,
    "budgetAmount": 96000,
    "managerId": "cmk888m3200152dg9q760jzth"
  },
  {
    "id": "cmk888mo2005l2dg915q0d4sj",
    "budgetDetailId": "cmk888mnx005j2dg91ifbmzuw",
    "year": 2026,
    "budgetAmount": 720000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888m4t001i2dg90ugmc13f",
    "budgetDetailId": "cmk888m4n001g2dg9d2jnw4qk",
    "year": 2026,
    "budgetAmount": 12110000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888m54001l2dg9pb5goqfu",
    "budgetDetailId": "cmk888m4y001j2dg9e42lne81",
    "year": 2026,
    "budgetAmount": 3600000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888m5f001o2dg9cietug06",
    "budgetDetailId": "cmk888m59001m2dg97hfk671q",
    "year": 2026,
    "budgetAmount": 800000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888m6e001u2dg9pi0xac1r",
    "budgetDetailId": "cmk888m61001r2dg92z3px1ko",
    "year": 2026,
    "budgetAmount": 300000,
    "managerId": "cmk888m6c001t2dg9o7nzc0t4"
  },
  {
    "id": "cmk888mng005f2dg9j89gxsjn",
    "budgetDetailId": "cmk888mn9005d2dg9ruh24tga",
    "year": 2026,
    "budgetAmount": 100000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mcd00312dg96b5sphc0",
    "budgetDetailId": "cmk888mc0002y2dg9epgzr8kh",
    "year": 2026,
    "budgetAmount": 120000,
    "managerId": "cmk888mcb00302dg99h11phub"
  },
  {
    "id": "cmk888mjr004h2dg9jtu9nq4o",
    "budgetDetailId": "cmk888mjl004f2dg9xhfw3aix",
    "year": 2026,
    "budgetAmount": 450000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888meo003f2dg9t61cp1zk",
    "budgetDetailId": "cmk888meb003c2dg9eqjy9c3y",
    "year": 2026,
    "budgetAmount": 1800000,
    "managerId": "cmk888mel003e2dg94g6z3pr1"
  },
  {
    "id": "cmk888mue006v2dg95alxa2zt",
    "budgetDetailId": "cmk888mu7006t2dg9i5s4pn4t",
    "year": 2026,
    "budgetAmount": 60000,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmk888mvf00712dg9kvdcm28s",
    "budgetDetailId": "cmk888muz006y2dg9esntgf8j",
    "year": 2026,
    "budgetAmount": 460000,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmk888mvq00742dg9p4siap7q",
    "budgetDetailId": "cmk888mvk00722dg9zvea9wp0",
    "year": 2026,
    "budgetAmount": 234000,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmk888mw100772dg9gxdwcuqm",
    "budgetDetailId": "cmk888mvv00752dg9x2f3rt5e",
    "year": 2026,
    "budgetAmount": 687000,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmk888mwd007a2dg96mp36hkp",
    "budgetDetailId": "cmk888mw600782dg905ejteey",
    "year": 2026,
    "budgetAmount": 140000,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmk888mwv007d2dg99yfjrens",
    "budgetDetailId": "cmk888mwo007b2dg9mw12jbs3",
    "year": 2026,
    "budgetAmount": 1330000,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmk888my5007m2dg9prwtqmho",
    "budgetDetailId": "cmk888mxr007j2dg9f25b6nt2",
    "year": 2026,
    "budgetAmount": 332000,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmk888myh007p2dg9u8pbt3yh",
    "budgetDetailId": "cmk888myb007n2dg9brlqj34c",
    "year": 2026,
    "budgetAmount": 474000,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmk888mys007s2dg9wd9ppqyq",
    "budgetDetailId": "cmk888mym007q2dg9id5c66nj",
    "year": 2026,
    "budgetAmount": 1200000,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmk888mz4007v2dg99xteq2xh",
    "budgetDetailId": "cmk888myy007t2dg91i3j2koy",
    "year": 2026,
    "budgetAmount": 190000,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmk888mzg007y2dg9le7bghea",
    "budgetDetailId": "cmk888mz9007w2dg96zncztn4",
    "year": 2026,
    "budgetAmount": 1550000,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmk888mzr00812dg9yqq1lvsh",
    "budgetDetailId": "cmk888mzl007z2dg9n7t8iy20",
    "year": 2026,
    "budgetAmount": 48000,
    "managerId": "cmk888my2007l2dg9ioyduwjm"
  },
  {
    "id": "cmk888n0h00862dg9e6dg61zj",
    "budgetDetailId": "cmk888n0b00842dg9jpqc2lv6",
    "year": 2026,
    "budgetAmount": 21000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888n0s00892dg99j9sauco",
    "budgetDetailId": "cmk888n0m00872dg9o55bgb12",
    "year": 2026,
    "budgetAmount": 599000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888n13008c2dg9ehrp7clr",
    "budgetDetailId": "cmk888n0y008a2dg9l0dqo9gr",
    "year": 2026,
    "budgetAmount": 3600000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888n1f008f2dg9zk1qv2gb",
    "budgetDetailId": "cmk888n19008d2dg9vv68ss50",
    "year": 2026,
    "budgetAmount": 240000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888n1r008i2dg9zl5qkheq",
    "budgetDetailId": "cmk888n1k008g2dg904ysvlkt",
    "year": 2026,
    "budgetAmount": 1234000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888n22008l2dg9tur34psr",
    "budgetDetailId": "cmk888n1w008j2dg95hw7e48u",
    "year": 2026,
    "budgetAmount": 72000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888n30008r2dg97cav9uog",
    "budgetDetailId": "cmk888n2m008o2dg9dw774qza",
    "year": 2026,
    "budgetAmount": 100000,
    "managerId": "cmk888n2x008q2dg9jehsp6ka"
  },
  {
    "id": "cmk888mty006s2dg9q0bcrvv6",
    "budgetDetailId": "cmk888mtb006q2dg9d21s2pji",
    "year": 2026,
    "budgetAmount": 1100000,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmk888msy006p2dg9hytula2u",
    "budgetDetailId": "cmk888msq006n2dg9kzfpq45g",
    "year": 2026,
    "budgetAmount": 130000,
    "managerId": "cmk888mrv006f2dg9s93dfw6y"
  },
  {
    "id": "cmk888n3b008u2dg9oui6wji5",
    "budgetDetailId": "cmk888n35008s2dg99ko3niof",
    "year": 2026,
    "budgetAmount": 200000,
    "managerId": "cmk888n2x008q2dg9jehsp6ka"
  },
  {
    "id": "cmk888n3m008x2dg9l3qvv4cp",
    "budgetDetailId": "cmk888n3g008v2dg90vdjd1gg",
    "year": 2026,
    "budgetAmount": 1650000,
    "managerId": "cmk888n2x008q2dg9jehsp6ka"
  },
  {
    "id": "cmk888n3x00902dg95i09rmuz",
    "budgetDetailId": "cmk888n3r008y2dg94gd87ymb",
    "year": 2026,
    "budgetAmount": 120000,
    "managerId": "cmk888n2x008q2dg9jehsp6ka"
  },
  {
    "id": "cmk888n4p00952dg99tohmth5",
    "budgetDetailId": "cmk888n4i00932dg915bq6c4u",
    "year": 2026,
    "budgetAmount": 300000,
    "managerId": "cmkmp8uj600002eknmyzv4lb0"
  },
  {
    "id": "cmk888n5100982dg91ykreqe4",
    "budgetDetailId": "cmk888n4v00962dg94jyhwq87",
    "year": 2026,
    "budgetAmount": 680000,
    "managerId": "cmkmp8uj600002eknmyzv4lb0"
  },
  {
    "id": "cmk888n5c009b2dg9lf62o25s",
    "budgetDetailId": "cmk888n5600992dg9bpwwtghh",
    "year": 2026,
    "budgetAmount": 84000,
    "managerId": "cmkmp8uj600002eknmyzv4lb0"
  },
  {
    "id": "cmk888n69009h2dg9en3qj18p",
    "budgetDetailId": "cmk888n63009f2dg9fttezph3",
    "year": 2026,
    "budgetAmount": 1500000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nbr00am2dg9bkzwfhoq",
    "budgetDetailId": "cmk888nbl00ak2dg9kne99m0j",
    "year": 2026,
    "budgetAmount": 600000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nca00aq2dg9duzuk7dj",
    "budgetDetailId": "cmk888nc400ao2dg93hmdv8di",
    "year": 2026,
    "budgetAmount": 300000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888n6z009m2dg9zdog7uy9",
    "budgetDetailId": "cmk888n6t009k2dg97lmphlci",
    "year": 2026,
    "budgetAmount": 3000000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888n7h009q2dg9z16jyusb",
    "budgetDetailId": "cmk888n7b009o2dg98i1f9q46",
    "year": 2026,
    "budgetAmount": 35000000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888n7z009u2dg9mshypuqy",
    "budgetDetailId": "cmk888n7t009s2dg9k10cocjb",
    "year": 2026,
    "budgetAmount": 3000000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nfd00be2dg9v3dd1j55",
    "budgetDetailId": "cmk888nf600bc2dg9agwvp3tq",
    "year": 2026,
    "budgetAmount": 250000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888n8h009y2dg9few93tu3",
    "budgetDetailId": "cmk888n8b009w2dg9ponj4dq0",
    "year": 2026,
    "budgetAmount": 1000000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888n8y00a22dg9z67yxu5o",
    "budgetDetailId": "cmk888n8t00a02dg9pvdtk3hu",
    "year": 2026,
    "budgetAmount": 30440000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888n9800a52dg9f8q1ip7e",
    "budgetDetailId": "cmk888n9300a32dg907yg0gq5",
    "year": 2026,
    "budgetAmount": 2561400,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888n9r00a92dg959lexg1m",
    "budgetDetailId": "cmk888n9l00a72dg9kcezf0qo",
    "year": 2026,
    "budgetAmount": 48465000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888naq00ae2dg9lqq47e81",
    "budgetDetailId": "cmk888naa00ac2dg9ye9o5hyi",
    "year": 2026,
    "budgetAmount": 960000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nb800ai2dg9ko2qlno2",
    "budgetDetailId": "cmk888nb300ag2dg9xt7bij80",
    "year": 2026,
    "budgetAmount": 600000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888njk00cc2dg9ffoy891t",
    "budgetDetailId": "cmk888nje00ca2dg9ho2h0qw6",
    "year": 2026,
    "budgetAmount": 15000000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888ncr00au2dg9u46l8i6e",
    "budgetDetailId": "cmk888ncm00as2dg99ip3n05g",
    "year": 2026,
    "budgetAmount": 4400000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888ndg00az2dg9m1s2jtuz",
    "budgetDetailId": "cmk888nda00ax2dg9djvyuzpr",
    "year": 2026,
    "budgetAmount": 1557500,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888ndy00b32dg9xxi9xd6e",
    "budgetDetailId": "cmk888ndt00b12dg9q0q9xnqm",
    "year": 2026,
    "budgetAmount": 3000000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888neh00b72dg95ysrlsw6",
    "budgetDetailId": "cmk888neb00b52dg93lviztow",
    "year": 2026,
    "budgetAmount": 120000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nge00bm2dg9zgs1pyvr",
    "budgetDetailId": "cmk888ng800bk2dg9kkzrt575",
    "year": 2026,
    "budgetAmount": 1320000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888ngq00bp2dg9ahtd7lfb",
    "budgetDetailId": "cmk888ngj00bn2dg9g5r3arkh",
    "year": 2026,
    "budgetAmount": 500000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nhb00bv2dg9pldnv2wm",
    "budgetDetailId": "cmk888nh500bt2dg9tqefyek0",
    "year": 2026,
    "budgetAmount": 1781949,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nht00bz2dg99w41h4ct",
    "budgetDetailId": "cmk888nhn00bx2dg9lfnxtyna",
    "year": 2026,
    "budgetAmount": 440000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nii00c42dg9h5fifzza",
    "budgetDetailId": "cmk888nid00c22dg9qpbxml7c",
    "year": 2026,
    "budgetAmount": 5500000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888niu00c72dg9vif8jlkv",
    "budgetDetailId": "cmk888nio00c52dg9sta2rirv",
    "year": 2026,
    "budgetAmount": 800000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nk900ch2dg9p2y7q657",
    "budgetDetailId": "cmk888nk300cf2dg9hlvzg88r",
    "year": 2026,
    "budgetAmount": 12200000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nld00co2dg90spd7ixd",
    "budgetDetailId": "cmk888nl700cm2dg9rld6xis9",
    "year": 2026,
    "budgetAmount": 69538000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmzrzge0005cab2y6vhvbkr",
    "budgetDetailId": "cmnmzrz080001cab2x5pzvtb5",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nnc00d42dg94lbkaw7l",
    "budgetDetailId": "cmk888nn600d22dg9nc484j0e",
    "year": 2026,
    "budgetAmount": 7000000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nnv00d82dg9b24zr2dp",
    "budgetDetailId": "cmk888nno00d62dg9tkox85og",
    "year": 2026,
    "budgetAmount": 4000000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nod00dc2dg9o2bgb56u",
    "budgetDetailId": "cmk888no700da2dg9whylry9k",
    "year": 2026,
    "budgetAmount": 9040000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nov00dg2dg98zen5eux",
    "budgetDetailId": "cmk888nop00de2dg9cscal610",
    "year": 2026,
    "budgetAmount": 7500000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888npl00dl2dg99rbmueyf",
    "budgetDetailId": "cmk888npf00dj2dg98rlvh4u2",
    "year": 2026,
    "budgetAmount": 30100000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbvxk00hxcax47mzg8lx6",
    "budgetDetailId": "cmncwzdg700alcam9vk8c2ter",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmnmhb23c0059cax4yhf8cown",
    "budgetDetailId": "cmncwyrsr0037cam96hm05si2",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888m4h001f2dg9m1jcmha1",
    "budgetDetailId": "cmk888m43001c2dg9rkiszwqd",
    "year": 2026,
    "budgetAmount": 19400000,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888nq200dp2dg92bh7flng",
    "budgetDetailId": "cmk888npx00dn2dg9ixmnoy3b",
    "year": 2026,
    "budgetAmount": 3549000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhcabv00p0cax45yaqkmwn",
    "budgetDetailId": "cmncwzn9v00dscam9409q8k2d",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhb2ds005fcax40j0v4hhc",
    "budgetDetailId": "cmncwyryy003bcam94dkhunc6",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmk888nqk00dt2dg92bledjjo",
    "budgetDetailId": "cmk888nqf00dr2dg9jiflgip2",
    "year": 2026,
    "budgetAmount": 2400000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nr200dx2dg999emg3w6",
    "budgetDetailId": "cmk888nqw00dv2dg906gaa8z7",
    "year": 2026,
    "budgetAmount": 22406000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbicp00c2cax4zs404c91",
    "budgetDetailId": "cmncwz3vl007acam945yzua70",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mb9002s2dg9ksfruoa3"
  },
  {
    "id": "cmnvffjb3004xgs1qswqeh017",
    "budgetDetailId": "cmnvffjas004vgs1qs0uw2kui",
    "year": 2026,
    "budgetAmount": 720000,
    "managerId": "cmk888mda00362dg9v2xppd75"
  },
  {
    "id": "cmoefkkkj004vln28mdfba6y0",
    "budgetDetailId": "cmoefkkk9004tln28o6f0hujf",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888m8c00282dg9djyu82fk",
    "budgetDetailId": "cmk888m7z00252dg9u3331aky",
    "year": 2026,
    "budgetAmount": 300000,
    "managerId": "cmk888m8900272dg98915y8ih"
  },
  {
    "id": "cmk888mko004q2dg91m03ki85",
    "budgetDetailId": "cmk888mki004o2dg98hrsvyk5",
    "year": 2026,
    "budgetAmount": 1050000,
    "managerId": "cmk888mj0004a2dg909o9xcpd"
  },
  {
    "id": "cmk888mx7007g2dg96npgazi8",
    "budgetDetailId": "cmk888mx1007e2dg9o34outfe",
    "year": 2026,
    "budgetAmount": 48000,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmk888net00ba2dg95qmokrti",
    "budgetDetailId": "cmk888nen00b82dg9fptibgaz",
    "year": 2026,
    "budgetAmount": 72000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nfw00bi2dg97vzsb1cm",
    "budgetDetailId": "cmk888nfq00bg2dg92zvtcla3",
    "year": 2026,
    "budgetAmount": 250000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nlu00cs2dg9cmtbmowl",
    "budgetDetailId": "cmk888nlp00cq2dg9gv8x6nl0",
    "year": 2026,
    "budgetAmount": 58476000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888nmc00cw2dg9mbkezyr9",
    "budgetDetailId": "cmk888nm700cu2dg9ofrm2q1w",
    "year": 2026,
    "budgetAmount": 14526000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhb38w005pcax4617dchi4",
    "budgetDetailId": "cmncwyspg003jcam9swxpgilz",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmk888nmu00d02dg91ati9ap2",
    "budgetDetailId": "cmk888nmp00cy2dg98n6r3h3o",
    "year": 2026,
    "budgetAmount": 16277000,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbhs100bucax4pxomoypt",
    "budgetDetailId": "cmncwz3fd0074cam9j0xttko6",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mb9002s2dg9ksfruoa3"
  },
  {
    "id": "cmk888nrs00e22dg9vbqk0325",
    "budgetDetailId": "cmk888nrm00e02dg9gai2yn93",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmk888ns200e52dg94ohqvarb",
    "budgetDetailId": "cmk888nrx00e32dg933bfrfr3",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmldfn2v7001i27fx1qt6gi2z",
    "budgetDetailId": "cmldfn2v0001h27fxlw0ewh3m",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbkdz00cvcax41hw81zv0",
    "budgetDetailId": "cmncwz5em007rcam9il9ogot5",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mda00362dg9v2xppd75"
  },
  {
    "id": "cmnmhb1sw0053cax417y3h9ka",
    "budgetDetailId": "cmncwyrlo0033cam9quwirzjl",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnmhcht800sacax4u1v4n727",
    "budgetDetailId": "cmncwzsqu00fmcam90seh92ai",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhb3ja005vcax4mr5ekhr5",
    "budgetDetailId": "cmncwysvq003ncam94n1ts460",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmnmhch8e00rycax4bqz6ti5j",
    "budgetDetailId": "cmncwzsef00fecam9izcxeg4z",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhb4480067cax4zoe0uvus",
    "budgetDetailId": "cmncwyt83003tcam9oxl633re",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888lzb000f2dg9oea0rnyt"
  },
  {
    "id": "cmnmhcawm00pccax4q1mj9ebg",
    "budgetDetailId": "cmncwznm600dycam94jzrrz9k",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888ly700092dg9phxe7mv4"
  },
  {
    "id": "cmnluca8f005iiv28pgvuc5st",
    "budgetDetailId": "cmncwztnf00fwcam95qtwx974",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnluczsv005kiv28vk33zydf",
    "budgetDetailId": "cmncx05tc00j5cam926txncu4",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnlu0l4d0054iv28wvr8jb2m",
    "budgetDetailId": "cmncx09qi00k6cam9qc5nj5ba",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhcqqo00vrcax4bl9exuve",
    "budgetDetailId": "cmncwzzqj00hjcam9ffj1izqt",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhchis00s4cax43wbhpzlz",
    "budgetDetailId": "cmncwzskj00ficam96fyoz3tt",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhco4l00upcax4s0k160p3",
    "budgetDetailId": "cmncwzxr100gzcam9aqrozss2",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhbzo300jqcax41jklbp1s",
    "budgetDetailId": "cmncwzg0w00becam9hywsergz",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mp3005r2dg90t8kip94"
  },
  {
    "id": "cmnmhboc200ebcax46ba5zr72",
    "budgetDetailId": "cmncwz8ax008ncam99odrncyw",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mfu003n2dg9th2dsx83"
  },
  {
    "id": "cmnmhc55c00mgcax44s9yh76u",
    "budgetDetailId": "cmncwzjqz00cmcam9xjbxckez",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mvb00702dg9ftvxu2cw"
  },
  {
    "id": "cmnmhbomo00ehcax4fv3qdhh2",
    "budgetDetailId": "cmncwz8h2008rcam9cte3xep6",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mfu003n2dg9th2dsx83"
  },
  {
    "id": "cmnmhb6zp0075cax4z2v2y99v",
    "budgetDetailId": "cmncwyvm8004hcam9rv6qaq8b",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhd06t00z8cax4s88mssl8",
    "budgetDetailId": "cmncx07ax00jicam94gwcy95u",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhb7kg007hcax432zi1k9f",
    "budgetDetailId": "cmncwyvyj004ncam9qw4c5wdn",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhccwz00qacax4l5lzfpep",
    "budgetDetailId": "cmncwzp1c00eecam9qq2e48t9",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888n2x008q2dg9jehsp6ka"
  },
  {
    "id": "cmk888m1b000t2dg9txi034ni",
    "budgetDetailId": "cmk888m13000r2dg9p328rjxu",
    "year": 2026,
    "budgetAmount": 5797440,
    "managerId": "cmk878q79000aeg3mqlt9wl3t"
  },
  {
    "id": "cmnmhb8fn007zcax4oq9n2xq3",
    "budgetDetailId": "cmncwywh0004vcam99f92xlm3",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888m0t000p2dg93paineyi"
  },
  {
    "id": "cmnmhbind00c8cax482zhpi00",
    "budgetDetailId": "cmncwz41s007ecam9egvsxnq8",
    "year": 2026,
    "budgetAmount": 0,
    "managerId": "cmk888mb9002s2dg9ksfruoa3"
  }
];

async function main() {
  console.log('🚀 예산 시드 시작...\n');

  // 1. Committee
  console.log('📋 위원회(Committee) 시드 중...');
  for (const c of committees) {
    await prisma.committee.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(`   ✅ ${committees.length}개 완료\n`);

  // 2. Department
  console.log('🏢 사역팀(Department) 시드 중...');
  for (const d of departments) {
    await prisma.department.upsert({ where: { id: d.id }, update: d, create: d });
  }
  console.log(`   ✅ ${departments.length}개 완료\n`);

  // 3. BudgetCategory
  console.log('📁 예산항(BudgetCategory) 시드 중...');
  for (const c of budgetCategories) {
    await prisma.budgetCategory.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(`   ✅ ${budgetCategories.length}개 완료\n`);

  // 4. BudgetSubcategory
  console.log('📂 예산목(BudgetSubcategory) 시드 중...');
  for (const s of budgetSubcategories) {
    await prisma.budgetSubcategory.upsert({ where: { id: s.id }, update: s, create: s });
  }
  console.log(`   ✅ ${budgetSubcategories.length}개 완료\n`);

  // 5. BudgetDetail
  console.log('📝 예산세목(BudgetDetail) 시드 중...');
  for (const d of budgetDetails) {
    await prisma.budgetDetail.upsert({ where: { id: d.id }, update: d, create: d });
  }
  console.log(`   ✅ ${budgetDetails.length}개 완료\n`);

  // 6. DepartmentBudgetDetail
  console.log('🔗 부서-세목 연결(DepartmentBudgetDetail) 시드 중...');
  for (const d of departmentBudgetDetails) {
    await prisma.departmentBudgetDetail.upsert({ where: { id: d.id }, update: d, create: d });
  }
  console.log(`   ✅ ${departmentBudgetDetails.length}개 완료\n`);

  // 7. BudgetDetailYear
  console.log('📅 연도별 세목설정(BudgetDetailYear) 시드 중...');
  for (const y of budgetDetailYears) {
    await prisma.budgetDetailYear.upsert({ where: { id: y.id }, update: y, create: y });
  }
  console.log(`   ✅ ${budgetDetailYears.length}개 완료\n`);

  console.log('🎉 모든 예산 시드 완료!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
