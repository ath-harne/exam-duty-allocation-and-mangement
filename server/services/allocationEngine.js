function roleCountKey(role) {
  if (role === 'Jr_SV') return 'jr_sv_count';
  if (role === 'Sr_SV') return 'sr_sv_count';
  return 'squad_count';
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
        last_allocated_exam: counter.last_allocated_exam ?? null,
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
      last_allocated_exam: null,
    });
  }

  return counterMap.get(facultyId);
}

function updateCounter(counterMap, facultyId, role, examId) {
  const counter = getCounter(counterMap, facultyId);
  counter[roleCountKey(role)] += 1;
  counter.total_allocations += 1;
  counter.last_allocated_exam = examId;
}

function isSeniorEligible(faculty) {
  const designation = faculty.designation.toLowerCase();
  return (
    designation.includes('hod') ||
    designation.includes('associate') ||
    designation.includes('professor') ||
    faculty.qualification === 'PhD' ||
    faculty.experience_years >= 10
  );
}

function isJuniorEligible(faculty) {
  if (faculty.teaching_type === 'NT') {
    return faculty.experience_years >= 5;
  }
  return ['Graduate', 'Postgraduate', 'PhD'].includes(faculty.qualification);
}

function compareSenior(a, b, counters, examId) {
  const counterA = getCounter(counters, a.faculty_id);
  const counterB = getCounter(counters, b.faculty_id);

  if (counterA.sr_sv_count !== counterB.sr_sv_count) return counterA.sr_sv_count - counterB.sr_sv_count;
  if ((counterA.last_allocated_exam === examId) !== (counterB.last_allocated_exam === examId)) {
    return counterA.last_allocated_exam === examId ? 1 : -1;
  }
  if (a.experience_years !== b.experience_years) return b.experience_years - a.experience_years;
  return a.name.localeCompare(b.name);
}

function compareJunior(a, b, counters, examId, deptUsage) {
  if (a.teaching_type !== b.teaching_type) {
    return a.teaching_type === 'T' ? -1 : 1;
  }

  const counterA = getCounter(counters, a.faculty_id);
  const counterB = getCounter(counters, b.faculty_id);

  if (counterA.jr_sv_count !== counterB.jr_sv_count) return counterA.jr_sv_count - counterB.jr_sv_count;
  if ((counterA.last_allocated_exam === examId) !== (counterB.last_allocated_exam === examId)) {
    return counterA.last_allocated_exam === examId ? 1 : -1;
  }

  const deptA = deptUsage.get(a.dept_id) ?? 0;
  const deptB = deptUsage.get(b.dept_id) ?? 0;
  if (deptA !== deptB) return deptA - deptB;

  return a.name.localeCompare(b.name);
}

function compareSquad(a, b, counters, examId) {
  const counterA = getCounter(counters, a.faculty_id);
  const counterB = getCounter(counters, b.faculty_id);

  if (counterA.squad_count !== counterB.squad_count) return counterA.squad_count - counterB.squad_count;
  if ((counterA.last_allocated_exam === examId) !== (counterB.last_allocated_exam === examId)) {
    return counterA.last_allocated_exam === examId ? 1 : -1;
  }
  if (a.experience_years !== b.experience_years) return b.experience_years - a.experience_years;
  return a.name.localeCompare(b.name);
}

function allocateSeniorSupervisors(pool, counters, examId, requiredCount, usedFacultyIds) {
  const selected = [];
  const eligible = pool
    .filter((faculty) => !usedFacultyIds.has(faculty.faculty_id) && isSeniorEligible(faculty))
    .sort((a, b) => compareSenior(a, b, counters, examId));

  for (const faculty of eligible) {
    if (selected.length >= requiredCount) break;
    selected.push(faculty);
    usedFacultyIds.add(faculty.faculty_id);
    updateCounter(counters, faculty.faculty_id, 'Sr_SV', examId);
  }

  return selected;
}

function allocateJuniorSupervisors(pool, counters, examId, requiredBlocks, usedFacultyIds) {
  const allocations = [];
  const deptUsage = new Map();
  const eligible = pool
    .filter((faculty) => !usedFacultyIds.has(faculty.faculty_id) && isJuniorEligible(faculty))
    .sort((a, b) => compareJunior(a, b, counters, examId, deptUsage));

  for (let blockNumber = 1; blockNumber <= requiredBlocks; blockNumber += 1) {
    const next = eligible.find((faculty) => !usedFacultyIds.has(faculty.faculty_id));
    if (!next) break;

    usedFacultyIds.add(next.faculty_id);
    allocations.push({
      faculty: next,
      block_number: blockNumber,
    });
    deptUsage.set(next.dept_id, (deptUsage.get(next.dept_id) ?? 0) + 1);
    updateCounter(counters, next.faculty_id, 'Jr_SV', examId);
  }

  return allocations;
}

function allocateSquads(pool, counters, examId, squadCount, usedFacultyIds) {
  const squads = [];

  for (let squadNumber = 1; squadNumber <= squadCount; squadNumber += 1) {
    const eligible = pool
      .filter((faculty) => !usedFacultyIds.has(faculty.faculty_id))
      .sort((a, b) => compareSquad(a, b, counters, examId));

    if (eligible.length === 0) break;

    const members = [];
    const female = eligible.find((faculty) => faculty.gender === 'F');
    if (female) {
      members.push(female);
      usedFacultyIds.add(female.faculty_id);
    }

    const experienced = eligible.find(
      (faculty) => !usedFacultyIds.has(faculty.faculty_id) && faculty.experience_years >= 10
    );
    if (experienced) {
      members.push(experienced);
      usedFacultyIds.add(experienced.faculty_id);
    }

    for (const faculty of eligible) {
      if (members.length >= 3) break;
      if (!usedFacultyIds.has(faculty.faculty_id)) {
        members.push(faculty);
        usedFacultyIds.add(faculty.faculty_id);
      }
    }

    if (!members.length) continue;

    for (const member of members) {
      updateCounter(counters, member.faculty_id, 'Squad', examId);
    }

    squads.push({
      squad_number: squadNumber,
      members,
    });
  }

  return squads;
}

export function generateAllocations({ faculties, fairnessCounters, schedules, examId, examName }) {
  const activeFaculties = faculties.filter((faculty) => !faculty.is_on_leave);
  const counterMap = createCounterMap(fairnessCounters);
  const allocations = [];
  const slotUsage = new Map();
  const sessionSummaries = [];
  const warnings = [];

  for (const schedule of schedules) {
    const slotKey = `${schedule.exam_date}_${schedule.shift}`;
    const usedFacultyIds = slotUsage.get(slotKey) ?? new Set();
    slotUsage.set(slotKey, usedFacultyIds);

    const juniorAllocations = allocateJuniorSupervisors(
      activeFaculties,
      counterMap,
      examId,
      schedule.block_required,
      usedFacultyIds
    );
    const seniorRequired = schedule.block_required > 20 ? 2 : 1;
    const seniorAllocations = allocateSeniorSupervisors(
      activeFaculties,
      counterMap,
      examId,
      seniorRequired,
      usedFacultyIds
    );
    const requiredSquads = Math.ceil(schedule.block_required / 10);
    const squadAllocations = allocateSquads(
      activeFaculties,
      counterMap,
      examId,
      requiredSquads,
      usedFacultyIds
    );

    if (juniorAllocations.length < schedule.block_required) {
      warnings.push(`${schedule.subject_name} on ${schedule.exam_date} ${schedule.shift}: junior supervisor shortage.`);
    }
    if (seniorAllocations.length < seniorRequired) {
      warnings.push(`${schedule.subject_name} on ${schedule.exam_date} ${schedule.shift}: senior supervisor shortage.`);
    }
    if (squadAllocations.length < requiredSquads) {
      warnings.push(`${schedule.subject_name} on ${schedule.exam_date} ${schedule.shift}: squad shortage.`);
    }

    for (const item of juniorAllocations) {
      allocations.push({
        exam_id: examId,
        schedule_id: schedule.schedule_id,
        faculty_id: item.faculty.faculty_id,
        role: 'Jr_SV',
        block_number: item.block_number,
        squad_number: null,
        exam_date: schedule.exam_date,
        shift: schedule.shift,
      });
    }

    for (const faculty of seniorAllocations) {
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
    }

    for (const squad of squadAllocations) {
      for (const member of squad.members) {
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
      }
    }

    sessionSummaries.push({
      schedule_id: schedule.schedule_id,
      subject_name: schedule.subject_name,
      dept_id: schedule.dept_id,
      exam_date: schedule.exam_date,
      shift: schedule.shift,
      block_required: schedule.block_required,
      junior_supervisors: juniorAllocations.map((item) => ({
        block_number: item.block_number,
        faculty_id: item.faculty.faculty_id,
        faculty_name: item.faculty.name,
        employee_code: item.faculty.employee_code,
        dept_id: item.faculty.dept_id,
      })),
      senior_supervisors: seniorAllocations.map((faculty) => ({
        faculty_id: faculty.faculty_id,
        faculty_name: faculty.name,
        employee_code: faculty.employee_code,
        designation: faculty.designation,
        experience_years: faculty.experience_years,
      })),
      squads: squadAllocations.map((squad) => ({
        squad_number: squad.squad_number,
        members: squad.members.map((member) => ({
          faculty_id: member.faculty_id,
          faculty_name: member.name,
          employee_code: member.employee_code,
          gender: member.gender,
          experience_years: member.experience_years,
        })),
      })),
    });
  }

  const allocatedFacultyIds = new Set(allocations.map((item) => item.faculty_id));
  const unallocated = activeFaculties
    .filter((faculty) => !allocatedFacultyIds.has(faculty.faculty_id))
    .map((faculty) => ({
      faculty_id: faculty.faculty_id,
      employee_code: faculty.employee_code,
      faculty_name: faculty.name,
      dept_id: faculty.dept_id,
      designation: faculty.designation,
    }));

  return {
    exam: {
      exam_id: examId,
      exam_name: examName,
    },
    allocations,
    counters: Array.from(counterMap.values()),
    unallocated,
    sessions: sessionSummaries,
    warnings,
    summary: {
      total_sessions: sessionSummaries.length,
      total_junior_supervisors: allocations.filter((item) => item.role === 'Jr_SV').length,
      total_senior_supervisors: allocations.filter((item) => item.role === 'Sr_SV').length,
      total_squad_members: allocations.filter((item) => item.role === 'Squad').length,
      total_unallocated: unallocated.length,
    },
  };
}
