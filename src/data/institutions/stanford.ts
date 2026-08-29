import importedCatalog from "@/data/institutions/stanford-catalog.json"
import type { Catalog, Course, Evidence, Meeting, Opportunity, Program, RequirementRule, Section } from "@/domain/types"
import type { InstitutionReference } from "@/data/institutions/types"

// The full 2026-27 catalog is imported from the public ExploreCourses API by
// scripts/import-stanford/import-catalog.mjs. Curated COURSE rows below add
// what the feed lacks, prerequisite structure and planning tags, and win on
// ID collisions. Curated SECTIONS are the opposite: imported meeting times
// are the schedule truth and win on ID collisions, because the sample times
// below drifted from the official schedule.
type ImportedCourse = { c: string, t: string, u?: number | [number, number], w?: string[], o?: string, d?: string, s?: Array<{ n: string, m: Array<{ d: string[], s: string, e: string, l?: string }> }> }
type ImportedPayload = { meta: { source: string, retrievedAt: string, academicYear: string, departments: number, courses: number, note: string }, courses: ImportedCourse[] }

const imported = importedCatalog as ImportedPayload
export const stanfordCatalogMeta = imported.meta

const meeting = (days: Meeting["days"], start: string, end: string, type: Meeting["type"] = "lecture", location = "Main Quad"): Meeting => ({
  days,
  start,
  end,
  timezone: "America/Los_Angeles",
  type,
  location
})

// code, title, subject, level, units, description, tags, prerequisite codes, uncertain prerequisite interpretation
type CourseRow = [string, string, string, number, number, string, string[], string[]?, boolean?]

const courseRows: CourseRow[] = [
  ["CS 106A", "Programming Methodology", "CS", 100, 5, "Problem solving and programming foundations in Python.", ["foundation"]],
  ["CS 106B", "Programming Abstractions", "CS", 100, 5, "Data structures, recursion, and abstraction in C++.", ["foundation", "systems"], ["CS 106A"]],
  ["CS 103", "Mathematical Foundations of Computing", "CS", 100, 5, "Proofs, discrete structures, computability, and complexity.", ["foundation", "theory"], undefined, true],
  ["CS 107", "Computer Organization and Systems", "CS", 100, 5, "How software maps to machines, memory, and the hardware-software interface.", ["systems"], ["CS 106B"]],
  ["CS 109", "Probability for Computer Scientists", "CS", 100, 5, "Probability, counting, and machine learning foundations for computing.", ["theory", "ai"], ["CS 106B", "CS 103"]],
  ["CS 111", "Operating Systems Principles", "CS", 100, 4, "Processes, concurrency, scheduling, virtual memory, and storage.", ["systems"], ["CS 107"]],
  ["CS 124", "From Languages to Information", "CS", 100, 4, "Language, information, and computation across text and social data.", ["language", "ai"]],
  ["CS 129", "Applied Machine Learning", "CS", 100, 4, "Practical machine learning methods for real datasets.", ["ai", "data"], undefined, true],
  ["CS 142", "Web Applications", "CS", 100, 4, "Full stack web application design.", ["web"], ["CS 106B"]],
  ["CS 143", "Compilers", "CS", 100, 4, "Lexing, parsing, semantic analysis, and code generation.", ["systems", "language"], ["CS 107", "CS 103"]],
  ["CS 145", "Data Management and Data Systems", "CS", 100, 4, "Relational databases, query processing, and modern data systems.", ["systems", "data"], ["CS 106B"]],
  ["CS 147", "Introduction to Human-Computer Interaction", "CS", 100, 4, "Human centered design, needfinding, prototyping, and evaluation.", ["design", "hci"]],
  ["CS 147B", "Advanced Interaction Design", "CS", 100, 3, "Studio work in advanced interaction design.", ["design", "hci"], undefined, true],
  ["CS 148", "Introduction to Computer Graphics", "CS", 100, 4, "Rendering, geometry, and visual computing.", ["graphics"], ["CS 107"]],
  ["CS 149", "Parallel Computing", "CS", 100, 4, "Parallel architectures and programming models for performance.", ["systems"], ["CS 111"]],
  ["CS 154", "Introduction to Automata and Complexity Theory", "CS", 100, 4, "Automata, computability, and computational complexity.", ["theory"], ["CS 103"]],
  ["CS 155", "Computer and Network Security", "CS", 100, 3, "Principles and practice of building secure computer systems.", ["systems", "security"], ["CS 111"]],
  ["CS 157", "Computational Logic", "CS", 100, 3, "Formal logic as a tool for representation and reasoning.", ["theory"], ["CS 103"]],
  ["CS 161", "Design and Analysis of Algorithms", "CS", 100, 5, "Algorithm design paradigms and complexity analysis.", ["theory"], ["CS 109", "CS 103"]],
  ["CS 168", "The Modern Algorithmic Toolbox", "CS", 100, 4, "Hashing, sketching, dimensionality reduction, and spectral methods.", ["theory", "data"], ["CS 107", "CS 109"], true],
  ["CS 181", "Computers, Ethics, and Public Policy", "CS", 100, 4, "Social consequences of computing with an emphasis on writing.", ["society", "ethics"]],
  ["CS 191", "Senior Project", "CS", 100, 3, "Independent capstone work supervised by a faculty member.", ["capstone"], undefined, true],
  ["CS 194", "Software Project", "CS", 100, 3, "Team capstone building and shipping a substantial software product.", ["capstone", "product"], ["CS 107"]],
  ["CS 197", "Computer Science Research", "CS", 100, 3, "Research methods and a mentored research project in computing.", ["research"], undefined, true],
  ["CS 205L", "Continuous Mathematical Methods", "CS", 200, 3, "Mathematical tools for modeling, vision, and machine learning.", ["math", "ai"], ["MATH 51"]],
  ["CS 210", "Software Project Experience", "CS", 200, 4, "Team-based software product development with corporate partners.", ["product", "systems"], ["CS 107"]],
  ["CS 221", "Artificial Intelligence: Principles and Techniques", "CS", 200, 4, "Search, planning, MDPs, and machine learning foundations of AI.", ["ai"], ["CS 106B", "CS 109"]],
  ["CS 224N", "Natural Language Processing with Deep Learning", "CS", 200, 4, "Neural methods for language understanding and generation.", ["ai", "language"], undefined, true],
  ["CS 228", "Probabilistic Graphical Models", "CS", 200, 3, "Bayesian networks, inference, and structured probability models.", ["ai", "theory"], ["CS 109"], true],
  ["CS 229", "Machine Learning", "CS", 200, 4, "Statistical and computational learning theory and practice.", ["ai"], ["CS 109", "MATH 51"]],
  ["CS 230", "Deep Learning", "CS", 200, 3, "Foundations and applications of deep neural networks.", ["ai"], ["CS 106B"]],
  ["CS 231N", "Deep Learning for Computer Vision", "CS", 200, 4, "Visual recognition with convolutional and transformer models.", ["ai", "vision"], ["CS 229"], true],
  ["CS 234", "Reinforcement Learning", "CS", 200, 3, "Sequential decision making from experience.", ["ai"], ["CS 229"], true],
  ["CS 238", "Decision Making under Uncertainty", "CS", 200, 4, "Sequential decisions, POMDPs, and uncertainty.", ["ai", "decision"], ["CS 109"]],
  ["CS 246", "Mining Massive Data Sets", "CS", 200, 3, "Algorithms for large-scale data analysis.", ["ai", "data"], ["CS 107", "CS 109"]],
  ["CS 247", "Human-Computer Interaction: Design Studio", "CS", 200, 4, "Advanced studio practice in interaction design.", ["design", "hci"], ["CS 147"]],
  ["CS 251", "Cryptocurrencies and Blockchain Technologies", "CS", 200, 3, "Consensus, smart contracts, and decentralized systems.", ["systems"], ["CS 107"], true],
  ["CS 255", "Introduction to Cryptography", "CS", 200, 3, "Foundations of modern cryptography.", ["theory", "security"], ["CS 109"]],
  ["CS 278", "Social Computing", "CS", 200, 3, "Designing and analyzing systems people use together.", ["hci", "society"], ["CS 147"], true],
  ["CS 999", "Independent Topics Placeholder", "CS", 900, 3, "A catalog record deliberately lacking a current offering.", ["research-gap"]],
  ["MATH 19", "Calculus", "MATH", 1, 3, "Differential calculus of a single variable.", ["math"]],
  ["MATH 20", "Calculus", "MATH", 1, 3, "Integral calculus of a single variable.", ["math"], ["MATH 19"]],
  ["MATH 21", "Calculus", "MATH", 1, 4, "Sequences, series, and an introduction to differential equations.", ["math"], ["MATH 20"]],
  ["MATH 51", "Linear Algebra, Multivariable Calculus, and Modern Applications", "MATH", 50, 5, "Linear algebra and multivariable calculus with applications. Placement depends on calculus background.", ["math"]],
  ["MATH 52", "Integral Calculus of Several Variables", "MATH", 50, 5, "Multiple integrals, vector fields, and the theorems of vector calculus.", ["math"], ["MATH 51"]],
  ["MATH 53", "Differential Equations with Linear Algebra", "MATH", 50, 5, "Ordinary differential equations, Fourier methods, and applications.", ["math"], ["MATH 51"]],
  ["MATH 104", "Applied Matrix Theory", "MATH", 100, 3, "Matrix methods, factorizations, and applications.", ["math"], ["MATH 51"]],
  ["MATH 113", "Linear Algebra and Matrix Theory", "MATH", 100, 3, "A second, proof-based course in linear algebra.", ["math"], ["MATH 51"]],
  ["MATH 115", "Functions of a Real Variable", "MATH", 100, 3, "Rigorous single-variable real analysis.", ["math"], ["MATH 51"]],
  ["STATS 60", "Introduction to Statistical Methods", "STATS", 50, 4, "Data, uncertainty, and statistical reasoning for a broad audience.", ["data", "foundation"]],
  ["STATS 116", "Theory of Probability", "STATS", 100, 4, "Foundations of probability with calculus.", ["math", "data"]],
  ["STATS 200", "Introduction to Statistical Inference", "STATS", 200, 4, "Probability models, estimation, and hypothesis testing.", ["data", "math"], ["STATS 116"]],
  ["STATS 202", "Data Mining and Analysis", "STATS", 200, 3, "Applied methods for finding structure in complex data.", ["data", "ai"]],
  ["STATS 216", "Introduction to Statistical Learning", "STATS", 200, 3, "Supervised and unsupervised learning with applications.", ["data", "ai"], undefined, true],
  ["DATASCI 112", "Principles of Data Science", "DATASCI", 100, 4, "Core ideas in computational and inferential data analysis.", ["data", "foundation"]],
  ["EE 101A", "Circuits I", "EE", 100, 4, "Circuit analysis, node and mesh methods, and first-order systems.", ["hardware"]],
  ["EE 180", "Digital Systems Architecture", "EE", 100, 4, "Processor design, pipelines, and memory hierarchies.", ["hardware", "systems"], ["CS 107"], true],
  ["ENGR 40M", "An Intro to Making: What is EE", "ENGR", 40, 5, "Hands-on introduction to electrical engineering through projects.", ["hardware", "foundation"]],
  ["ENGR 76", "Information Science and Engineering", "ENGR", 70, 3, "Information, compression, and communication for engineers.", ["foundation", "theory"]],
  ["PHYSICS 41", "Mechanics", "PHYSICS", 40, 4, "Mechanics with calculus.", ["science"]],
  ["PHYSICS 43", "Electricity and Magnetism", "PHYSICS", 40, 4, "Electric and magnetic fields, circuits, and waves.", ["science"], ["PHYSICS 41"]],
  ["PHYSICS 45", "Light and Heat", "PHYSICS", 40, 4, "Optics, thermodynamics, and statistical ideas.", ["science"], ["PHYSICS 41"]],
  ["CHEM 31A", "Chemical Principles I", "CHEM", 30, 4, "Atomic structure, bonding, and stoichiometry.", ["science"]],
  ["BIO 41", "Genetics, Biochemistry, and Molecular Biology", "BIO", 40, 5, "Molecular foundations of biology.", ["science"]],
  ["EARTHSYS 10", "Introduction to Earth Systems", "EARTHSYS", 10, 4, "The science of the Earth system and global change.", ["science", "environment"]],
  ["PSYCH 1", "Introduction to Psychology", "PSYCH", 1, 5, "Mind, behavior, and scientific evidence.", ["social-science"]],
  ["PSYCH 30", "Introduction to Perception", "PSYCH", 30, 3, "How sensory systems build our experience of the world.", ["cognition"]],
  ["PSYCH 45", "Introduction to Learning and Memory", "PSYCH", 30, 3, "Mechanisms of learning and remembering.", ["cognition"]],
  ["PSYCH 50", "Introduction to Cognitive Neuroscience", "PSYCH", 50, 4, "Neural systems underlying cognition and behavior.", ["cognition", "health"]],
  ["LINGUIST 1", "Introduction to Linguistics", "LINGUIST", 1, 4, "Sounds, structure, and meaning in human language.", ["language", "cognition"]],
  ["PHIL 80", "Mind, Matter, and Meaning", "PHIL", 80, 4, "Philosophical questions about mind, language, and representation.", ["cognition", "humanities"]],
  ["PHIL 150", "Mathematical Logic", "PHIL", 100, 4, "First-order logic, soundness, and completeness.", ["theory", "humanities"]],
  ["PHIL 151", "Metalogic", "PHIL", 100, 4, "Limitative theorems and the metatheory of formal systems.", ["theory", "humanities"], ["PHIL 150"]],
  ["SYMSYS 1", "Minds and Machines", "SYMSYS", 1, 4, "An interdisciplinary introduction to minds, symbols, and computation.", ["cognition", "ai"]],
  ["ECON 1", "Principles of Economics", "ECON", 1, 5, "Microeconomic and macroeconomic foundations.", ["social-science"]],
  ["ECON 50", "Economic Analysis I", "ECON", 50, 5, "Core microeconomic analysis.", ["economics", "theory"], ["ECON 1"]],
  ["ECON 51", "Economic Analysis II", "ECON", 50, 5, "Continued microeconomic theory with applications.", ["economics", "theory"], ["ECON 50"]],
  ["ECON 102A", "Introduction to Statistical Methods for Economics", "ECON", 100, 5, "Statistical tools for economic analysis.", ["economics", "data"]],
  ["ECON 102B", "Applied Econometrics", "ECON", 100, 5, "Regression and causal inference for economics.", ["economics", "data"], ["ECON 102A"]],
  ["MS&E 120", "Probabilistic Analysis", "MS&E", 100, 4, "Probability models for engineering and management decisions.", ["math", "decision"]],
  ["MS&E 125", "Introduction to Applied Statistics", "MS&E", 100, 4, "Statistical modeling and communication with real data.", ["data", "decision"]],
  ["MS&E 140", "Accounting for Managers and Entrepreneurs", "MS&E", 100, 4, "Financial information for management and entrepreneurship.", ["business", "product"]],
  ["MS&E 193", "Technology and National Security", "MS&E", 100, 3, "Technology, institutions, and security.", ["policy", "ethics"]],
  ["DESIGN 1", "Designing Your Stanford", "DESIGN", 1, 2, "Design methods applied to choices and experiences at Stanford.", ["design", "planning"]],
  ["DESIGN 60", "Design Foundations", "DESIGN", 60, 2, "A compact studio in observation and prototyping.", ["design"]],
  ["DESIGN 161", "Designing Social Impact", "DESIGN", 100, 4, "Human-centered design for social and public challenges.", ["design", "society"]],
  ["ME 101", "Visual Thinking", "ME", 100, 4, "Sketching, ideation, and rapid prototyping for designers.", ["design"]],
  ["COMM 1", "Public Speaking", "COMM", 1, 3, "Speaking, argument, and audience.", ["communication"]],
  ["COMM 166", "Virtual People", "COMM", 100, 4, "How people respond to mediated and virtual social experiences.", ["hci", "society"]],
  ["PWR 1", "Writing and Rhetoric 1", "PWR", 1, 4, "Research based writing and rhetoric.", ["writing"]],
  ["PWR 2", "Writing and Rhetoric 2", "PWR", 1, 4, "Oral, written, and multimedia rhetoric.", ["writing"], ["PWR 1"]],
  ["COLLEGE 101", "Why College? Your Education and the Good Life", "COLLEGE", 1, 3, "The first-year requirement on the purposes of education.", ["humanities", "first-year"]],
  ["COLLEGE 102", "Citizenship in the 21st Century", "COLLEGE", 1, 3, "The first-year requirement on democratic and global citizenship.", ["humanities", "first-year"], ["COLLEGE 101"]],
  ["HISTORY 1", "The Human Past", "HISTORY", 1, 4, "Methods and arguments in history.", ["humanities"]],
  ["ARTSTUDI 160", "Intro to Digital Art", "ARTSTUDI", 100, 4, "Digital tools, visual experimentation, and critical making.", ["art", "design"]],
  ["TAPS 103", "Beginning Improvising", "TAPS", 100, 3, "Ensemble improvisation, presence, and collaboration.", ["art", "performance"]],
  ["HUMBIO 2A", "Genetics, Evolution, and Ecology", "HUMBIO", 1, 5, "Biological foundations within the Human Biology core.", ["health", "biology"]],
  ["HUMBIO 2B", "Culture, Evolution, and Society", "HUMBIO", 1, 5, "Behavioral and social perspectives within the Human Biology core.", ["health", "society"]],
  ["BIOE 101", "Systems Biology", "BIOE", 100, 3, "Quantitative approaches to biological systems.", ["health", "biology"]],
  ["BIOE 141A", "Senior Capstone Design", "BIOE", 100, 4, "Team-based bioengineering design and capstone work.", ["health", "design"]],
  ["BIOMEDIN 215", "Data-Driven Medicine", "BIOMEDIN", 200, 3, "Methods for working with biomedical and clinical data.", ["health", "data", "ai"]]
]

export const stanfordSlug = (code: string) => code.replaceAll(" ", "-").replaceAll("&", "AND")
const courseId = (code: string) => `COURSE-${stanfordSlug(code)}`

const courses = (): Course[] => courseRows.map(([code, title, subject, level, units, description, tags, prerequisites, uncertain]) => ({
  id: courseId(code),
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
  prerequisites: prerequisites?.map(courseId),
  prerequisiteUncertain: uncertain
}))

const section = (
  id: string,
  courseCode: string,
  units: number,
  meetings: Meeting[],
  evidenceIds = ["EVIDENCE-TERM-SCHEDULE"],
  final?: { start: string, end: string }
): Section => ({ id, courseId: courseId(courseCode), termId: "TERM-2026-AUTUMN", sectionNumber: "01", instructor: "See ExploreCourses", units, meetings, evidenceIds, final })

const quick = (courseCode: string, days: Meeting["days"], start: string, end: string, location: string, type: Meeting["type"] = "lecture") => {
  const row = courseRows.find(([code]) => code === courseCode)
  return section(`SECTION-${stanfordSlug(courseCode)}-01`, courseCode, row ? row[4] : 3, [meeting(days, start, end, type, location)])
}

const sections = (): Section[] => [
  section("SECTION-CS-106A-01", "CS 106A", 5, [meeting(["tue", "thu"], "11:30", "12:50", "lecture", "Hewlett 200")]),
  section("SECTION-CS-106B-01", "CS 106B", 5, [meeting(["mon", "wed"], "10:00", "11:20", "lecture", "Hewlett 200")], ["EVIDENCE-TERM-SCHEDULE"], { start: "2026-12-08T09:00:00-08:00", end: "2026-12-08T12:00:00-08:00" }),
  section("SECTION-CS-107-01", "CS 107", 5, [meeting(["tue", "thu"], "15:00", "16:20", "lecture", "Gates B01")]),
  section("SECTION-CS-109-01", "CS 109", 5, [meeting(["mon", "wed", "fri"], "13:30", "14:20", "lecture", "Hewlett 201")]),
  section("SECTION-CS-111-01", "CS 111", 4, [meeting(["tue", "thu"], "13:30", "14:50", "lecture", "Gates B03")]),
  section("SECTION-CS-124-01", "CS 124", 4, [meeting(["mon", "wed"], "15:00", "16:20", "lecture", "Building 380")]),
  section("SECTION-CS-142-01", "CS 142", 4, [meeting(["tue", "thu"], "10:00", "11:20", "lecture", "Gates B12")]),
  section("SECTION-CS-147-01", "CS 147", 4, [meeting(["tue", "thu"], "15:00", "16:20", "lecture", "NVIDIA Auditorium")]),
  section("SECTION-CS-147B-01", "CS 147B", 3, [meeting(["wed"], "15:00", "17:50", "seminar", "d.school")]),
  section("SECTION-CS-148-01", "CS 148", 4, [meeting(["mon", "wed"], "13:30", "14:50", "lecture", "Gates B01")]),
  section("SECTION-CS-161-01", "CS 161", 5, [meeting(["tue", "thu"], "09:00", "10:20", "lecture", "Hewlett 200")]),
  section("SECTION-CS-181-01", "CS 181", 4, [meeting(["mon", "wed"], "11:30", "12:50", "lecture", "Building 420")]),
  section("SECTION-CS-221-01", "CS 221", 4, [meeting(["tue", "thu"], "16:30", "17:50", "lecture", "NVIDIA Auditorium")]),
  section("SECTION-CS-224N-01", "CS 224N", 4, [meeting(["mon", "wed"], "16:30", "17:50", "lecture", "NVIDIA Auditorium")]),
  section("SECTION-CS-229-01", "CS 229", 4, [meeting(["tue", "thu"], "13:30", "14:50", "lecture", "NVIDIA Auditorium")]),
  section("SECTION-CS-231N-01", "CS 231N", 4, [meeting(["mon", "wed"], "14:00", "15:20", "lecture", "Hewlett 200")]),
  section("SECTION-MATH-51-01", "MATH 51", 5, [meeting(["tue", "thu"], "13:30", "14:50", "lecture", "Building 380")]),
  section("SECTION-DESIGN-60-01", "DESIGN 60", 2, [meeting(["wed"], "14:00", "15:20", "seminar", "d.school")]),
  section("SECTION-COMM-1-01", "COMM 1", 3, [meeting(["tue", "thu"], "09:00", "10:20", "lecture", "Building 120")]),
  section("SECTION-PWR-1-01", "PWR 1", 4, [meeting(["mon", "wed"], "11:30", "12:50", "seminar", "Building 460")]),
  quick("CS 103", ["mon", "wed", "fri"], "10:30", "11:20", "Hewlett 201"),
  quick("CS 129", ["mon", "wed"], "09:00", "10:20", "Gates B01"),
  quick("CS 143", ["tue", "thu"], "10:30", "11:50", "Gates B03"),
  quick("CS 145", ["mon", "wed"], "13:30", "14:50", "Gates B12"),
  quick("CS 149", ["tue", "thu"], "14:30", "15:50", "Gates B01"),
  quick("CS 154", ["mon", "wed"], "09:00", "10:20", "Building 380"),
  quick("CS 155", ["mon", "wed"], "16:30", "17:50", "Gates B03"),
  quick("CS 157", ["tue", "thu"], "11:00", "12:20", "Building 460"),
  quick("CS 168", ["mon", "wed"], "11:30", "12:50", "Building 370"),
  quick("CS 194", ["fri"], "13:30", "16:20", "Gates B12", "seminar"),
  quick("CS 205L", ["mon", "wed"], "15:30", "16:50", "Building 380"),
  quick("CS 210", ["tue"], "16:00", "18:50", "Building 550", "seminar"),
  quick("CS 228", ["tue", "thu"], "12:00", "13:20", "Gates B01"),
  quick("CS 230", ["wed"], "15:30", "17:20", "Hewlett 201", "seminar"),
  quick("CS 234", ["mon", "wed"], "13:00", "14:20", "Gates B03"),
  quick("CS 238", ["mon", "wed"], "10:30", "11:50", "Building 540"),
  quick("CS 246", ["tue", "thu"], "15:00", "16:20", "Hewlett 201"),
  quick("CS 247", ["mon", "wed"], "13:30", "15:20", "d.school", "seminar"),
  quick("CS 251", ["tue", "thu"], "14:30", "15:50", "Gates B12"),
  quick("CS 255", ["mon", "wed"], "14:30", "15:50", "Building 370"),
  quick("CS 278", ["tue"], "13:30", "16:20", "Building 160", "seminar"),
  quick("MATH 19", ["mon", "wed", "fri"], "09:30", "10:20", "Building 380"),
  quick("MATH 20", ["mon", "wed", "fri"], "11:30", "12:20", "Building 380"),
  quick("MATH 21", ["mon", "wed", "fri"], "13:30", "14:20", "Building 381"),
  quick("MATH 52", ["mon", "wed", "fri"], "10:30", "11:20", "Building 380"),
  quick("MATH 53", ["mon", "wed", "fri"], "12:30", "13:20", "Building 381"),
  quick("MATH 104", ["tue", "thu"], "09:00", "10:20", "Building 380"),
  quick("MATH 113", ["mon", "wed"], "14:30", "15:50", "Building 381"),
  quick("STATS 60", ["mon", "wed", "fri"], "10:30", "11:20", "Sequoia Hall"),
  quick("STATS 116", ["mon", "wed", "fri"], "11:30", "12:20", "Sequoia Hall"),
  quick("STATS 200", ["tue", "thu"], "10:30", "11:50", "Sequoia Hall"),
  quick("STATS 202", ["mon", "wed"], "15:00", "16:20", "Sequoia Hall"),
  quick("STATS 216", ["tue", "thu"], "13:30", "14:50", "Sequoia Hall"),
  quick("DATASCI 112", ["mon", "wed", "fri"], "09:30", "10:20", "Building 200"),
  quick("EE 101A", ["mon", "wed", "fri"], "13:30", "14:20", "Packard 101"),
  quick("EE 180", ["tue", "thu"], "12:00", "13:20", "Packard 101"),
  quick("ENGR 40M", ["tue", "thu"], "10:30", "11:50", "Huang 305", "lab"),
  quick("ENGR 76", ["mon", "wed"], "12:30", "13:50", "Huang 018"),
  quick("PHYSICS 41", ["mon", "wed", "fri"], "10:30", "11:20", "Hewlett 200"),
  quick("PHYSICS 43", ["mon", "wed", "fri"], "12:30", "13:20", "Hewlett 200"),
  quick("PHYSICS 45", ["tue", "thu"], "09:00", "10:20", "Hewlett 201"),
  quick("CHEM 31A", ["mon", "wed", "fri"], "09:30", "10:20", "Braun Auditorium"),
  quick("BIO 41", ["mon", "wed", "fri"], "11:30", "12:20", "Braun Auditorium"),
  quick("EARTHSYS 10", ["tue", "thu"], "13:30", "14:50", "Y2E2 111"),
  quick("PSYCH 1", ["mon", "wed"], "13:30", "14:50", "Building 420"),
  quick("PSYCH 30", ["tue", "thu"], "10:30", "11:50", "Building 420"),
  quick("PSYCH 45", ["mon", "wed"], "09:00", "10:20", "Building 420"),
  quick("PSYCH 50", ["tue", "thu"], "15:00", "16:20", "Building 420"),
  quick("LINGUIST 1", ["mon", "wed", "fri"], "12:30", "13:20", "Building 460"),
  quick("PHIL 80", ["tue", "thu"], "12:00", "13:20", "Building 90"),
  quick("PHIL 150", ["mon", "wed"], "10:30", "11:50", "Building 90"),
  quick("SYMSYS 1", ["mon", "wed", "fri"], "10:30", "11:20", "Building 200"),
  quick("ECON 1", ["mon", "wed"], "10:30", "11:50", "Building 320"),
  quick("ECON 50", ["mon", "wed", "fri"], "09:30", "10:20", "Building 320"),
  quick("ECON 51", ["mon", "wed", "fri"], "11:30", "12:20", "Building 320"),
  quick("ECON 102A", ["tue", "thu"], "09:00", "10:20", "Building 320"),
  quick("ECON 102B", ["tue", "thu"], "10:30", "11:50", "Building 320"),
  quick("MS&E 120", ["mon", "wed"], "14:00", "15:20", "Huang 018"),
  quick("MS&E 125", ["tue", "thu"], "11:00", "12:20", "Huang 018"),
  quick("MS&E 140", ["mon", "wed"], "08:30", "09:50", "Huang 305"),
  quick("MS&E 193", ["tue", "thu"], "16:30", "17:50", "Huang 018"),
  quick("DESIGN 1", ["thu"], "15:00", "16:50", "d.school", "seminar"),
  quick("DESIGN 161", ["mon", "wed"], "15:30", "17:20", "d.school", "seminar"),
  quick("ME 101", ["tue", "thu"], "13:30", "15:20", "Building 550", "seminar"),
  quick("COMM 166", ["mon", "wed"], "12:00", "13:20", "Building 120"),
  quick("PWR 2", ["tue", "thu"], "10:30", "11:50", "Building 460", "seminar"),
  quick("COLLEGE 101", ["mon", "wed"], "09:00", "10:20", "Building 160", "seminar"),
  quick("COLLEGE 102", ["mon", "wed"], "15:00", "16:20", "Building 160", "seminar"),
  quick("HISTORY 1", ["tue", "thu"], "12:00", "13:20", "Building 200"),
  quick("ARTSTUDI 160", ["tue", "thu"], "14:00", "15:50", "McMurtry", "lab"),
  quick("TAPS 103", ["fri"], "10:00", "12:50", "Memorial Hall", "seminar"),
  quick("HUMBIO 2A", ["mon", "wed", "fri"], "10:00", "10:50", "Building 300"),
  quick("HUMBIO 2B", ["mon", "wed", "fri"], "13:00", "13:50", "Building 300"),
  quick("BIOE 101", ["tue", "thu"], "11:00", "12:20", "Shriram 104"),
  quick("BIOMEDIN 215", ["wed"], "16:00", "18:50", "MSOB", "seminar"),
  section("SECTION-CONFLICTING", "COMM 1", 3, [meeting(["mon"], "13:00", "14:20")]),
  section("SECTION-FINAL-CONFLICT", "COMM 1", 3, [meeting(["tue"], "09:00", "10:20")], ["EVIDENCE-TERM-SCHEDULE"], { start: "2026-12-08T10:00:00-08:00", end: "2026-12-08T13:00:00-08:00" }),
  section("SECTION-FRIDAY", "COMM 1", 3, [meeting(["sat"], "10:00", "11:20")]),
  section("SECTION-EARLY", "COMM 1", 3, [meeting(["tue", "thu"], "07:30", "08:50")]),
  section("SECTION-TIGHT-TRANSITION", "COMM 1", 3, [meeting(["mon"], "13:30", "14:50", "lecture", "Engineering Quad")]),
  section("SECTION-STALE", "COMM 1", 3, [meeting(["tue", "thu"], "09:00", "10:20")], ["EVIDENCE-STALE-OFFERING"])
]

const programEvidence = (id: string, programName: string, url: string): Evidence => ({
  id,
  classification: "official",
  authority: "program_requirements",
  claim: `Official 2026-27 ${programName} program reference.`,
  sourceUrl: url,
  sourceTitle: `Stanford Bulletin: ${programName}`,
  retrievedAt: "2026-08-28T12:00:00Z",
  expiresAt: "2027-07-01T00:00:00Z",
  confidence: 1,
  status: "current",
  addedBy: "system",
  untrustedExternalContent: true
})

export const buildStanfordEvidence = (): Evidence[] => [
  {
    id: "EVIDENCE-TERM-SCHEDULE",
    classification: "derived",
    authority: "term_schedule",
    claim: "Illustrative Autumn 2026 section and meeting data for planning, used only where ExploreCourses publishes no section. Verify live times before enrolling.",
    sourceUrl: "https://explorecourses.stanford.edu/",
    sourceTitle: "Stanford ExploreCourses",
    retrievedAt: "2026-08-20T12:00:00Z",
    expiresAt: "2026-10-01T00:00:00Z",
    confidence: 0.6,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-PROGRAM-REQUIREMENTS",
    classification: "official",
    authority: "program_requirements",
    claim: "Requirement structure grounded in the official Computer Science BS program page. Track details and catalog-year rules must be confirmed on the official source.",
    sourceUrl: "https://bulletin.stanford.edu/programs/CS-BS",
    sourceTitle: "Stanford Bulletin: Computer Science BS",
    retrievedAt: "2026-08-20T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 0.9,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-WAYS",
    classification: "official",
    authority: "program_requirements",
    claim: "WAYS course counts follow the official requirement, and the course groups use the WAY designations in the imported 2026-27 ExploreCourses catalog.",
    sourceUrl: "https://advising.stanford.edu/current-students/advising-student-handbook/ways-thinking-ways-doing",
    sourceTitle: "Stanford Academic Advising: Ways of Thinking, Ways of Doing",
    retrievedAt: "2026-08-28T12:00:00Z",
    expiresAt: "2027-07-01T00:00:00Z",
    confidence: 0.95,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  {
    id: "EVIDENCE-EXPLORECOURSES-IMPORT",
    classification: "official",
    authority: "term_schedule",
    claim: `The 2026-27 catalog and Autumn meeting times were imported from the public ExploreCourses listing. Confirm live sections before enrolling.`,
    sourceUrl: "https://explorecourses.stanford.edu/",
    sourceTitle: "Stanford ExploreCourses",
    retrievedAt: stanfordCatalogMeta.retrievedAt,
    expiresAt: "2026-12-15T00:00:00Z",
    confidence: 0.95,
    status: "current",
    addedBy: "system",
    untrustedExternalContent: true
  },
  programEvidence("EVIDENCE-SYMBO-PROGRAM", "Symbolic Systems BS", "https://bulletin.stanford.edu/programs/SYMBO-BS"),
  programEvidence("EVIDENCE-DATSC-PROGRAM", "Data Science BS", "https://bulletin.stanford.edu/programs/DATSC-BS"),
  programEvidence("EVIDENCE-BMC-PROGRAM", "Biomedical Computation BS", "https://bulletin.stanford.edu/programs/16kZ1nSLynUYAQA95BOf"),
  programEvidence("EVIDENCE-DESIGN-PROGRAM", "Design BS", "https://bulletin.stanford.edu/programs/DESIGN-BS"),
  programEvidence("EVIDENCE-ECON-PROGRAM", "Economics BA", "https://bulletin.stanford.edu/programs/ECON-BA"),
  programEvidence("EVIDENCE-HUMBI-PROGRAM", "Human Biology BA", "https://bulletin.stanford.edu/programs/HUMBI-BA"),
  programEvidence("EVIDENCE-MGTSC-PROGRAM", "Management Science and Engineering BS", "https://bulletin.stanford.edu/programs/MGTSC-BS"),
  programEvidence("EVIDENCE-BIOE-PROGRAM", "Bioengineering BS", "https://bulletin.stanford.edu/programs/BIOE-BS"),
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

const levelFromCode = (code: string) => {
  const numberPart = code.split(" ").slice(1).join(" ")
  const digits = /\d+/.exec(numberPart)?.[0]
  return digits ? Number(digits) : 0
}

const importedWaysByCode = new Map(imported.courses.filter((row) => row.w?.length).map((row) => [row.c, row.w as string[]]))

const importedCourses = (curatedCodes: Set<string>): Course[] => imported.courses
  .filter((row) => !curatedCodes.has(row.c))
  .map((row) => {
    const units = row.u === undefined ? [3, 3] : typeof row.u === "number" ? [row.u, row.u] : row.u
    return {
      id: courseId(row.c),
      code: row.c,
      title: row.t,
      description: row.d ?? "",
      subject: row.c.split(" ")[0],
      level: levelFromCode(row.c),
      minUnits: units[0],
      maxUnits: units[1],
      tags: [],
      ways: row.w,
      offeredSeasons: row.o,
      sourceUrl: "https://explorecourses.stanford.edu/",
      catalogYear: "2026-27"
    }
  })

const importedSections = (): Section[] => {
  const result: Section[] = []
  for (const row of imported.courses) {
    if (!row.s?.length) continue
    const id = courseId(row.c)
    const units = row.u === undefined ? 3 : typeof row.u === "number" ? row.u : row.u[1]
    for (const section of row.s) {
      result.push({
        id: `SECTION-${stanfordSlug(row.c)}-${section.n}`,
        courseId: id,
        termId: "TERM-2026-AUTUMN",
        sectionNumber: section.n,
        instructor: "See ExploreCourses",
        units,
        meetings: section.m.map((meeting) => ({ days: meeting.d as Meeting["days"], start: meeting.s, end: meeting.e, timezone: "America/Los_Angeles", type: "lecture" as const, location: meeting.l })),
        evidenceIds: ["EVIDENCE-EXPLORECOURSES-IMPORT"]
      })
    }
  }
  return result
}

let catalogCache: Catalog | null = null

export const buildStanfordCatalog = (): Catalog => {
  if (catalogCache) return catalogCache
  const curated = courses().map((course) => ({ ...course, ways: course.ways ?? importedWaysByCode.get(course.code) }))
  const curatedCodes = new Set(curated.map((course) => course.code))
  const curatedSections = sections()
  // Imported ExploreCourses sections are the schedule truth. The curated
  // list predates the import and its sample times drifted from the official
  // schedule, so on an ID collision the imported section wins. Curated
  // sections with unique IDs survive: the deterministic-check demos and the
  // courses the import carries no sections for. Curated final-exam blocks
  // graft onto their imported twins, which the import does not know about.
  const importedList = importedSections()
  const importedIds = new Set(importedList.map((section) => section.id))
  const curatedFinals = new Map(curatedSections.filter((section) => section.final).map((section) => [section.id, section.final!]))
  for (const section of importedList) {
    const final = curatedFinals.get(section.id)
    if (final && !section.final) section.final = final
  }
  catalogCache = {
    courses: [...curated, ...importedCourses(curatedCodes)],
    sections: [...importedList, ...curatedSections.filter((section) => !importedIds.has(section.id))]
  }
  return catalogCache
}

const ids = (...codes: string[]) => codes.map(courseId)
const course = (code: string, id?: string): RequirementRule => ({ id: id ?? `RULE-${stanfordSlug(code)}`, type: "course", courseId: courseId(code) })
const group = (id: string, count: number, ...codes: string[]): RequirementRule => ({ id, type: "course_group", count, courseIds: ids(...codes) })

// WAYS groups come from the official WAY designations in the imported
// ExploreCourses feed. Each group carries a sample of designated courses, low
// numbered and described first, because the complete lists run to hundreds.
const waysDefinitions: Array<[string, string, number]> = [
  ["A-II", "Aesthetic and Interpretive Inquiry", 2],
  ["AQR", "Applied Quantitative Reasoning", 1],
  ["CE", "Creative Expression", 2],
  ["EDP", "Exploring Difference and Power", 1],
  ["ER", "Ethical Reasoning", 1],
  ["FR", "Formal Reasoning", 1],
  ["SI", "Social Inquiry", 2],
  ["SMA", "Scientific Method and Analysis", 2]
]

const waysCourseIds = (code: string): string[] => imported.courses
  .filter((row) => row.w?.includes(code))
  .sort((a, b) => (Number(Boolean(b.d)) - Number(Boolean(a.d))) || (levelFromCode(a.c) - levelFromCode(b.c)) || a.c.localeCompare(b.c))
  .slice(0, 40)
  .map((row) => courseId(row.c))

const manualProgram = (id: string, name: string, credential: string, sourceUrl: string, summary: string, requirementTitle: string, reason: string, evidenceId: string): Program => ({
  id,
  name,
  credential,
  catalogYear: "2026-27",
  sourceUrl,
  summary,
  requirements: [{ id: `REQUIREMENT-${id.replace("PROGRAM-", "")}-REVIEW`, title: requirementTitle, rule: { id: `RULE-${id.replace("PROGRAM-", "")}-REVIEW`, type: "manual_review", reason }, evidenceIds: [evidenceId] }]
})

export const buildStanfordPrograms = (): Program[] => [{
  id: "PROGRAM-CS-BS",
  name: "Computer Science",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/CS-BS",
  summary: "A broad computing program with mathematical foundations, core systems, theory, and a chosen depth track.",
  requirements: [
    { id: "REQUIREMENT-INTRO", title: "Programming foundation", rule: { id: "RULE-INTRO", type: "course", courseId: courseId("CS 106A") }, evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"] },
    { id: "REQUIREMENT-ABSTRACTIONS", title: "Programming abstractions", rule: { id: "RULE-ABSTRACTIONS", type: "course", courseId: courseId("CS 106B") }, evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"] },
    {
      id: "REQUIREMENT-MATH-CORE",
      title: "Mathematics core",
      rule: { id: "RULE-MATH-CORE", type: "all_of", rules: [course("MATH 51"), course("CS 103"), course("CS 109")] },
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    },
    {
      id: "REQUIREMENT-MATH-ELECTIVES",
      title: "Mathematics electives, choose two",
      rule: group("RULE-MATH-ELECTIVES", 2, "MATH 52", "MATH 53", "MATH 104", "MATH 113", "MATH 115", "STATS 116", "CS 205L"),
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    },
    {
      id: "REQUIREMENT-SCIENCE",
      title: "Science, eleven units",
      rule: { id: "RULE-SCIENCE", type: "all_of", rules: [course("PHYSICS 41"), course("PHYSICS 43"), { id: "RULE-SCIENCE-ELECTIVE", type: "minimum_units", units: 3, courseIds: ids("PHYSICS 45", "CHEM 31A", "BIO 41", "EARTHSYS 10", "PSYCH 30") } ] },
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    },
    {
      id: "REQUIREMENT-ENGR-FUNDAMENTALS",
      title: "Engineering fundamentals, choose one",
      rule: group("RULE-ENGR-FUNDAMENTALS", 1, "ENGR 40M", "ENGR 76", "EE 101A"),
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    },
    {
      id: "REQUIREMENT-TIS",
      title: "Technology in society, choose one",
      rule: group("RULE-TIS", 1, "CS 181", "MS&E 193", "COMM 166"),
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    },
    {
      id: "REQUIREMENT-SYSTEMS-CORE",
      title: "Systems core",
      rule: { id: "RULE-SYSTEMS-CORE", type: "all_of", rules: [course("CS 107"), course("CS 111")] },
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    },
    { id: "REQUIREMENT-ALGORITHMS", title: "Algorithms", rule: { id: "RULE-ALGORITHMS", type: "course", courseId: courseId("CS 161") }, evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"] },
    {
      id: "REQUIREMENT-DEPTH-AI-SAMPLE",
      title: "Depth sample, Artificial Intelligence track",
      rule: { id: "RULE-DEPTH-AI", type: "all_of", rules: [course("CS 221"), group("RULE-DEPTH-AI-ELECTIVES", 2, "CS 224N", "CS 228", "CS 229", "CS 231N", "CS 234", "CS 238", "CS 246")] },
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    },
    {
      id: "REQUIREMENT-CAPSTONE",
      title: "Senior capstone, choose one",
      rule: group("RULE-CAPSTONE", 1, "CS 191", "CS 194", "CS 210"),
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    },
    {
      id: "REQUIREMENT-DEPTH-TRACK",
      title: "Declared depth track",
      rule: { id: "RULE-DEPTH-TRACK", type: "manual_review", reason: "The AI depth shown above is one sample. Systems, theory, HCI, graphics, information, biocomputation, and unspecialized tracks each define their own course lists on the official program page." },
      evidenceIds: ["EVIDENCE-PROGRAM-REQUIREMENTS"]
    }
  ]
}, {
  id: "PROGRAM-WAYS-GER",
  name: "General Education, WAYS",
  credential: "Undergraduate requirement",
  catalogYear: "2026-27",
  sourceUrl: "https://advising.stanford.edu/current-students/advising-student-handbook/ways-thinking-ways-doing",
  summary: "Every Stanford undergraduate completes eleven WAYS courses across eight ways of thinking and doing, alongside writing and first-year requirements.",
  requirements: [
    ...waysDefinitions.map(([code, title, count]): Program["requirements"][number] => ({
      id: `REQUIREMENT-WAYS-${code.replaceAll("-", "")}`,
      title: `${title}, ${count === 1 ? "one course" : "two courses"}`,
      rule: { id: `RULE-WAYS-${code.replaceAll("-", "")}`, type: "course_group", count, courseIds: waysCourseIds(code) },
      evidenceIds: ["EVIDENCE-WAYS"]
    })),
    {
      id: "REQUIREMENT-WAYS-VERIFY",
      title: "The complete WAYS lists live on ExploreCourses",
      rule: { id: "RULE-WAYS-VERIFY", type: "manual_review", reason: "Each group above shows a sample of officially designated courses from the imported catalog. Hundreds more carry each designation." },
      evidenceIds: ["EVIDENCE-WAYS"]
    }
  ]
}, {
  id: "PROGRAM-SYMBO-BS",
  name: "Symbolic Systems",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/SYMBO-BS",
  summary: "An interdisciplinary study of computation, language, cognition, logic, and intelligence.",
  requirements: [
    { id: "REQUIREMENT-SYMBO-GATEWAY", title: "Gateway", rule: course("SYMSYS 1", "RULE-SYMBO-GATEWAY"), evidenceIds: ["EVIDENCE-SYMBO-PROGRAM"] },
    { id: "REQUIREMENT-SYMBO-PROGRAMMING", title: "Programming", rule: course("CS 106B", "RULE-SYMBO-PROGRAMMING"), evidenceIds: ["EVIDENCE-SYMBO-PROGRAM"] },
    { id: "REQUIREMENT-SYMBO-FORMAL", title: "Formal foundations, choose one", rule: { id: "RULE-SYMBO-FORMAL", type: "any_of", rules: [course("CS 103"), course("PHIL 150")] }, evidenceIds: ["EVIDENCE-SYMBO-PROGRAM"] },
    { id: "REQUIREMENT-SYMBO-PROBABILITY", title: "Probability, choose one", rule: { id: "RULE-SYMBO-PROBABILITY", type: "any_of", rules: [course("CS 109"), course("STATS 116")] }, evidenceIds: ["EVIDENCE-SYMBO-PROGRAM"] },
    { id: "REQUIREMENT-SYMBO-BREADTH", title: "Cognitive and linguistic breadth, choose two", rule: group("RULE-SYMBO-BREADTH", 2, "LINGUIST 1", "PHIL 80", "PSYCH 30", "PSYCH 45", "PSYCH 50"), evidenceIds: ["EVIDENCE-SYMBO-PROGRAM"] },
    { id: "REQUIREMENT-SYMBO-CONCENTRATION", title: "Concentration", rule: { id: "RULE-SYMBO-CONCENTRATION", type: "manual_review", reason: "The selected concentration determines the remaining requirement map on the official program page." }, evidenceIds: ["EVIDENCE-SYMBO-PROGRAM"] }
  ]
}, {
  id: "PROGRAM-DATSC-BS",
  name: "Data Science",
  credential: "BS",
  catalogYear: "2026-27",
  sourceUrl: "https://bulletin.stanford.edu/programs/DATSC-BS",
  summary: "An interdisciplinary quantitative program combining computation, statistics, mathematics, and applications.",
  requirements: [
    { id: "REQUIREMENT-DATSC-FOUNDATION", title: "Foundations", rule: { id: "RULE-DATSC-FOUNDATION", type: "all_of", rules: [course("DATASCI 112"), course("MATH 51"), course("CS 106B")] }, evidenceIds: ["EVIDENCE-DATSC-PROGRAM"] },
    { id: "REQUIREMENT-DATSC-PROBABILITY", title: "Probability and inference, choose one", rule: { id: "RULE-DATSC-PROBABILITY", type: "any_of", rules: [course("STATS 116"), course("CS 109"), course("MS&E 120")] }, evidenceIds: ["EVIDENCE-DATSC-PROGRAM"] },
    { id: "REQUIREMENT-DATSC-METHODS", title: "Statistical methods, choose two", rule: group("RULE-DATSC-METHODS", 2, "STATS 200", "STATS 202", "STATS 216", "CS 229", "CS 246", "ECON 102B"), evidenceIds: ["EVIDENCE-DATSC-PROGRAM"] },
    { id: "REQUIREMENT-DATSC-SUBPLAN", title: "Subplan and capstone", rule: { id: "RULE-DATSC-SUBPLAN", type: "manual_review", reason: "Data Science subplans and the capstone sequence are defined on the official program page." }, evidenceIds: ["EVIDENCE-DATSC-PROGRAM"] }
  ]
},
manualProgram("PROGRAM-BMC-BS", "Biomedical Computation", "BS", "https://bulletin.stanford.edu/programs/16kZ1nSLynUYAQA95BOf", "An Engineering path connecting computer science, biology, medicine, and substantial research.", "Foundations, depth, and research", "The official Engineering program page defines the current Biomedical Computation requirements.", "EVIDENCE-BMC-PROGRAM"),
manualProgram("PROGRAM-DESIGN-BS", "Design", "BS", "https://bulletin.stanford.edu/programs/DESIGN-BS", "A studio-centered program in human-centered design, technology, and creative practice.", "Core and concentration", "The official Design program page defines the current concentration requirements.", "EVIDENCE-DESIGN-PROGRAM"),
manualProgram("PROGRAM-ECON-BA", "Economics", "BA", "https://bulletin.stanford.edu/programs/ECON-BA", "Economic theory and empirical tools for analyzing markets, institutions, and public policy.", "Core, field courses, and capstone", "Use the official Economics program page for current course and grade rules.", "EVIDENCE-ECON-PROGRAM"),
manualProgram("PROGRAM-HUMBI-BA", "Human Biology", "BA", "https://bulletin.stanford.edu/programs/HUMBI-BA", "An individualized interdisciplinary program spanning biological, behavioral, social, and cultural perspectives.", "Core and area of concentration", "Human Biology uses an individualized area of concentration reviewed with program advisors.", "EVIDENCE-HUMBI-PROGRAM"),
manualProgram("PROGRAM-MGTSC-BS", "Management Science and Engineering", "BS", "https://bulletin.stanford.edu/programs/MGTSC-BS", "Mathematical modeling, systems analysis, organizations, operations, finance, and technology policy.", "Core and application areas", "The official program page defines the current core and three application areas.", "EVIDENCE-MGTSC-PROGRAM"),
manualProgram("PROGRAM-BIOE-BS", "Bioengineering", "BS", "https://bulletin.stanford.edu/programs/BIOE-BS", "Engineering foundations and design applied to living systems, health, medicine, and biological research.", "Engineering core, depth, and capstone", "Use the official Bioengineering program page and School of Engineering handbook for current rules.", "EVIDENCE-BIOE-PROGRAM")
]

// A starting directory of well known clubs, research programs, and campus
// programs. Entries carry official links where they are stable. Coverage is a
// sample of a much larger landscape, and workspace additions extend it.
const opportunityRows: Array<[Opportunity["kind"], string, string, string | undefined, string[], string?, string?]> = [
  ["research", "CURIS", "The CS department's undergraduate research program. Paid summer research with a faculty group, plus part time quarters.", "https://curis.stanford.edu/", ["cs", "research", "summer"], "Full time in summer", "Applications open winter quarter"],
  ["research", "Bio-X Undergraduate Summer Research", "Funded interdisciplinary bioscience research across labs in medicine, engineering, and biology.", "https://biox.stanford.edu/", ["bio", "health", "research", "summer"], "Full time in summer", "Applications due late winter"],
  ["research", "UAR Student Grants", "Undergraduate Advising and Research grants that fund independent research and conference travel in any field.", "https://undergradresearch.stanford.edu/", ["research", "funding"], "Project based", "Multiple deadlines each year"],
  ["program", "CS198 Section Leading", "Teach CS 106 sections after taking CS 106B. A paid teaching community that many CS students consider formative.", "https://cs198.stanford.edu/", ["cs", "teaching"], "Around 10 hours a week", "Applications each quarter"],
  ["program", "Structured Liberal Education", "A residential humanities program for first years combining writing, philosophy, and the arts.", "https://sle.stanford.edu/", ["humanities", "residential", "first-year"], "Replaces PWR 1 and fulfills requirements", "Chosen before autumn of frosh year"],
  ["program", "d.school classes and fellowships", "Design courses, pop up experiences, and fellowships at the Hasso Plattner Institute of Design.", "https://dschool.stanford.edu/", ["design"], "Varies by program"],
  ["club", "BASES", "The large student entrepreneurship organization. Speaker events, startup challenges, and a builder community.", "https://bases.stanford.edu/", ["startups", "community"], "Flexible", "Recruits early autumn"],
  ["club", "TreeHacks", "Stanford's flagship intercollegiate hackathon, organized by students each winter.", "https://www.treehacks.com/", ["cs", "hackathon"], "One weekend, or join the organizing team", "Event in February"],
  ["club", "The Stanford Daily", "The independent student newspaper. Reporting, data, design, and photography desks.", "https://stanforddaily.com/", ["writing", "journalism"], "A few hours a week", "Open joins all year"],
  ["club", "Stanford Solar Car Project", "A student team that designs, builds, and races a solar vehicle across Australia.", "https://solarcar.stanford.edu/", ["engineering", "hardware"], "Serious build commitment", "Recruits autumn"],
  ["club", "CS + Social Good", "Students building technology with nonprofits and social ventures through studios, fellowships, and classes.", undefined, ["cs", "impact"], "Project based", "Recruits autumn and spring"],
  ["club", "Stanford Women in Computer Science", "Community, mentorship, and industry events supporting women and gender minorities in computing.", undefined, ["cs", "community"], "Flexible"],
  ["club", "Stanford Robotics Club", "Hands on robotics projects across mechanical, electrical, and software subteams.", undefined, ["engineering", "robotics"], "Project based"],
  ["club", "Stanford Pre-Medical Association", "Advising panels, mentorship, and community for students exploring medicine.", undefined, ["health", "community"], "Flexible"]
]

export const buildStanfordOpportunities = (): Opportunity[] => opportunityRows.map(([kind, name, summary, url, tags, commitment, timing]) => ({
  id: `OPPORTUNITY-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  kind,
  name,
  summary,
  url,
  tags,
  commitment,
  timing,
  sourceUrl: url ?? "https://studentaffairs.stanford.edu/"
}))

export const stanfordInstitution: InstitutionReference = {
  id: "INSTITUTION-STANFORD",
  slug: "stanford",
  name: "Stanford University",
  shortName: "Stanford",
  timezone: "America/Los_Angeles",
  termSystem: "quarter",
  status: "full",
  coverageNote: "Includes a broad sample of the 2026-27 catalog, structured requirement maps for Computer Science, Symbolic Systems, Data Science, and WAYS, and manual-review references for five more programs. Meeting times are planning samples to verify on ExploreCourses.",
  currentTermId: "TERM-2026-AUTUMN",
  terms: [
    { id: "TERM-2026-AUTUMN", name: "Autumn 2026", startsOn: "2026-09-21", endsOn: "2026-12-11" },
    { id: "TERM-2027-WINTER", name: "Winter 2027", startsOn: "2027-01-04", endsOn: "2027-03-19" },
    { id: "TERM-2027-SPRING", name: "Spring 2027", startsOn: "2027-03-29", endsOn: "2027-06-09" }
  ],
  buildCatalog: buildStanfordCatalog,
  buildPrograms: buildStanfordPrograms,
  buildEvidence: buildStanfordEvidence,
  buildOpportunities: buildStanfordOpportunities,
  resources: [
    { id: "RESOURCE-BULLETIN", title: "Stanford Bulletin", url: "https://bulletin.stanford.edu/", note: "The official catalog of programs, requirements, and policies.", kind: "official" },
    { id: "RESOURCE-EXPLORECOURSES", title: "ExploreCourses", url: "https://explorecourses.stanford.edu/", note: "The official course and section listing with live meeting times.", kind: "official" },
    { id: "RESOURCE-CALENDAR", title: "Academic Calendar 2026-27", url: "https://studentservices.stanford.edu/calendar-events/academic-calendars/stanford-academic-calendar-2026-2027", note: "Official quarter dates and deadlines.", kind: "official" },
    { id: "RESOURCE-ADVISING", title: "Academic Advising", url: "https://advising.stanford.edu/", note: "Official advising guidance, WAYS, and declaring a major.", kind: "official" },
    { id: "RESOURCE-CARTA", title: "Carta", url: "https://carta-beta.stanford.edu/", note: "Stanford-internal planning tool with historical evaluations. Requires a SUNet login, which CourseContext never asks for.", kind: "community" },
    { id: "RESOURCE-ONCOURSE", title: "OnCourse", url: "https://oncourse.college/", note: "A student-built degree planning tool. Useful for exploration, not an official audit.", kind: "community" }
  ]
}
