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
  counter[roleCountKey(role)] += 1;
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

function getDailyAssignedFacultyIds(dayUsage, examDate) {
  if (!dayUsage.has(examDate)) {
    dayUsage.set(examDate, new Set());
  }

  return dayUsage.get(examDate);
}

function getAvailableCandidates(faculties, sessionUsedFacultyIds, globallyReservedFacultyIds, dayAllocatedFacultyIds, eligibilityCheck) {
  return faculties.filter((faculty) => {
    if (sessionUsedFacultyIds.has(faculty.faculty_id)) return false;
    if (globallyReservedFacultyIds.has(faculty.faculty_id)) return false;
    if (dayAllocatedFacultyIds.has(faculty.faculty_id)) return false;
    if (typeof eligibilityCheck === 'function' && !eligibilityCheck(faculty)) return false;
    return true;
  });
}

// Allocates Junior Supervisors: 1 per block.
// Uses sessionUsedFacultyIds directly (no copy) so picks are visible to all subsequent allocators.
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
}) {
  const deptCounters = new Map();
  const maxPerDept = totalDepartments > 0 ? Math.ceil(blockCount / totalDepartments) : null;

  // Pool is re-computed dynamically so every update to sessionUsedFacultyIds is immediately visible
  const getPool = () =>
    faculties.filter((f) => {
      if (sessionUsedFacultyIds.has(f.faculty_id)) return false;  // already used this session
      if (globallyReservedFacultyIds.has(f.faculty_id)) return false; // Sr SV
      if (dayAllocatedFacultyIds.has(f.faculty_id)) return false;     // already used today
      if (!isJuniorEligible(f)) return false;
      if (scheduleDeptId && f.dept_id === scheduleDeptId) return false; // same dept as exam
      return true;
    });

  const selected = [];

  for (let block = 1; block <= blockCount; block++) {
    const pool = getPool().sort(createRoleComparator('Jr_SV', counters, randomOrder));

    // Respect dept cap; fallback to any eligible faculty if cap prevents filling
    let pick = null;
    for (const candidate of pool) {
      const dCount = deptCounters.get(candidate.dept_id) || 0;
      if (maxPerDept === null || dCount < maxPerDept) { pick = candidate; break; }
    }
    if (!pick) pick = pool[0] ?? null; // soft fallback
    if (!pick) break;

    // Immediately remove from pool by adding to the shared Sets
    sessionUsedFacultyIds.add(pick.faculty_id);
    dayAllocatedFacultyIds.add(pick.faculty_id);
    deptCounters.set(pick.dept_id, (deptCounters.get(pick.dept_id) || 0) + 1);
    updateCounter(counters, pick.faculty_id, 'Jr_SV', examId, termLabel);
    selected.push({ faculty: pick, blockNumber: block });
  }

  console.log(`[Jr SV] Blocks: ${blockCount}, Assigned: ${selected.length}`);
  return selected;
}

// Generic sequential allocator (for substitutes and other roles).
// Uses sessionUsedFacultyIds directly — no copy — so all updates are immediately visible.
function allocateSequentialFaculty({
  faculties,
  count,
  counters,
  randomOrder,
  role,
  eligibilityCheck,
  globallyReservedFacultyIds,
  dayAllocatedFacultyIds,
  sessionUsedFacultyIds,
  examId,
  termLabel,
}) {
  const selected = [];

  for (let i = 0; i < count; i++) {
    const pool = faculties
      .filter((f) => {
        if (sessionUsedFacultyIds.has(f.faculty_id)) return false;   // used this session (any role)
        if (globallyReservedFacultyIds.has(f.faculty_id)) return false;
        if (dayAllocatedFacultyIds.has(f.faculty_id)) return false;  // used today (any shift)
        if (typeof eligibilityCheck === 'function' && !eligibilityCheck(f)) return false;
        return true;
      })
      .sort(createRoleComparator(role, counters, randomOrder));

    const pick = pool[0] ?? null;
    if (!pick) break;

    // Immediately remove from all shared pools
    sessionUsedFacultyIds.add(pick.faculty_id);
    dayAllocatedFacultyIds.add(pick.faculty_id);
    updateCounter(counters, pick.faculty_id, role, examId, termLabel);
    selected.push(pick);
  }

  return selected;
}

function isFemaleFaculty(faculty) {
  const gender = String(faculty.gender ?? '').trim().toLowerCase();
  return gender === 'f' || gender === 'female';
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

  // ── STEP 0: Build eligible pool (not Sr SV, not Jr SV, active)
  const eligiblePool = faculties.filter((f) => {
    if (sessionUsedFacultyIds.has(f.faculty_id)) return false;
    if (globallyReservedFacultyIds.has(f.faculty_id)) return false;
    if (dayAllocatedFacultyIds.has(f.faculty_id)) return false;
    return true;
  });

  // ── STEP 2: GLOBAL FAIR SORT — done ONCE, never re-sorted inside the loop
  // Order: squad_count ASC → total_allocations ASC → last_allocated_term ASC → experience DESC
  const sortedPool = [...eligiblePool].sort((a, b) => {
    const cA = getCounter(counters, a.faculty_id);
    const cB = getCounter(counters, b.faculty_id);
    if (cA.squad_count !== cB.squad_count) return cA.squad_count - cB.squad_count;
    if (cA.total_allocations !== cB.total_allocations) return cA.total_allocations - cB.total_allocations;
    const termCompare = compareNullableAscending(cA.last_allocated_order, cB.last_allocated_order);
    if (termCompare !== 0) return termCompare;
    return Number(b.experience_years ?? 0) - Number(a.experience_years ?? 0);
  });

  console.log(`[Squad] Required: ${squadCount}, Pool size: ${sortedPool.length}`);

  // Track who has been picked — removal means splicing from sortedPool
  const taken = new Set();
  const removeFromPool = (faculty) => {
    taken.add(faculty.faculty_id);
    const idx = sortedPool.findIndex(f => f.faculty_id === faculty.faculty_id);
    if (idx >= 0) sortedPool.splice(idx, 1);
  };

  // ── STEP 3: Build each squad
  for (let squadNumber = 1; squadNumber <= squadCount; squadNumber += 1) {
    if (sortedPool.length < 1) {
      console.warn(`[Squad] Pool exhausted at squad ${squadNumber}`);
      break;
    }

    // 1️⃣ Pick FEMALE — first female in the already-sorted pool
    let m1idx = sortedPool.findIndex(f => isFemaleFaculty(f));
    let m1;
    if (m1idx >= 0) {
      m1 = sortedPool[m1idx];
    } else {
      // Fallback: first available in sorted pool
      m1 = sortedPool[0] ?? null;
    }
    if (!m1) break;
    removeFromPool(m1);

    // 2️⃣ Pick HIGH EXPERIENCE — highest experience_years from remaining pool
    if (sortedPool.length < 1) break;
    let m2 = sortedPool.reduce((best, f) =>
      Number(f.experience_years ?? 0) > Number(best.experience_years ?? 0) ? f : best,
      sortedPool[0]
    );
    removeFromPool(m2);

    // 3️⃣ Pick LEAST USED — first person from the sorted pool (already sorted by least used)
    if (sortedPool.length < 1) break;
    const m3 = sortedPool[0];
    removeFromPool(m3);

    // ── STEP 4: Update counters for all 3
    const members = [m1, m2, m3];
    for (const member of members) {
      sessionUsedFacultyIds.add(member.faculty_id);
      dayAllocatedFacultyIds.add(member.faculty_id);
      updateCounter(counters, member.faculty_id, 'Squad', examId, termLabel);
    }

    // ── STEP 5: Store squad
    squads.push({ squad_number: squadNumber, members });
  }

  console.log(`[Squad] Formed: ${squads.length}/${squadCount}`);
  return squads;
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

  for (const senior of seniorPool) {
    globallyAllocatedFacultyIds.add(senior.faculty_id);
  }

  for (const schedule of normalizedSchedules) {
    const dayAllocatedFacultyIds = getDailyAssignedFacultyIds(dayUsage, schedule.exam_date);

    // Seed the day-level Set with Sr SV so they are protected from any intra-day reassignment
    for (const senior of seniorPool) {
      dayAllocatedFacultyIds.add(senior.faculty_id);
    }

    // sessionUsedFacultyIds is the single source of truth for this session.
    // All three allocators (Jr SV, Substitutes, Squads) READ and WRITE to this same Set.
    const sessionUsedFacultyIds = new Set(seniorPoolIds);

    const juniorSupervisors = allocateJuniorSupervisors({
      faculties: activeFaculties,
      blockCount: schedule.blocks,
      counters: counterMap,
      randomOrder,
      globallyReservedFacultyIds: seniorPoolIds,
      dayAllocatedFacultyIds,
      sessionUsedFacultyIds,
      examId,
      termLabel,
      scheduleDeptId: schedule.dept_id,
      totalDepartments,
    });

    const substitutes = allocateSequentialFaculty({
      faculties: activeFaculties,
      count: SUBSTITUTE_COUNT,
      counters: counterMap,
      randomOrder,
      role: 'Jr_SV',
      eligibilityCheck: isJuniorEligible,
      globallyReservedFacultyIds: seniorPoolIds,
      dayAllocatedFacultyIds,
      sessionUsedFacultyIds,
      examId,
      termLabel,
    });

    const squadsRequired = Math.ceil(schedule.blocks / 10);
    const squads = allocateSquads({
      faculties: activeFaculties,
      squadCount: squadsRequired,
      counters: counterMap,
      globallyReservedFacultyIds: seniorPoolIds,
      dayAllocatedFacultyIds,
      sessionUsedFacultyIds,
      examId,
      termLabel,
    });

    if (juniorSupervisors.length < schedule.blocks) {
      warnings.push(`${schedule.subject_name} on ${schedule.exam_date} ${schedule.shift}: junior supervisor shortage.`);
    }
    if (substitutes.length < SUBSTITUTE_COUNT) {
      warnings.push(`${schedule.subject_name} on ${schedule.exam_date} ${schedule.shift}: substitute junior supervisor shortage.`);
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

    juniorSupervisors.forEach(({ faculty, blockNumber }) => {
      globallyAllocatedFacultyIds.add(faculty.faculty_id);
      allocations.push({
        exam_id: examId,
        schedule_id: schedule.schedule_id,
        faculty_id: faculty.faculty_id,
        role: 'Jr_SV',
        block_number: blockNumber,
        squad_number: null,
        exam_date: schedule.exam_date,
        shift: schedule.shift,
      });
    });

    substitutes.forEach((faculty) => {
      globallyAllocatedFacultyIds.add(faculty.faculty_id);
      allocations.push({
        exam_id: examId,
        schedule_id: schedule.schedule_id,
        faculty_id: faculty.faculty_id,
        role: 'Substitute',
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
      jr_supervisors: juniorSupervisors.map(({ faculty, blockNumber }) => ({
        block: blockNumber,
        block_number: blockNumber,
        faculty_id: faculty.faculty_id,
        faculty_name: faculty.name,
        name: faculty.name,
        employee_code: faculty.employee_code,
        dept_id: faculty.dept_id,
      })),
      junior_supervisors: juniorSupervisors.map(({ faculty, blockNumber }) => ({
        block: blockNumber,
        block_number: blockNumber,
        faculty_id: faculty.faculty_id,
        faculty_name: faculty.name,
        name: faculty.name,
        employee_code: faculty.employee_code,
        dept_id: faculty.dept_id,
      })),
      substitutes: substitutes.map((faculty) => buildFacultySummary(faculty)),
      squads: squads.map((squad) => ({
        squad_number: squad.squad_number,
        members: squad.members.map((member) => buildFacultySummary(member)),
      })),
      unallocated: buildSessionUnallocated(
        activeFaculties,
        sessionUsedFacultyIds,
        seniorPoolIds,
        dayAllocatedFacultyIds
      ),
    });
  }

  const srSupervisors = seniorPool.map((faculty) => buildFacultySummary(faculty));
  const unallocated = buildGlobalUnallocated(activeFaculties, globallyAllocatedFacultyIds, seniorPoolIds);

  return {
    exam: {
      exam_id: examId,
      exam_name: examName,
    },
    sr_supervisors: srSupervisors,
    senior_supervisors: srSupervisors,
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

export function generateAllocations({ faculties, fairnessCounters, schedules, examId, examName }) {
  return generateAllocation(schedules, faculties, {
    fairnessCounters,
    examId,
    examName,
  });
}
