import type { Catalog, Course, Evidence, Fixture, Meeting, Program, Section, WorkspaceState } from "@/domain/types"

const meeting = (days: Meeting["days"], start: string, end: string, type: Meeting["type"] = "lecture", location = "Main Quad"): Meeting => ({
  days,
  start,
  end,
  timezone: "America/Los_Angeles",
  type,
  location
})

const courseRows: Array<[string, string, string, number, number, string, string[]]> = [
  ["CS 106A", "Programming Methodology", "CS", 100, 5, "Problem solving and programming foundations.", ["foundation"]],
  ["CS 106B", "Programming Abstractions", "CS", 100, 5, "Data structures, recursion, and abstraction.", ["foundation", "systems"]],
  ["CS 107", "Computer Organization", "CS", 100, 5, "How software maps to machines and memory.", ["systems"]],
  ["CS 109", "Probability for Computer Scientists", "CS", 100, 5, "Probability tools for computing.", ["theory", "ai"]],
  ["CS 111", "Operating Systems Principles", "CS", 100, 4, "Processes, concurrency, and storage.", ["systems"]],
  ["CS 124", "From Languages to Information", "CS", 100, 4, "Language, information, and computation.", ["language"]],
  ["CS 142", "Web Applications", "CS", 100, 4, "Full stack web application design.", ["web"]],
  ["CS 147", "Introduction to Human Computer Interaction", "CS", 100, 4, "Human centered design and interactive systems.", ["design", "hci"]],
  ["CS 147B", "Advanced Interaction Design", "CS", 100, 3, "Studio work in advanced interaction design.", ["design", "hci"]],
  ["CS 148", "Introduction to Computer Graphics", "CS", 100, 4, "Rendering, geometry, and visual computing.", ["graphics"]],
  ["CS 161", "Design and Analysis of Algorithms", "CS", 100, 5, "Algorithms and complexity.", ["theory"]],
  ["CS 181", "Computers, Ethics, and Public Policy", "CS", 100, 4, "Social consequences of computing.", ["society"]],
  ["CS 221", "Artificial Intelligence Principles", "CS", 200, 4, "Core techniques in artificial intelligence.", ["ai"]],
  ["CS 224N", "Natural Language Processing", "CS", 200, 4, "Neural methods for language.", ["ai", "language"]],
  ["CS 229", "Machine Learning", "CS", 200, 4, "Statistical and computational learning.", ["ai"]],
  ["CS 231N", "Deep Learning for Computer Vision", "CS", 200, 4, "Visual recognition with neural networks.", ["ai", "vision"]],
  ["CS 238", "Decision Making under Uncertainty", "CS", 200, 4, "Sequential decisions and uncertainty.", ["ai"]],
  ["CS 103", "Mathematical Foundations of Computing", "CS", 100, 5, "Proofs, discrete structures, computability, and complexity.", ["foundation", "theory"]],
  ["CS 154", "Introduction to Automata and Complexity Theory", "CS", 100, 4, "Automata, computability, and computational complexity.", ["theory"]],
  ["CS 155", "Computer and Network Security", "CS", 100, 3, "Principles and practice of building secure computer systems.", ["systems", "security"]],
  ["CS 205L", "Continuous Mathematical Methods", "CS", 200, 3, "Mathematical tools for modeling and computation.", ["math", "ai"]],
  ["CS 210", "Software Project Experience", "CS", 200, 4, "Team-based software product development.", ["product", "systems"]],
  ["CS 230", "Deep Learning", "CS", 200, 3, "Foundations and applications of deep neural networks.", ["ai"]],
  ["CS 246", "Mining Massive Data Sets", "CS", 200, 3, "Algorithms for large-scale data analysis.", ["ai", "data"]],
  ["DATASCI 112", "Principles of Data Science", "DATASCI", 100, 4, "Core ideas in computational and inferential data analysis.", ["data", "foundation"]],
  ["STATS 200", "Introduction to Statistical Inference", "STATS", 200, 4, "Probability models, estimation, and hypothesis testing.", ["data", "math"]],
  ["STATS 202", "Data Mining and Analysis", "STATS", 200, 3, "Applied methods for finding structure in complex data.", ["data", "ai"]],
  ["SYMSYS 1", "Minds and Machines", "SYMSYS", 1, 4, "An interdisciplinary introduction to minds, symbols, and computation.", ["cognition", "ai"]],
  ["PSYCH 50", "Introduction to Cognitive Neuroscience", "PSYCH", 50, 4, "Neural systems underlying cognition and behavior.", ["cognition", "health"]],
  ["PHIL 80", "Mind, Matter, and Meaning", "PHIL", 80, 4, "Philosophical questions about mind, language, and representation.", ["cognition", "humanities"]],
  ["BIOE 101", "Systems Biology", "BIOE", 100, 3, "Quantitative approaches to biological systems.", ["health", "biology"]],
  ["BIOE 141A", "Senior Capstone Design", "BIOE", 100, 4, "Team-based bioengineering design and capstone work.", ["health", "design"]],
  ["BIOMEDIN 215", "Data-Driven Medicine", "BIOMEDIN", 200, 3, "Methods for working with biomedical and clinical data.", ["health", "data", "ai"]],
  ["HUMBIO 2A", "Genetics, Evolution, and Ecology", "HUMBIO", 1, 5, "Biological foundations within the Human Biology core.", ["health", "biology"]],
  ["HUMBIO 2B", "Culture, Evolution, and Society", "HUMBIO", 1, 5, "Behavioral and social perspectives within the Human Biology core.", ["health", "society"]],
  ["DESIGN 1", "Designing Your Stanford", "DESIGN", 1, 2, "Design methods applied to choices and experiences at Stanford.", ["design", "planning"]],
  ["DESIGN 161", "Designing Social Impact", "DESIGN", 100, 4, "Human-centered design for social and public challenges.", ["design", "society"]],
  ["MS&E 120", "Probabilistic Analysis", "MS&E", 100, 4, "Probability models for engineering and management decisions.", ["math", "decision"]],
  ["MS&E 140", "Accounting for Managers and Entrepreneurs", "MS&E", 100, 4, "Financial information for management and entrepreneurship.", ["business", "product"]],
  ["ECON 50", "Economic Analysis I", "ECON", 50, 5, "Core microeconomic analysis.", ["economics", "theory"]],
  ["ECON 102A", "Introduction to Statistical Methods", "ECON", 100, 5, "Statistical tools for economic analysis.", ["economics", "data"]],
  ["COMM 166", "Virtual People", "COMM", 100, 4, "How people respond to mediated and virtual social experiences.", ["hci", "society"]],
  ["ARTSTUDI 160", "Intro to Digital Art", "ARTSTUDI", 100, 4, "Digital tools, visual experimentation, and critical making.", ["art", "design"]],
  ["MATH 51", "Linear Algebra and Multivariable Calculus", "MATH", 50, 4, "Linear algebra and multivariable calculus.", ["math"]],
  ["MATH 104", "Applied Matrix Theory", "MATH", 100, 3, "Matrix methods and applications.", ["math"]],
  ["STATS 116", "Theory of Probability", "STATS", 100, 4, "Foundations of probability.", ["math"]],
  ["DESIGN 60", "Design Foundations", "DESIGN", 60, 2, "A compact studio in observation and prototyping.", ["design"]],
  ["COMM 1", "Public Speaking", "COMM", 1, 3, "Speaking, argument, and audience.", ["communication"]],
  ["PWR 1", "Writing and Rhetoric", "PWR", 1, 4, "Research based writing and rhetoric.", ["writing"]],
  ["ECON 1", "Principles of Economics", "ECON", 1, 5, "Microeconomic and macroeconomic foundations.", ["social-science"]],
  ["BIO 41", "Genetics, Biochemistry, and Molecular Biology", "BIO", 40, 5, "Molecular foundations of biology.", ["science"]],
  ["PHYSICS 41", "Mechanics", "PHYSICS", 40, 4, "Mechanics with calculus.", ["science"]],
  ["PSYCH 1", "Introduction to Psychology", "PSYCH", 1, 5, "Mind, behavior, and scientific evidence.", ["social-science"]],
  ["HISTORY 1", "The Human Past", "HISTORY", 1, 4, "Methods and arguments in history.", ["humanities"]],
  ["MS&E 193", "Technology and National Security", "MS&E", 100, 3, "Technology, institutions, and security.", ["policy"]],
  ["CS 999", "Independent Topics Placeholder", "CS", 900, 3, "A catalog record deliberately lacking a current offering.", ["research-gap"]]
]

const slug = (code: string) => code.replaceAll(" ", "-").replaceAll("&", "AND")

const courses = (): Course[] => courseRows.map(([code, title, subject, level, units, description, tags]) => ({
  id: `COURSE-${slug(code)}`,
  code,
  title,
  description,
  subject,
  level,
  minUnits: units,
  maxUnits: units,
  tags,
  sourceUrl: "https://explorecourses.stanford.edu/",
  catalogYear: "2026-27",
  prerequisites: code === "CS 106B" ? ["COURSE-CS-106A"] : code === "CS 221" ? ["COURSE-CS-106B"] : undefined,
  prerequisiteUncertain: code === "CS 147B"
}))

const section = (
  id: string,
  courseId: string,
  units: number,
  meetings: Meeting[],
  evidenceIds = ["EVIDENCE-TERM-SCHEDULE"],
  final?: { start: string, end: string }
): Section => ({ id, courseId, termId: "TERM-2026-AUTUMN", sectionNumber: "01", instructor: "Course staff", units, meetings, evidenceIds, final })

const sections = (): Section[] => [
  section("SECTION-CS-106A-01", "COURSE-CS-106A", 5, [meeting(["tue", "thu"], "11:30", "12:50")]),
  section("SECTION-CS-106B-01", "COURSE-CS-106B", 5, [meeting(["mon", "wed"], "10:00", "11:20")], ["EVIDENCE-TERM-SCHEDULE"], { start: "2026-12-08T09:00:00-08:00", end: "2026-12-08T12:00:00-08:00" }),
  section("SECTION-CS-107-01", "COURSE-CS-107", 5, [meeting(["tue", "thu"], "15:00", "16:20")]),
  section("SECTION-CS-109-01", "COURSE-CS-109", 5, [meeting(["mon", "wed", "fri"], "13:30", "14:20")]),
  section("SECTION-CS-111-01", "COURSE-CS-111", 4, [meeting(["tue", "thu"], "13:30", "14:50")]),
  section("SECTION-CS-124-01", "COURSE-CS-124", 4, [meeting(["mon", "wed"], "15:00", "16:20")]),
  section("SECTION-CS-142-01", "COURSE-CS-142", 4, [meeting(["tue", "thu"], "10:00", "11:20")]),
  section("SECTION-CS-147-01", "COURSE-CS-147", 4, [meeting(["tue", "thu"], "15:00", "16:20")]),
  section("SECTION-CS-147B-01", "COURSE-CS-147B", 3, [meeting(["wed"], "15:00", "17:50")]),
  section("SECTION-CS-148-01", "COURSE-CS-148", 4, [meeting(["mon", "wed"], "13:30", "14:50")]),
  section("SECTION-CS-161-01", "COURSE-CS-161", 5, [meeting(["tue", "thu"], "09:00", "10:20")]),
  section("SECTION-CS-181-01", "COURSE-CS-181", 4, [meeting(["mon", "wed"], "11:30", "12:50")]),
  section("SECTION-CS-221-01", "COURSE-CS-221", 4, [meeting(["tue", "thu"], "16:30", "17:50")]),
  section("SECTION-CS-224N-01", "COURSE-CS-224N", 4, [meeting(["mon", "wed"], "16:30", "17:50")]),
  section("SECTION-CS-229-01", "COURSE-CS-229", 4, [meeting(["tue", "thu"], "13:30", "14:50")]),
  section("SECTION-CS-231N-01", "COURSE-CS-231N", 4, [meeting(["mon", "wed"], "14:00", "15:20")]),
  section("SECTION-MATH-51-01", "COURSE-MATH-51", 4, [meeting(["tue", "thu"], "13:30", "14:50")]),
  section("SECTION-DESIGN-60-01", "COURSE-DESIGN-60", 2, [meeting(["wed"], "14:00", "15:20", "seminar", "d.school")]),
  section("SECTION-COMM-1-01", "COURSE-COMM-1", 3, [meeting(["tue", "thu"], "09:00", "10:20")]),
  section("SECTION-PWR-1-01", "COURSE-PWR-1", 4, [meeting(["mon", "wed"], "11:30", "12:50")]),
  section("SECTION-CONFLICTING", "COURSE-COMM-1", 3, [meeting(["mon"], "10:30", "11:50")]),
  section("SECTION-FINAL-CONFLICT", "COURSE-COMM-1", 3, [meeting(["tue"], "09:00", "10:20")], ["EVIDENCE-TERM-SCHEDULE"], { start: "2026-12-08T10:00:00-08:00", end: "2026-12-08T13:00:00-08:00" }),
  section("SECTION-FRIDAY", "COURSE-COMM-1", 3, [meeting(["fri"], "10:00", "11:20")]),
  section("SECTION-EARLY", "COURSE-COMM-1", 3, [meeting(["tue", "thu"], "07:30", "08:50")]),
  section("SECTION-TIGHT-TRANSITION", "COURSE-COMM-1", 3, [meeting(["mon"], "11:25", "12:45", "lecture", "Engineering Quad")]),
  section("SECTION-STALE", "COURSE-COMM-1", 3, [meeting(["tue", "thu"], "09:00", "10:20")], ["EVIDENCE-STALE-OFFERING"])
]

export const buildStanfordEvidence = (): Evidence[] => [
  {
    id: "EVIDENCE-TERM-SCHEDULE",
    classification: "official",
    authority: "term_schedule",
    claim: "Illustrative Autumn 2026 section and meeting data for the product demo.",
    sourceUrl: "https://explorecourses.stanford.edu/",
    sourceTitle: "Stanford ExploreCourses",
    retrievedAt: "2026-08-20T12:00:00Z",
    expiresAt: "2026-10-01T00:00:00Z",
    confidence: 0.9,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-PROGRAM-REQUIREMENTS",
    classification: "official",
    authority: "program_requirements",
    claim: "Illustrative requirement structure grounded in an official program source.",
    sourceUrl: "https://bulletin.stanford.edu/programs/CS-BS",
    sourceTitle: "Stanford Bulletin",
    retrievedAt: "2026-08-20T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 0.9,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-SYMBO-PROGRAM",
    classification: "official",
    authority: "program_requirements",
    claim: "Official 2026-27 Symbolic Systems BS program reference.",
    sourceUrl: "https://bulletin.stanford.edu/programs/SYMBO-BS",
    sourceTitle: "Stanford Bulletin: Symbolic Systems BS",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-DATSC-PROGRAM",
    classification: "official",
    authority: "program_requirements",
    claim: "Official 2026-27 Data Science BS program reference.",
    sourceUrl: "https://bulletin.stanford.edu/programs/DATSC-BS",
    sourceTitle: "Stanford Bulletin: Data Science BS",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-BMC-PROGRAM",
    classification: "official",
    authority: "program_requirements",
    claim: "Official 2026-27 Biomedical Computation BS program reference.",
    sourceUrl: "https://bulletin.stanford.edu/programs/16kZ1nSLynUYAQA95BOf",
    sourceTitle: "Stanford Bulletin: Biomedical Computation BS",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-DESIGN-PROGRAM",
    classification: "official",
    authority: "program_requirements",
    claim: "Official 2026-27 Design BS program reference.",
    sourceUrl: "https://bulletin.stanford.edu/programs/DESIGN-BS",
    sourceTitle: "Stanford Bulletin: Design BS",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-ECON-PROGRAM",
    classification: "official",
    authority: "program_requirements",
    claim: "Official 2026-27 Economics BA program reference.",
    sourceUrl: "https://bulletin.stanford.edu/programs/ECON-BA",
    sourceTitle: "Stanford Bulletin: Economics BA",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-HUMBI-PROGRAM",
    classification: "official",
    authority: "program_requirements",
    claim: "Official 2026-27 Human Biology BA program reference.",
    sourceUrl: "https://bulletin.stanford.edu/programs/HUMBI-BA",
    sourceTitle: "Stanford Bulletin: Human Biology BA",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-MGTSC-PROGRAM",
    classification: "official",
    authority: "program_requirements",
    claim: "Official 2026-27 Management Science and Engineering BS program reference.",
    sourceUrl: "https://bulletin.stanford.edu/programs/MGTSC-BS",
    sourceTitle: "Stanford Bulletin: Management Science and Engineering BS",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-BIOE-PROGRAM",
    classification: "official",
    authority: "program_requirements",
    claim: "Official 2026-27 Bioengineering BS program reference.",
    sourceUrl: "https://bulletin.stanford.edu/programs/BIOE-BS",
    sourceTitle: "Stanford Bulletin: Bioengineering BS",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-ACADEMIC-CALENDAR",
    classification: "official",
    authority: "catalog",
    claim: "Official Stanford 2026-27 academic calendar reference.",
    sourceUrl: "https://studentservices.stanford.edu/calendar-events/academic-calendars/stanford-academic-calendar-2026-2027",
    sourceTitle: "Stanford Academic Calendar 2026-27",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-08-01T00:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-DECLARING-MAJOR",
    classification: "official",
    authority: "catalog",
    claim: "Official Stanford Academic Advising guide to exploring and declaring a major.",
    sourceUrl: "https://advising.stanford.edu/current-students/advising-student-handbook/declaring-major",
    sourceTitle: "Stanford Academic Advising: Declaring Your Major",
    retrievedAt: "2026-08-28T12:00:00Z",
    confidence: 1,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-STALE-OFFERING",
    classification: "official",
    authority: "term_schedule",
    claim: "An intentionally stale section record used to test warnings.",
    sourceUrl: "https://explorecourses.stanford.edu/",
    sourceTitle: "Stanford ExploreCourses",
    retrievedAt: "2026-05-01T12:00:00Z",
    expiresAt: "2026-08-01T00:00:00Z",
    confidence: 0.6,
    status: "stale",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-PROFESSOR-NOTE",
    classification: "experiential",
    authority: "experiential",
    claim: "A professor conversation may help clarify research fit.",
    sourceUrl: "https://www.stanford.edu/",
    sourceTitle: "Student note with public reference",
    retrievedAt: "2026-08-25T12:00:00Z",
    confidence: 0.5,
    status: "current",
    addedBy: "human",
    untrustedExternalContent: false
  }
]

export const buildStanfordCatalog = (): Catalog => ({ courses: courses(), sections: sections() })

export const buildStanfordPrograms = (): Program[] => [{
  id: "PROGRAM-CS-BS",
  name: "Computer Science",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/CS-BS",
  summary: "A broad computing program with foundations, systems, theory, applications, and a chosen depth area.",
  requirements: [
    { id: "REQUIREMENT-INTRO", title: "Programming foundation", rule: { id: "RULE-INTRO", type: "course", courseId: "COURSE-CS-106A" }, evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"] },
    { id: "REQUIREMENT-ABSTRACTIONS", title: "Programming abstractions", rule: { id: "RULE-ABSTRACTIONS", type: "course", courseId: "COURSE-CS-106B" }, evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"] },
    { id: "REQUIREMENT-ALGORITHMS", title: "Algorithms", rule: { id: "RULE-ALGORITHMS", type: "course", courseId: "COURSE-CS-161" }, evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"] },
    { id: "REQUIREMENT-ADVISOR", title: "Selected depth", rule: { id: "RULE-ADVISOR", type: "manual_review", reason: "Depth requirements depend on the selected CS track." }, evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"] }
  ]
}, {
  id: "PROGRAM-SYMBO-BS",
  name: "Symbolic Systems",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/SYMBO-BS",
  summary: "An interdisciplinary study of computation, language, cognition, logic, and intelligence.",
  requirements: [{ id: "REQUIREMENT-SYMBO-REVIEW", title: "Core and concentration", rule: { id: "RULE-SYMBO-REVIEW", type: "manual_review", reason: "The selected concentration determines the full requirement map." }, evidenceIds: ["EVIDENCE-SYMBO-PROGRAM"] }]
}, {
  id: "PROGRAM-DATSC-BS",
  name: "Data Science",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/DATSC-BS",
  summary: "An interdisciplinary quantitative program combining computation, statistics, mathematics, and applications.",
  requirements: [{ id: "REQUIREMENT-DATSC-REVIEW", title: "Core and subplan", rule: { id: "RULE-DATSC-REVIEW", type: "manual_review", reason: "Data Science requirements depend on the selected subplan." }, evidenceIds: ["EVIDENCE-DATSC-PROGRAM"] }]
}, {
  id: "PROGRAM-BMC-BS",
  name: "Biomedical Computation",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/16kZ1nSLynUYAQA95BOf",
  summary: "An Engineering path connecting computer science, biology, medicine, and substantial research.",
  requirements: [{ id: "REQUIREMENT-BMC-REVIEW", title: "Foundations, depth, and research", rule: { id: "RULE-BMC-REVIEW", type: "manual_review", reason: "The official Engineering program page defines the current Biomedical Computation requirements." }, evidenceIds: ["EVIDENCE-BMC-PROGRAM"] }]
}, {
  id: "PROGRAM-DESIGN-BS",
  name: "Design",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/DESIGN-BS",
  summary: "A studio-centered program in human-centered design, technology, and creative practice.",
  requirements: [{ id: "REQUIREMENT-DESIGN-REVIEW", title: "Core and concentration", rule: { id: "RULE-DESIGN-REVIEW", type: "manual_review", reason: "The official Design program page defines the current concentration requirements." }, evidenceIds: ["EVIDENCE-DESIGN-PROGRAM"] }]
}, {
  id: "PROGRAM-ECON-BA",
  name: "Economics",
  credential: "BA",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/ECON-BA",
  summary: "Economic theory and empirical tools for analyzing markets, institutions, and public policy.",
  requirements: [{ id: "REQUIREMENT-ECON-REVIEW", title: "Core, field courses, and capstone", rule: { id: "RULE-ECON-REVIEW", type: "manual_review", reason: "Use the official Economics program page for current course and grade rules." }, evidenceIds: ["EVIDENCE-ECON-PROGRAM"] }]
}, {
  id: "PROGRAM-HUMBI-BA",
  name: "Human Biology",
  credential: "BA",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/HUMBI-BA",
  summary: "An individualized interdisciplinary program spanning biological, behavioral, social, and cultural perspectives.",
  requirements: [{ id: "REQUIREMENT-HUMBI-REVIEW", title: "Core and area of concentration", rule: { id: "RULE-HUMBI-REVIEW", type: "manual_review", reason: "Human Biology uses an individualized area of concentration reviewed with program advisors." }, evidenceIds: ["EVIDENCE-HUMBI-PROGRAM"] }]
}, {
  id: "PROGRAM-MGTSC-BS",
  name: "Management Science and Engineering",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/MGTSC-BS",
  summary: "Mathematical modeling, systems analysis, organizations, operations, finance, and technology policy.",
  requirements: [{ id: "REQUIREMENT-MGTSC-REVIEW", title: "Core and application areas", rule: { id: "RULE-MGTSC-REVIEW", type: "manual_review", reason: "The official program page defines the current core and three application areas." }, evidenceIds: ["EVIDENCE-MGTSC-PROGRAM"] }]
}, {
  id: "PROGRAM-BIOE-BS",
  name: "Bioengineering",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/BIOE-BS",
  summary: "Engineering foundations and design applied to living systems, health, medicine, and biological research.",
  requirements: [{ id: "REQUIREMENT-BIOE-REVIEW", title: "Engineering core, depth, and capstone", rule: { id: "RULE-BIOE-REVIEW", type: "manual_review", reason: "Use the official Bioengineering program page and School of Engineering handbook for current rules." }, evidenceIds: ["EVIDENCE-BIOE-PROGRAM"] }]
}]

export const buildFixture = (): Fixture => {
  const catalog = buildStanfordCatalog()
  const workspace: WorkspaceState = {
    id: "WORKSPACE-DEMO",
    ownerUserId: "USER-DEMO",
    version: 1,
    title: "Alex's academic workspace",
    institution: "Stanford University",
    currentTermId: "TERM-2026-AUTUMN",
    profile: {
      id: "PROFILE-DEMO",
      name: "Alex Chen",
      email: "alex@example.edu",
      isFictional: true,
      summary: "CS-first, design-aware planning with room for research and community.",
      catalogYear: "2026-27",
      declaredProgramId: "PROGRAM-CS-BS",
      completedCourseIds: ["COURSE-CS-106A"],
      courseGrades: { "COURSE-CS-106A": "A" },
      residentCourseIds: ["COURSE-CS-106A"],
      preferences: [
        { id: "PREFERENCE-NO-FRIDAY", label: "Keep Fridays open", strength: "hard", value: true },
        { id: "PREFERENCE-DESIGN", label: "Include hands-on design", strength: "soft", value: true },
        { id: "PREFERENCE-RESEARCH", label: "Protect a research block", strength: "soft", value: true }
      ],
      excludedDays: ["fri"],
      earliestStart: "08:30",
      latestEnd: "18:00",
      transitionBufferMinutes: 15
    },
    plans: [{
      id: "PLAN-AUT26",
      title: "Autumn plan",
      termId: "TERM-2026-AUTUMN",
      activeScenarioId: "SCENARIO-PRIMARY",
      scenarios: [{
        id: "SCENARIO-PRIMARY",
        name: "Primary",
        unitLimit: 20,
        courses: [
          { id: "PLANCOURSE-CS-106B", courseId: "COURSE-CS-106B", sectionId: "SECTION-CS-106B-01", units: 5, status: "active" },
          { id: "PLANCOURSE-COMM-1", courseId: "COURSE-COMM-1", sectionId: "SECTION-COMM-1-01", units: 3, status: "active" },
          { id: "PLANCOURSE-DESIGN-60", courseId: "COURSE-DESIGN-60", sectionId: "SECTION-DESIGN-60-01", units: 2, status: "active" },
          { id: "PLANCOURSE-MATH-51", courseId: "COURSE-MATH-51", sectionId: "SECTION-MATH-51-01", units: 4, status: "active" },
          { id: "PLANCOURSE-BACKUP-CS-147", courseId: "COURSE-CS-147", sectionId: "SECTION-CS-147-01", units: 4, status: "backup" }
        ],
        commitments: [{ id: "COMMITMENT-RESEARCH", title: "Research block", meetings: [meeting(["fri"], "13:00", "15:00", "commitment", "Research lab")] }]
      }, {
        id: "SCENARIO-LIGHTER",
        name: "Lighter option",
        unitLimit: 18,
        courses: [
          { id: "PLANCOURSE-LIGHT-CS-106B", courseId: "COURSE-CS-106B", sectionId: "SECTION-CS-106B-01", units: 5, status: "active" },
          { id: "PLANCOURSE-LIGHT-COMM-1", courseId: "COURSE-COMM-1", sectionId: "SECTION-COMM-1-01", units: 3, status: "active" },
          { id: "PLANCOURSE-LIGHT-MATH-51", courseId: "COURSE-MATH-51", sectionId: "SECTION-MATH-51-01", units: 4, status: "active" },
          { id: "PLANCOURSE-LIGHT-DESIGN-60", courseId: "COURSE-DESIGN-60", sectionId: "SECTION-DESIGN-60-01", units: 2, status: "backup" }
        ],
        commitments: [{ id: "COMMITMENT-LIGHT-RESEARCH", title: "Research block", meetings: [meeting(["fri"], "13:00", "15:00", "commitment", "Research lab")] }]
      }]
    }],
    programs: buildStanfordPrograms(),
    collections: [
      ["COLLECTION-INBOX", "Inbox"], ["COLLECTION-COURSES", "Courses"], ["COLLECTION-PROGRAMS", "Programs"],
      ["COLLECTION-PEOPLE", "People"], ["COLLECTION-CLUBS", "Clubs"], ["COLLECTION-RESEARCH", "Research"], ["COLLECTION-DECISIONS", "Decisions"]
    ].map(([id, name]) => ({ id, name, description: `${name} context` })),
    contextItems: [
      {
        id: "NOTE-001",
        type: "person",
        title: "Professor conversation",
        summary: "Ask a professor about research directions that connect HCI and health.",
        content: { text: "Prepare two specific questions before office hours." },
        collectionId: "COLLECTION-PEOPLE",
        sourceEvidenceIds: ["EVIDENCE-PROFESSOR-NOTE"],
        addedBy: { type: "agent", id: "AGENT-DEMO" },
        createdAt: "2026-08-25T12:00:00Z",
        updatedAt: "2026-08-25T12:00:00Z"
      },
      {
        id: "NOTE-002",
        type: "idea",
        title: "Health and HCI project",
        summary: "Explore a small project at the intersection of design and health.",
        content: { text: "Connect this idea to CS 147 and potential research groups." },
        collectionId: "COLLECTION-RESEARCH",
        addedBy: { type: "human", id: "USER-DEMO" },
        createdAt: "2026-08-24T12:00:00Z",
        updatedAt: "2026-08-24T12:00:00Z"
      }
    ],
    evidence: buildStanfordEvidence(),
    uncertainties: [{
      id: "UNCERTAINTY-LIVE-OFFERING",
      title: "Verify a live course offering",
      question: "Is the desired advanced interaction course still offered this term?",
      status: "open",
      relatedIds: ["COURSE-CS-147B"]
    }],
    savedViews: [],
    activity: [],
    receipts: [],
    undoSnapshots: {}
  }
  return structuredClone({ workspace, catalog })
}

export const fixtureHash = (fixture: Fixture): string => {
  const input = JSON.stringify(fixture)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `FIXTURE-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`
}
