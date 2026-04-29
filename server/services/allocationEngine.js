const BLOCK_SIZE = 36;
const SUBSTITUTE_COUNT = 2;
const HIGH_EXPERIENCE_YEARS = 10;
const SENIOR_FALLBACK_EXPERIENCE_YEARS = 8;

function roleCountKey(role) {
  if (role === 'Sr_SV') return 'sr_sv_count';
  if (role === 'Squad') return 'squad_count';
  return 'jr_sv_count';
}

function normalizeLastAllocatedOrder(counter) {
  if (typeof counter.last_allocated_exam === 'number') {
    return counter.last_allocated_exam;
  }

  const rawValue = counter.last_allocated_term;
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function createCounterMap(counters) {
  return new Map(
    counters.map((counter) => [
      counter.faculty_id,
      {
        faculty_id: counter.faculty_id,
        jr_sv_count: counter.jr_sv_count ?? 0,
        sr_sv_count: counter.sr_sv_count ?? 0,
        squad_count: counter.squad_count ?? 0,
        total_allocations: counter.total_allocations ?? 0,
        last_allocated_term: counter.last_allocated_term ?? null,
        last_allocated_exam: counter.last_allocated_exam ?? null,
        last_allocated_order: normalizeLastAllocatedOrder(counter),
      },
    ])
  );
}

function getCounter(counterMap, facultyId) {
  if (!counterMap.has(facultyId)) {
    counterMap.set(facultyId, {
      faculty_id: facultyId,
      jr_sv_count: 0,
      sr_sv_count: 0,
      squad_count: 0,
      total_allocations: 0,
      last_allocated_term: null,
      last_allocated_exam: null,
      last_allocated_order: null,
    });
  }

  return counterMap.get(facultyId);
}

function updateCounter(counterMap, facultyId, role, examId, termLabel) {
  const counter = getCounter(counterMap, facultyId);
  const key = role === 'Overall_Substitute' ? 'jr_sv_count' : roleCountKey(role);
  counter[key] += 1;
  counter.total_allocations += 1;
  counter.last_allocated_exam = examId;
  counter.last_allocated_term = termLabel;
  counter.last_allocated_order = examId;
}

function calculateBlocks(studentCount) {
  return Math.ceil((Number(studentCount) || 0) / BLOCK_SIZE);
}

function normalizeSchedules(schedules) {
  return schedules.map((schedule) => {
    const studentCount = Number(schedule.student_count ?? schedule.block_required * BLOCK_SIZE ?? 0);
    const blocks = calculateBlocks(studentCount);

    return {
      ...schedule,
      student_count: studentCount,
      block_required: blocks,
      blocks,
    };
  });
}

function buildFacultySummary(faculty) {
  return {
    faculty_id: faculty.faculty_id,
    faculty_name: faculty.name,
    name: faculty.name,
    employee_code: faculty.employee_code,
    dept_id: faculty.dept_id,
    designation: faculty.designation,
    qualification: faculty.qualification,
    experience_years: faculty.experience_years,
    gender: faculty.gender,
  };
}

function compareNullableAscending(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a - b;
}

function buildRandomOrderMap(faculties) {
  const shuffled = [...faculties]
    .map((faculty) => ({ faculty_id: faculty.faculty_id, sort_key: Math.random() }))
    .sort((a, b) => a.sort_key - b.sort_key);

  return new Map(shuffled.map((item, index) => [item.faculty_id, index]));
}

function createRoleComparator(role, counters, randomOrder) {
  return (a, b) => {
    const cA = getCounter(counters, a.faculty_id);
    const cB = getCounter(counters, b.faculty_id);
    const roleKey = roleCountKey(role);

    if (role === 'Sr_SV') {
      // 1. Lowest sr_sv_count first (fairness)
      if (cA[roleKey] !== cB[roleKey]) return cA[roleKey] - cB[roleKey];
      // 2. Higher experience first
      const expDiff = Number(b.experience_years ?? 0) - Number(a.experience_years ?? 0);
      if (expDiff !== 0) return expDiff;
      // 3. Not recently allocated (older last_allocated first)
      return compareNullableAscending(cA.last_allocated_order, cB.last_allocated_order);
    }
    
    if (role === 'Jr_SV') {
      if (a.teaching_type !== b.teaching_type) return a.teaching_type === 'T' ? -1 : 1;
      if (cA[roleKey] !== cB[roleKey]) return cA[roleKey] - cB[roleKey];
      if (cA.total_allocations !== cB.total_allocations) return cA.total_allocations - cB.total_allocations;
      const termCompare = compareNullableAscending(cA.last_allocated_order, cB.last_allocated_order);
      if (termCompare !== 0) return termCompare;
      const randomCompare = (randomOrder.get(a.faculty_id) ?? 0) - (randomOrder.get(b.faculty_id) ?? 0);
      if (randomCompare !== 0) return randomCompare;
      return a.name.localeCompare(b.name);
    }
    
    if (role === 'Squad') {
      if (cA[roleKey] !== cB[roleKey]) return cA[roleKey] - cB[roleKey];
      if (cA.total_allocations !== cB.total_allocations) return cA.total_allocations - cB.total_allocations;
      const termCompare = compareNullableAscending(cA.last_allocated_order, cB.last_allocated_order);
      if (termCompare !== 0) return termCompare;
      return Number(b.experience_years ?? 0) - Number(a.experience_years ?? 0);
    }
    return 0;
  };
}

function isSeniorEligible(faculty) {
  const designation = String(faculty.designation ?? '').toLowerCase();
  const qualification = String(faculty.qualification ?? '').toLowerCase();
  const isEligibleDesignation =
    designation.includes('hod') ||
    designation.includes('associate professor') ||
    designation.includes('professor');

  return (isEligibleDesignation || qualification === 'phd') && Number(faculty.experience_years ?? 0) >= HIGH_EXPERIENCE_YEARS;
}

function hasSeniorDesignationOrQualification(faculty) {
  const designation = String(faculty.designation ?? '').toLowerCase();
  const qualification = String(faculty.qualification ?? '').toLowerCase();

  return (
    designation.includes('hod') ||
    designation.includes('associate professor') ||
    designation.includes('professor') ||
    qualification === 'phd'
  );
}

function sortSeniorCandidates(faculties, counters, randomOrder) {
  return [...faculties].sort(createRoleComparator('Sr_SV', counters, randomOrder));
}

function isJuniorEligible(faculty) {
  if (faculty.teaching_type === 'NT') {
    return faculty.experience_years >= 5;
  }
  return ['Graduate', 'Postgraduate', 'PhD'].includes(faculty.qualification);
}

function selectGlobalSeniorSupervisors(faculties, counters, examId, totalStudents, termLabel, randomOrder) {
  // Rule: <800 students = 1 Sr SV, >=800 = 2 Sr SV
  const requiredCount = totalStudents < 800 ? 1 : 2;

  // Tier 1: Strict eligibility — (HoD / Assoc Prof / Prof OR PhD) AND experience >= 10
  let eligible = sortSeniorCandidates(
    faculties.filter((f) => isSeniorEligible(f)),
    counters,
    randomOrder
  );

  // Tier 2 fallback: Right designation/qualification but slightly lower experience
  if (!eligible.length) {
    eligible = sortSeniorCandidates(
      faculties.filter(
        (f) => hasSeniorDesignationOrQualification(f)
          && Number(f.experience_years ?? 0) >= SENIOR_FALLBACK_EXPERIENCE_YEARS
      ),
      counters,
      randomOrder
    );
  }

  // Tier 3 fallback: At least 10 years experience (data may lack designation labels)
  if (!eligible.length) {
    eligible = sortSeniorCandidates(
      faculties.filter((f) => Number(f.experience_years ?? 0) >= HIGH_EXPERIENCE_YEARS),
      counters,
      randomOrder
    );
  }

  // Tier 4 last-resort fallback
  if (!eligible.length) {
    eligible = sortSeniorCandidates(
      faculties.filter((f) => Number(f.experience_years ?? 0) >= SENIOR_FALLBACK_EXPERIENCE_YEARS),
      counters,
      randomOrder
    );
  }

  console.log(`[Sr SV] Required: ${requiredCount}, Eligible pool: ${eligible.length}`);

  // Pick exactly N — SAME selection used for ALL sessions (global assignment)
  const selected = eligible.slice(0, requiredCount);

  // Update counters immediately after selection
  for (const faculty of selected) {
    updateCounter(counters, faculty.faculty_id, 'Sr_SV', examId, termLabel);
  }

  if (selected.length < requiredCount) {
    console.warn(`[Sr SV] WARNING: Only ${selected.length}/${requiredCount} Sr SV could be selected.`);
  }

  return selected;
}

function selectGlobalSubstitutes(faculties, counters, examId, termLabel, randomOrder, reservedIds) {
  const eligible = faculties
    .filter((f) => !reservedIds.has(f.faculty_id) && isJuniorEligible(f))
    .sort(createRoleComparator('Jr_SV', counters, randomOrder));

  const selected = eligible.slice(0, 2); // Pick 2 overall substitutes

  for (const faculty of selected) {
    updateCounter(counters, faculty.faculty_id, 'Overall_Substitute', examId, termLabel);
  }

  return selected;
}

function getDailyAssignedFacultyIds(dayUsage, examDate) {
  if (!dayUsage.has(examDate)) {
    dayUsage.set(examDate, new Set());
  }

  return dayUsage.get(examDate);
}

// Phase 1 Junior SV Allocator: Pick N faculty for N blocks
function allocateJuniorSupervisors({
  faculties,
  blockCount,
  counters,
  randomOrder,
  globallyReservedFacultyIds,
  dayAllocatedFacultyIds,
  sessionUsedFacultyIds,
  examId,
  termLabel,
  scheduleDeptId,
  totalDepartments,
  deptBlockRules = [],
}) {
  const deptCounters = new Map();
  const maxPerDept = totalDepartments > 0 ? Math.ceil(blockCount / totalDepartments) : null;

  // Pool is re-computed dynamically so every update to sessionUsedFacultyIds is immediately visible
  const getPool = () =>
    faculties.filter((f) => {
      if (sessionUsedFacultyIds.has(f.faculty_id)) return false;
      if (globallyReservedFacultyIds.has(f.faculty_id)) return false;
      if (dayAllocatedFacultyIds.has(f.faculty_id)) return false;
      if (!isJuniorEligible(f)) return false;
      if (scheduleDeptId && f.dept_id === scheduleDeptId) return false;
      return true;
    });

  const selected = [];

  for (let block = 1; block <= blockCount; block++) {
    const pool = getPool().sort(createRoleComparator('Jr_SV', counters, randomOrder));

    let pick = null;
    
    // Try to find a faculty whose department doesn't conflict with the current block index
    // Note: In Phase 1, we don't have final block numbers, but we can use the loop index 
    // as a proxy to spread people across potential blocks.
    for (const candidate of pool) {
      const isRestricted = deptBlockRules.some(rule => 
        rule.dept_id === candidate.dept_id && 
        block >= rule.start_block && 
        block <= rule.end_block
      );
      if (isRestricted) continue;

      const dCount = deptCounters.get(candidate.dept_id) || 0;
      if (maxPerDept !== null && dCount >= maxPerDept) continue;
      
      pick = candidate;
      break;
    }
    
    // soft fallback 1: ignore dept caps but respect block rules
    if (!pick) {
      for (const candidate of pool) {
        const isRestricted = deptBlockRules.some(rule => 
          rule.dept_id === candidate.dept_id && 
          block >= rule.start_block && 
          block <= rule.end_block
        );
        if (!isRestricted) { pick = candidate; break; }
      }
    }

    // soft fallback 2: if everyone is restricted, just pick the first one
    if (!pick && pool[0]) {
      console.warn(`[Jr SV] Block ${block} fallback: All eligible candidates are restricted by dept block rules.`);
      pick = pool[0];
    }
    
    if (!pick) break;

    sessionUsedFacultyIds.add(pick.faculty_id);
    dayAllocatedFacultyIds.add(pick.faculty_id);
    deptCounters.set(pick.dept_id, (deptCounters.get(pick.dept_id) || 0) + 1);
    updateCounter(counters, pick.faculty_id, 'Jr_SV', examId, termLabel);
    selected.push({ faculty: pick });
  }

  console.log(`[Jr SV] Blocks: ${blockCount}, Assigned: ${selected.length}`);
  return selected;
}

function allocateSquads({
  faculties,
  squadCount,
  counters,
  globallyReservedFacultyIds,
  dayAllocatedFacultyIds,
  sessionUsedFacultyIds,
  examId,
  termLabel,
}) {
  const squads = [];

  // 1. Initial Filtering: Active, not already assigned this session/day
  const eligibleFaculty = faculties.filter((f) => {
    if (sessionUsedFacultyIds.has(f.faculty_id)) return false;
    if (globallyReservedFacultyIds.has(f.faculty_id)) return false;
    if (dayAllocatedFacultyIds.has(f.faculty_id)) return false;
    return true;
  });

  // 2. Sort by fairness (squad_count, total_allocations) and experience
  const sortByFairness = (list) => [...list].sort((a, b) => {
    const cA = getCounter(counters, a.faculty_id);
    const cB = getCounter(counters, b.faculty_id);
    
    // Primary: Squad count (role-specific fairness)
    if (cA.squad_count !== cB.squad_count) return cA.squad_count - cB.squad_count;
    
    // Secondary: Total allocations (overall fairness)
    if (cA.total_allocations !== cB.total_allocations) return cA.total_allocations - cB.total_allocations;
    
    // Tertiary: Experience (higher experience first for squads)
    return Number(b.experience_years ?? 0) - Number(a.experience_years ?? 0);
  });

  let pool = sortByFairness(eligibleFaculty);
  
  // 3. Helper lists
  const getFemaleList = (currentPool) => currentPool.filter(f => isFemaleFaculty(f));
  
  // "Relatively Experienced" means picking the most experienced person 
  // from the next few candidates who are equally "fair" to pick.
  const getRelativelyExperiencedMember = (currentPool) => {
    if (currentPool.length === 0) return null;
    
    // Look at the top 10 candidates (who are the most "fair" to pick right now)
    const topCandidates = currentPool.slice(0, Math.min(10, currentPool.length));
    
    // From these fair candidates, pick the one with the most experience
    return [...topCandidates].sort((a, b) => Number(b.experience_years ?? 0) - Number(a.experience_years ?? 0))[0];
  };

  const pickAndRemove = (currentPool, faculty, squadMembers) => {
    if (!faculty) return currentPool;
    squadMembers.push(faculty);
    
    // Remove from shared pools
    sessionUsedFacultyIds.add(faculty.faculty_id);
    dayAllocatedFacultyIds.add(faculty.faculty_id);
    updateCounter(counters, faculty.faculty_id, 'Squad', examId, termLabel);
    
    // Return filtered pool
    return currentPool.filter(f => f.faculty_id !== faculty.faculty_id);
  };

  for (let i = 1; i <= squadCount; i++) {
    // Break if less than 3 members available for a full squad
    if (pool.length < 3) {
      console.warn(`[Squad] Breaking: Only ${pool.length} faculty left, cannot form a full 3-member squad.`);
      break;
    }

    const squadMembers = [];

    // Member 1: Female (fairness-based among females)
    const femaleList = getFemaleList(pool);
    let m1 = femaleList[0] || pool[0];
    pool = pickAndRemove(pool, m1, squadMembers);

    // Member 2: Relatively Experienced (pick best experience among the current fairest candidates)
    let m2 = getRelativelyExperiencedMember(pool);
    pool = pickAndRemove(pool, m2, squadMembers);

    // Member 3: Normal (next fairest candidate)
    let m3 = pool[0];
    pool = pickAndRemove(pool, m3, squadMembers);

    squads.push({
      squad_number: i,
      members: squadMembers
    });
  }

  console.log(`[Squad] Allocated ${squads.length} squads out of ${squadCount} required.`);
  return squads;
}

function isFemaleFaculty(faculty) {
  const gender = String(faculty.gender ?? '').trim().toLowerCase();
  return gender === 'f' || gender === 'female';
}

function buildSessionUnallocated(faculties, sessionUsedFacultyIds, globallyReservedFacultyIds, dayAllocatedFacultyIds) {
  return faculties
    .filter((faculty) => {
      if (sessionUsedFacultyIds.has(faculty.faculty_id)) return false;
      if (globallyReservedFacultyIds.has(faculty.faculty_id)) return false;
      if (dayAllocatedFacultyIds.has(faculty.faculty_id)) return false;
      return true;
    })
    .map(buildFacultySummary);
}

function buildGlobalUnallocated(faculties, allocatedFacultyIds, globallyReservedFacultyIds) {
  return faculties
    .filter((faculty) => !allocatedFacultyIds.has(faculty.faculty_id) && !globallyReservedFacultyIds.has(faculty.faculty_id))
    .map(buildFacultySummary);
}

function buildSeniorSessionSummary(seniorPool) {
  return seniorPool.map((faculty) => buildFacultySummary(faculty));
}

export function generateAllocation(timetable, facultyData, options = {}) {
  const {
    fairnessCounters = [],
    deptBlockRules = [],
    examId = null,
    examName = '',
  } = options;

  const safeFacultyData = Array.isArray(facultyData) ? facultyData : [];
  const activeFaculties = safeFacultyData.filter((faculty) => !faculty.is_on_leave);
  const normalizedSchedules = normalizeSchedules(timetable);
  const totalStudents = normalizedSchedules.reduce((sum, schedule) => sum + schedule.student_count, 0);
  const counterMap = createCounterMap(fairnessCounters);
  const randomOrder = buildRandomOrderMap(activeFaculties);
  const termLabel = examName || (examId !== null ? String(examId) : null);
  const totalDepartments = Math.max(1, new Set(activeFaculties.map((f) => f.dept_id).filter(Boolean)).size);
  const warnings = [];
  const allocations = [];
  const sessions = [];
  const dayUsage = new Map();
  const globallyAllocatedFacultyIds = new Set();

  const seniorPool = selectGlobalSeniorSupervisors(
    activeFaculties,
    counterMap,
    examId,
    totalStudents,
    termLabel,
    randomOrder
  );
  const seniorPoolIds = new Set(seniorPool.map((faculty) => faculty.faculty_id));
  
  const substitutePool = selectGlobalSubstitutes(
    activeFaculties,
    counterMap,
    examId,
    termLabel,
    randomOrder,
    seniorPoolIds
  );
  const substitutePoolIds = new Set(substitutePool.map((f) => f.faculty_id));
  const globallyReservedIds = new Set([...seniorPoolIds, ...substitutePoolIds]);

  for (const senior of seniorPool) {
    globallyAllocatedFacultyIds.add(senior.faculty_id);
  }
  for (const sub of substitutePool) {
    globallyAllocatedFacultyIds.add(sub.faculty_id);
  }

  for (const schedule of normalizedSchedules) {
    const dayAllocatedFacultyIds = getDailyAssignedFacultyIds(dayUsage, schedule.exam_date);

    for (const reservedId of globallyReservedIds) {
      dayAllocatedFacultyIds.add(reservedId);
    }

    const sessionUsedFacultyIds = new Set(globallyReservedIds);

    const juniorSupervisors = allocateJuniorSupervisors({
      faculties: activeFaculties,
      blockCount: schedule.blocks,
      counters: counterMap,
      randomOrder,
      globallyReservedFacultyIds: globallyReservedIds,
      dayAllocatedFacultyIds,
      sessionUsedFacultyIds,
      examId,
      termLabel,
      scheduleDeptId: schedule.dept_id,
      totalDepartments,
      deptBlockRules,
    });

    const squadsRequired = Math.ceil(schedule.blocks / 10);
    const squads = allocateSquads({
      faculties: activeFaculties,
      squadCount: squadsRequired,
      counters: counterMap,
      globallyReservedFacultyIds: globallyReservedIds,
      dayAllocatedFacultyIds,
      sessionUsedFacultyIds,
      examId,
      termLabel,
    });

    if (juniorSupervisors.length < schedule.blocks) {
      warnings.push(`${schedule.subject_name} on ${schedule.exam_date} ${schedule.shift}: junior supervisor shortage.`);
    }
    if (squads.length < squadsRequired) {
      warnings.push(`${schedule.subject_name} on ${schedule.exam_date} ${schedule.shift}: squad shortage.`);
    }

    buildSeniorSessionSummary(seniorPool).forEach((faculty) => {
      allocations.push({
        exam_id: examId,
        schedule_id: schedule.schedule_id,
        faculty_id: faculty.faculty_id,
        role: 'Sr_SV',
        block_number: null,
        squad_number: null,
        exam_date: schedule.exam_date,
        shift: schedule.shift,
      });
    });

    juniorSupervisors.forEach(({ faculty }) => {
      globallyAllocatedFacultyIds.add(faculty.faculty_id);
      allocations.push({
        exam_id: examId,
        schedule_id: schedule.schedule_id,
        faculty_id: faculty.faculty_id,
        role: 'Jr_SV',
        block_number: null,
        squad_number: null,
        exam_date: schedule.exam_date,
        shift: schedule.shift,
      });
    });

    squads.forEach((squad) => {
      squad.members.forEach((member) => {
        globallyAllocatedFacultyIds.add(member.faculty_id);
        allocations.push({
          exam_id: examId,
          schedule_id: schedule.schedule_id,
          faculty_id: member.faculty_id,
          role: 'Squad',
          block_number: null,
          squad_number: squad.squad_number,
          exam_date: schedule.exam_date,
          shift: schedule.shift,
        });
      });
    });

    sessions.push({
      schedule_id: schedule.schedule_id,
      date: schedule.exam_date,
      exam_date: schedule.exam_date,
      shift: schedule.shift,
      subject: schedule.subject_name,
      subject_name: schedule.subject_name,
      dept_id: schedule.dept_id,
      student_count: schedule.student_count,
      blocks: schedule.blocks,
      block_required: schedule.blocks,
      sr_supervisors: buildSeniorSessionSummary(seniorPool),
      senior_supervisors: buildSeniorSessionSummary(seniorPool),
      jr_supervisors: juniorSupervisors.map(({ faculty }) => ({
        block: null,
        block_number: null,
        faculty_id: faculty.faculty_id,
        faculty_name: faculty.name,
        name: faculty.name,
        employee_code: faculty.employee_code,
        dept_id: faculty.dept_id,
      })),
      junior_supervisors: juniorSupervisors.map(({ faculty }) => ({
        block: null,
        block_number: null,
        faculty_id: faculty.faculty_id,
        faculty_name: faculty.name,
        name: faculty.name,
        employee_code: faculty.employee_code,
        dept_id: faculty.dept_id,
      })),
      substitutes: [], 
      squads: squads.map((squad) => ({
        squad_number: squad.squad_number,
        members: squad.members.map((member) => buildFacultySummary(member)),
      })),
      unallocated: buildSessionUnallocated(
        activeFaculties,
        sessionUsedFacultyIds,
        globallyReservedIds,
        dayAllocatedFacultyIds
      ),
    });
  }

  const srSupervisors = seniorPool.map((faculty) => buildFacultySummary(faculty));
  const unallocated = buildGlobalUnallocated(activeFaculties, globallyAllocatedFacultyIds, globallyReservedIds);
  const overallSubstitutes = substitutePool.map((f) => buildFacultySummary(f));

  if (srSupervisors.length < (normalizedSchedules[0]?.totalStudents < 800 ? 1 : 2)) {
    warnings.push(`Senior Supervisor shortage: Only ${srSupervisors.length} selected.`);
  }
  if (overallSubstitutes.length < SUBSTITUTE_COUNT) {
    warnings.push(`Overall Substitute shortage: Only ${overallSubstitutes.length} selected.`);
  }

  for (const sub of overallSubstitutes) {
    allocations.push({
      exam_id: examId,
      schedule_id: null,
      faculty_id: sub.faculty_id,
      role: 'Overall_Substitute',
      block_number: null,
      squad_number: null,
      exam_date: null,
      shift: null,
    });
  }

  return {
    exam: {
      exam_id: examId,
      exam_name: examName,
    },
    sr_supervisors: srSupervisors,
    senior_supervisors: srSupervisors,
    overall_substitutes: overallSubstitutes,
    global_substitutes: overallSubstitutes,
    sessions,
    allocations,
    counters: Array.from(counterMap.values()).map((counter) => ({
      faculty_id: counter.faculty_id,
      jr_sv_count: counter.jr_sv_count,
      sr_sv_count: counter.sr_sv_count,
      squad_count: counter.squad_count,
      total_allocations: counter.total_allocations,
      last_allocated_term: counter.last_allocated_term,
      last_allocated_exam: counter.last_allocated_exam,
    })),
    unallocated,
    warnings,
    summary: {
      total_sessions: sessions.length,
      total_junior_supervisors: allocations.filter((item) => item.role === 'Jr_SV').length,
      total_senior_supervisors: srSupervisors.length,
      total_squad_members: allocations.filter((item) => item.role === 'Squad').length,
      total_unallocated: unallocated.length,
    },
  };
}

export function generateAllocations({ faculties, fairnessCounters, schedules, examId, examName, deptBlockRules = [] }) {
  return generateAllocation(schedules, faculties, {
    fairnessCounters,
    deptBlockRules,
    examId,
    examName,
  });
}
